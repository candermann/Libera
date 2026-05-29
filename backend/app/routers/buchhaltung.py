"""
Buchhaltung endpoints — invoice overview grouped by school year.

GET /api/buchhaltung/schuljahre
GET /api/buchhaltung/rechnungen?schuljahr=2025/2026
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.db import get_db

router = APIRouter(prefix="/api/buchhaltung", tags=["Buchhaltung"])


@router.get("/schuljahre")
def list_schuljahre(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT
            schuljahr,
            COUNT(*) AS anzahl,
            SUM(CASE WHEN status != 'storniert' THEN summe_cents - verrechnet_cents ELSE 0 END) AS umsatz_cents,
            SUM(CASE WHEN status = 'storniert' THEN 1 ELSE 0 END) AS anzahl_storniert
        FROM rechnungen
        GROUP BY schuljahr
        UNION
        SELECT
            e.wert AS schuljahr,
            0 AS anzahl,
            0 AS umsatz_cents,
            0 AS anzahl_storniert
        FROM einstellungen e
        WHERE e.schluessel = 'schuljahr_aktuell'
          AND e.wert NOT IN (SELECT DISTINCT schuljahr FROM rechnungen)
        ORDER BY schuljahr DESC
    """)).fetchall()
    return {"items": [
        {
            "schuljahr": r.schuljahr,
            "anzahl": r.anzahl,
            "umsatz_cents": r.umsatz_cents or 0,
            "anzahl_storniert": r.anzahl_storniert or 0,
        }
        for r in rows
    ]}


@router.get("/rechnungen")
def list_rechnungen_buchhaltung(
    schuljahr: str | None = Query(None),
    db: Session = Depends(get_db),
):
    if schuljahr:
        rows = db.execute(text("""
            SELECT r.id, r.schueler_id,
                   s.nachname || ', ' || s.vorname AS schueler_name,
                   s.nachname, s.vorname,
                   s.klasse, s.email_eltern,
                   r.datum, r.summe_cents, r.verrechnet_cents,
                   (r.summe_cents - r.verrechnet_cents) AS zu_zahlen_cents,
                   r.status, r.schuljahr, r.mail_versandt_am, r.mail_versandt_an
            FROM rechnungen r
            JOIN schueler s ON s.id = r.schueler_id
            WHERE r.schuljahr = :schuljahr
            ORDER BY s.nachname, s.vorname, r.datum DESC
        """), {"schuljahr": schuljahr}).fetchall()
    else:
        rows = db.execute(text("""
            SELECT r.id, r.schueler_id,
                   s.nachname || ', ' || s.vorname AS schueler_name,
                   s.nachname, s.vorname,
                   s.klasse, s.email_eltern,
                   r.datum, r.summe_cents, r.verrechnet_cents,
                   (r.summe_cents - r.verrechnet_cents) AS zu_zahlen_cents,
                   r.status, r.schuljahr, r.mail_versandt_am, r.mail_versandt_an,
                   COALESCE((SELECT SUM(z.betrag_cents) FROM zahlungen z WHERE z.schueler_id = r.schueler_id), 0) AS zahlungen_cents
            FROM rechnungen r
            JOIN schueler s ON s.id = r.schueler_id
            ORDER BY r.schuljahr DESC, s.klasse, s.nachname, s.vorname
        """)).fetchall()
    return {"items": [
        {
            "id": r.id,
            "schueler_id": r.schueler_id,
            "schueler_name": r.schueler_name,
            "klasse": r.klasse,
            "email_eltern": r.email_eltern,
            "datum": r.datum,
            "summe_cents": r.summe_cents,
            "verrechnet_cents": r.verrechnet_cents,
            "zu_zahlen_cents": r.zu_zahlen_cents,
            "zahlungen_cents": getattr(r, "zahlungen_cents", None) or 0,
            "status": r.status,
            "schuljahr": r.schuljahr,
            "mail_versandt_am": r.mail_versandt_am,
            "mail_versandt_an": r.mail_versandt_an,
        }
        for r in rows
    ]}


@router.get("/unversandt")
def list_unversandt(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT r.id, r.schueler_id,
               s.nachname || ', ' || s.vorname AS schueler_name,
               s.klasse, s.email_eltern,
               r.datum, r.summe_cents, r.verrechnet_cents,
               (r.summe_cents - r.verrechnet_cents) AS zu_zahlen_cents,
               r.status, r.schuljahr, r.mail_versandt_am, r.mail_versandt_an
        FROM rechnungen r
        JOIN schueler s ON s.id = r.schueler_id
        WHERE r.mail_versandt_am IS NULL
          AND r.status != 'storniert'
        ORDER BY r.datum DESC, r.erstellt_am DESC
    """)).fetchall()
    return {"items": [
        {
            "id": r.id,
            "schueler_id": r.schueler_id,
            "schueler_name": r.schueler_name,
            "klasse": r.klasse,
            "email_eltern": r.email_eltern,
            "datum": r.datum,
            "summe_cents": r.summe_cents,
            "verrechnet_cents": r.verrechnet_cents,
            "zu_zahlen_cents": r.zu_zahlen_cents,
            "status": r.status,
            "schuljahr": r.schuljahr,
            "mail_versandt_am": r.mail_versandt_am,
            "mail_versandt_an": r.mail_versandt_an,
        }
        for r in rows
    ]}


@router.get("/versandt")
def list_versandt(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT r.id, r.schueler_id,
               s.nachname || ', ' || s.vorname AS schueler_name,
               s.klasse, s.email_eltern,
               r.datum, r.summe_cents, r.verrechnet_cents,
               (r.summe_cents - r.verrechnet_cents) AS zu_zahlen_cents,
               r.status, r.schuljahr, r.mail_versandt_am, r.mail_versandt_an
        FROM rechnungen r
        JOIN schueler s ON s.id = r.schueler_id
        WHERE r.mail_versandt_am IS NOT NULL
          AND r.status != 'storniert'
        ORDER BY r.mail_versandt_am DESC, r.datum DESC
    """)).fetchall()
    return {"items": [
        {
            "id": r.id,
            "schueler_id": r.schueler_id,
            "schueler_name": r.schueler_name,
            "klasse": r.klasse,
            "email_eltern": r.email_eltern,
            "datum": r.datum,
            "summe_cents": r.summe_cents,
            "verrechnet_cents": r.verrechnet_cents,
            "zu_zahlen_cents": r.zu_zahlen_cents,
            "status": r.status,
            "schuljahr": r.schuljahr,
            "mail_versandt_am": r.mail_versandt_am,
            "mail_versandt_an": r.mail_versandt_an,
        }
        for r in rows
    ]}
