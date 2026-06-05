"""
Saldo and transaction aggregation.
"""

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.services.zustand import berechne_gutschrift_nutzungsjahr, get_nutzungsjahr_abschlaege


def get_saldo(db: Session, schueler_id: str) -> int:
    row = db.execute(
        text("SELECT saldo_cents FROM v_schueler_saldo WHERE schueler_id = :sid"),
        {"sid": schueler_id},
    ).first()
    return row.saldo_cents if row else 0


def get_vorgaenge(db: Session, schueler_id: str) -> list[dict]:
    rows = db.execute(
        text(
            "SELECT id, typ, datum, bezeichnung, betrag_cents, mail_versandt_am "
            "FROM v_schueler_vorgaenge "
            "WHERE schueler_id = :sid "
            "ORDER BY datum, id"
        ),
        {"sid": schueler_id},
    ).fetchall()

    items = []
    running_saldo = 0
    for row in rows:
        if row.typ in ("gutschrift", "auszahlung", "verrechnung"):
            running_saldo += row.betrag_cents
        items.append(
            {
                "id": row.id,
                "typ": row.typ,
                "datum": row.datum,
                "bezeichnung": row.bezeichnung,
                "betrag_cents": row.betrag_cents,
                "saldo_nach_cents": running_saldo,
                "mail_versandt_am": row.mail_versandt_am,
            }
        )
    return items


def get_aktive_buecher(
    db: Session,
    schueler_id: str,
    include_beschaedigte_rueckgaben: bool = False,
) -> list[dict]:
    from app.models import Einstellungen
    schuljahr_row = db.query(Einstellungen).filter(
        Einstellungen.schluessel == "schuljahr_aktuell"
    ).first()
    aktuelles_schuljahr = schuljahr_row.wert if schuljahr_row else "2025/2026"

    rows = db.execute(
        text(
            """
            SELECT
                rp.id AS rechnungs_posten_id,
                rp.rechnung_id,
                rp.buch_id,
                b.titel,
                b.fach,
                b.verlag,
                r.datum AS kaufdatum,
                r.schuljahr AS verkauft_schuljahr,
                rp.preis_cents,
                rp.nutzungsjahr_beim_kauf,
                b.preis_cents AS basispreis_cents,
                COALESCE(b.schutzgebuehr_cents, 0) AS schutzgebuehr_cents,
                COALESCE(rp.zurueckgegeben, 0) AS zurueckgegeben,
                CASE
                    WHEN COALESCE(gp.beschaedigt, 0) = 1 THEN 1
                    ELSE 0
                END AS beschaedigt
            FROM rechnungs_posten rp
            JOIN rechnungen r ON r.id = rp.rechnung_id
            JOIN buecher b ON b.id = rp.buch_id
            LEFT JOIN gutschrift_posten gp ON gp.rechnungs_posten_id = rp.id
            WHERE r.schueler_id = :sid
              AND r.status != 'storniert'
              AND (
                rp.zurueckgegeben = 0
                OR (:include_beschaedigte_rueckgaben = 1 AND COALESCE(gp.beschaedigt, 0) = 1)
              )
              AND COALESCE(rp.behalten, 0) = 0
            ORDER BY COALESCE(rp.zurueckgegeben, 0), r.datum DESC, b.titel
            """
        ),
        {
            "sid": schueler_id,
            "include_beschaedigte_rueckgaben": 1 if include_beschaedigte_rueckgaben else 0,
        },
    ).fetchall()

    abschlaege = get_nutzungsjahr_abschlaege(db)

    result = []
    for row in rows:
        gutschrift_cents, nutzungsjahr, abschreibung_prozent = berechne_gutschrift_nutzungsjahr(
            row.preis_cents,
            row.verkauft_schuljahr,
            aktuelles_schuljahr,
            abschlaege,
            row.schutzgebuehr_cents if row.schutzgebuehr_cents else None,
            row.basispreis_cents,
            row.nutzungsjahr_beim_kauf,
        )
        ist_beschaedigt = bool(row.beschaedigt)
        ist_zurueckgegeben = bool(row.zurueckgegeben)
        result.append({
            "rechnungs_posten_id": row.rechnungs_posten_id,
            "rechnung_id": row.rechnung_id,
            "buch_id": row.buch_id,
            "titel": row.titel,
            "fach": row.fach,
            "verlag": row.verlag,
            "kaufdatum": row.kaufdatum,
            "verkauft_schuljahr": row.verkauft_schuljahr,
            "preis_cents": row.preis_cents,
            "gutschrift_cents": gutschrift_cents,
            "nutzungsjahr": nutzungsjahr,
            "abschreibung_prozent": abschreibung_prozent,
            "schutzgebuehr_cents": row.schutzgebuehr_cents,
            "zurueckgegeben": ist_zurueckgegeben,
            "beschaedigt": ist_beschaedigt,
        })
    return result


def count_aktive_buecher(db: Session, schueler_id: str) -> int:
    row = db.execute(
        text(
            """
            SELECT COUNT(*) AS cnt
            FROM rechnungs_posten rp
            JOIN rechnungen r ON r.id = rp.rechnung_id
            WHERE r.schueler_id = :sid
              AND r.status != 'storniert'
              AND rp.zurueckgegeben = 0
              AND COALESCE(rp.behalten, 0) = 0
            """
        ),
        {"sid": schueler_id},
    ).first()
    return row.cnt if row else 0


def count_behalten_buecher(db: Session, schueler_id: str) -> int:
    row = db.execute(
        text(
            """
            SELECT COUNT(*) AS cnt
            FROM rechnungs_posten rp
            JOIN rechnungen r ON r.id = rp.rechnung_id
            WHERE r.schueler_id = :sid
              AND r.status != 'storniert'
              AND COALESCE(rp.behalten, 0) = 1
            """
        ),
        {"sid": schueler_id},
    ).first()
    return row.cnt if row else 0


def count_vorgaenge(db: Session, schueler_id: str) -> int:
    row = db.execute(
        text(
            "SELECT COUNT(*) AS cnt FROM v_schueler_vorgaenge "
            "WHERE schueler_id = :sid"
        ),
        {"sid": schueler_id},
    ).first()
    return row.cnt if row else 0


def get_letzter_vorgang_datum(db: Session, schueler_id: str) -> str | None:
    row = db.execute(
        text(
            "SELECT MAX(datum) AS d FROM v_schueler_vorgaenge "
            "WHERE schueler_id = :sid"
        ),
        {"sid": schueler_id},
    ).first()
    return row.d if row else None
