"""
Klassenversetzung — Schüler am Beginn eines neuen Schuljahres in die nächste Klasse versetzen.

GET  /api/klassenversetzung/vorschau    — Alle aktiven Klassen mit Schülern + Versetzungsvorschlag
POST /api/klassenversetzung/ausfuehren  — Versetzung durchführen (klasse-Feld aktualisieren)
"""

import re
from datetime import date
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.models import Schueler, Einstellungen
from app.schemas import (
    KlassenversetzungGruppe,
    KlassenversetzungSchueler,
    KlassenversetzungVorschauResponse,
    VersetzungItem,
    VersetzungRequest,
    VersetzungResponse,
)

router = APIRouter(prefix="/api/klassenversetzung", tags=["Klassenversetzung"])


def _naechste_klasse(klasse: str) -> tuple[str, bool]:
    """
    Berechnet die Folge-Klasse und ob es sich um eine Abgangsklasse handelt.

    Beispiele: "6" → ("7", False), "6a" → ("7a", False), "12b" → ("13b", True)

    Gibt (neue_klasse, ist_abgang) zurück. ist_abgang=True bedeutet, die Schüler
    verlassen die Schule (höchste Klasse überschritten).
    """
    match = re.match(r'^(\d+)([a-zA-Z]*)$', klasse.strip())
    if not match:
        # Unbekanntes Format (z.B. "EF", "Q1") — unverändert zurückgeben
        return klasse, False

    nummer = int(match.group(1))
    suffix = match.group(2)
    naechste = nummer + 1

    abgangs_stufe = 12

    if nummer >= abgangs_stufe:
        return f"{naechste}{suffix}", True
    return f"{naechste}{suffix}", False


def _get_setting(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.query(Einstellungen).filter(Einstellungen.schluessel == key).first()
    return row.wert if row else default


def _set_setting(db: Session, key: str, value: str) -> None:
    row = db.query(Einstellungen).filter(Einstellungen.schluessel == key).first()
    if row:
        row.wert = value
    else:
        db.add(Einstellungen(schluessel=key, wert=value))


def _aktive_buecher_count(db: Session, schueler_id: str) -> int:
    return db.execute(text("""
        SELECT COUNT(*) FROM rechnungs_posten rp
        JOIN rechnungen re ON re.id = rp.rechnung_id
        WHERE re.schueler_id = :sid
          AND re.status != 'storniert'
          AND rp.zurueckgegeben = 0
          AND rp.behalten = 0
    """), {"sid": schueler_id}).scalar() or 0


@router.get("/vorschau", response_model=KlassenversetzungVorschauResponse)
def get_vorschau(db: Session = Depends(get_db)):
    """
    Gibt alle aktiven Klassen gruppiert zurück, jeweils mit der vorgeschlagenen
    Zielklasse und den zugehörigen Schülern.
    """
    rows = db.execute(text("""
        SELECT s.id, s.vorname, s.nachname, s.klasse, s.klasse_seit,
               COALESCE(v.saldo_cents, 0) AS saldo_cents
        FROM schueler s
        LEFT JOIN v_schueler_saldo v ON v.schueler_id = s.id
        WHERE s.geloescht_am IS NULL AND s.archiviert_am IS NULL
        ORDER BY s.klasse, s.klasse_seit, s.nachname, s.vorname
    """)).fetchall()

    gruppen_map: dict[str, list] = {}
    for r in rows:
        gruppen_map.setdefault(r.klasse, []).append(r)

    gruppen = []
    for klasse_von, schueler_rows in sorted(gruppen_map.items()):
        klasse_nach, ist_abgang = _naechste_klasse(klasse_von)

        schueler_list = []
        for r in schueler_rows:
            aktive = _aktive_buecher_count(db, r.id)
            schueler_list.append(KlassenversetzungSchueler(
                id=r.id,
                vorname=r.vorname,
                nachname=r.nachname,
                klasse_von=klasse_von,
                klasse_nach=klasse_nach,
                klasse_seit=r.klasse_seit,
                aktive_buecher=aktive,
                saldo_cents=r.saldo_cents,
            ))

        gruppen.append(KlassenversetzungGruppe(
            klasse_von=klasse_von,
            klasse_nach=klasse_nach,
            ist_abgangsklasse=ist_abgang,
            schueler=schueler_list,
        ))

    letzte = _get_setting(db, "letzte_klassenversetzung_am")
    naechster = _get_setting(db, "schuljahr_naechster_beginn")
    sperre = _get_setting(db, "versetzung_sperre_aktiv", "true") == "true"

    return KlassenversetzungVorschauResponse(
        gruppen=gruppen,
        letzte_versetzung_am=letzte,
        naechster_schuljahresbeginn=naechster,
        versetzung_sperre_aktiv=sperre,
    )


@router.post("/ausfuehren", response_model=VersetzungResponse)
def ausfuehren(data: VersetzungRequest, db: Session = Depends(get_db)):
    """
    Führt die Klassenversetzung für die übermittelten Schüler durch.

    - Schüler mit einer Abgangsklasse (Zielklasse höher als Abgangsstufe) werden archiviert.
      Haben sie noch aktive Bücher, werden diese als "behalten" markiert.
    - Alle anderen bekommen die neue Klasse ins klasse-Feld geschrieben.
    """
    from datetime import datetime
    now = datetime.now().isoformat()
    today = date.today().isoformat()

    sperre = _get_setting(db, "versetzung_sperre_aktiv", "true") == "true"
    naechster = _get_setting(db, "schuljahr_naechster_beginn")
    if sperre and naechster and today < naechster:
        raise HTTPException(
            status_code=403,
            detail=f"Klassenversetzung ist erst ab dem {naechster} (Schuljahresbeginn) möglich. Die Sperre kann im Profil deaktiviert werden.",
        )

    versetzt = 0
    archiviert = 0

    for item in data.versetzungen:
        s = db.query(Schueler).filter(
            Schueler.id == item.schueler_id,
            Schueler.geloescht_am.is_(None),
            Schueler.archiviert_am.is_(None),
        ).first()
        if not s:
            continue

        _, wird_abgaenger = _naechste_klasse(s.klasse)

        if item.klasse_nach == "__archiv__" or (wird_abgaenger and item.klasse_nach == _naechste_klasse(s.klasse)[0]):
            aktive = _aktive_buecher_count(db, s.id)
            if aktive > 0:
                buch_ids = db.execute(text("""
                    SELECT rp.buch_id FROM rechnungs_posten rp
                    JOIN rechnungen re ON re.id = rp.rechnung_id
                    WHERE re.schueler_id = :sid AND re.status != 'storniert'
                      AND rp.zurueckgegeben = 0 AND rp.behalten = 0
                """), {"sid": s.id}).fetchall()
                for row in buch_ids:
                    db.execute(text("""
                        UPDATE buecher
                        SET bestand_gesamt = MAX(0, bestand_gesamt - 1),
                            bestand_ausgegeben = MAX(0, bestand_ausgegeben - 1)
                        WHERE id = :bid
                    """), {"bid": row.buch_id})
                db.execute(text("""
                    UPDATE rechnungs_posten SET behalten = 1
                    WHERE id IN (
                        SELECT rp.id FROM rechnungs_posten rp
                        JOIN rechnungen re ON re.id = rp.rechnung_id
                        WHERE re.schueler_id = :sid AND re.status != 'storniert'
                          AND rp.zurueckgegeben = 0 AND rp.behalten = 0
                    )
                """), {"sid": s.id})
            s.archiviert_am = now
            s.archiviert_schuljahr = _get_setting(db, "schuljahr_aktuell")
            archiviert += 1
        else:
            s.klasse = item.klasse_nach
            s.klasse_seit = today
            versetzt += 1

    _set_setting(db, "letzte_klassenversetzung_am", today)
    db.commit()

    return VersetzungResponse(versetzt=versetzt, archiviert=archiviert)
