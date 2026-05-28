"""
Auszahlungen (credit payout) endpoints.

POST   /api/auszahlungen
DELETE /api/auszahlungen/{id}
"""

from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session
from typing import Optional

from pydantic import BaseModel

from app.db import get_db
from app.models import Auszahlungen, Schueler
from app.services.pdf import render_auszahlung_html, render_auszahlung_pdf
from app.services.saldo import get_saldo

router = APIRouter(prefix="/api/auszahlungen", tags=["Auszahlungen"])


class AuszahlungCreate(BaseModel):
    schueler_id: str
    betrag_cents: int
    datum: Optional[str] = None
    notizen: Optional[str] = None


class AuszahlungResponse(BaseModel):
    id: int
    schueler_id: str
    datum: str
    betrag_cents: int
    notizen: Optional[str]


@router.post("", response_model=AuszahlungResponse, status_code=201)
def create_auszahlung(data: AuszahlungCreate, db: Session = Depends(get_db)):
    schueler = db.query(Schueler).filter(
        Schueler.id == data.schueler_id, Schueler.geloescht_am.is_(None)
    ).first()
    if not schueler:
        raise HTTPException(status_code=404, detail="Schüler nicht gefunden")

    if data.betrag_cents <= 0:
        raise HTTPException(status_code=422, detail="Betrag muss größer als 0 sein")

    saldo = get_saldo(db, data.schueler_id)
    if data.betrag_cents > saldo:
        raise HTTPException(
            status_code=422,
            detail=f"Auszahlungsbetrag übersteigt das verfügbare Guthaben ({saldo / 100:.2f} €)"
        )

    auszahlung = Auszahlungen(
        schueler_id=data.schueler_id,
        datum=data.datum or date.today().isoformat(),
        betrag_cents=data.betrag_cents,
        notizen=data.notizen,
    )
    db.add(auszahlung)
    db.commit()
    db.refresh(auszahlung)

    return AuszahlungResponse(
        id=auszahlung.id,
        schueler_id=auszahlung.schueler_id,
        datum=auszahlung.datum,
        betrag_cents=auszahlung.betrag_cents,
        notizen=auszahlung.notizen,
    )


@router.delete("/{auszahlung_id}", status_code=204)
def delete_auszahlung(auszahlung_id: int, db: Session = Depends(get_db)):
    a = db.query(Auszahlungen).filter(Auszahlungen.id == auszahlung_id).first()
    if not a:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden")
    db.delete(a)
    db.commit()


@router.get("/{auszahlung_id}/html", response_class=HTMLResponse)
def get_auszahlung_html(auszahlung_id: int, db: Session = Depends(get_db)):
    html = render_auszahlung_html(db, auszahlung_id)
    if not html:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden")
    return HTMLResponse(content=html)


@router.get("/{auszahlung_id}/pdf")
def get_auszahlung_pdf(auszahlung_id: int, db: Session = Depends(get_db)):
    html = render_auszahlung_html(db, auszahlung_id)
    if not html:
        raise HTTPException(status_code=404, detail="Auszahlung nicht gefunden")

    pdf_bytes = render_auszahlung_pdf(db, auszahlung_id)
    if not pdf_bytes:
        raise HTTPException(
            status_code=501,
            detail="PDF-Erzeugung nicht verfuegbar (WeasyPrint nicht installiert)",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="auszahlung-{auszahlung_id}.pdf"'},
    )
