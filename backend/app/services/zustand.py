"""
Condition and depreciation helpers.
"""

from datetime import date

from sqlalchemy.orm import Session

from app.models import Einstellungen


def berechne_bucket_preis(
    basispreis_cents: int,
    nutzungsjahr: int,
    abschlaege: dict[int, int],
    schutzgebuehr_cents: int | None,
) -> int:
    """Returns the pure inventory bucket price for a given NJ — no surcharge included.

    This is what gets stored in BuchZustandBestand.verkaufspreis_cents.
    The Rückgabe-Aufschlag is always added at point of sale, never here.
    """
    fee = max(0, int(schutzgebuehr_cents or 0))
    if nutzungsjahr >= 6:
        return max(0, fee)
    if nutzungsjahr <= 0:
        return max(0, basispreis_cents)
    abschreibung = abschlaege.get(nutzungsjahr, 0)
    return berechne_wiederverkaufspreis(basispreis_cents, abschreibung)


def berechne_wiederverkaufspreis(preis_cents: int, abschreibung_prozent: int) -> int:
    abschreibung_prozent = max(0, min(100, int(abschreibung_prozent)))
    neuer_preis = round(preis_cents * (100 - abschreibung_prozent) / 100)
    return max(0, int(neuer_preis))


# ── Nutzungsjahr-basierte Abschläge ───────────────────────────────────────────

NUTZUNGSJAHR_ABSCHLAG_KEYS = {
    1: "nutzungsjahr_abschlag_1_prozent",
    2: "nutzungsjahr_abschlag_2_prozent",
    3: "nutzungsjahr_abschlag_3_prozent",
    4: "nutzungsjahr_abschlag_4_prozent",
    5: "nutzungsjahr_abschlag_5_prozent",
}
DEFAULT_NUTZUNGSJAHR_ABSCHLAEGE = {1: 0, 2: 10, 3: 20, 4: 30, 5: 40}


def _schuljahr_start(d: date) -> int:
    """Returns the start year of the school year a date falls in (Aug 1 cutoff)."""
    return d.year if d.month >= 8 else d.year - 1


def current_schuljahr_start() -> int:
    """Returns the start year of the current school year."""
    return _schuljahr_start(date.today())


def effective_nutzungsjahr(stored_nj: int, schuljahr_eingestellt: int | None) -> int:
    """Returns the effective (display) Nutzungsjahr, advancing by one per school year elapsed.

    NJ=0 (Neu) never ages — new books stay new until sold.
    If schuljahr_eingestellt is None, the stored value is returned unchanged.
    """
    if stored_nj <= 0 or schuljahr_eingestellt is None:
        return stored_nj
    diff = _schuljahr_start(date.today()) - schuljahr_eingestellt
    return min(6, stored_nj + max(0, diff))


def calc_nutzungsjahr(kaufdatum_str: str) -> int:
    """Returns usage year based on school years elapsed since purchase (Aug 1 cutoff)."""
    try:
        kauf = date.fromisoformat(kaufdatum_str[:10])
    except (ValueError, TypeError):
        return 1
    diff = _schuljahr_start(date.today()) - _schuljahr_start(kauf)
    return min(6, max(1, diff + 1))


def get_nutzungsjahr_abschlaege(db: Session) -> dict[int, int]:
    rows = db.query(Einstellungen).filter(
        Einstellungen.schluessel.in_(NUTZUNGSJAHR_ABSCHLAG_KEYS.values())
    ).all()
    values = DEFAULT_NUTZUNGSJAHR_ABSCHLAEGE.copy()
    setting_map = {row.schluessel: row.wert for row in rows}
    for jahr, key in NUTZUNGSJAHR_ABSCHLAG_KEYS.items():
        if key in setting_map:
            try:
                values[jahr] = max(0, min(100, int(setting_map[key])))
            except (TypeError, ValueError):
                pass
    return values


def _infer_purchase_nj(
    preis_cents: int,
    basispreis_cents: int,
    abschlaege: dict[int, int],
    fee: int,
) -> int:
    """Infers the Nutzungsjahr at which a book was purchased (0=Neu, 1-5=Jahr, 6=Schutzgebühr)."""
    if preis_cents == basispreis_cents:
        return 0
    if fee > 0 and preis_cents == fee:
        return 6
    for j in range(1, 6):
        expected = berechne_wiederverkaufspreis(basispreis_cents, abschlaege.get(j, 0))
        if abs(preis_cents - expected) <= 1:
            return j
    return 0


def schuljahr_to_start_year(schuljahr: str) -> int:
    """Extracts the start year from a school year string, e.g. '2025/2026' → 2025."""
    try:
        return int(str(schuljahr).split('/')[0])
    except (ValueError, IndexError):
        return 0


def berechne_gutschrift_nutzungsjahr(
    preis_cents: int,
    rechnung_schuljahr: str,
    aktuelles_schuljahr: str,
    abschlaege: dict[int, int],
    schutzgebuehr_cents: int | None,
    basispreis_cents: int | None = None,
    nutzungsjahr_beim_kauf: int | None = None,
) -> tuple[int, int, int]:
    """Returns (betrag_cents, nutzungsjahr, abschreibung_prozent).

    NJ steigt um die Anzahl der Schuljahre, die seit der Ausgabe vergangen sind.
    Beispiel: Ausgabe 2025/2026 (NJ=1), Rückgabe in 2027/2028 → NJ=3.
    """
    basis = basispreis_cents if basispreis_cents is not None else preis_cents
    fee = max(0, int(schutzgebuehr_cents or 0))

    schuljahr_diff = max(
        0,
        schuljahr_to_start_year(aktuelles_schuljahr) - schuljahr_to_start_year(rechnung_schuljahr),
    )

    if nutzungsjahr_beim_kauf is not None:
        display_nj = max(0, nutzungsjahr_beim_kauf)
    else:
        purchase_nj = _infer_purchase_nj(preis_cents, basis, abschlaege, fee)
        display_nj = max(1, purchase_nj)

    nutzungsjahr = min(6, display_nj + schuljahr_diff)

    if nutzungsjahr >= 6:
        betrag = max(0, fee)
        abschreibung = (
            max(0, min(100, 100 - round(betrag * 100 / basis)))
            if basis > 0 else 100
        )
        return betrag, nutzungsjahr, abschreibung

    abschreibung_prozent = abschlaege.get(nutzungsjahr, 0)
    betrag = berechne_wiederverkaufspreis(basis, abschreibung_prozent)
    return betrag, nutzungsjahr, abschreibung_prozent
