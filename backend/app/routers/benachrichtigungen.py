"""
Benachrichtigungen — System-Warnungen und Handlungsbedarf.

GET  /api/benachrichtigungen        — Aktive Benachrichtigungen abrufen
POST /api/benachrichtigungen/archiv/loeschen — Archivierte Schüler endgültig löschen
"""

from datetime import datetime, date, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text

from app.db import get_db
from app.models import Schueler
from app.services.zustand import current_schuljahr_start

router = APIRouter(prefix="/api/benachrichtigungen", tags=["Benachrichtigungen"])

ARCHIV_AUFBEWAHRUNG_JAHRE = 10


def _schuljahr_start_year(schuljahr: str) -> int:
    try:
        return int(str(schuljahr).split('/')[0])
    except (ValueError, IndexError):
        return 0


@router.get("")
def get_benachrichtigungen(db: Session = Depends(get_db)):
    schuljahr_row = db.execute(
        text("SELECT wert FROM einstellungen WHERE schluessel = 'schuljahr_aktuell'")
    ).scalar()
    aktuelles_schuljahr = schuljahr_row or "2025/2026"
    aktuell_start = _schuljahr_start_year(aktuelles_schuljahr)

    rows = db.execute(text("""
        SELECT id, vorname, nachname, klasse, archiviert_am, archiviert_schuljahr
        FROM schueler
        WHERE geloescht_am IS NULL
          AND archiviert_am IS NOT NULL
          AND archiviert_schuljahr IS NOT NULL
    """)).fetchall()

    abgelaufen = []
    for r in rows:
        archiv_start = _schuljahr_start_year(r.archiviert_schuljahr)
        if archiv_start > 0 and (aktuell_start - archiv_start) >= ARCHIV_AUFBEWAHRUNG_JAHRE:
            abgelaufen.append({
                "id": r.id,
                "name": f"{r.nachname}, {r.vorname}",
                "klasse": r.klasse,
                "archiviert_schuljahr": r.archiviert_schuljahr,
            })

    items = []
    if abgelaufen:
        items.append({
            "typ": "archiv_abgelaufen",
            "titel": "Aufbewahrungsfrist abgelaufen",
            "beschreibung": (
                f"{len(abgelaufen)} {'Schüler' if len(abgelaufen) == 1 else 'Schüler'} "
                f"{'ist' if len(abgelaufen) == 1 else 'sind'} seit über "
                f"{ARCHIV_AUFBEWAHRUNG_JAHRE} Schuljahren archiviert und können gelöscht werden."
            ),
            "anzahl": len(abgelaufen),
            "schueler": abgelaufen,
        })

    # Jährliche Erinnerung: nur wenn das eingestellte Schuljahr ÄLTER als erwartet ist
    erwartetes_start = current_schuljahr_start()
    erwartetes_schuljahr = f"{erwartetes_start}/{erwartetes_start + 1}"
    if aktuell_start < erwartetes_start:
        items.append({
            "typ": "schuljahr_wechsel",
            "titel": "Schuljahrwechsel anstehend",
            "beschreibung": (
                f"Das System ist noch auf Schuljahr {aktuelles_schuljahr} eingestellt. "
                f"Bitte auf {erwartetes_schuljahr} aktualisieren und Buchpreise prüfen."
            ),
            "anzahl": 0,
            "schueler": [],
            "aktion": "einstellungen",
        })

    entwurf_cutoff = (datetime.now() - timedelta(days=45)).replace(microsecond=0).isoformat()
    alte_entwuerfe = db.execute(text("""
        SELECT e.id, e.schueler_id, e.bearbeiter, e.geaendert_am, s.vorname, s.nachname
        FROM rechnung_entwuerfe e
        LEFT JOIN schueler s ON s.id = e.schueler_id
        WHERE e.status = 'in_bearbeitung'
          AND e.geaendert_am < :cutoff
        ORDER BY e.geaendert_am
    """), {"cutoff": entwurf_cutoff}).fetchall()
    if alte_entwuerfe:
        items.append({
            "typ": "rechnung_entwuerfe_alt",
            "titel": "Alte Rechnungsentwürfe",
            "beschreibung": (
                f"{len(alte_entwuerfe)} {'Entwurf ist' if len(alte_entwuerfe) == 1 else 'Entwürfe sind'} "
                "seit über 45 Tagen unverändert. Nach 60 Tagen werden offene Entwürfe automatisch gelöscht."
            ),
            "anzahl": len(alte_entwuerfe),
            "schueler": [
                {
                    "id": str(row.id),
                    "name": f"{row.nachname}, {row.vorname}" if row.nachname else "Ohne Schüler",
                    "klasse": row.bearbeiter,
                    "archiviert_schuljahr": row.geaendert_am,
                }
                for row in alte_entwuerfe
            ],
            "aktion": "buchausgabe",
        })

    return {"items": items}


@router.post("/archiv/loeschen")
def loeschen_abgelaufene(data: dict, db: Session = Depends(get_db)):
    schueler_ids = data.get("schueler_ids", [])
    if not schueler_ids:
        raise HTTPException(status_code=422, detail="Keine Schüler-IDs angegeben.")

    schuljahr_row = db.execute(
        text("SELECT wert FROM einstellungen WHERE schluessel = 'schuljahr_aktuell'")
    ).scalar()
    aktuelles_schuljahr = schuljahr_row or "2025/2026"
    aktuell_start = _schuljahr_start_year(aktuelles_schuljahr)

    now = datetime.now().isoformat()
    geloescht = 0
    for sid in schueler_ids:
        s = db.query(Schueler).filter(
            Schueler.id == sid,
            Schueler.geloescht_am.is_(None),
            Schueler.archiviert_am.isnot(None),
        ).first()
        if not s:
            continue
        archiv_start = _schuljahr_start_year(s.archiviert_schuljahr or "")
        if archiv_start == 0 or (aktuell_start - archiv_start) < ARCHIV_AUFBEWAHRUNG_JAHRE:
            raise HTTPException(
                status_code=422,
                detail=f"Schüler {sid} hat die Aufbewahrungsfrist noch nicht erreicht."
            )
        s.geloescht_am = now
        geloescht += 1

    db.commit()
    return {"geloescht": geloescht}
