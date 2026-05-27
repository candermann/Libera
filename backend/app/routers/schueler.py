"""
Schüler CRUD endpoints.

GET  /api/schueler
GET  /api/schueler/:id
GET  /api/schueler/:id/vorgaenge
GET  /api/schueler/:id/aktive-buecher
POST /api/schueler
PATCH /api/schueler/:id
DELETE /api/schueler/:id
"""

import csv
import io
from datetime import datetime as _dt

from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.models import Schueler
from app.schemas import (
    SchuelerCreate,
    SchuelerUpdate,
    SchuelerListItem,
    SchuelerListResponse,
    SchuelerDetailResponse,
    KontoSummary,
    VorgaengeResponse,
    VorgangItem,
    AktiveBuecherResponse,
    AktivesBuchItem,
    ArchivKandidatItem,
    ArchivKandidatenResponse,
    ArchivierungRequest,
    ArchiviertItem,
    ArchiviertListResponse,
    SchuelerCsvImportPreviewResponse,
    SchuelerCsvImportPreviewRow,
    SchuelerCsvImportRequest,
    SchuelerCsvImportResponse,
    SchuelerCsvImportSkipItem,
)
from app.services.ids import generate_schueler_id
from app.services.saldo import (
    get_saldo,
    get_vorgaenge,
    get_aktive_buecher,
    count_aktive_buecher,
    count_vorgaenge,
    get_letzter_vorgang_datum,
)

router = APIRouter(prefix="/api/schueler", tags=["Schüler"])



_CSV_REQUIRED_FIELDS = ("vorname", "nachname", "klasse")
_CSV_FIELD_ORDER = (
    "vorname",
    "nachname",
    "klasse",
    "strasse",
    "plz",
    "ort",
    "email_eltern",
    "notizen",
)

_CSV_HEADER_ALIASES = {
    "vorname": {"vorname", "firstname", "first_name", "namevorname"},
    "nachname": {"nachname", "lastname", "last_name", "namenachname", "familienname"},
    "klasse": {"klasse", "class", "stufe"},
    "strasse": {"strasse", "strabe", "strasze", "street"},
    "plz": {"plz", "postleitzahl", "zip", "zipcode"},
    "ort": {"ort", "stadt", "city"},
    "email_eltern": {"emaileltern", "elternemail", "email", "emailparent"},
    "notizen": {"notizen", "bemerkung", "bemerkungen", "notes"},
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


def _clean_optional(value: str | None) -> str | None:
    if value is None:
        return None
    stripped = value.strip()
    return stripped if stripped else None


def _normalize_csv_row(row: dict) -> dict:
    return {
        "vorname": _clean_optional(row.get("vorname")),
        "nachname": _clean_optional(row.get("nachname")),
        "klasse": _clean_optional(row.get("klasse")),
        "strasse": _clean_optional(row.get("strasse")),
        "plz": _clean_optional(row.get("plz")),
        "ort": _clean_optional(row.get("ort")),
        "email_eltern": _clean_optional(row.get("email_eltern")),
        "notizen": _clean_optional(row.get("notizen")),
    }


def _student_key(data: dict) -> tuple[str, str, str] | None:
    if not data.get("vorname") or not data.get("nachname") or not data.get("klasse"):
        return None
    return (
        data["vorname"].strip().lower(),
        data["nachname"].strip().lower(),
        data["klasse"].strip().lower(),
    )


def _find_missing_fields(data: dict) -> list[str]:
    missing: list[str] = []
    for field_name in _CSV_REQUIRED_FIELDS:
        if not data.get(field_name):
            missing.append(field_name)
    return missing


def _existing_student_keys(db: Session) -> set[tuple[str, str, str]]:
    rows = db.execute(
        text(
            """
            SELECT vorname, nachname, klasse
            FROM schueler
            WHERE geloescht_am IS NULL
            """
        )
    ).fetchall()
    keys: set[tuple[str, str, str]] = set()
    for row in rows:
        keys.add(
            (
                (row.vorname or "").strip().lower(),
                (row.nachname or "").strip().lower(),
                (row.klasse or "").strip().lower(),
            )
        )
    return keys


def _next_schueler_counter(db: Session) -> int:
    row = db.execute(
        text("SELECT MAX(id) AS max_id FROM schueler WHERE id LIKE 'S-%'")
    ).scalar()
    if not row:
        return 1
    parts = str(row).split("-")
    if not parts:
        return 1
    try:
        return int(parts[-1]) + 1
    except ValueError:
        return 1


def _schuljahr_von_datum(datum_iso: str) -> str:
    try:
        d = _dt.fromisoformat((datum_iso or "")[:10])
    except Exception:
        d = _dt.now()
    start = d.year if d.month >= 8 else d.year - 1
    return f"{start}/{start + 1}"


def _aktuelles_schuljahr(db: Session) -> str:
    schuljahr = db.execute(
        text(
            """
            SELECT wert
            FROM einstellungen
            WHERE schluessel = 'schuljahr_aktuell'
            """
        )
    ).scalar()
    if schuljahr and str(schuljahr).strip():
        return str(schuljahr).strip()
    return _schuljahr_von_datum(_dt.now().date().isoformat())


@router.get("", response_model=SchuelerListResponse)
def list_schueler(
    q: str | None = None,
    klasse: str | None = None,
    schulden_nur: bool = False,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    """List students with optional search and class filter."""
    conditions = ["s.geloescht_am IS NULL", "s.archiviert_am IS NULL"]
    params: dict = {}

    if q:
        conditions.append(
            "(s.vorname LIKE :q OR s.nachname LIKE :q OR s.id LIKE :q)"
        )
        params["q"] = f"%{q}%"

    if klasse:
        conditions.append("s.klasse = :klasse")
        params["klasse"] = klasse

    if schulden_nur:
        conditions.append("COALESCE(v.saldo_cents, 0) < 0")

    where = " AND ".join(conditions)
    join_saldo = "LEFT JOIN v_schueler_saldo v ON v.schueler_id = s.id" if schulden_nur else ""

    # Count total
    total = db.execute(
        text(f"SELECT COUNT(*) FROM schueler s {join_saldo} WHERE {where}"),
        params,
    ).scalar()

    # Fetch page with saldo
    rows = db.execute(
        text(
            f"""
            SELECT s.id, s.vorname, s.nachname, s.klasse,
                   s.email_eltern,
                   s.strasse, s.plz, s.ort,
                   s.erstes_schuljahr,
                   COALESCE(v.saldo_cents, 0) AS saldo_cents
            FROM schueler s
            LEFT JOIN v_schueler_saldo v ON v.schueler_id = s.id
            WHERE {where}
            ORDER BY s.nachname, s.vorname
            LIMIT :limit OFFSET :offset
            """
        ),
        {**params, "limit": limit, "offset": offset},
    ).fetchall()

    items = []
    for r in rows:
        letzter = get_letzter_vorgang_datum(db, r.id)
        items.append(
            SchuelerListItem(
                id=r.id,
                vorname=r.vorname,
                nachname=r.nachname,
                klasse=r.klasse,
                email_eltern=r.email_eltern,
                strasse=r.strasse,
                plz=r.plz,
                ort=r.ort,
                erstes_schuljahr=r.erstes_schuljahr,
                saldo_cents=r.saldo_cents,
                letzter_vorgang_datum=letzter,
            )
        )

    return SchuelerListResponse(items=items, total=total)


@router.get("/archiv-kandidaten", response_model=ArchivKandidatenResponse)
def get_archiv_kandidaten(monate: int = Query(default=12, ge=1, le=120), db: Session = Depends(get_db)):
    """Students with no activity for at least `monate` months."""
    from datetime import date, timedelta
    cutoff = (date.today().replace(day=1) - timedelta(days=monate * 30)).isoformat()

    rows = db.execute(text("""
        SELECT s.id, s.vorname, s.nachname, s.klasse,
               COALESCE(sal.saldo_cents, 0) AS saldo_cents,
               MAX(vg.datum) AS letzter_vorgang
        FROM schueler s
        LEFT JOIN v_schueler_saldo sal ON sal.schueler_id = s.id
        LEFT JOIN v_schueler_vorgaenge vg ON vg.schueler_id = s.id
        WHERE s.geloescht_am IS NULL AND s.archiviert_am IS NULL
        GROUP BY s.id
        HAVING letzter_vorgang < :cutoff OR letzter_vorgang IS NULL
        ORDER BY s.nachname, s.vorname
    """), {"cutoff": cutoff}).fetchall()

    items = []
    for r in rows:
        aktive = db.execute(text("""
            SELECT COUNT(*) FROM rechnungs_posten rp
            JOIN rechnungen re ON re.id = rp.rechnung_id
            WHERE re.schueler_id = :sid AND re.status != 'storniert' AND rp.zurueckgegeben = 0
        """), {"sid": r.id}).scalar() or 0
        items.append(ArchivKandidatItem(
            id=r.id, vorname=r.vorname, nachname=r.nachname, klasse=r.klasse,
            saldo_cents=r.saldo_cents, letzter_vorgang_datum=r.letzter_vorgang,
            aktive_buecher=aktive,
        ))
    return ArchivKandidatenResponse(items=items)


@router.post("/archivieren", status_code=200)
def archivieren(data: ArchivierungRequest, db: Session = Depends(get_db)):
    """Soft-archive a list of students."""
    from datetime import datetime
    now = datetime.now().isoformat()
    blocked = []
    for sid in data.schueler_ids:
        aktive = db.execute(text("""
            SELECT COUNT(*) FROM rechnungs_posten rp
            JOIN rechnungen re ON re.id = rp.rechnung_id
            WHERE re.schueler_id = :sid AND re.status != 'storniert' AND rp.zurueckgegeben = 0
        """), {"sid": sid}).scalar() or 0
        if aktive > 0:
            blocked.append(sid)
    if blocked:
        raise HTTPException(status_code=422, detail=f"Schüler {', '.join(blocked)} haben noch nicht zurückgegebene Bücher.")

    schuljahr = _aktuelles_schuljahr(db)
    for sid in data.schueler_ids:
        s = db.query(Schueler).filter(Schueler.id == sid).first()
        if s:
            s.archiviert_am = now
            s.archiviert_schuljahr = schuljahr
    db.commit()
    return {"archiviert": len(data.schueler_ids)}


@router.get("/archiv", response_model=ArchiviertListResponse)
def get_archiv(db: Session = Depends(get_db)):
    """List all archived students."""
    rows = db.execute(text("""
        SELECT s.id, s.vorname, s.nachname, s.klasse, s.archiviert_am,
               s.erstes_schuljahr, s.archiviert_schuljahr,
               COALESCE(sal.saldo_cents, 0) AS saldo_cents,
               MAX(vg.datum) AS letzter_vorgang
        FROM schueler s
        LEFT JOIN v_schueler_saldo sal ON sal.schueler_id = s.id
        LEFT JOIN v_schueler_vorgaenge vg ON vg.schueler_id = s.id
        WHERE s.geloescht_am IS NULL AND s.archiviert_am IS NOT NULL
        GROUP BY s.id
        ORDER BY s.archiviert_am DESC, s.nachname
    """)).fetchall()
    return ArchiviertListResponse(items=[
        ArchiviertItem(
            id=r.id, vorname=r.vorname, nachname=r.nachname, klasse=r.klasse,
            archiviert_am=r.archiviert_am, saldo_cents=r.saldo_cents,
            letzter_vorgang_datum=r.letzter_vorgang,
            erstes_schuljahr=r.erstes_schuljahr,
            schuljahr=r.archiviert_schuljahr or _schuljahr_von_datum(r.archiviert_am),
        ) for r in rows
    ])



@router.post("/import/csv/preview", response_model=SchuelerCsvImportPreviewResponse)
async def preview_csv_import(file: UploadFile = File(...), db: Session = Depends(get_db)):
    """Parse CSV and return normalized rows with validation details."""
    filename = file.filename or "import.csv"
    if not filename.lower().endswith(".csv"):
        raise HTTPException(status_code=422, detail="Bitte eine CSV-Datei hochladen.")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=422, detail="Die CSV-Datei ist leer.")

    decoded = None
    for encoding in ("utf-8-sig", "cp1252", "latin-1"):
        try:
            decoded = raw.decode(encoding)
            break
        except UnicodeDecodeError:
            continue
    if decoded is None:
        raise HTTPException(status_code=422, detail="CSV konnte nicht gelesen werden (Zeichencodierung).")

    stream = io.StringIO(decoded)
    sample = decoded[:4096]
    dialect = None
    delimiter = None
    try:
        dialect = csv.Sniffer().sniff(sample, delimiters=",;")
    except csv.Error:
        delimiter = ";" if ";" in sample and "," not in sample else ","

    if delimiter:
        reader = csv.DictReader(stream, delimiter=delimiter)
    else:
        reader = csv.DictReader(stream, dialect=dialect)
    if not reader.fieldnames:
        raise HTTPException(status_code=422, detail="CSV-Header fehlt oder ist ungueltig.")

    header_mapping = {}
    for header in reader.fieldnames:
        mapped = _map_csv_header(header)
        if mapped:
            header_mapping[header] = mapped

    existing_keys = _existing_student_keys(db)
    rows: list[SchuelerCsvImportPreviewRow] = []
    duplicates_by_key: dict[tuple[str, str, str], list[int]] = {}

    csv_row_number = 1
    for source_row in reader:
        csv_row_number += 1

        normalized_source = {field: None for field in _CSV_FIELD_ORDER}
        for raw_header, value in source_row.items():
            mapped = header_mapping.get(raw_header)
            if not mapped:
                continue
            normalized_source[mapped] = value

        data = _normalize_csv_row(normalized_source)

        if not any(data.values()):
            continue

        missing = _find_missing_fields(data)
        key = _student_key(data)

        row_item = SchuelerCsvImportPreviewRow(
            row_number=csv_row_number,
            vorname=data["vorname"],
            nachname=data["nachname"],
            klasse=data["klasse"],
            strasse=data["strasse"],
            plz=data["plz"],
            ort=data["ort"],
            email_eltern=data["email_eltern"],
            notizen=data["notizen"],
            fehlende_felder=missing,
            duplicate_existing=(key in existing_keys) if key else False,
            duplicate_file=False,
            valid=len(missing) == 0,
        )
        rows.append(row_item)

        if key:
            duplicates_by_key.setdefault(key, []).append(len(rows) - 1)

    for idxs in duplicates_by_key.values():
        if len(idxs) > 1:
            for idx in idxs:
                rows[idx].duplicate_file = True

    valid_rows = 0
    for row in rows:
        row.valid = row.valid and not row.duplicate_existing and not row.duplicate_file
        if row.valid:
            valid_rows += 1

    return SchuelerCsvImportPreviewResponse(
        filename=filename,
        total_rows=len(rows),
        valid_rows=valid_rows,
        invalid_rows=len(rows) - valid_rows,
        rows=rows,
    )


@router.post("/import/csv", response_model=SchuelerCsvImportResponse, status_code=201)
def import_csv(data: SchuelerCsvImportRequest, db: Session = Depends(get_db)):
    """Create students from selected CSV rows."""
    if not data.rows:
        raise HTTPException(status_code=422, detail="Keine Datensaetze zum Import ausgewaehlt.")

    existing_keys = _existing_student_keys(db)
    next_counter = _next_schueler_counter(db)
    schuljahr_erstanlage = _aktuelles_schuljahr(db)

    imported = 0
    skipped = 0
    skip_details: list[SchuelerCsvImportSkipItem] = []

    for idx, row in enumerate(data.rows, start=1):
        payload = _normalize_csv_row(row.model_dump())
        missing = _find_missing_fields(payload)
        if missing:
            skipped += 1
            skip_details.append(
                SchuelerCsvImportSkipItem(
                    row_number=idx,
                    reason=f"Pflichtfelder fehlen: {', '.join(missing)}",
                )
            )
            continue

        key = _student_key(payload)
        if key and key in existing_keys:
            skipped += 1
            skip_details.append(
                SchuelerCsvImportSkipItem(
                    row_number=idx,
                    reason="Bereits vorhandener Schueler (Vorname, Nachname, Klasse).",
                )
            )
            continue

        schueler_id = f"S-{next_counter:04d}"
        next_counter += 1

        schueler = Schueler(
            id=schueler_id,
            vorname=payload["vorname"],
            nachname=payload["nachname"],
            klasse=payload["klasse"],
            strasse=payload["strasse"],
            plz=payload["plz"],
            ort=payload["ort"],
            email_eltern=payload["email_eltern"],
            notizen=payload["notizen"],
            erstes_schuljahr=schuljahr_erstanlage,
        )
        db.add(schueler)
        imported += 1
        if key:
            existing_keys.add(key)

    db.commit()

    return SchuelerCsvImportResponse(
        imported=imported,
        skipped=skipped,
        skip_details=skip_details,
    )
@router.post("/{schueler_id}/reaktivieren", status_code=200)
def reaktivieren(schueler_id: str, db: Session = Depends(get_db)):
    """Remove a student from the archive."""
    s = db.query(Schueler).filter(
        Schueler.id == schueler_id, Schueler.geloescht_am.is_(None)
    ).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")
    s.archiviert_am = None
    db.commit()
    return {"reaktiviert": schueler_id}


@router.get("/{schueler_id}", response_model=SchuelerDetailResponse)
def get_schueler(schueler_id: str, db: Session = Depends(get_db)):
    """Get student detail with account summary."""
    s = db.query(Schueler).filter(
        Schueler.id == schueler_id, Schueler.geloescht_am.is_(None)
    ).first()

    if not s:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")

    saldo = get_saldo(db, schueler_id)
    aktive = count_aktive_buecher(db, schueler_id)
    anz_vorgaenge = count_vorgaenge(db, schueler_id)

    return SchuelerDetailResponse(
        id=s.id,
        vorname=s.vorname,
        nachname=s.nachname,
        klasse=s.klasse,
        strasse=s.strasse,
        plz=s.plz,
        ort=s.ort,
        email_eltern=s.email_eltern,
        erstes_schuljahr=s.erstes_schuljahr,
        konto=KontoSummary(
            saldo_cents=saldo,
            anzahl_aktive_buecher=aktive,
            anzahl_vorgaenge=anz_vorgaenge,
        ),
    )


@router.get("/{schueler_id}/vorgaenge", response_model=VorgaengeResponse)
def get_schueler_vorgaenge(schueler_id: str, db: Session = Depends(get_db)):
    """Get transaction history with running saldo."""
    # Verify student exists
    s = db.query(Schueler).filter(Schueler.id == schueler_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")

    vorgaenge = get_vorgaenge(db, schueler_id)
    return VorgaengeResponse(
        items=[VorgangItem(**v) for v in vorgaenge]
    )


@router.get("/{schueler_id}/aktive-buecher", response_model=AktiveBuecherResponse)
def get_schueler_aktive_buecher(schueler_id: str, db: Session = Depends(get_db)):
    """Get books currently held by the student."""
    s = db.query(Schueler).filter(Schueler.id == schueler_id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")

    buecher = get_aktive_buecher(db, schueler_id)
    return AktiveBuecherResponse(
        items=[AktivesBuchItem(**b) for b in buecher]
    )


@router.post("", response_model=SchuelerDetailResponse, status_code=201)
def create_schueler(data: SchuelerCreate, db: Session = Depends(get_db)):
    """Create a new student."""
    new_id = generate_schueler_id(db)
    schuljahr_erstanlage = _aktuelles_schuljahr(db)

    schueler = Schueler(
        id=new_id,
        vorname=data.vorname,
        nachname=data.nachname,
        klasse=data.klasse,
        strasse=data.strasse,
        plz=data.plz,
        ort=data.ort,
        email_eltern=data.email_eltern,
        notizen=data.notizen,
        erstes_schuljahr=schuljahr_erstanlage,
    )
    db.add(schueler)
    db.commit()
    db.refresh(schueler)

    return SchuelerDetailResponse(
        id=schueler.id,
        vorname=schueler.vorname,
        nachname=schueler.nachname,
        klasse=schueler.klasse,
        strasse=schueler.strasse,
        plz=schueler.plz,
        ort=schueler.ort,
        email_eltern=schueler.email_eltern,
        erstes_schuljahr=schueler.erstes_schuljahr,
        konto=KontoSummary(
            saldo_cents=0, anzahl_aktive_buecher=0, anzahl_vorgaenge=0
        ),
    )


@router.patch("/{schueler_id}", response_model=SchuelerDetailResponse)
def update_schueler(
    schueler_id: str, data: SchuelerUpdate, db: Session = Depends(get_db)
):
    """Partially update a student."""
    s = db.query(Schueler).filter(
        Schueler.id == schueler_id, Schueler.geloescht_am.is_(None)
    ).first()

    if not s:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")

    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(s, field, value)

    db.commit()
    db.refresh(s)

    saldo = get_saldo(db, schueler_id)
    aktive = count_aktive_buecher(db, schueler_id)
    anz_vorgaenge = count_vorgaenge(db, schueler_id)

    return SchuelerDetailResponse(
        id=s.id,
        vorname=s.vorname,
        nachname=s.nachname,
        klasse=s.klasse,
        strasse=s.strasse,
        plz=s.plz,
        ort=s.ort,
        email_eltern=s.email_eltern,
        erstes_schuljahr=s.erstes_schuljahr,
        konto=KontoSummary(
            saldo_cents=saldo,
            anzahl_aktive_buecher=aktive,
            anzahl_vorgaenge=anz_vorgaenge,
        ),
    )


@router.delete("/{schueler_id}", status_code=204)
def delete_schueler(schueler_id: str, db: Session = Depends(get_db)):
    """Soft-delete a student."""
    s = db.query(Schueler).filter(
        Schueler.id == schueler_id, Schueler.geloescht_am.is_(None)
    ).first()

    if not s:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")

    from datetime import datetime
    s.geloescht_am = datetime.now().isoformat()
    db.commit()
