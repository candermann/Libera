"""
Mahnungen (dunning) endpoints.

GET  /api/mahnungen
POST /api/mahnungen/sammeldruck
"""

from datetime import date
from fastapi import APIRouter, Depends
from fastapi.responses import Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import (
    MahnungItem,
    MahnungSummary,
    MahnungenResponse,
    SammeldruckRequest,
)
from app.services.pdf import render_sammel_mahnung_pdf

router = APIRouter(prefix="/api/mahnungen", tags=["Mahnungen"])


@router.get("", response_model=MahnungenResponse)
def list_mahnungen(db: Session = Depends(get_db)):
    """
    List all students with saldo < 0, sorted by days open.

    Stufen: 1 (30+ Tage), 2 (60+ Tage), 3 (90+ Tage).
    """
    rows = db.execute(
        text(
            """
            SELECT
                s.id AS schueler_id,
                s.nachname || ', ' || s.vorname AS name,
                s.klasse,
                v.saldo_cents,
                MIN(r.datum) AS aelteste_rechnung
            FROM schueler s
            JOIN v_schueler_saldo v ON v.schueler_id = s.id
            LEFT JOIN rechnungen r ON r.schueler_id = s.id AND r.status = 'offen'
            WHERE v.saldo_cents < 0
              AND s.geloescht_am IS NULL
            GROUP BY s.id
            ORDER BY MIN(r.datum) ASC
            """
        )
    ).fetchall()

    today = date.today()
    items = []
    summary = {
        "stufe_1_anzahl": 0, "stufe_1_summe_cents": 0,
        "stufe_2_anzahl": 0, "stufe_2_summe_cents": 0,
        "stufe_3_anzahl": 0, "stufe_3_summe_cents": 0,
    }

    for r in rows:
        tage_offen = 0
        if r.aelteste_rechnung:
            try:
                d = date.fromisoformat(r.aelteste_rechnung)
                tage_offen = (today - d).days
            except ValueError:
                pass

        if tage_offen < 30:
            stufe = 0
        elif tage_offen < 60:
            stufe = 1
        elif tage_offen < 90:
            stufe = 2
        else:
            stufe = 3

        betrag = abs(r.saldo_cents)

        # Count open books for this student
        buecher_count = db.execute(
            text(
                """
                SELECT COUNT(*) AS cnt
                FROM rechnungs_posten rp
                JOIN rechnungen re ON re.id = rp.rechnung_id
                WHERE re.schueler_id = :sid
                  AND re.status != 'storniert'
                  AND rp.zurueckgegeben = 0
                """
            ),
            {"sid": r.schueler_id},
        ).scalar()

        items.append(
            MahnungItem(
                schueler_id=r.schueler_id,
                name=r.name,
                klasse=r.klasse,
                anzahl_buecher=buecher_count or 0,
                betrag_cents=betrag,
                tage_offen=tage_offen,
                stufe=stufe,
            )
        )

        if stufe >= 1:
            summary["stufe_1_anzahl"] += 1
            summary["stufe_1_summe_cents"] += betrag
        if stufe >= 2:
            summary["stufe_2_anzahl"] += 1
            summary["stufe_2_summe_cents"] += betrag
        if stufe >= 3:
            summary["stufe_3_anzahl"] += 1
            summary["stufe_3_summe_cents"] += betrag

    return MahnungenResponse(
        items=items,
        summary=MahnungSummary(**summary),
    )


@router.post("/sammeldruck")
def sammeldruck(data: SammeldruckRequest, db: Session = Depends(get_db)):
    """Generate a combined PDF with dunning letters for multiple students."""
    pdf_bytes = render_sammel_mahnung_pdf(db, data.schueler_ids)
    if not pdf_bytes:
        return Response(status_code=404)

    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="mahnungen.pdf"'
        },
    )
