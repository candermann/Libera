"""
Buecher CRUD endpoints.
"""

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import BuchFach, BuchZustandBestand, Buecher
from app.schemas import (
    BuchCreate,
    BuchListResponse,
    BuchResponse,
    BuchUpdate,
    BuchZustandUpdate,
    BuchZustandResponse,
    NameCreateRequest,
    NameListResponse,
    NutzungsjahrBestand,
    RenameRequest,
)

from app.services.ids import generate_buch_id
from app.services.zustand import (
    berechne_bucket_preis,
    berechne_wiederverkaufspreis,
    current_schuljahr_start,
    effective_nutzungsjahr,
    get_nutzungsjahr_abschlaege,
)

router = APIRouter(prefix="/api/buecher", tags=["Buecher"])


_CSV_REQUIRED_FIELDS = ("titel", "fach", "stufe", "preis_cents")
_CSV_HEADER_ALIASES = {
    "titel": {"titel", "title", "buch", "buchtitle", "buchtitel"},
    "untertitel": {"untertitel", "subtitle", "subtitel"},
    "isbn": {"isbn", "isbn13", "isbn10"},
    "fach": {"fach", "subject", "kategorie"},
    "stufe": {"stufe", "klasse", "jahrgang", "class"},
    "verlag": {"verlag", "publisher"},
    "preis_cents": {"preis", "preiscent", "preiscents", "preis_cents", "betrag", "basispreis"},
    "bestand_gesamt": {"bestand", "bestandgesamt", "bestand_gesamt", "anzahl", "menge"},
    "nutzungsjahr": {
        "nutzungsjahr",
        "nutzungs_jahr",
        "nutzungsjahre",
        "jahr",
        "usageyear",
        "usage_year",
    },
    "nutzungsjahr_1": {"nutzungsjahr1", "nutzungsjahre1", "jahr1", "usageyear1", "usage_year_1"},
    "nutzungsjahr_2": {"nutzungsjahr2", "nutzungsjahre2", "jahr2", "usageyear2", "usage_year_2"},
    "nutzungsjahr_3": {"nutzungsjahr3", "nutzungsjahre3", "jahr3", "usageyear3", "usage_year_3"},
    "nutzungsjahr_4": {"nutzungsjahr4", "nutzungsjahre4", "jahr4", "usageyear4", "usage_year_4"},
    "nutzungsjahr_5": {"nutzungsjahr5", "nutzungsjahre5", "jahr5", "usageyear5", "usage_year_5"},
    "nutzungsjahr_6": {
        "nutzungsjahr6",
        "nutzungsjahr6plus",
        "nutzungsjahre6",
        "nutzungsjahre6plus",
        "jahr6",
        "jahr6plus",
        "usageyear6",
        "usageyear6plus",
        "usage_year_6",
    },
    "schutzgebuehr_cents": {
        "schutzgebuehr",
        "schutzgebuhr",
        "schutzgebuehrcents",
        "schutzgebuehr_cents",
        "gebuehr",
        "gebuhr",
    },
    "nj_1": {"nj1", "nj_1", "nutzungsjahr1", "nutzungsjahr_1"},
    "nj_2": {"nj2", "nj_2", "nutzungsjahr2", "nutzungsjahr_2"},
    "nj_3": {"nj3", "nj_3", "nutzungsjahr3", "nutzungsjahr_3"},
    "nj_4": {"nj4", "nj_4", "nutzungsjahr4", "nutzungsjahr_4"},
    "nj_5": {"nj5", "nj_5", "nutzungsjahr5", "nutzungsjahr_5"},
    "nj_6": {"nj6", "nj_6", "nutzungsjahr6", "nutzungsjahr_6"},
}


def _normalize_header_key(value: str) -> str:
    normalized = (value or "").strip().lower()
    replacements = {
        "\u00e4": "ae",
        "\u00f6": "oe",
        "\u00fc": "ue",
        "\u00df": "ss",
        " ": "",
        "-": "",
        "_": "",
        ".": "",
    }
    for src, dest in replacements.items():
        normalized = normalized.replace(src, dest)
    return normalized


def _map_csv_header(header: str | None) -> str | None:
    normalized = _normalize_header_key(header or "")
    for canonical, aliases in _CSV_HEADER_ALIASES.items():
        if normalized in aliases:
            return canonical
    return None


def _clean_text(value: str | None) -> str | None:
    text_value = (value or "").strip()
    return text_value or None


def _parse_int(value: str | None, default: int | None = None) -> int | None:
    text_value = (value or "").strip()
    if not text_value:
        return default
    try:
        return int(float(text_value.replace(",", ".")))
    except ValueError:
        return None


def _parse_money_cents(value: str | None) -> int | None:
    text_value = (value or "").strip()
    if not text_value:
        return None

    cleaned = (
        text_value.replace("\u20ac", "")
        .replace("EUR", "")
        .replace("eur", "")
        .replace(" ", "")
        .strip()
    )

    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")

    try:
        amount = float(cleaned)
    except ValueError:
        return None

    if "." not in cleaned and "," not in text_value and amount >= 1000:
        return int(amount)
    return int(round(amount * 100))


def _load_zustaende(db: Session, buch_id: str) -> list:
    rows = db.execute(
        text(
            """
            SELECT id, buch_id, zustand, nutzungsjahr, verkaufspreis_cents,
                   bestand_verfuegbar, schuljahr_eingestellt
            FROM buch_zustand_bestand
            WHERE buch_id = :buch_id
            """
        ),
        {"buch_id": buch_id},
    ).fetchall()
    return rows


def _buch_to_response(
    b: Buecher, zustaende_rows: list, abschlaege: dict[int, int]
) -> BuchResponse:
    """Builds BuchResponse, merging buckets by effective Nutzungsjahr and recomputing prices."""
    merged: dict[tuple[str, int], dict] = {}
    for row in zustaende_rows:
        stored_nj = row.nutzungsjahr if row.nutzungsjahr is not None else 0
        eff_nj = effective_nutzungsjahr(stored_nj, row.schuljahr_eingestellt)
        if row.zustand != "sehr_gut":
            eff_preis = max(0, row.verkaufspreis_cents)
        else:
            eff_preis = berechne_bucket_preis(
                b.preis_cents, eff_nj, abschlaege, b.schutzgebuehr_cents
            )
        avail = max(0, row.bestand_verfuegbar)
        key = (row.zustand, eff_nj)
        if key in merged:
            merged[key]["bestand_verfuegbar"] += avail
        else:
            merged[key] = {
                "bestand_id": row.id,
                "zustand": row.zustand,
                "nutzungsjahr": eff_nj,
                "preis_cents": eff_preis,
                "bestand_verfuegbar": avail,
            }

    zustaende = sorted(
        [
            BuchZustandResponse(
                bestand_id=v["bestand_id"],
                zustand=v["zustand"],
                nutzungsjahr=v["nutzungsjahr"],
                preis_cents=v["preis_cents"],
                bestand_verfuegbar=v["bestand_verfuegbar"],
            )
            for v in merged.values()
        ],
        key=lambda r: (r.nutzungsjahr, r.preis_cents),
    )

    bestand_frei = sum(v["bestand_verfuegbar"] for v in merged.values())

    return BuchResponse(
        id=b.id,
        titel=b.titel,
        untertitel=b.untertitel,
        isbn=b.isbn,
        fach=b.fach,
        stufe=b.stufe,
        verlag=b.verlag,
        preis_cents=b.preis_cents,
        gutschrift_cents=b.gutschrift_cents,
        bestand_gesamt=b.bestand_gesamt,
        bestand_ausgegeben=b.bestand_ausgegeben,
        bestand_frei=bestand_frei,
        schutzgebuehr_cents=b.schutzgebuehr_cents or 0,
        zustaende=zustaende,
    )


def _ensure_fach_exists(db: Session, fach: str | None):
    fach_name = (fach or "").strip()
    if not fach_name:
        return
    if not db.query(BuchFach).filter(BuchFach.name == fach_name).first():
        db.add(BuchFach(name=fach_name))
        db.flush()


def _get_or_create_bestand(
    db: Session, buch_id: str, preis_cents: int, nutzungsjahr: int = 0
) -> BuchZustandBestand:
    bestand = (
        db.query(BuchZustandBestand)
        .filter(
            BuchZustandBestand.buch_id == buch_id,
            BuchZustandBestand.zustand == "sehr_gut",
            BuchZustandBestand.nutzungsjahr == nutzungsjahr,
        )
        .first()
    )
    if bestand:
        return bestand

    bestand = BuchZustandBestand(
        buch_id=buch_id,
        zustand="sehr_gut",
        verkaufspreis_cents=preis_cents,
        bestand_verfuegbar=0,
        nutzungsjahr=nutzungsjahr,
        schuljahr_eingestellt=current_schuljahr_start() if nutzungsjahr > 0 else None,
    )
    db.add(bestand)
    db.flush()
    return bestand


def _infer_nutzungsjahr_from_preis(
    preis_cents: int,
    basispreis_cents: int,
    abschlaege: dict[int, int],
    schutzgebuehr_cents: int,
) -> int | None:
    """Ermittelt das Nutzungsjahr aus dem gespeicherten Rückgabebetrag (ohne Aufschlag).

    Rückgabe: 0 = Neu, 1–5 = Jahr, 6 = Schutzgebühr, None = nicht zuzuordnen
    """
    fee = max(0, int(schutzgebuehr_cents or 0))

    if fee > 0 and preis_cents == fee:
        return 6

    for jahr in range(1, 6):
        expected = berechne_wiederverkaufspreis(basispreis_cents, abschlaege.get(jahr, 0))
        if preis_cents == expected:
            return jahr

    if preis_cents == basispreis_cents:
        return 0  # "Neu"

    # Kein exakter Treffer — nächstgelegenes Nutzungsjahr (±1 Cent Toleranz für Rundung).
    expected_prices = [
        (j, berechne_wiederverkaufspreis(basispreis_cents, abschlaege.get(j, 0)))
        for j in range(1, 6)
    ]
    nearest_jahr, nearest_preis = min(expected_prices, key=lambda item: abs(preis_cents - item[1]))
    if abs(preis_cents - nearest_preis) <= 1:
        return nearest_jahr
    return None


def _reprice_bestand_buckets(
    db: Session,
    buch_id: str,
    old_basispreis_cents: int,
    new_basispreis_cents: int,
    old_schutzgebuehr_cents: int,
    new_schutzgebuehr_cents: int,
    abschlaege: dict[int, int],
):
    """Passt alle Bucket-Preise an, wenn sich der Basispreis oder die Schutzgebühr ändert.

    Bucket-Preise enthalten keinen Aufschlag — der wird erst beim Verkauf addiert.
    """
    rows = (
        db.query(BuchZustandBestand)
        .filter(BuchZustandBestand.buch_id == buch_id)
        .all()
    )

    cur_sj = current_schuljahr_start()
    # effective_nj → (bestand_verfuegbar, target_price)
    aggregated: dict[int, tuple[int, int]] = {}
    for row in rows:
        stored_nj = row.nutzungsjahr
        if stored_nj is None:
            stored_nj = _infer_nutzungsjahr_from_preis(
                preis_cents=row.verkaufspreis_cents,
                basispreis_cents=old_basispreis_cents,
                abschlaege=abschlaege,
                schutzgebuehr_cents=old_schutzgebuehr_cents,
            )

        eff_nj = effective_nutzungsjahr(
            stored_nj if stored_nj is not None else 0,
            row.schuljahr_eingestellt,
        )

        if stored_nj is None:
            target_price = row.verkaufspreis_cents
        elif eff_nj == 0:
            target_price = new_basispreis_cents
        elif eff_nj >= 6:
            target_price = max(0, int(new_schutzgebuehr_cents or 0))
        else:
            target_price = berechne_wiederverkaufspreis(
                new_basispreis_cents,
                abschlaege.get(eff_nj, 0),
            )

        nj_key = eff_nj if stored_nj is not None else -1
        prev_bestand, _ = aggregated.get(nj_key, (0, int(target_price)))
        aggregated[nj_key] = (prev_bestand + max(0, row.bestand_verfuegbar), int(target_price))

    for row in rows:
        db.delete(row)
    db.flush()

    for nj_key, (bestand_verfuegbar, target_price) in aggregated.items():
        if bestand_verfuegbar <= 0:
            continue
        db.add(
            BuchZustandBestand(
                buch_id=buch_id,
                zustand="sehr_gut",
                verkaufspreis_cents=target_price,
                bestand_verfuegbar=bestand_verfuegbar,
                nutzungsjahr=nj_key if nj_key >= 0 else None,
                schuljahr_eingestellt=cur_sj if nj_key > 0 else None,
            )
        )
    db.flush()


def _replace_bestand_buckets(
    db: Session,
    buch_id: str,
    zustaende: list[BuchZustandUpdate],
    basispreis_cents: int,
    schutzgebuehr_cents: int,
    abschlaege: dict[int, int],
    unbekannt_bestand: int = 0,
) -> int:
    cur_sj = current_schuljahr_start()
    aggregated: dict[tuple[str, int], int] = {}
    for item in zustaende:
        zustand = (item.zustand or "sehr_gut").strip() or "sehr_gut"
        nutzungsjahr = max(0, min(6, int(item.nutzungsjahr)))
        bestand = max(0, int(item.bestand_verfuegbar))
        if bestand <= 0:
            continue
        key = (zustand, nutzungsjahr)
        aggregated[key] = aggregated.get(key, 0) + bestand

    if unbekannt_bestand > 0:
        aggregated[("unbekannt", 0)] = aggregated.get(("unbekannt", 0), 0) + unbekannt_bestand

    rows = (
        db.query(BuchZustandBestand)
        .filter(BuchZustandBestand.buch_id == buch_id)
        .all()
    )
    for row in rows:
        db.delete(row)
    db.flush()

    for (zustand, nutzungsjahr), bestand_verfuegbar in aggregated.items():
        preis_cents = berechne_bucket_preis(
            basispreis_cents,
            nutzungsjahr,
            abschlaege,
            schutzgebuehr_cents,
        )
        db.add(
            BuchZustandBestand(
                buch_id=buch_id,
                zustand=zustand,
                verkaufspreis_cents=preis_cents,
                bestand_verfuegbar=bestand_verfuegbar,
                nutzungsjahr=nutzungsjahr,
                schuljahr_eingestellt=cur_sj if nutzungsjahr > 0 else None,
            )
        )
    db.flush()
    return sum(aggregated.values())


@router.get("", response_model=BuchListResponse)
def list_buecher(
    q: str | None = None,
    fach: str | None = None,
    stufe: int | None = None,
    limit: int = Query(default=50, ge=1, le=50000),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Buecher).filter(Buecher.geloescht_am.is_(None))

    if q:
        query = query.filter(
            Buecher.titel.ilike(f"%{q}%")
            | Buecher.isbn.ilike(f"%{q}%")
            | Buecher.id.ilike(f"%{q}%")
        )

    if fach:
        query = query.filter(Buecher.fach == fach)

    if stufe is not None:
        query = query.filter(Buecher.stufe == stufe)

    total = query.count()
    books = query.order_by(Buecher.titel).offset(offset).limit(limit).all()
    abschlaege = get_nutzungsjahr_abschlaege(db)

    return BuchListResponse(
        items=[_buch_to_response(book, _load_zustaende(db, book.id), abschlaege) for book in books],
        total=total,
    )


@router.get("/faecher", response_model=NameListResponse)
def list_faecher(db: Session = Depends(get_db)):
    rows = db.query(BuchFach.name).order_by(BuchFach.name).all()
    return NameListResponse(items=[row[0] for row in rows if row[0]])


@router.get("/{buch_id}", response_model=BuchResponse)
def get_buch(buch_id: str, db: Session = Depends(get_db)):
    b = db.query(Buecher).filter(
        Buecher.id == buch_id, Buecher.geloescht_am.is_(None)
    ).first()

    if not b:
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")

    return _buch_to_response(b, _load_zustaende(db, b.id), get_nutzungsjahr_abschlaege(db))


@router.post("", response_model=BuchResponse, status_code=201)
def create_buch(data: BuchCreate, db: Session = Depends(get_db)):
    new_id = generate_buch_id(db)
    _ensure_fach_exists(db, data.fach)

    extra_nj = [nj for nj in (data.nutzungsjahre or []) if 1 <= nj.nutzungsjahr <= 6 and nj.bestand > 0]
    total_bestand = data.bestand_gesamt + sum(nj.bestand for nj in extra_nj)

    buch = Buecher(
        id=new_id,
        titel=data.titel,
        untertitel=data.untertitel,
        isbn=data.isbn,
        fach=data.fach,
        stufe=data.stufe,
        verlag=data.verlag,
        preis_cents=data.preis_cents,
        gutschrift_cents=data.preis_cents,
        bestand_gesamt=total_bestand,
        bestand_ausgegeben=0,
        schutzgebuehr_cents=data.schutzgebuehr_cents,
    )
    db.add(buch)
    db.flush()

    db.add(
        BuchZustandBestand(
            buch_id=new_id,
            zustand="sehr_gut",
            verkaufspreis_cents=data.preis_cents,
            bestand_verfuegbar=data.bestand_gesamt,
            nutzungsjahr=0,
            schuljahr_eingestellt=None,
        )
    )
    cur_sj = current_schuljahr_start()
    for nj in extra_nj:
        db.add(
            BuchZustandBestand(
                buch_id=new_id,
                zustand="sehr_gut",
                verkaufspreis_cents=data.preis_cents,
                bestand_verfuegbar=nj.bestand,
                nutzungsjahr=nj.nutzungsjahr,
                schuljahr_eingestellt=cur_sj,
            )
        )
    db.commit()
    db.refresh(buch)

    return _buch_to_response(buch, _load_zustaende(db, buch.id), get_nutzungsjahr_abschlaege(db))


@router.post("/import/csv", status_code=201)
async def import_buecher_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    filename = file.filename or "import.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="Bitte eine CSV-Datei hochladen.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Die CSV-Datei ist leer.")

    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            content = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            content = ""
    if not content:
        raise HTTPException(status_code=422, detail="CSV konnte nicht gelesen werden.")

    sample = content[:4096]
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
    except csv.Error:
        dialect = None

    stream = io.StringIO(content)
    reader = csv.DictReader(stream, dialect=dialect) if dialect else csv.DictReader(stream, delimiter=";")
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="CSV-Header fehlt oder ist ungueltig.")

    header_map: dict[str, str] = {}
    for header in reader.fieldnames:
        mapped = _map_csv_header(header)
        if mapped and mapped not in header_map:
            header_map[mapped] = header

    missing_headers = [field for field in _CSV_REQUIRED_FIELDS if field not in header_map]
    if missing_headers:
        raise HTTPException(
            status_code=422,
            detail="Pflichtspalten fehlen: " + ", ".join(missing_headers),
        )

    imported = 0
    skipped = 0
    created_faecher: set[str] = set()
    existing_faecher = {
        row[0]
        for row in db.query(Buecher.fach)
        .filter(Buecher.geloescht_am.is_(None))
        .distinct()
        .all()
        if row[0]
    }
    errors: list[dict] = []
    abschlaege = get_nutzungsjahr_abschlaege(db)

    for row_number, source in enumerate(reader, start=2):
        row = {field: _clean_text(source.get(original)) for field, original in header_map.items()}
        if not any(row.values()):
            continue

        titel = row.get("titel")
        fach = row.get("fach")
        stufe = _parse_int(row.get("stufe"))
        preis_cents = _parse_money_cents(row.get("preis_cents"))
        bestand_gesamt = _parse_int(row.get("bestand_gesamt"), 0)
        nutzungsjahr = _parse_int(row.get("nutzungsjahr"), 0)
        nutzungsjahr_counts: dict[int, int] = {}
        has_nutzungsjahr_counts = False
        for jahr in range(1, 7):
            raw_count = row.get(f"nutzungsjahr_{jahr}")
            if raw_count is None:
                continue
            has_nutzungsjahr_counts = True
            parsed_count = _parse_int(raw_count, 0)
            nutzungsjahr_counts[jahr] = parsed_count if parsed_count is not None else -1
        schutzgebuehr_cents = _parse_money_cents(row.get("schutzgebuehr_cents")) if row.get("schutzgebuehr_cents") else 0

        extra_nj = []
        for nj_num in range(1, 7):
            nj_val = _parse_int(row.get(f"nj_{nj_num}"), 0)
            if nj_val and nj_val > 0:
                extra_nj.append((nj_num, nj_val))

        row_errors = []
        if not titel:
            row_errors.append("Titel fehlt")
        if not fach:
            row_errors.append("Fach fehlt")
        if stufe is None:
            row_errors.append("Stufe ungueltig")
        if preis_cents is None:
            row_errors.append("Preis ungueltig")
        if bestand_gesamt is None or bestand_gesamt < 0:
            row_errors.append("Bestand ungueltig")
        if nutzungsjahr is None or nutzungsjahr < 0:
            row_errors.append("Nutzungsjahr ungueltig")
        if any(count < 0 for count in nutzungsjahr_counts.values()):
            row_errors.append("Nutzungsjahr-Bestand ungueltig")
        if (
            bestand_gesamt is not None
            and bestand_gesamt >= 0
            and sum(nutzungsjahr_counts.values()) > bestand_gesamt
        ):
            row_errors.append("Nutzungsjahr-Bestaende ueberschreiten Bestand")
        if schutzgebuehr_cents is None or schutzgebuehr_cents < 0:
            row_errors.append("Schutzgebuehr ungueltig")

        if row_errors:
            skipped += 1
            errors.append({"row": row_number, "errors": row_errors})
            continue

        total_bestand = bestand_gesamt + sum(b for _, b in extra_nj)
        new_id = generate_buch_id(db)
        buch = Buecher(
            id=new_id,
            titel=titel,
            untertitel=row.get("untertitel"),
            isbn=row.get("isbn"),
            fach=fach,
            stufe=stufe,
            verlag=row.get("verlag"),
            preis_cents=preis_cents,
            gutschrift_cents=preis_cents,
            bestand_gesamt=total_bestand,
            bestand_ausgegeben=0,
            schutzgebuehr_cents=schutzgebuehr_cents,
        )
        db.add(buch)
        db.flush()
        _ensure_fach_exists(db, fach)

        bucket_counts: dict[tuple[str, int], int] = {}
        if has_nutzungsjahr_counts:
            assigned_count = 0
            for jahr, count in nutzungsjahr_counts.items():
                if count <= 0:
                    continue
                nutzungsjahr_key = min(6, jahr)
                bucket_counts[("sehr_gut", nutzungsjahr_key)] = (
                    bucket_counts.get(("sehr_gut", nutzungsjahr_key), 0) + count
                )
                assigned_count += count
            unknown_count = bestand_gesamt - assigned_count
            if unknown_count > 0:
                bucket_counts[("unbekannt", 0)] = unknown_count
        else:
            nutzungsjahr = min(6, nutzungsjahr or 0)
            bucket_counts[("sehr_gut", nutzungsjahr)] = bestand_gesamt

        for (zustand, bucket_nutzungsjahr), bestand_verfuegbar in bucket_counts.items():
            if bestand_verfuegbar <= 0:
                continue
            db.add(
                BuchZustandBestand(
                    buch_id=new_id,
                    zustand=zustand,
                    verkaufspreis_cents=berechne_bucket_preis(
                        preis_cents,
                        bucket_nutzungsjahr,
                        abschlaege,
                        schutzgebuehr_cents,
                    ),
                    bestand_verfuegbar=bestand_verfuegbar,
                    nutzungsjahr=bucket_nutzungsjahr,
                    schuljahr_eingestellt=current_schuljahr_start() if bucket_nutzungsjahr > 0 else None,
                )
            )

        if fach not in existing_faecher:
            created_faecher.add(fach)
            existing_faecher.add(fach)
        imported += 1

    if imported == 0 and errors:
        db.rollback()
        raise HTTPException(status_code=422, detail="Keine gueltigen Buecher gefunden.")

    db.commit()
    return {
        "imported": imported,
        "skipped": skipped,
        "created_faecher": sorted(created_faecher),
        "errors": errors[:50],
    }


@router.patch("/{buch_id}", response_model=BuchResponse)
def update_buch(buch_id: str, data: BuchUpdate, db: Session = Depends(get_db)):
    b = db.query(Buecher).filter(
        Buecher.id == buch_id, Buecher.geloescht_am.is_(None)
    ).first()

    if not b:
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")

    update_data = data.model_dump(exclude_unset=True)
    zustaende_update = update_data.pop("zustaende", None)
    old_preis = b.preis_cents
    old_bestand = b.bestand_gesamt
    old_schutzgebuehr = max(0, int(b.schutzgebuehr_cents or 0))
    new_preis = update_data.get("preis_cents", old_preis)
    new_bestand = update_data.get("bestand_gesamt", old_bestand)
    new_schutzgebuehr = max(
        0,
        int(update_data.get("schutzgebuehr_cents", old_schutzgebuehr) or 0),
    )

    if new_bestand < b.bestand_ausgegeben:
        raise HTTPException(
            status_code=422,
            detail="Bestand gesamt darf nicht kleiner als Bestand ausgegeben sein",
        )

    abschlaege = get_nutzungsjahr_abschlaege(db)
    if zustaende_update is not None:
        parsed_zustaende = [BuchZustandUpdate(**item) for item in zustaende_update]
        freier_bestand = sum(item.bestand_verfuegbar for item in parsed_zustaende)
        expected_freier_bestand = new_bestand - b.bestand_ausgegeben
        if freier_bestand > expected_freier_bestand:
            raise HTTPException(
                status_code=422,
                detail=(
                    "Summe der Nutzungsjahr-Bestaende darf den freien Bestand "
                    f"nicht ueberschreiten ({expected_freier_bestand})"
                ),
            )
        unbekannt_bestand = expected_freier_bestand - freier_bestand

        _replace_bestand_buckets(
            db=db,
            buch_id=buch_id,
            zustaende=parsed_zustaende,
            basispreis_cents=new_preis,
            schutzgebuehr_cents=new_schutzgebuehr,
            abschlaege=abschlaege,
            unbekannt_bestand=unbekannt_bestand,
        )
    else:
        base_bucket = (
            db.query(BuchZustandBestand)
            .filter(
                BuchZustandBestand.buch_id == buch_id,
                BuchZustandBestand.zustand == "sehr_gut",
                BuchZustandBestand.nutzungsjahr == 0,
            )
            .first()
        )
        if not base_bucket:
            base_bucket = (
                db.query(BuchZustandBestand)
                .filter(BuchZustandBestand.buch_id == buch_id)
                .order_by(BuchZustandBestand.nutzungsjahr.asc().nulls_last(), BuchZustandBestand.id)
                .first()
            )
        if not base_bucket:
            base_bucket = _get_or_create_bestand(db, buch_id, old_preis, nutzungsjahr=0)

        delta_bestand = new_bestand - old_bestand

        neuer_freier_bestand = base_bucket.bestand_verfuegbar + delta_bestand
        if neuer_freier_bestand < 0:
            raise HTTPException(
                status_code=422,
                detail="Bestandsaenderung wuerde den freien Sehr-Gut-Bestand negativ machen",
            )
        base_bucket.bestand_verfuegbar = neuer_freier_bestand

        if new_preis != old_preis or new_schutzgebuehr != old_schutzgebuehr:
            _reprice_bestand_buckets(
                db=db,
                buch_id=buch_id,
                old_basispreis_cents=old_preis,
                new_basispreis_cents=new_preis,
                old_schutzgebuehr_cents=old_schutzgebuehr,
                new_schutzgebuehr_cents=new_schutzgebuehr,
                abschlaege=abschlaege,
            )

    if "preis_cents" in update_data and "gutschrift_cents" not in update_data:
        update_data["gutschrift_cents"] = update_data["preis_cents"]

    if "fach" in update_data:
        _ensure_fach_exists(db, update_data.get("fach"))

    for field, value in update_data.items():
        setattr(b, field, value)

    db.commit()
    db.refresh(b)

    return _buch_to_response(b, _load_zustaende(db, b.id), abschlaege)


@router.post("/fach/umbenennen", status_code=200)
def fach_umbenennen(data: RenameRequest, db: Session = Depends(get_db)):
    alt = (data.alt or "").strip()
    neu = (data.neu or "").strip()
    if not alt or not neu:
        raise HTTPException(status_code=422, detail="'alt' und 'neu' erforderlich.")
    if alt == neu:
        return {"aktualisiert": 0}
    existing_target = db.query(BuchFach).filter(BuchFach.name == neu).first()
    existing_source = db.query(BuchFach).filter(BuchFach.name == alt).first()
    if existing_source and not existing_target:
        existing_source.name = neu
    elif existing_source and existing_target:
        db.delete(existing_source)
    elif not existing_target:
        db.add(BuchFach(name=neu))
    result = db.execute(
        text("UPDATE buecher SET fach = :neu WHERE fach = :alt AND geloescht_am IS NULL"),
        {"neu": neu, "alt": alt},
    )
    db.commit()
    return {"aktualisiert": result.rowcount}


@router.post("/faecher", response_model=NameListResponse, status_code=201)
def create_fach(data: NameCreateRequest, db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="'name' erforderlich.")
    _ensure_fach_exists(db, name)
    db.commit()
    rows = db.query(BuchFach.name).order_by(BuchFach.name).all()
    return NameListResponse(items=[row[0] for row in rows if row[0]])


@router.delete("/faecher/{fach_name:path}", status_code=204)
def delete_fach(fach_name: str, force: bool = False, db: Session = Depends(get_db)):
    name = (fach_name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Fachname fehlt.")
    active_books = db.query(Buecher).filter(Buecher.fach == name, Buecher.geloescht_am.is_(None)).all()
    if active_books and not force:
        raise HTTPException(status_code=422, detail=f"Fach hat noch {len(active_books)} Bücher.")
    if active_books:
        now = datetime.now().isoformat()
        for b in active_books:
            b.geloescht_am = now
    fach = db.query(BuchFach).filter(BuchFach.name == name).first()
    if fach:
        db.delete(fach)
    elif not active_books:
        raise HTTPException(status_code=404, detail="Fach nicht gefunden")
    db.commit()


@router.delete("/{buch_id}", status_code=204)
def delete_buch(buch_id: str, db: Session = Depends(get_db)):
    b = db.query(Buecher).filter(
        Buecher.id == buch_id, Buecher.geloescht_am.is_(None)
    ).first()

    if not b:
        raise HTTPException(status_code=404, detail="Buch nicht gefunden")

    b.geloescht_am = datetime.now().isoformat()
    db.commit()
