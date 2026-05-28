"""
Seed script — populates the database with example data for development.

Usage:
    uv run python -m app.seed

Creates:
- ~30 example books
- ~50 example students
- ~20 sales (invoices)
- ~5 credit notes (returns)
- ~10 payments
"""

import random
import os
from datetime import date, timedelta
from app.db import SessionLocal, init_db
from app.models import (
    Schueler,
    Buecher,
    Rechnungen,
    RechnungsPosten,
    Gutschriften,
    GutschriftPosten,
    Zahlungen,
    Einstellungen,
)
from app.services.ids import (
    generate_schueler_id,
    generate_buch_id,
    generate_rechnungs_id,
    generate_gutschrift_id,
)

# ── Static data ──────────────────────────────────────────────────────────

KLASSEN = [
    "5a", "5b", "5c",
    "6a", "6b", "6c",
    "7a", "7b", "7c",
    "8a", "8b", "8c",
    "9a", "9b", "9c",
    "10a", "10b", "10c",
    "EF", "Q1", "Q2",
]

VORNAMEN = [
    "Lukas", "Anna", "Leon", "Mia", "Tim", "Emma", "Paul", "Lena",
    "Max", "Sophie", "Felix", "Marie", "Jonas", "Laura", "David",
    "Hannah", "Elias", "Lisa", "Noah", "Julia", "Finn", "Lea",
    "Ben", "Sarah", "Niklas", "Katharina", "Moritz", "Johanna",
    "Jan", "Clara", "Tom", "Charlotte", "Philipp", "Amelie",
    "Simon", "Theresa", "Fabian", "Helena", "Tobias", "Emilia",
    "Linus", "Frieda", "Erik", "Nora", "Robin", "Greta",
    "Julian", "Ida", "Anton", "Marlene",
]

NACHNAMEN = [
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer",
    "Wagner", "Becker", "Hoffmann", "Schäfer", "Koch", "Bauer",
    "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz",
    "Zimmermann", "Braun", "Krüger", "Hofmann", "Hartmann", "Lange",
    "Schmitt", "Werner", "Schmitz", "Krause", "Meier", "Lehmann",
]

BUECHER_DATA = [
    ("Mathematik 5", "Mathematik", 5, "Cornelsen", 2490),
    ("Mathematik 6", "Mathematik", 6, "Cornelsen", 2490),
    ("Mathematik 7", "Mathematik", 7, "Cornelsen", 2400),
    ("Mathematik 8", "Mathematik", 8, "Cornelsen", 2690),
    ("Mathematik 9", "Mathematik", 9, "Cornelsen", 2890),
    ("Deutsch 5", "Deutsch", 5, "Klett", 2350),
    ("Deutsch 6", "Deutsch", 6, "Klett", 2350),
    ("Deutsch 7", "Deutsch", 7, "Klett", 2400),
    ("Deutsch 8", "Deutsch", 8, "Klett", 2550),
    ("Deutsch 9", "Deutsch", 9, "Klett", 2690),
    ("Englisch 5", "Englisch", 5, "Klett", 2590),
    ("Englisch 6", "Englisch", 6, "Klett", 2590),
    ("Englisch 7", "Englisch", 7, "Klett", 2400),
    ("Englisch 8", "Englisch", 8, "Klett", 2690),
    ("Englisch 9", "Englisch", 9, "Klett", 2890),
    ("Biologie 5/6", "Biologie", 5, "Westermann", 2990),
    ("Biologie 7/8", "Biologie", 7, "Westermann", 3100),
    ("Physik 7/8", "Physik", 7, "Duden", 2750),
    ("Physik 9/10", "Physik", 9, "Duden", 2950),
    ("Chemie 8/9", "Chemie", 8, "Schroedel", 2850),
    ("Geschichte 5/6", "Geschichte", 5, "Westermann", 2650),
    ("Geschichte 7/8", "Geschichte", 7, "Westermann", 2750),
    ("Erdkunde 5/6", "Erdkunde", 5, "Cornelsen", 2450),
    ("Französisch 7", "Französisch", 7, "Klett", 2790),
    ("Französisch 8", "Französisch", 8, "Klett", 2890),
    ("Latein 7", "Latein", 7, "Buchner", 3200),
    ("Musik 5/6", "Musik", 5, "Schott", 2350),
    ("Kunst 5/6", "Kunst", 5, "Cornelsen", 1990),
    ("Religion 5/6", "Religion", 5, "Diesterweg", 2150),
    ("Informatik EF", "Informatik", 11, "Cornelsen", 3490),
]

STRASSEN = [
    "Hauptstraße", "Schulstraße", "Bahnhofstraße", "Gartenstraße",
    "Kirchstraße", "Lindenweg", "Birkenallee", "Rosenstraße",
    "Am Markt", "Waldweg", "Friedrichstraße", "Mozartstraße",
]

ORTE = [
    ("52538", "Gangelt"),
    ("52525", "Heinsberg"),
    ("52511", "Geilenkirchen"),
    ("52531", "Übach-Palenberg"),
    ("41849", "Wassenberg"),
]


def main():
    """Seed the database with example data."""
    init_db()
    db = SessionLocal()

    try:
        # Check if already seeded
        existing = db.query(Schueler).count()
        if existing > 0:
            print(f"[WARN] Datenbank enthaelt bereits {existing} Schueler -- Seed uebersprungen.")
            print("   Loesche schulbuch.db und starte erneut fuer einen frischen Seed.")
            return

        print("[SEED] Seede Beispieldaten ...")

        # ── Setup admin password from env (required) ────────────────
        existing_hash = db.query(Einstellungen).filter(
            Einstellungen.schluessel == "admin_password_hash"
        ).first()
        if not existing_hash:
            admin_initial_password = (os.getenv("ADMIN_INITIAL_PASSWORD") or "").strip()
            if not admin_initial_password:
                raise RuntimeError(
                    "ADMIN_INITIAL_PASSWORD environment variable is required for seeding."
                )
            if len(admin_initial_password) < 10:
                raise RuntimeError(
                    "ADMIN_INITIAL_PASSWORD must be at least 10 characters long."
                )
            from app.security import get_password_hash
            pwd_hash = get_password_hash(admin_initial_password)
            db.add(Einstellungen(schluessel="admin_password_hash", wert=pwd_hash))
            db.flush()

        # ── Create books ─────────────────────────────────────────────
        buecher = []
        for titel, fach, stufe, verlag, preis in BUECHER_DATA:
            buch_id = generate_buch_id(db)
            buch = Buecher(
                id=buch_id,
                titel=titel,
                fach=fach,
                stufe=stufe,
                verlag=verlag,
                preis_cents=preis,
                gutschrift_cents=preis,
                bestand_gesamt=random.randint(40, 100),
                bestand_ausgegeben=0,
            )
            db.add(buch)
            db.flush()  # flush each book so next generate_buch_id sees it
            buecher.append(buch)
        print(f"   [OK] {len(buecher)} Buecher angelegt")

        # ── Create students ──────────────────────────────────────────
        schueler_list = []
        for i in range(50):
            sid = generate_schueler_id(db)
            vorname = VORNAMEN[i % len(VORNAMEN)]
            nachname = random.choice(NACHNAMEN)
            klasse = random.choice(KLASSEN)
            plz, ort = random.choice(ORTE)
            strasse = f"{random.choice(STRASSEN)} {random.randint(1, 99)}"

            schueler = Schueler(
                id=sid,
                vorname=vorname,
                nachname=nachname,
                klasse=klasse,
                strasse=strasse,
                plz=plz,
                ort=ort,
            )
            db.add(schueler)
            db.flush()  # flush each student so next ID generation sees it
            schueler_list.append(schueler)
        print(f"   [OK] {len(schueler_list)} Schueler angelegt")

        # ── Create sales ─────────────────────────────────────────────
        schuljahr = "2025/2026"
        rechnungen_created = []
        for i in range(20):
            schueler = random.choice(schueler_list)
            # Pick 2-5 random books appropriate for the student's grade
            stufe = _klasse_to_stufe(schueler.klasse)
            passende_buecher = [b for b in buecher if abs(b.stufe - stufe) <= 1]
            if len(passende_buecher) < 2:
                passende_buecher = buecher
            anzahl = random.randint(2, min(5, len(passende_buecher)))
            selected = random.sample(passende_buecher, anzahl)

            rechnung_id = generate_rechnungs_id(db, schuljahr)
            tage_offset = random.randint(0, 60)
            datum = (date(2025, 8, 15) + timedelta(days=tage_offset)).isoformat()

            # Validate books first, calculate summe
            valid_books = [b for b in selected if b.bestand_gesamt - b.bestand_ausgegeben > 0]
            if not valid_books:
                continue

            summe = sum(b.preis_cents for b in valid_books)

            # Create rechnung FIRST (parent for FK)
            rechnung = Rechnungen(
                id=rechnung_id,
                schueler_id=schueler.id,
                schuljahr=schuljahr,
                datum=datum,
                summe_cents=summe,
                verrechnet_cents=0,
                status="offen",
            )
            db.add(rechnung)
            db.flush()  # parent must exist before children

            # Now create posten (children)
            posten_objs = []
            for buch in valid_books:
                posten = RechnungsPosten(
                    rechnung_id=rechnung_id,
                    buch_id=buch.id,
                    preis_cents=buch.preis_cents,
                )
                db.add(posten)
                buch.bestand_ausgegeben += 1
                posten_objs.append(posten)
            db.flush()
            rechnungen_created.append((rechnung, posten_objs, schueler))

        print(f"   [OK] {len(rechnungen_created)} Rechnungen angelegt")

        # ── Create some payments ─────────────────────────────────────
        zahlungen_count = 0
        for rechnung, posten_objs, schueler in rechnungen_created[:10]:
            zahlung = Zahlungen(
                schueler_id=schueler.id,
                rechnung_id=rechnung.id,
                datum=(date.fromisoformat(rechnung.datum) + timedelta(days=random.randint(5, 20))).isoformat(),
                betrag_cents=rechnung.summe_cents,
                notizen="Ueberweisung",
            )
            db.add(zahlung)
            rechnung.status = "bezahlt"
            zahlungen_count += 1
        print(f"   [OK] {zahlungen_count} Zahlungen angelegt")

        # ── Create some credit notes ─────────────────────────────────
        gutschriften_count = 0
        for rechnung, posten_objs, schueler in rechnungen_created[:5]:
            db.flush()
            if len(posten_objs) < 2:
                continue
            # Return 1 book
            rp = posten_objs[0]
            if rp.zurueckgegeben:
                continue

            gutschrift_id = generate_gutschrift_id(db, schuljahr)
            datum = (date.fromisoformat(rechnung.datum) + timedelta(days=random.randint(30, 180))).isoformat()

            rp.zurueckgegeben = 1
            rp.zurueckgegeben_am = datum

            # Restore stock
            buch = next((b for b in buecher if b.id == rp.buch_id), None)
            if buch:
                buch.bestand_ausgegeben = max(0, buch.bestand_ausgegeben - 1)

            gutschrift = Gutschriften(
                id=gutschrift_id,
                schueler_id=schueler.id,
                schuljahr=schuljahr,
                datum=datum,
                summe_cents=rp.preis_cents,
                ausgezahlt=0,
            )
            db.add(gutschrift)
            db.flush()  # parent must exist before child

            gp = GutschriftPosten(
                gutschrift_id=gutschrift_id,
                rechnungs_posten_id=rp.id,
                betrag_cents=rp.preis_cents,
            )
            db.add(gp)
            db.flush()
            gutschriften_count += 1

        print(f"   [OK] {gutschriften_count} Gutschriften angelegt")

        db.commit()
        print("[DONE] Seed abgeschlossen!")

    except Exception as e:
        db.rollback()
        print(f"[ERROR] Fehler beim Seeden: {e}")
        raise
    finally:
        db.close()


def _klasse_to_stufe(klasse: str) -> int:
    """Convert class name to grade level for matching books."""
    if klasse.startswith("EF"):
        return 11
    if klasse.startswith("Q1"):
        return 12
    if klasse.startswith("Q2"):
        return 13
    try:
        return int(klasse.rstrip("abcdefg"))
    except ValueError:
        return 7


if __name__ == "__main__":
    main()
