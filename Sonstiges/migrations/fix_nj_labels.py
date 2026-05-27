"""
Korrigiert fehlerhafte NJ-Labels in buch_zustand_bestand.

Das cleanup_nj_buckets.py Script hat fälschlicherweise alle Neu-Buckets
(preis == basis) auf NJ=1 gesetzt, statt auf NJ=0.

Diese Migration setzt:
  - Buckets mit preis == buch.preis_cents -> nutzungsjahr = 0 (Neu)
  - Nur für Buckets die aktuell NJ=1 haben UND preis == basis

Danach werden Duplikate (buch, zustand, nj) zusammengeführt.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "schulbuch.db")


def main():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    print("=== Korrigiere NJ-Labels: Neu-Buckets von NJ=1 -> NJ=0 ===\n")

    # Finde alle Buckets wo preis == basis und nj == 1 (falsch gelabelt)
    to_fix = db.execute("""
        SELECT bzb.id, bzb.buch_id, bzb.zustand, bzb.verkaufspreis_cents,
               bzb.bestand_verfuegbar, bzb.nutzungsjahr,
               b.titel, b.preis_cents AS basis
        FROM buch_zustand_bestand bzb
        JOIN buecher b ON b.id = bzb.buch_id
        WHERE bzb.nutzungsjahr = 1
          AND bzb.verkaufspreis_cents = b.preis_cents
        ORDER BY b.titel, bzb.zustand
    """).fetchall()

    print(f"Gefundene falsch gelabelte Neu-Buckets: {len(to_fix)}")

    corrected = 0
    merged = 0

    for bucket in to_fix:
        buch_id = bucket["buch_id"]
        zustand = bucket["zustand"]
        preis = bucket["verkaufspreis_cents"]
        bestand = bucket["bestand_verfuegbar"]
        bid = bucket["id"]

        print(f"  {bucket['titel'][:30]:30s} | {zustand:10s} | {preis/100:.2f} EUR | Bestand={bestand} | NJ=1->0")

        # Prüfe ob schon ein NJ=0 Bucket für (buch, zustand, preis) existiert
        existing_nj0 = db.execute(
            "SELECT id, bestand_verfuegbar FROM buch_zustand_bestand "
            "WHERE buch_id=? AND zustand=? AND verkaufspreis_cents=? AND nutzungsjahr=0 AND id!=?",
            (buch_id, zustand, preis, bid)
        ).fetchone()

        if existing_nj0:
            # Zusammenführen
            db.execute(
                "UPDATE buch_zustand_bestand SET bestand_verfuegbar=? WHERE id=?",
                (existing_nj0["bestand_verfuegbar"] + bestand, existing_nj0["id"])
            )
            db.execute("DELETE FROM buch_zustand_bestand WHERE id=?", (bid,))
            print(f"    -> Zusammengeführt mit bestehendem NJ=0 Bucket")
            merged += 1
        else:
            # NJ von 1 auf 0 setzen
            db.execute(
                "UPDATE buch_zustand_bestand SET nutzungsjahr=0 WHERE id=?",
                (bid,)
            )
            corrected += 1

    db.commit()
    print(f"\n=== Ergebnis: {corrected} korrigiert, {merged} zusammengeführt ===\n")

    # Prüfe verbleibende Duplikate
    dups = db.execute(
        "SELECT b.titel, bzb.zustand, bzb.nutzungsjahr, COUNT(*) AS cnt "
        "FROM buch_zustand_bestand bzb "
        "JOIN buecher b ON b.id = bzb.buch_id "
        "WHERE bzb.bestand_verfuegbar > 0 "
        "GROUP BY bzb.buch_id, bzb.zustand, bzb.nutzungsjahr "
        "HAVING cnt > 1 "
        "ORDER BY b.titel"
    ).fetchall()

    if dups:
        print(f"Verbleibende Duplikate ({len(dups)}):")
        for d in dups:
            print(f"  {d['titel'][:30]:30s} | {d['zustand']:10s} | NJ={d['nutzungsjahr']} | {d['cnt']}x")
    else:
        print("Keine Duplikate mehr - alle NJ-Labels korrekt!")

    # Zeige Zusammenfassung
    print("\nStichprobe Chemie 8/9:")
    for r in db.execute(
        "SELECT bzb.nutzungsjahr, bzb.verkaufspreis_cents, bzb.bestand_verfuegbar "
        "FROM buch_zustand_bestand bzb JOIN buecher b ON b.id=bzb.buch_id "
        "WHERE b.titel='Chemie 8/9' ORDER BY bzb.nutzungsjahr"
    ):
        print(f"  NJ={r['nutzungsjahr']} | {r['verkaufspreis_cents']/100:.2f} EUR | Bestand={r['bestand_verfuegbar']}")

    db.close()


if __name__ == "__main__":
    main()
