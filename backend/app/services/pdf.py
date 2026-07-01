"""
PDF generation service - HTML to PDF via WeasyPrint, templates via Jinja2.
"""

import base64
import os
import sys
from pathlib import Path
from jinja2 import Environment, FileSystemLoader
from sqlalchemy import text
from sqlalchemy.orm import Session

_TEMPLATE_DIR = Path(__file__).resolve().parent.parent / "templates"
_jinja_env = Environment(
    loader=FileSystemLoader(str(_TEMPLATE_DIR)),
    autoescape=True,
)


def _prepare_weasyprint_runtime() -> None:
    """Ensure native library lookup works for WeasyPrint on macOS/Homebrew."""
    if sys.platform != "darwin":
        return

    candidates = ["/opt/homebrew/lib", "/opt/homebrew/opt/libffi/lib", "/usr/lib"]
    existing = os.environ.get("DYLD_FALLBACK_LIBRARY_PATH", "")
    parts = [p for p in existing.split(":") if p] if existing else []

    for path in candidates:
        if path not in parts and Path(path).exists():
            parts.append(path)

    if parts:
        os.environ["DYLD_FALLBACK_LIBRARY_PATH"] = ":".join(parts)


def _cents_to_eur(cents: int) -> str:
    """Format integer cents as German-locale EUR string: '24,00 EUR'."""
    eur = cents / 100
    return f"{eur:,.2f} EUR".replace(",", "X").replace(".", ",").replace("X", ".")


def _zustand_to_label(zustand: str) -> str:
    """Convert internal state keys like 'sehr_gut' into display labels."""
    labels = {
        "sehr_gut": "Sehr Gut",
        "gut": "Gut",
        "mangelhaft": "Mangelhaft",
        "beschaedigt": "Nicht zurueckgenommen",
    }
    if not zustand:
        return ""
    return labels.get(zustand, zustand.replace("_", " ").title())


_jinja_env.filters["eur"] = _cents_to_eur
_jinja_env.filters["zustand_label"] = _zustand_to_label


def _load_logo_base64() -> tuple[str, str]:
    """Returns (base64_data, mime_type) or ('', '')."""
    for filename, mime in [("logo.png", "image/png"), ("logo.jpg", "image/jpeg"), ("logo.jpeg", "image/jpeg")]:
        p = _TEMPLATE_DIR / filename
        if p.exists():
            with open(p, "rb") as f:
                return base64.b64encode(f.read()).decode("utf-8"), mime
    return "", ""


def _get_abschlaege_from_settings(settings: dict) -> dict:
    return {
        1: max(0, int(settings.get("nutzungsjahr_abschlag_1_prozent") or 0)),
        2: max(0, int(settings.get("nutzungsjahr_abschlag_2_prozent") or 10)),
        3: max(0, int(settings.get("nutzungsjahr_abschlag_3_prozent") or 20)),
        4: max(0, int(settings.get("nutzungsjahr_abschlag_4_prozent") or 30)),
        5: max(0, int(settings.get("nutzungsjahr_abschlag_5_prozent") or 40)),
    }


def _infer_nutzungsjahr_label(
    preis_cents: int,
    basispreis_cents: int,
    schutzgebuehr_cents: int,
    abschlaege: dict,
    aufschlag_prozent: int = 0,
) -> str:
    fee = max(0, int(schutzgebuehr_cents or 0))
    basis = int(basispreis_cents or 0)
    # Try matching against the raw price first, then against the derived bucket price
    # (preis without surcharge: bucket = round(preis / (1 + p/100))).
    candidates = [preis_cents]
    if aufschlag_prozent > 0:
        candidates.append(round(preis_cents / (1 + aufschlag_prozent / 100)))

    for effective in candidates:
        if fee > 0 and effective == fee:
            return "Nutzungsjahr +6"
        for jahr in range(1, 6):
            abschlag = abschlaege.get(jahr, 0)
            expected = max(0, round(basis * (100 - abschlag) / 100))
            if effective == expected:
                return f"Nutzungsjahr {jahr}"
        if effective >= basis:
            return "Neu"

    effective_fallback = round(preis_cents / (1 + aufschlag_prozent / 100)) if aufschlag_prozent > 0 else preis_cents
    best_j = min(
        range(1, 6),
        key=lambda j: abs(effective_fallback - max(0, round(basis * (100 - abschlaege.get(j, 0)) / 100))),
    )
    return f"Nutzungsjahr {best_j}"


def _infer_nutzungsjahr_label_from_abschreibung(abschreibung_prozent: int, abschlaege: dict) -> str:
    if abschreibung_prozent == 0:
        return "Neu"
    for jahr, abschlag in abschlaege.items():
        if abschlag == abschreibung_prozent:
            return f"Nutzungsjahr {jahr}"
    return f"{abschreibung_prozent}% Abschr."


def _nutzungsjahr_label(nutzungsjahr: int | None, abschreibung_prozent: int, abschlaege: dict) -> str:
    """Nutzungsjahr direkt aus gespeichertem Wert ableiten; Fallback auf Abschlag-Inferenz."""
    if nutzungsjahr is None:
        return _infer_nutzungsjahr_label_from_abschreibung(abschreibung_prozent, abschlaege)
    if nutzungsjahr == 0:
        return "Neu"
    if nutzungsjahr >= 6:
        return "Nutzungsjahr +6"
    return f"Nutzungsjahr {nutzungsjahr}"


def _load_einstellungen(db: Session) -> dict:
    """Load all settings as a flat dict."""
    rows = db.execute(text("SELECT schluessel, wert FROM einstellungen")).fetchall()
    return {r.schluessel: r.wert for r in rows}


# Rechnung

def _load_rechnung_data(db: Session, rechnung_id: str) -> dict:
    """Load full invoice data for rendering."""
    r = db.execute(
        text(
            """
            SELECT r.*, s.vorname, s.nachname, s.klasse,
                   s.strasse, s.plz, s.ort
            FROM rechnungen r
            JOIN schueler s ON s.id = r.schueler_id
            WHERE r.id = :rid
            """
        ),
        {"rid": rechnung_id},
    ).first()

    if not r:
        return None

    buch_posten = db.execute(
        text(
            """
            SELECT rp.id, rp.buch_id, b.titel, b.fach, b.verlag, rp.preis_cents, rp.zustand,
                   rp.nutzungsjahr_beim_kauf,
                   b.preis_cents AS buch_basispreis_cents,
                   COALESCE(b.schutzgebuehr_cents, 0) AS schutzgebuehr_cents
            FROM rechnungs_posten rp
            JOIN buecher b ON b.id = rp.buch_id
            WHERE rp.rechnung_id = :rid
            ORDER BY rp.id
            """
        ),
        {"rid": rechnung_id},
    ).fetchall()

    lm_posten = db.execute(
        text(
            """
            SELECT lp.id, lp.lernmaterial_id, m.name AS titel, m.kategorie AS fach,
                   lp.preis_cents, COALESCE(lp.menge, 1) AS menge
            FROM lernmaterial_posten lp
            JOIN lernmaterial m ON m.id = lp.lernmaterial_id
            WHERE lp.rechnung_id = :rid
            ORDER BY lp.id
            """
        ),
        {"rid": rechnung_id},
    ).fetchall()

    frei_posten = db.execute(
        text(
            """
            SELECT id, bezeichnung, betrag_cents, typ
            FROM rechnung_freiposten
            WHERE rechnung_id = :rid
            ORDER BY id
            """
        ),
        {"rid": rechnung_id},
    ).fetchall()

    verrechnung_posten = db.execute(
        text(
            """
            SELECT rv.quelle_typ, rv.betrag_cents, b.titel,
                   COALESCE(b.verlag, '') AS verlag,
                   COALESCE(b.isbn, '') AS isbn,
                   COALESCE(gp.ursprungs_preis_cents, 0) AS ursprungs_preis_cents,
                   COALESCE(gp.abschreibung_prozent, 0) AS abschreibung_prozent
            FROM rechnung_verrechnungen rv
            LEFT JOIN gutschrift_posten gp ON gp.id = rv.gutschrift_posten_id
            LEFT JOIN rechnungs_posten rp ON rp.id = gp.rechnungs_posten_id
            LEFT JOIN buecher b ON b.id = rp.buch_id
            WHERE rv.rechnung_id = :rid
            ORDER BY rv.id
            """
        ),
        {"rid": rechnung_id},
    ).fetchall()

    settings = _load_einstellungen(db)
    abschlaege = _get_abschlaege_from_settings(settings)
    aufschlag_prozent = max(0, int(settings.get("rueckgabe_aufschlag_prozent") or 0))
    logo_data, logo_mime = _load_logo_base64()

    # Separate Postenlisten aufbauen
    buch_posten_list = []
    for i, p in enumerate(buch_posten):
        nutzungsjahr_label = _nutzungsjahr_label(
            p.nutzungsjahr_beim_kauf,
            0,
            abschlaege,
        ) if p.nutzungsjahr_beim_kauf is not None else _infer_nutzungsjahr_label(
            p.preis_cents,
            p.buch_basispreis_cents,
            p.schutzgebuehr_cents,
            abschlaege,
            aufschlag_prozent,
        )
        buch_posten_list.append({
            "nr": i + 1,
            "menge": 1,
            "buch_id": p.buch_id,
            "titel": p.titel,
            "fach": p.fach,
            "verlag": p.verlag,
            "preis_cents": p.preis_cents,
            "buch_basispreis_cents": p.buch_basispreis_cents,
            "nutzungsjahr_label": nutzungsjahr_label,
            "ist_neu": nutzungsjahr_label == "Neu",
        })

    lm_posten_list = []
    for i, p in enumerate(lm_posten):
        lm_posten_list.append({
            "nr": i + 1,
            "menge": p.menge,
            "titel": p.titel,
            "kategorie": p.fach,
            "preis_cents": p.preis_cents * p.menge,
        })

    frei_posten_list = []
    for i, p in enumerate(frei_posten):
        frei_posten_list.append({
            "nr": i + 1,
            "menge": None,
            "titel": p.bezeichnung,
            "typ": p.typ,
            "preis_cents": p.betrag_cents,
        })

    # Backward-compat merged list
    neue_posten = []
    for p in buch_posten:
        neue_posten.append({
            "buch_id": p.buch_id,
            "titel": p.titel,
            "fach": p.fach,
            "verlag": p.verlag,
            "preis_cents": p.preis_cents,
            "typ_label": _zustand_to_label(p.zustand),
        })
    for p in lm_posten:
        neue_posten.append({
            "buch_id": None,
            "titel": f"{p.menge}× {p.titel}" if p.menge > 1 else p.titel,
            "fach": p.fach,
            "verlag": "",
            "preis_cents": p.preis_cents * p.menge,
            "typ_label": "Neu",
        })
    for p in frei_posten:
        neue_posten.append({
            "buch_id": None,
            "titel": p.bezeichnung,
            "fach": "",
            "verlag": "",
            "preis_cents": p.betrag_cents,
            "typ_label": p.typ,
        })

    verrechnete_posten = []
    rueckgaben_posten = []
    rueck_nr = 1
    for p in verrechnung_posten:
        verrechnete_posten.append({
            "titel": p.titel or "Sonstiges Guthaben",
            "quelle_label": "Rückgabe" if p.quelle_typ == "rueckgabe" else "Guthaben",
            "betrag_cents": p.betrag_cents,
        })
        if p.quelle_typ == "rueckgabe" and p.titel and p.betrag_cents > 0:
            rueckgaben_posten.append({
                "nr": rueck_nr,
                "menge": 1,
                "titel": p.titel,
                "verlag": p.verlag,
                "isbn": p.isbn,
                "ursprungs_preis_cents": p.ursprungs_preis_cents,
                "abschreibung_prozent": p.abschreibung_prozent,
                "betrag_cents": p.betrag_cents,
                "nutzungsjahr_label": _infer_nutzungsjahr_label_from_abschreibung(
                    p.abschreibung_prozent, abschlaege
                ),
            })
            rueck_nr += 1

    gutschrift_rueckgabe_cents = sum(
        p.betrag_cents for p in verrechnung_posten if p.quelle_typ == "rueckgabe"
    )
    gutschrift_sonstiges_cents = sum(
        p.betrag_cents for p in verrechnung_posten if p.quelle_typ != "rueckgabe"
    )

    summe_buecher_cents = sum(p["preis_cents"] for p in buch_posten_list)
    summe_lm_frei_cents = (
        sum(p["preis_cents"] for p in lm_posten_list)
        + sum(p["preis_cents"] for p in frei_posten_list)
    )

    return {
        "rechnung": {
            "id": r.id,
            "datum": r.datum,
            "schuljahr": r.schuljahr,
            "summe_cents": r.summe_cents,
            "summe_buecher_cents": summe_buecher_cents,
            "summe_lm_frei_cents": summe_lm_frei_cents,
            "verrechnet_cents": r.verrechnet_cents,
            "gutschrift_rueckgabe_cents": gutschrift_rueckgabe_cents,
            "gutschrift_sonstiges_cents": gutschrift_sonstiges_cents,
            "zu_zahlen_cents": r.summe_cents - r.verrechnet_cents,
            "status": r.status,
            "notizen": r.notizen,
        },
        "schueler": {
            "id": r.schueler_id,
            "vorname": r.vorname,
            "nachname": r.nachname,
            "klasse": r.klasse,
            "strasse": r.strasse,
            "plz": r.plz,
            "ort": r.ort,
        },
        "buch_posten": buch_posten_list,
        "lm_posten": lm_posten_list,
        "frei_posten": frei_posten_list,
        "neue_posten": [{"nr": i + 1, **p} for i, p in enumerate(neue_posten)],
        "verrechnete_posten": [{"nr": i + 1, **p} for i, p in enumerate(verrechnete_posten)],
        "rueckgaben_posten": rueckgaben_posten,
        "posten": [{"nr": i + 1, **p} for i, p in enumerate(neue_posten)],
        "logo_base64": logo_data,
        "logo_mime": logo_mime,
        "schule": settings,
    }


def render_rechnung_html(db: Session, rechnung_id: str) -> str | None:
    """Render invoice as HTML string."""
    data = _load_rechnung_data(db, rechnung_id)
    if not data:
        return None
    template = _jinja_env.get_template("rechnung.html")
    return template.render(**data)


def render_rechnung_pdf(db: Session, rechnung_id: str) -> bytes | None:
    """Render invoice as PDF bytes."""
    html = render_rechnung_html(db, rechnung_id)
    if not html:
        return None
    try:
        _prepare_weasyprint_runtime()
        from weasyprint import HTML

        return HTML(string=html).write_pdf()
    except (ImportError, OSError):
        return None


# Gutschrift

def _load_gutschrift_data(db: Session, gutschrift_id: str) -> dict:
    """Load full credit note data for rendering."""
    g = db.execute(
        text(
            """
            SELECT g.*, s.vorname, s.nachname, s.klasse,
                   s.strasse, s.plz, s.ort
            FROM gutschriften g
            JOIN schueler s ON s.id = g.schueler_id
            WHERE g.id = :gid
            """
        ),
        {"gid": gutschrift_id},
    ).first()

    if not g:
        return None

    posten = db.execute(
        text(
            """
            SELECT gp.rechnungs_posten_id, gp.betrag_cents, gp.zustand,
                   gp.abschreibung_prozent, gp.ursprungs_preis_cents,
                   gp.nutzungsjahr,
                   COALESCE(gp.beschaedigt, 0) AS beschaedigt,
                   rp.buch_id, b.titel, b.fach,
                   COALESCE(b.verlag, '') AS verlag,
                   COALESCE(b.isbn, '') AS isbn
            FROM gutschrift_posten gp
            JOIN rechnungs_posten rp ON rp.id = gp.rechnungs_posten_id
            JOIN buecher b ON b.id = rp.buch_id
            WHERE gp.gutschrift_id = :gid
            ORDER BY gp.id
            """
        ),
        {"gid": gutschrift_id},
    ).fetchall()

    settings = _load_einstellungen(db)
    abschlaege = _get_abschlaege_from_settings(settings)
    logo_data, logo_mime = _load_logo_base64()

    return {
        "gutschrift": {
            "id": g.id,
            "datum": g.datum,
            "schuljahr": g.schuljahr,
            "summe_cents": g.summe_cents,
            "ausgezahlt": bool(g.ausgezahlt),
            "notizen": g.notizen,
        },
        "schueler": {
            "id": g.schueler_id,
            "vorname": g.vorname,
            "nachname": g.nachname,
            "klasse": g.klasse,
            "strasse": g.strasse,
            "plz": g.plz,
            "ort": g.ort,
        },
        "posten": [
            {
                "nr": i + 1,
                "menge": 1,
                "rechnungs_posten_id": p.rechnungs_posten_id,
                "buch_id": p.buch_id,
                "titel": p.titel,
                "fach": p.fach,
                "verlag": p.verlag,
                "isbn": p.isbn,
                "betrag_cents": p.betrag_cents,
                "zustand": p.zustand,
                "abschreibung_prozent": p.abschreibung_prozent,
                "ursprungs_preis_cents": p.ursprungs_preis_cents,
                "nutzungsjahr_label": _nutzungsjahr_label(
                    p.nutzungsjahr, p.abschreibung_prozent, abschlaege
                ),
                "beschaedigt": bool(p.beschaedigt),
            }
            for i, p in enumerate(posten)
        ],
        "logo_base64": logo_data,
        "logo_mime": logo_mime,
        "schule": settings,
    }


def render_gutschrift_html(db: Session, gutschrift_id: str) -> str | None:
    """Render credit note as HTML string."""
    data = _load_gutschrift_data(db, gutschrift_id)
    if not data:
        return None
    template = _jinja_env.get_template("gutschrift.html")
    return template.render(**data)


def render_gutschrift_pdf(db: Session, gutschrift_id: str) -> bytes | None:
    """Render credit note as PDF bytes."""
    html = render_gutschrift_html(db, gutschrift_id)
    if not html:
        return None
    try:
        _prepare_weasyprint_runtime()
        from weasyprint import HTML

        return HTML(string=html).write_pdf()
    except (ImportError, OSError):
        return None


# Auszahlung

def _load_auszahlung_data(db: Session, auszahlung_id: int) -> dict | None:
    a = db.execute(
        text(
            """
            SELECT a.*, s.vorname, s.nachname, s.klasse, s.strasse, s.plz, s.ort
            FROM auszahlungen a
            JOIN schueler s ON s.id = a.schueler_id
            WHERE a.id = :aid
            """
        ),
        {"aid": auszahlung_id},
    ).first()

    if not a:
        return None

    settings = _load_einstellungen(db)
    logo_data, logo_mime = _load_logo_base64()

    return {
        "auszahlung": {
            "id": a.id,
            "datum": a.datum,
            "betrag_cents": a.betrag_cents,
            "notizen": a.notizen,
        },
        "schueler": {
            "id": a.schueler_id,
            "vorname": a.vorname,
            "nachname": a.nachname,
            "klasse": a.klasse,
            "strasse": a.strasse,
            "plz": a.plz,
            "ort": a.ort,
        },
        "logo_base64": logo_data,
        "logo_mime": logo_mime,
        "schule": settings,
    }


def render_auszahlung_html(db: Session, auszahlung_id: int) -> str | None:
    data = _load_auszahlung_data(db, auszahlung_id)
    if not data:
        return None
    template = _jinja_env.get_template("auszahlung.html")
    return template.render(**data)


def render_auszahlung_pdf(db: Session, auszahlung_id: int) -> bytes | None:
    html = render_auszahlung_html(db, auszahlung_id)
    if not html:
        return None
    try:
        _prepare_weasyprint_runtime()
        from weasyprint import HTML

        return HTML(string=html).write_pdf()
    except (ImportError, OSError):
        return None
