"""
Gutschrift (returns) endpoints.
"""

from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse, Response
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import (
    BuchZustandBestand,
    Buecher,
    Einstellungen,
    Gutschriften,
    GutschriftPosten,
    Rechnungen,
    RechnungsPosten,
    Schueler,
)
from app.schemas import (
    ErrorResponse,
    GutschriftDetailResponse,
    GutschriftPostenResponse,
    GutschriftRequest,
    GutschriftResponse,
)
from app.services.ids import generate_gutschrift_id
from app.services.pdf import render_gutschrift_html, render_gutschrift_pdf
from app.services.zustand import (
    berechne_bucket_preis,
    berechne_gutschrift_nutzungsjahr,
    current_schuljahr_start,
    effective_nutzungsjahr,
    get_nutzungsjahr_abschlaege,
)

router = APIRouter(prefix="/api", tags=["Gutschrift"])


def _get_or_create_bestand(
    db: Session, buch_id: str, preis_cents: int, nutzungsjahr: int,
) -> BuchZustandBestand:
    """Findet oder erstellt einen Bucket für das gegebene effektive Nutzungsjahr.

    Sucht zuerst nach einem Bucket, dessen effektives NJ übereinstimmt (berücksichtigt Alterung).
    Zustand wird immer als 'sehr_gut' gesetzt.
    """
    cur_sj = current_schuljahr_start()
    all_buckets = (
        db.query(BuchZustandBestand)
        .filter(BuchZustandBestand.buch_id == buch_id)
        .all()
    )
    for bucket in all_buckets:
        stored = bucket.nutzungsjahr if bucket.nutzungsjahr is not None else 0
        if effective_nutzungsjahr(stored, bucket.schuljahr_eingestellt) == nutzungsjahr:
            bucket.verkaufspreis_cents = preis_cents
            db.flush()
            return bucket

    bestand = BuchZustandBestand(
        buch_id=buch_id,
        zustand="sehr_gut",
        verkaufspreis_cents=preis_cents,
        bestand_verfuegbar=0,
        nutzungsjahr=nutzungsjahr,
        schuljahr_eingestellt=cur_sj if nutzungsjahr > 0 else None,
    )
    db.add(bestand)
    db.flush()
    return bestand


@router.post(
    "/gutschrift",
    response_model=GutschriftResponse,
    status_code=201,
    responses={422: {"model": ErrorResponse}},
)
def create_gutschrift(data: GutschriftRequest, db: Session = Depends(get_db)):
    schueler = db.query(Schueler).filter(
        Schueler.id == data.schueler_id, Schueler.geloescht_am.is_(None)
    ).first()
    if not schueler:
        raise HTTPException(status_code=404, detail="Schueler nicht gefunden")

    schuljahr_row = db.query(Einstellungen).filter(
        Einstellungen.schluessel == "schuljahr_aktuell"
    ).first()
    schuljahr = schuljahr_row.wert if schuljahr_row else "2025/2026"

    gutschrift_id = generate_gutschrift_id(db, schuljahr)
    today = date.today().isoformat()
    abschlaege = get_nutzungsjahr_abschlaege(db)

    requested_rueckgaben = data.rueckgaben or [
        {"rechnungs_posten_id": rp_id}
        for rp_id in data.rechnungs_posten_ids
    ]

    validated_posten = []
    summe = 0

    for rueckgabe in requested_rueckgaben:
        rp_id = (
            rueckgabe.rechnungs_posten_id
            if hasattr(rueckgabe, "rechnungs_posten_id")
            else rueckgabe["rechnungs_posten_id"]
        )

        rp = db.query(RechnungsPosten).filter(RechnungsPosten.id == rp_id).first()
        if not rp:
            raise HTTPException(
                status_code=404,
                detail=f"Rechnungsposten {rp_id} nicht gefunden",
            )

        rechnung = db.query(Rechnungen).filter(Rechnungen.id == rp.rechnung_id).first()
        if not rechnung or rechnung.schueler_id != data.schueler_id:
            raise HTTPException(
                status_code=422,
                detail=f"Rechnungsposten {rp_id} gehoert nicht zu Schueler {data.schueler_id}",
            )

        if rechnung.status == "storniert":
            raise HTTPException(
                status_code=422,
                detail=f"Rechnung {rechnung.id} ist storniert",
            )

        if rp.zurueckgegeben:
            raise HTTPException(
                status_code=422,
                detail={
                    "error": {
                        "code": "BEREITS_ZURUECKGEGEBEN",
                        "message": f"Posten {rp_id} wurde bereits zurueckgegeben",
                        "details": {"rechnungs_posten_id": rp_id},
                    }
                },
            )

        beschaedigt = (
            rueckgabe.beschaedigt
            if hasattr(rueckgabe, "beschaedigt")
            else rueckgabe.get("beschaedigt", False)
        )

        buch = db.query(Buecher).filter(Buecher.id == rp.buch_id).first()
        if beschaedigt:
            betrag, nj, abschreibung_prozent = 0, 0, 0
            bucket_preis = 0
        else:
            # betrag: credit the student receives; bucket_preis: stored in inventory (no surcharge)
            betrag, nj, abschreibung_prozent = berechne_gutschrift_nutzungsjahr(
                rp.preis_cents,
                rechnung.schuljahr,
                schuljahr,
                abschlaege,
                buch.schutzgebuehr_cents if buch else None,
                buch.preis_cents if buch else None,
                rp.nutzungsjahr_beim_kauf,
            )
            bucket_preis = berechne_bucket_preis(
                buch.preis_cents if buch else betrag,
                nj,
                abschlaege,
                buch.schutzgebuehr_cents if buch else None,
            )

        validated_posten.append(
            {
                "rp": rp,
                "rp_id": rp_id,
                "buch": buch,
                "betrag": betrag,
                "bucket_preis": bucket_preis,
                "abschreibung_prozent": abschreibung_prozent,
                "nj": nj,
                "beschaedigt": beschaedigt,
            }
        )
        summe += betrag

    gutschrift = Gutschriften(
        id=gutschrift_id,
        schueler_id=data.schueler_id,
        schuljahr=schuljahr,
        datum=today,
        summe_cents=summe,
        ausgezahlt=0,
        notizen=data.notizen,
    )
    db.add(gutschrift)
    db.flush()

    posten_list = []
    for vp in validated_posten:
        rp = vp["rp"]
        buch = vp["buch"]

        rp.zurueckgegeben = 1
        rp.zurueckgegeben_am = today

        if buch:
            buch.bestand_ausgegeben = max(0, buch.bestand_ausgegeben - 1)
            if vp["beschaedigt"]:
                buch.bestand_gesamt = max(0, buch.bestand_gesamt - 1)

        if not vp["beschaedigt"]:
            bestand = _get_or_create_bestand(db, rp.buch_id, vp["bucket_preis"], vp["nj"])
            bestand.bestand_verfuegbar += 1

        gp = GutschriftPosten(
            gutschrift_id=gutschrift_id,
            rechnungs_posten_id=vp["rp_id"],
            betrag_cents=vp["betrag"],
            zustand="beschaedigt" if vp["beschaedigt"] else "sehr_gut",
            abschreibung_prozent=vp["abschreibung_prozent"],
            ursprungs_preis_cents=rp.preis_cents,
            nutzungsjahr=vp["nj"],
            beschaedigt=1 if vp["beschaedigt"] else 0,
        )
        db.add(gp)

        posten_list.append(
            {
                "rechnungs_posten_id": vp["rp_id"],
                "buch_id": rp.buch_id,
                "titel": buch.titel if buch else "Unbekannt",
                "betrag_cents": vp["betrag"],
                "abschreibung_prozent": vp["abschreibung_prozent"],
                "ursprungs_preis_cents": rp.preis_cents,
                "wiederverkaufspreis_cents": vp["betrag"],
                "beschaedigt": vp["beschaedigt"],
            }
        )

    db.commit()

    return GutschriftResponse(
        id=gutschrift_id,
        schueler_id=data.schueler_id,
        datum=today,
        summe_cents=summe,
        ausgezahlt=False,
        posten=[GutschriftPostenResponse(**p) for p in posten_list],
    )


@router.get("/gutschriften/{gutschrift_id}", response_model=GutschriftDetailResponse)
def get_gutschrift(gutschrift_id: str, db: Session = Depends(get_db)):
    g = db.query(Gutschriften).filter(Gutschriften.id == gutschrift_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Gutschrift nicht gefunden")

    posten = (
        db.query(GutschriftPosten)
        .filter(GutschriftPosten.gutschrift_id == gutschrift_id)
        .all()
    )

    posten_responses = []
    for gp in posten:
        rp = db.query(RechnungsPosten).filter(
            RechnungsPosten.id == gp.rechnungs_posten_id
        ).first()
        buch = db.query(Buecher).filter(Buecher.id == rp.buch_id).first() if rp else None
        posten_responses.append(
            GutschriftPostenResponse(
                rechnungs_posten_id=gp.rechnungs_posten_id,
                buch_id=rp.buch_id if rp else "?",
                titel=buch.titel if buch else "Unbekannt",
                betrag_cents=gp.betrag_cents,
                abschreibung_prozent=gp.abschreibung_prozent,
                ursprungs_preis_cents=gp.ursprungs_preis_cents,
                wiederverkaufspreis_cents=gp.betrag_cents,
            )
        )

    return GutschriftDetailResponse(
        id=g.id,
        schueler_id=g.schueler_id,
        schuljahr=g.schuljahr,
        datum=g.datum,
        summe_cents=g.summe_cents,
        ausgezahlt=bool(g.ausgezahlt),
        ausgezahlt_am=g.ausgezahlt_am,
        notizen=g.notizen,
        posten=posten_responses,
    )


@router.post("/gutschriften/{gutschrift_id}/auszahlen")
def auszahlen_gutschrift(gutschrift_id: str, db: Session = Depends(get_db)):
    g = db.query(Gutschriften).filter(Gutschriften.id == gutschrift_id).first()
    if not g:
        raise HTTPException(status_code=404, detail="Gutschrift nicht gefunden")

    if g.ausgezahlt:
        raise HTTPException(status_code=422, detail="Gutschrift bereits ausgezahlt")

    g.ausgezahlt = 1
    g.ausgezahlt_am = datetime.now().isoformat()
    db.commit()

    return {"status": "ausgezahlt", "gutschrift_id": gutschrift_id}


@router.get("/gutschriften/{gutschrift_id}/pdf")
def get_gutschrift_pdf(gutschrift_id: str, db: Session = Depends(get_db)):
    html = render_gutschrift_html(db, gutschrift_id)
    if not html:
        raise HTTPException(status_code=404, detail="Gutschrift nicht gefunden")

    pdf_bytes = render_gutschrift_pdf(db, gutschrift_id)
    if not pdf_bytes:
        raise HTTPException(
            status_code=501,
            detail="PDF-Erzeugung nicht verfuegbar (WeasyPrint nicht installiert)",
        )

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{gutschrift_id}.pdf"'},
    )


@router.get("/gutschriften/{gutschrift_id}/html", response_class=HTMLResponse)
def get_gutschrift_html(gutschrift_id: str, db: Session = Depends(get_db)):
    html = render_gutschrift_html(db, gutschrift_id)
    if not html:
        raise HTTPException(status_code=404, detail="Gutschrift nicht gefunden")

    return HTMLResponse(content=html)
