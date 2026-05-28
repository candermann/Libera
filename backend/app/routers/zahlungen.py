"""
Zahlungen (payment) endpoints.

POST   /api/zahlungen
GET    /api/zahlungen?schueler_id=...
PATCH  /api/zahlungen/{id}
DELETE /api/zahlungen/{id}
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import Zahlungen, Schueler, Rechnungen
from app.schemas import ZahlungCreate, ZahlungUpdate, ZahlungResponse, ZahlungenListResponse

router = APIRouter(prefix="/api/zahlungen", tags=["Zahlungen"])


def _recalculate_rechnung_status(db: Session, rechnung_id: str) -> None:
    rechnung = db.query(Rechnungen).filter(Rechnungen.id == rechnung_id).first()
    if not rechnung or rechnung.status == "storniert":
        return
    total_paid = db.query(func.coalesce(func.sum(Zahlungen.betrag_cents), 0)).filter(
        Zahlungen.rechnung_id == rechnung_id
    ).scalar()
    offen = rechnung.summe_cents - rechnung.verrechnet_cents
    rechnung.status = "bezahlt" if total_paid >= offen else "offen"
    db.commit()


def _zahlung_to_response(z: Zahlungen) -> ZahlungResponse:
    return ZahlungResponse(
        id=z.id,
        schueler_id=z.schueler_id,
        rechnung_id=z.rechnung_id,
        datum=z.datum,
        betrag_cents=z.betrag_cents,
        notizen=z.notizen,
        erstellt_am=z.erstellt_am or "",
    )


@router.post("", response_model=ZahlungResponse, status_code=201)
def create_zahlung(data: ZahlungCreate, db: Session = Depends(get_db)):
    schueler = db.query(Schueler).filter(Schueler.id == data.schueler_id).first()
    if not schueler:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")

    if data.rechnung_id:
        if not db.query(Rechnungen).filter(Rechnungen.id == data.rechnung_id).first():
            raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")

    zahlung = Zahlungen(
        schueler_id=data.schueler_id,
        rechnung_id=data.rechnung_id,
        datum=data.datum,
        betrag_cents=data.betrag_cents,
        notizen=data.notizen,
    )
    db.add(zahlung)
    db.commit()
    db.refresh(zahlung)

    if data.rechnung_id:
        _recalculate_rechnung_status(db, data.rechnung_id)

    return _zahlung_to_response(zahlung)


@router.get("", response_model=ZahlungenListResponse)
def list_zahlungen(schueler_id: str | None = None, db: Session = Depends(get_db)):
    query = db.query(Zahlungen)
    if schueler_id:
        query = query.filter(Zahlungen.schueler_id == schueler_id)
    zahlungen = query.order_by(Zahlungen.datum.desc()).all()
    return ZahlungenListResponse(items=[_zahlung_to_response(z) for z in zahlungen])


@router.patch("/{zahlung_id}", response_model=ZahlungResponse)
def update_zahlung(zahlung_id: int, data: ZahlungUpdate, db: Session = Depends(get_db)):
    z = db.query(Zahlungen).filter(Zahlungen.id == zahlung_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")

    old_rechnung_id = z.rechnung_id

    if data.betrag_cents is not None:
        z.betrag_cents = data.betrag_cents
    if data.datum is not None:
        z.datum = data.datum
    if data.rechnung_id is not None:
        if data.rechnung_id and not db.query(Rechnungen).filter(Rechnungen.id == data.rechnung_id).first():
            raise HTTPException(status_code=404, detail="Rechnung nicht gefunden")
        z.rechnung_id = data.rechnung_id or None
    if data.notizen is not None:
        z.notizen = data.notizen or None

    db.commit()
    db.refresh(z)

    for rid in set(filter(None, [old_rechnung_id, z.rechnung_id])):
        _recalculate_rechnung_status(db, rid)

    return _zahlung_to_response(z)


@router.delete("/{zahlung_id}", status_code=204)
def delete_zahlung(zahlung_id: int, db: Session = Depends(get_db)):
    z = db.query(Zahlungen).filter(Zahlungen.id == zahlung_id).first()
    if not z:
        raise HTTPException(status_code=404, detail="Zahlung nicht gefunden")

    rechnung_id = z.rechnung_id
    db.delete(z)
    db.commit()

    if rechnung_id:
        _recalculate_rechnung_status(db, rechnung_id)
