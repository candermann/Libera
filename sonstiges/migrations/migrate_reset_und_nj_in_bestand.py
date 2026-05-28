"""
Migration:
1. Delete all transaction data (Rechnungen, Gutschriften, Zahlungen, Auszahlungen and sub-tables)
2. Reset bestand_ausgegeben to 0 on buecher and lernmaterial
3. Add nutzungsjahr column to buch_zustand_bestand (nullable)
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "schulbuch.db")


def main():
    db = sqlite3.connect(DB_PATH)

    print("=== Schritt 1: Vorgänge löschen ===")
    # Delete in dependency order (children first)
    tables = [
        "rechnung_verrechnungen",
        "rechnung_freiposten",
        "lernmaterial_posten",
        "gutschrift_posten",
        "rechnungs_posten",
        "gutschriften",
        "rechnungen",
        "zahlungen",
        "auszahlungen",
    ]
    for table in tables:
        count = db.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        db.execute(f"DELETE FROM {table}")
        print(f"  {table}: {count} Zeilen gelöscht")

    print("\n=== Schritt 2: bestand_ausgegeben zurücksetzen ===")
    db.execute("UPDATE buecher SET bestand_ausgegeben = 0")
    db.execute("UPDATE lernmaterial SET bestand_ausgegeben = 0")
    print("  buecher.bestand_ausgegeben = 0")
    print("  lernmaterial.bestand_ausgegeben = 0")

    print("\n=== Schritt 3: nutzungsjahr Spalte zu buch_zustand_bestand ===")
    try:
        db.execute(
            "ALTER TABLE buch_zustand_bestand ADD COLUMN nutzungsjahr INTEGER"
        )
        print("  Spalte nutzungsjahr hinzugefügt.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("  Spalte existiert bereits, übersprungen.")
        else:
            raise

    print("\n=== Schritt 4: nutzungsjahr_beim_kauf Spalte in rechnungs_posten ===")
    try:
        db.execute(
            "ALTER TABLE rechnungs_posten ADD COLUMN nutzungsjahr_beim_kauf INTEGER NOT NULL DEFAULT 1"
        )
        print("  Spalte nutzungsjahr_beim_kauf hinzugefügt.")
    except sqlite3.OperationalError as e:
        if "duplicate column name" in str(e).lower():
            print("  Spalte existiert bereits, übersprungen.")
        else:
            raise

    db.commit()
    db.close()
    print("\nMigration abgeschlossen.")


if __name__ == "__main__":
    main()
