"""Merge remaining duplicate (buch, zustand, nj) buckets and delete empty buckets."""
import sqlite3, os

DB_PATH = os.path.join(os.path.dirname(__file__), "schulbuch.db")

def main():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    # Delete empty buckets first
    deleted_empty = db.execute(
        "DELETE FROM buch_zustand_bestand WHERE bestand_verfuegbar <= 0"
    ).rowcount
    print(f"Deleted {deleted_empty} empty buckets.")

    # Find remaining duplicates after empty cleanup
    dups = db.execute(
        "SELECT bzb.buch_id, bzb.zustand, bzb.nutzungsjahr, COUNT(*) AS cnt, b.titel "
        "FROM buch_zustand_bestand bzb JOIN buecher b ON b.id=bzb.buch_id "
        "WHERE bzb.bestand_verfuegbar > 0 "
        "GROUP BY bzb.buch_id, bzb.zustand, bzb.nutzungsjahr HAVING cnt > 1"
    ).fetchall()

    if not dups:
        print("No duplicates remaining.")
        db.commit()
        db.close()
        return

    print(f"\nMerging {len(dups)} duplicate groups:")
    for dup in dups:
        buckets = db.execute(
            "SELECT id, verkaufspreis_cents, bestand_verfuegbar FROM buch_zustand_bestand "
            "WHERE buch_id=? AND zustand=? AND nutzungsjahr=? AND bestand_verfuegbar > 0 "
            "ORDER BY bestand_verfuegbar DESC",
            (dup["buch_id"], dup["zustand"], dup["nutzungsjahr"])
        ).fetchall()

        primary = buckets[0]
        total = sum(b["bestand_verfuegbar"] for b in buckets)
        prices = [b["verkaufspreis_cents"] for b in buckets]
        print(f"  {dup['titel'][:30]:30s} | {dup['zustand']:10s} | NJ={dup['nutzungsjahr']} | prices={[p/100 for p in prices]} | total={total}")

        db.execute(
            "UPDATE buch_zustand_bestand SET bestand_verfuegbar=? WHERE id=?",
            (total, primary["id"])
        )
        for b in buckets[1:]:
            db.execute("DELETE FROM buch_zustand_bestand WHERE id=?", (b["id"],))

    db.commit()

    # Final check
    remaining_dups = db.execute(
        "SELECT COUNT(*) FROM (SELECT buch_id, zustand, nutzungsjahr, COUNT(*) AS cnt "
        "FROM buch_zustand_bestand WHERE bestand_verfuegbar > 0 "
        "GROUP BY buch_id, zustand, nutzungsjahr HAVING cnt > 1)"
    ).fetchone()[0]
    print(f"\nRemaining duplicates: {remaining_dups}")

    null_nj = db.execute(
        "SELECT COUNT(*) FROM buch_zustand_bestand WHERE nutzungsjahr IS NULL AND bestand_verfuegbar > 0"
    ).fetchone()[0]
    print(f"NULL NJ buckets (active): {null_nj}")

    print("\nStichprobe Englisch 9:")
    for r in db.execute(
        "SELECT bzb.nutzungsjahr, bzb.verkaufspreis_cents, bzb.bestand_verfuegbar "
        "FROM buch_zustand_bestand bzb JOIN buecher b ON b.id=bzb.buch_id "
        "WHERE b.titel='Englisch 9' ORDER BY bzb.nutzungsjahr"
    ):
        print(f"  NJ={r['nutzungsjahr']} | {r['verkaufspreis_cents']/100:.2f} EUR | Bestand={r['bestand_verfuegbar']}")

    db.close()

if __name__ == "__main__":
    main()
