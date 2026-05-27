"""
Konsolidiert buch_zustand_bestand: alle Einträge werden auf zustand='sehr_gut'
gesetzt und Duplikate per (buch_id, nutzungsjahr) zusammengeführt.
"""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "schulbuch.db")

def main():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    # Strategie: per (buch_id, nutzungsjahr) alle Buckets zusammenführen,
    # dabei den bestand von allen Zustands-Varianten summieren,
    # dann alles löschen und nur 'sehr_gut' Buckets neu anlegen.

    all_buckets = db.execute(
        "SELECT buch_id, nutzungsjahr, verkaufspreis_cents, bestand_verfuegbar "
        "FROM buch_zustand_bestand"
    ).fetchall()

    # Aggregiere per (buch_id, nutzungsjahr) -> (preis, bestand)
    aggregated = {}
    for b in all_buckets:
        key = (b["buch_id"], b["nutzungsjahr"])
        existing_bestand, existing_preis = aggregated.get(key, (0, b["verkaufspreis_cents"]))
        new_bestand = existing_bestand + max(0, b["bestand_verfuegbar"])
        # Bevorzuge 'sehr_gut'-Preis (der ist sowieso immer gleich bei gleicher NJ)
        aggregated[key] = (new_bestand, b["verkaufspreis_cents"])

    # Alle alten Buckets löschen
    deleted_all = db.execute("DELETE FROM buch_zustand_bestand").rowcount
    print(f"Alle Buckets gelöscht: {deleted_all}")

    # Neue 'sehr_gut' Buckets anlegen
    inserted = 0
    for (buch_id, nutzungsjahr), (bestand, preis) in aggregated.items():
        if bestand <= 0:
            continue
        db.execute(
            "INSERT INTO buch_zustand_bestand (buch_id, zustand, verkaufspreis_cents, bestand_verfuegbar, nutzungsjahr) "
            "VALUES (?, 'sehr_gut', ?, ?, ?)",
            (buch_id, preis, bestand, nutzungsjahr)
        )
        inserted += 1
    print(f"Neue sehr_gut Buckets angelegt: {inserted}")

    merged = 0
    deleted = 0

    db.commit()
    print(f"Zusammengeführt: {merged} | Leer gelöscht: {deleted}")

    # Prüfung
    remaining = db.execute(
        "SELECT COUNT(*) FROM (SELECT buch_id, nutzungsjahr, COUNT(*) AS cnt "
        "FROM buch_zustand_bestand GROUP BY buch_id, nutzungsjahr HAVING cnt > 1)"
    ).fetchone()[0]
    print(f"Verbleibende Duplikate: {remaining}")
    non_sehr_gut = db.execute("SELECT COUNT(*) FROM buch_zustand_bestand WHERE zustand != 'sehr_gut'").fetchone()[0]
    print(f"Nicht-sehr_gut Buckets: {non_sehr_gut}")
    db.close()
    print("Fertig.")

if __name__ == "__main__":
    main()
