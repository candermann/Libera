"""
Lernmaterial CRUD endpoints.
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Lernmaterial
from app.schemas import (
    LernmaterialCreate,
    LernmaterialListResponse,
    LernmaterialResponse,
    LernmaterialUpdate,
)
from app.services.ids import generate_lernmaterial_id

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
    for field, value in update_data.items():
        setattr(m, field, value)
    db.commit()
    db.refresh(m)
    return _to_response(m)


@router.post("/kategorie/umbenennen", status_code=200)
def kategorie_umbenennen(data: dict, db: Session = Depends(get_db)):
    from sqlalchemy import text
    alt = (data.get("alt") or "").strip()
    neu = (data.get("neu") or "").strip()
    if not alt or not neu:
        raise HTTPException(status_code=422, detail="'alt' und 'neu' erforderlich.")
    if alt == neu:
        return {"aktualisiert": 0}
    result = db.execute(
        text("UPDATE lernmaterial SET kategorie = :neu WHERE kategorie = :alt AND geloescht_am IS NULL"),
        {"neu": neu, "alt": alt},
    )
    db.commit()
    return {"aktualisiert": result.rowcount}


@router.delete("/{material_id}", status_code=204)
def delete_lernmaterial(material_id: str, db: Session = Depends(get_db)):
    m = db.query(Lernmaterial).filter(
        Lernmaterial.id == material_id, Lernmaterial.geloescht_am.is_(None)
    ).first()
    if not m:
        raise HTTPException(status_code=404, detail="Lernmaterial nicht gefunden")
    m.geloescht_am = datetime.now().isoformat()
    db.commit()
