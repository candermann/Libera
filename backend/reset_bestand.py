"""
Setzt buch_zustand_bestand zurück und legt frische Beispieldaten an.
Vorhandene Bücher bleiben erhalten. Alle alten Bucket-Einträge werden gelöscht.

Jedes Buch erhält:
  - 1 "Neu"-Bucket  (sehr_gut, preis_cents, bestand_frei Exemplare)
  - 2 "Gebraucht"-Buckets mit Nutzungsjahr 1 und 2 (je 3 Exemplare),
    damit die neue Aufschlag-Logik sichtbar getestet werden kann.

Aufruf: uv run python reset_bestand.py  ODER  python reset_bestand.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db import SessionLocal, init_db
from app.models import Buecher, BuchZustandBestand, Einstellungen
from app.services.zustand import get_nutzungsjahr_abschlaege, berechne_wiederverkaufspreis

init_db()
db = SessionLocal()

try:
    # Abschläge aus Einstellungen laden
    abschlaege = get_nutzungsjahr_abschlaege(db)
    print(f"Nutzungsjahr-Abschläge: {abschlaege}")

    # Alle bestehenden Buckets löschen
    deleted = db.query(BuchZustandBestand).delete()
    db.flush()
    print(f"  {deleted} alte Bucket-Einträge gelöscht")

    buecher = db.query(Buecher).filter(Buecher.geloescht_am.is_(None)).all()
    print(f"  {len(buecher)} Bücher gefunden\n")

    for buch in buecher:
        bestand_frei = max(0, buch.bestand_gesamt - buch.bestand_ausgegeben)

        # "Neu"-Bucket (nutzungsjahr=0): alle freien Exemplare
        db.add(BuchZustandBestand(
            buch_id=buch.id,
            zustand="sehr_gut",
            verkaufspreis_cents=buch.preis_cents,
            bestand_verfuegbar=bestand_frei,
            nutzungsjahr=0,
        ))

        # Nutzungsjahr-1-Bucket: 3 Exemplare
        preis_j1 = berechne_wiederverkaufspreis(buch.preis_cents, abschlaege.get(1, 0))
        if preis_j1 < buch.preis_cents:  # nur anlegen wenn tatsächlich günstiger
            db.add(BuchZustandBestand(
                buch_id=buch.id,
                zustand="sehr_gut",
                verkaufspreis_cents=preis_j1,
                bestand_verfuegbar=3,
                nutzungsjahr=1,
            ))

        # Nutzungsjahr-2-Bucket: 2 Exemplare
        preis_j2 = berechne_wiederverkaufspreis(buch.preis_cents, abschlaege.get(2, 10))
        if preis_j2 < buch.preis_cents:
            db.add(BuchZustandBestand(
                buch_id=buch.id,
                zustand="sehr_gut",
                verkaufspreis_cents=preis_j2,
                bestand_verfuegbar=2,
                nutzungsjahr=2,
            ))

        print(f"  {buch.id}  {buch.titel:<30}  "
              f"Neu={buch.preis_cents/100:.2f}  "
              f"J1={preis_j1/100:.2f}  "
              f"J2={preis_j2/100:.2f}")

    db.commit()
    print(f"\nFertig — {len(buecher) * 3} Buckets angelegt (max).")
except Exception as e:
    db.rollback()
    print(f"FEHLER: {e}")
    raise
finally:
    db.close()
