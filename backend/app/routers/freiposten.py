"""
Freiposten-Vorlagen endpoints — gespeicherte Posten für schnellen Zugriff beim Verkauf.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import FreipostenVorlage
from app.schemas import FreipostenVorlageCreate, FreipostenVorlageResponse

router = APIRouter(prefix="/api/freiposten", tags=["Freiposten"])


@router.get("/vorlagen", response_model=list[FreipostenVorlageResponse])
def list_vorlagen(db: Session = Depends(get_db)):
    return (
        db.query(FreipostenVorlage)
        .order_by(FreipostenVorlage.bezeichnung)
        .all()
    )


@router.post("/vorlagen", response_model=FreipostenVorlageResponse, status_code=201)
def create_vorlage(data: FreipostenVorlageCreate, db: Session = Depends(get_db)):
    v = FreipostenVorlage(
        bezeichnung=data.bezeichnung,
        betrag_cents=data.betrag_cents,
        typ=data.typ,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return v


@router.delete("/vorlagen/{vorlage_id}", status_code=204)
def delete_vorlage(vorlage_id: int, db: Session = Depends(get_db)):
    v = db.query(FreipostenVorlage).filter(FreipostenVorlage.id == vorlage_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vorlage nicht gefunden")
    db.delete(v)
    db.commit()
