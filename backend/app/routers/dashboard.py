"""
Dashboard endpoint.

GET /api/dashboard
"""

from datetime import date
from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db
from app.schemas import DashboardResponse, LetzterVorgang

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("", response_model=DashboardResponse)
def get_dashboard(db: Session = Depends(get_db)):
    """Aggregate statistics for the dashboard."""
    today = date.today()
    first_of_month = today.replace(day=1).isoformat()

    # Total active students
    anzahl_schueler = db.execute(
        text("SELECT COUNT(*) FROM schueler WHERE geloescht_am IS NULL")
    ).scalar()

    # Total active book titles
    anzahl_buecher_titel = db.execute(
        text("SELECT COUNT(*) FROM buecher WHERE geloescht_am IS NULL")
    ).scalar()

    # Open loans (non-returned items from non-cancelled invoices)
    offene_ausleihen = db.execute(
        text(
            """
            SELECT COUNT(*)
            FROM rechnungs_posten rp
            JOIN rechnungen r ON r.id = rp.rechnung_id
            WHERE r.status != 'storniert' AND rp.zurueckgegeben = 0
            """
        )
    ).scalar()

    # Sales this month
    verkaeufe_monat = db.execute(
        text(
            "SELECT COUNT(*) FROM rechnungen "
            "WHERE datum >= :fom AND status != 'storniert'"
        ),
        {"fom": first_of_month},
    ).scalar()

    # Returns this month
    rueckgaben_monat = db.execute(
        text(
            "SELECT COUNT(*) FROM gutschriften WHERE datum >= :fom"
        ),
        {"fom": first_of_month},
    ).scalar()

    # Revenue this month
    umsatz_monat_cents = db.execute(
        text(
            "SELECT COALESCE(SUM(summe_cents), 0) FROM rechnungen "
            "WHERE datum >= :fom AND status != 'storniert'"
        ),
        {"fom": first_of_month},
    ).scalar()

    # Credits this month
    gutschriften_monat_cents = db.execute(
        text(
            "SELECT COALESCE(SUM(summe_cents), 0) FROM gutschriften "
            "WHERE datum >= :fom"
        ),
        {"fom": first_of_month},
    ).scalar()

    letzte_vorgaenge_rows = db.execute(text("""
        SELECT id, typ, bezeichnung, betrag_cents, datum, erstellt_am, schueler_id, schueler_name
        FROM (
            SELECT r.id, 'rechnung' AS typ,
                   'Schulbücher ' || r.schuljahr AS bezeichnung,
                   -(r.summe_cents) AS betrag_cents,
                   r.datum, r.erstellt_am, r.schueler_id,
                   s.vorname || ' ' || s.nachname AS schueler_name
            FROM rechnungen r JOIN schueler s ON s.id = r.schueler_id
            WHERE r.status != 'storniert'
            UNION ALL
            SELECT g.id, 'gutschrift' AS typ,
                   'Buchrückgabe' AS bezeichnung,
                   g.summe_cents AS betrag_cents,
                   g.datum, g.erstellt_am, g.schueler_id,
                   s.vorname || ' ' || s.nachname AS schueler_name
            FROM gutschriften g JOIN schueler s ON s.id = g.schueler_id
            UNION ALL
            SELECT CAST(z.id AS TEXT), 'zahlung' AS typ,
                   'Zahlungseingang' || CASE WHEN z.notizen IS NOT NULL AND z.notizen != '' THEN ' · ' || z.notizen ELSE '' END AS bezeichnung,
                   z.betrag_cents,
                   z.datum, z.erstellt_am, z.schueler_id,
                   s.vorname || ' ' || s.nachname AS schueler_name
            FROM zahlungen z JOIN schueler s ON s.id = z.schueler_id
            UNION ALL
            SELECT CAST(a.id AS TEXT), 'auszahlung' AS typ,
                   'Auszahlung Schulguthaben' || CASE WHEN a.notizen IS NOT NULL AND a.notizen != '' THEN ' · ' || a.notizen ELSE '' END AS bezeichnung,
                   -(a.betrag_cents) AS betrag_cents,
                   a.datum, a.erstellt_am, a.schueler_id,
                   s.vorname || ' ' || s.nachname AS schueler_name
            FROM auszahlungen a JOIN schueler s ON s.id = a.schueler_id
        )
        ORDER BY erstellt_am DESC LIMIT 6
    """)).fetchall()

    letzte_vorgaenge = [
        LetzterVorgang(
            id=row.id,
            typ=row.typ,
            bezeichnung=row.bezeichnung,
            betrag_cents=row.betrag_cents,
            datum=row.datum,
            erstellt_am=row.erstellt_am,
            schueler_id=row.schueler_id,
            schueler_name=row.schueler_name,
        )
        for row in letzte_vorgaenge_rows
    ]

    return DashboardResponse(
        anzahl_schueler=anzahl_schueler or 0,
        anzahl_buecher_titel=anzahl_buecher_titel or 0,
        offene_ausleihen=offene_ausleihen or 0,
        verkaeufe_monat=verkaeufe_monat or 0,
        rueckgaben_monat=rueckgaben_monat or 0,
        umsatz_monat_cents=umsatz_monat_cents or 0,
        gutschriften_monat_cents=gutschriften_monat_cents or 0,
        letzte_vorgaenge=letzte_vorgaenge,
    )
