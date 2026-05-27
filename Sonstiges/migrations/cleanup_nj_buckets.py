"""
Bereinigt BuchZustandBestand-Einträge, deren Preis keinem Standard-Nutzungsjahr
entspricht (Basis * Abschlag). Bestand wird in den nächstgelegenen gültigen Bucket verschoben.
"""
import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "schulbuch.db")


def rund(cents):
    return int(round(cents))


def nj_preis(basis, abschlag_prozent):
    return rund(basis * (100 - abschlag_prozent) / 100)


def main():
    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    # Abschlaege aus DB laden
    abschlaege = {1: 16, 2: 33, 3: 49, 4: 66, 5: 82}
    for row in db.execute("SELECT schluessel, wert FROM einstellungen WHERE schluessel LIKE 'nutzungsjahr_abschlag_%'"):
        mapping = {
            "nutzungsjahr_abschlag_1_prozent": 1,
            "nutzungsjahr_abschlag_2_prozent": 2,
            "nutzungsjahr_abschlag_3_prozent": 3,
            "nutzungsjahr_abschlag_4_prozent": 4,
            "nutzungsjahr_abschlag_5_prozent": 5,
        }
        if row["schluessel"] in mapping:
            try:
                abschlaege[mapping[row["schluessel"]]] = max(0, min(100, int(row["wert"])))
            except (TypeError, ValueError):
                pass

    print(f"Abschlaege: {abschlaege}")

    buckets = db.execute("""
        SELECT bzb.id, bzb.buch_id, bzb.zustand, bzb.verkaufspreis_cents,
               bzb.bestand_verfuegbar, bzb.nutzungsjahr,
               b.titel, b.preis_cents AS basis,
               COALESCE(b.schutzgebuehr_cents, 0) AS fee
        FROM buch_zustand_bestand bzb
        JOIN buecher b ON b.id = bzb.buch_id
        ORDER BY b.titel, bzb.zustand, bzb.verkaufspreis_cents
    """).fetchall()

    moved = 0
    deleted = 0

    for bucket in buckets:
        preis = bucket["verkaufspreis_cents"]
        basis = bucket["basis"]
        fee = bucket["fee"]
        zustand = bucket["zustand"]
        buch_id = bucket["buch_id"]
        bestand = bucket["bestand_verfuegbar"]

        # Prüfen ob Preis einem Standard-NJ entspricht (±1 Cent Toleranz)
        matched_nj = None
        if preis == basis:
            matched_nj = 0  # Neu
        elif fee > 0 and preis == fee:
            matched_nj = 6  # Schutzgebühr
        else:
            for nj in range(1, 6):
                expected = nj_preis(basis, abschlaege[nj])
                if abs(preis - expected) <= 1:
                    matched_nj = nj
                    break

        if matched_nj is not None:
            # Preis passt — NJ im Bucket setzen falls noch nicht gesetzt
            if bucket["nutzungsjahr"] is None:
                db.execute(
                    "UPDATE buch_zustand_bestand SET nutzungsjahr = ? WHERE id = ?",
                    (matched_nj if matched_nj > 0 else 1, bucket["id"])
                )
            continue  # gültiger Bucket, nichts zu tun

        # Kein Standard-NJ gefunden — Bucket bereinigen
        print(f"\n  [NJ ?] {bucket['titel'][:30]:30s} | {zustand:10s} | {preis/100:.2f} EUR (Basis {basis/100:.2f})")

        if bestand <= 0:
            print(f"    -> Bestand=0, lösche leeren Bucket")
            db.execute("DELETE FROM buch_zustand_bestand WHERE id = ?", (bucket["id"],))
            deleted += 1
            continue

        # Ziel-NJ bestimmen: gespeichertes NJ bevorzugen, sonst nächstgelegenes
        stored_nj = bucket["nutzungsjahr"]
        if stored_nj is not None and 1 <= stored_nj <= 5:
            target_nj = stored_nj
            print(f"    Gespeichertes NJ: {target_nj}")
        else:
            # Nächstgelegenes NJ nach Preisabstand
            candidates = [(abs(preis - basis), 0, basis)]  # Neu
            for nj in range(1, 6):
                expected = nj_preis(basis, abschlaege[nj])
                candidates.append((abs(preis - expected), nj, expected))
            if fee > 0:
                candidates.append((abs(preis - fee), 6, fee))
            candidates.sort()
            target_nj = candidates[0][1]
            print(f"    Nächstgelegenes NJ: {target_nj} (Abstand: {candidates[0][0]} Cent)")

        # Zielpreis berechnen
        if target_nj == 0:
            target_preis = basis
        elif target_nj >= 6:
            target_preis = max(0, fee)
        else:
            target_preis = nj_preis(basis, abschlaege[target_nj])

        print(f"    Verschiebe {bestand}× -> {zustand} NJ{target_nj} @ {target_preis/100:.2f} EUR")

        # Ziel-Bucket finden oder erstellen
        existing = db.execute(
            "SELECT id, bestand_verfuegbar FROM buch_zustand_bestand "
            "WHERE buch_id=? AND zustand=? AND verkaufspreis_cents=?",
            (buch_id, zustand, target_preis)
        ).fetchone()

        if existing:
            db.execute(
                "UPDATE buch_zustand_bestand SET bestand_verfuegbar=?, nutzungsjahr=? WHERE id=?",
                (existing["bestand_verfuegbar"] + bestand, target_nj if target_nj > 0 else 1, existing["id"])
            )
        else:
            db.execute(
                "INSERT INTO buch_zustand_bestand (buch_id, zustand, verkaufspreis_cents, bestand_verfuegbar, nutzungsjahr) "
                "VALUES (?, ?, ?, ?, ?)",
                (buch_id, zustand, target_preis, bestand, target_nj if target_nj > 0 else 1)
            )

        db.execute("DELETE FROM buch_zustand_bestand WHERE id = ?", (bucket["id"],))
        moved += bestand
        deleted += 1

    # Auch Buckets mit preis == basis aber nutzungsjahr noch NULL -> setze 1
    db.execute(
        "UPDATE buch_zustand_bestand SET nutzungsjahr = 1 WHERE nutzungsjahr IS NULL"
    )

    db.commit()
    db.close()
    print(f"\n=== Fertig: {deleted} Buckets bereinigt, {moved} Einheiten verschoben ===")
    print("Alle verbleibenden NJ-NULL-Einträge auf NJ=1 gesetzt (Neu/Standard).")


if __name__ == "__main__":
    main()
