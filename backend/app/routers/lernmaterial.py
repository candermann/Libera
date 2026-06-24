"""
Lernmaterial CRUD endpoints.
"""

import csv
import io
from datetime import datetime

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lernmaterial, LernmaterialKategorie
from app.schemas import (
    LernmaterialCreate,
    LernmaterialListResponse,
    LernmaterialResponse,
    LernmaterialUpdate,
    NameCreateRequest,
    NameListResponse,
    RenameRequest,
)
from app.services.ids import generate_lernmaterial_id

_CSV_REQUIRED_FIELDS = ("name", "kategorie", "preis_cents")
_CSV_HEADER_ALIASES = {
    "name": {"name", "bezeichnung", "artikel", "material"},
    "kategorie": {"kategorie", "category", "typ", "art"},
    "preis_cents": {"preis", "preiscents", "preis_cents", "betrag", "basispreis"},
    "bestand_gesamt": {"bestand", "bestandgesamt", "bestand_gesamt", "anzahl", "menge"},
}


def _normalize_header_key(value: str) -> str:
    normalized = (value or "").strip().lower()
    for src, dest in {"ä": "ae", "ö": "oe", "ü": "ue", "ß": "ss", " ": "", "-": "", "_": "", ".": ""}.items():
        normalized = normalized.replace(src, dest)
    return normalized


def _map_lm_csv_header(header: str | None) -> str | None:
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
        text_value.replace("€", "").replace("EUR", "").replace("eur", "").replace(" ", "").strip()
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

router = APIRouter(prefix="/api/lernmaterial", tags=["Lernmaterial"])


def _to_response(m: Lernmaterial) -> LernmaterialResponse:
    return LernmaterialResponse(
        id=m.id,
        name=m.name,
        kategorie=m.kategorie,
        preis_cents=m.preis_cents,
        bestand_gesamt=m.bestand_gesamt,
        bestand_ausgegeben=m.bestand_ausgegeben,
        bestand_frei=m.bestand_gesamt - m.bestand_ausgegeben,
    )


def _ensure_kategorie_exists(db: Session, kategorie: str | None):
    category_name = (kategorie or "").strip()
    if not category_name:
        return
    if not db.query(LernmaterialKategorie).filter(LernmaterialKategorie.name == category_name).first():
        db.add(LernmaterialKategorie(name=category_name))
        db.flush()


@router.get("", response_model=LernmaterialListResponse)
def list_lernmaterial(
    q: str | None = None,
    kategorie: str | None = None,
    limit: int = Query(default=50, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    db: Session = Depends(get_db),
):
    query = db.query(Lernmaterial).filter(Lernmaterial.geloescht_am.is_(None))
    if q:
        query = query.filter(
            Lernmaterial.name.ilike(f"%{q}%")
            | Lernmaterial.id.ilike(f"%{q}%")
            | Lernmaterial.kategorie.ilike(f"%{q}%")
        )
    if kategorie:
        query = query.filter(Lernmaterial.kategorie == kategorie)
    total = query.count()
    items = query.order_by(Lernmaterial.kategorie, Lernmaterial.name).offset(offset).limit(limit).all()
    return LernmaterialListResponse(items=[_to_response(m) for m in items], total=total)


@router.get("/kategorien", response_model=NameListResponse)
def list_kategorien(db: Session = Depends(get_db)):
    rows = db.query(LernmaterialKategorie.name).order_by(LernmaterialKategorie.name).all()
    return NameListResponse(items=[row[0] for row in rows if row[0]])


@router.get("/{material_id}", response_model=LernmaterialResponse)
def get_lernmaterial(material_id: str, db: Session = Depends(get_db)):
    m = db.query(Lernmaterial).filter(
        Lernmaterial.id == material_id, Lernmaterial.geloescht_am.is_(None)
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Lernmaterial nicht gefunden")
    return _to_response(m)


@router.post("", response_model=LernmaterialResponse, status_code=201)
def create_lernmaterial(data: LernmaterialCreate, db: Session = Depends(get_db)):
    new_id = generate_lernmaterial_id(db)
    _ensure_kategorie_exists(db, data.kategorie)
    m = Lernmaterial(
        id=new_id,
        name=data.name,
        kategorie=data.kategorie,
        preis_cents=data.preis_cents,
        bestand_gesamt=data.bestand_gesamt,
        bestand_ausgegeben=0,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return _to_response(m)


@router.patch("/{material_id}", response_model=LernmaterialResponse)
def update_lernmaterial(
    material_id: str, data: LernmaterialUpdate, db: Session = Depends(get_db)
):
    m = db.query(Lernmaterial).filter(
        Lernmaterial.id == material_id, Lernmaterial.geloescht_am.is_(None)
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Lernmaterial nicht gefunden")

    update_data = data.model_dump(exclude_unset=True)
    if "bestand_gesamt" in update_data and update_data["bestand_gesamt"] < m.bestand_ausgegeben:
        raise HTTPException(
            status_code=422,
            detail="Bestand gesamt darf nicht kleiner als Bestand ausgegeben sein",
        )
    if "kategorie" in update_data:
        _ensure_kategorie_exists(db, update_data.get("kategorie"))
    for field, value in update_data.items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return _to_response(m)


@router.post("/kategorien", response_model=NameListResponse, status_code=201)
def create_kategorie(data: NameCreateRequest, db: Session = Depends(get_db)):
    name = (data.name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="'name' erforderlich.")
    _ensure_kategorie_exists(db, name)
    db.commit()
    rows = db.query(LernmaterialKategorie.name).order_by(LernmaterialKategorie.name).all()
    return NameListResponse(items=[row[0] for row in rows if row[0]])


@router.delete("/kategorien/{kategorie_name:path}", status_code=204)
def delete_kategorie(kategorie_name: str, db: Session = Depends(get_db)):
    name = (kategorie_name or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="Kategoriename fehlt.")
    count = db.query(Lernmaterial).filter(
        Lernmaterial.kategorie == name,
        Lernmaterial.geloescht_am.is_(None),
    ).count()
    if count > 0:
        raise HTTPException(status_code=422, detail=f"Kategorie hat noch {count} Artikel.")
    category = db.query(LernmaterialKategorie).filter(LernmaterialKategorie.name == name).first()
    if not category:
        raise HTTPException(status_code=404, detail="Kategorie nicht gefunden")
    db.delete(category)
    db.commit()


@router.post("/kategorie/umbenennen", status_code=200)
def kategorie_umbenennen(data: RenameRequest, db: Session = Depends(get_db)):
    from sqlalchemy import text
    alt = (data.alt or "").strip()
    neu = (data.neu or "").strip()
    if not alt or not neu:
        raise HTTPException(status_code=422, detail="'alt' und 'neu' erforderlich.")
    if alt == neu:
        return {"aktualisiert": 0}
    existing_target = db.query(LernmaterialKategorie).filter(LernmaterialKategorie.name == neu).first()
    existing_source = db.query(LernmaterialKategorie).filter(LernmaterialKategorie.name == alt).first()
    if existing_source and not existing_target:
        existing_source.name = neu
    elif existing_source and existing_target:
        db.delete(existing_source)
    elif not existing_target:
        db.add(LernmaterialKategorie(name=neu))
    result = db.execute(
        text("UPDATE lernmaterial SET kategorie = :neu WHERE kategorie = :alt AND geloescht_am IS NULL"),
        {"neu": neu, "alt": alt},
    )
    db.commit()
    return {"aktualisiert": result.rowcount}


@router.post("/import/csv", status_code=201)
async def import_lernmaterial_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
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
        mapped = _map_lm_csv_header(header)
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
    errors: list[dict] = []

    for row_number, source in enumerate(reader, start=2):
        row = {field: _clean_text(source.get(original)) for field, original in header_map.items()}
        if not any(row.values()):
            continue

        name = row.get("name")
        kategorie = row.get("kategorie")
        preis_cents = _parse_money_cents(row.get("preis_cents"))
        bestand_gesamt = _parse_int(row.get("bestand_gesamt"), 0)

        row_errors = []
        if not name:
            row_errors.append("Name fehlt")
        if not kategorie:
            row_errors.append("Kategorie fehlt")
        if preis_cents is None:
            row_errors.append("Preis ungueltig")
        if bestand_gesamt is None or bestand_gesamt < 0:
            row_errors.append("Bestand ungueltig")

        if row_errors:
            skipped += 1
            errors.append({"row": row_number, "errors": row_errors})
            continue

        new_id = generate_lernmaterial_id(db)
        m = Lernmaterial(
            id=new_id,
            name=name,
            kategorie=kategorie,
            preis_cents=preis_cents,
            bestand_gesamt=bestand_gesamt,
            bestand_ausgegeben=0,
        )
        db.add(m)
        db.flush()
        _ensure_kategorie_exists(db, kategorie)
        imported += 1

    if imported == 0 and errors:
        db.rollback()
        raise HTTPException(status_code=422, detail="Keine gueltigen Eintraege gefunden.")

    db.commit()
    return {
        "imported": imported,
        "skipped": skipped,
        "errors": errors[:50],
    }


@router.delete("/{material_id}", status_code=204)
def delete_lernmaterial(material_id: str, db: Session = Depends(get_db)):
    m = db.query(Lernmaterial).filter(
        Lernmaterial.id == material_id, Lernmaterial.geloescht_am.is_(None)
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Lernmaterial nicht gefunden")
    m.geloescht_am = datetime.now().isoformat()
    db.commit()
