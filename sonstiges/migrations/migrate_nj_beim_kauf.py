"""
Migration: add nutzungsjahr_beim_kauf column to rechnungs_posten
and backfill with best-effort inference from purchase price vs base price.
"""
import sqlite3
import sys
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "schulbuch.db")

def berechne_wiederverkaufspreis(preis_cents, abschreibung_prozent):
    abschreibung_prozent = max(0, min(100, int(abschreibung_prozent)))
    neuer_preis = round(preis_cents * (100 - abschreibung_prozent) / 100)
    return max(0, int(neuer_preis))

def infer_purchase_nj(preis_cents, basispreis_cents, abschlaege, fee):
    if preis_cents == basispreis_cents:
        return 0  # Neu
    if fee > 0 and preis_cents == fee:
        return 6
    for j in range(1, 6):
        expected = berechne_wiederverkaufspreis(basispreis_cents, abschlaege.get(j, 0))
        if abs(preis_cents - expected) <= 1:
            return j
    return 0  # fallback: treat as Neu -> display NJ 1

def main():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    # 1. Add column if not exists
    try:
        db.execute(
            "ALTER TABLE rechnungs_posten ADD COLUMN nutzungsjahr_beim_kauf INTEGER NOT NULL DEFAULT 1"
        )
        db.commit()
        print("Column nutzungsjahr_beim_kauf added.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("Column already exists, skipping ALTER.")
        else:
            raise

    # 2. Load abschlaege from DB
    abschlaege = {1: 16, 2: 33, 3: 49, 4: 66, 5: 82}  # defaults
    rows = db.execute(
        "SELECT schluessel, wert FROM einstellungen WHERE schluessel LIKE 'nutzungsjahr_abschlag_%'"
    ).fetchall()
    key_map = {
        "nutzungsjahr_abschlag_1_prozent": 1,
        "nutzungsjahr_abschlag_2_prozent": 2,
        "nutzungsjahr_abschlag_3_prozent": 3,
        "nutzungsjahr_abschlag_4_prozent": 4,
        "nutzungsjahr_abschlag_5_prozent": 5,
    }
    for row in rows:
        if row["schluessel"] in key_map:
            try:
                abschlaege[key_map[row["schluessel"]]] = max(0, min(100, int(row["wert"])))
            except (TypeError, ValueError):
                pass
    print(f"Abschlaege: {abschlaege}")

    # 3. Backfill all existing rows where nutzungsjahr_beim_kauf == 1 (default)
    posten = db.execute(
        """
        SELECT rp.id, rp.preis_cents, rp.nutzungsjahr_beim_kauf,
               b.preis_cents AS basispreis_cents,
               COALESCE(b.schutzgebuehr_cents, 0) AS schutzgebuehr_cents
        FROM rechnungs_posten rp
        JOIN buecher b ON b.id = rp.buch_id
        """
    ).fetchall()

    updated = 0
    for rp in posten:
        inferred = infer_purchase_nj(
            rp["preis_cents"],
            rp["basispreis_cents"],
            abschlaege,
            rp["schutzgebuehr_cents"],
        )
        display_nj = max(1, inferred)  # 0 (Neu) -> 1 for display
        db.execute(
            "UPDATE rechnungs_posten SET nutzungsjahr_beim_kauf = ? WHERE id = ?",
            (display_nj, rp["id"]),
        )
        updated += 1
        print(f"  rp.id={rp['id']}: preis={rp['preis_cents']}, basis={rp['basispreis_cents']}, "
              f"inferred_nj={inferred}, stored_nj={display_nj}")

    db.commit()
    print(f"\nBackfilled {updated} rows.")
    db.close()

if __name__ == "__main__":
    main()
