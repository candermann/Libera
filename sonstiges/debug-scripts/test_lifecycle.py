"""
End-to-end test: book sale -> same-year return -> different-year return.

Runs directly against the SQLite DB without HTTP calls, so no server needed.
Uses the same service functions the API uses.

Tested invariants:
  1. Sale stores nutzungsjahr_beim_kauf correctly in rechnungs_posten
  2. Same-year return: credit == purchase price, bucket price has NO surcharge
  3. Different-year return: NJ advances, price = current basis * abschlag
  4. No duplicate buckets per (buch, zustand, nj) after returns
  5. No NULL nutzungsjahr in BuchZustandBestand after returns
"""
import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

import sqlite3
from datetime import date, timedelta

DB_PATH = os.path.join(os.path.dirname(__file__), "schulbuch.db")


# ── helpers ──────────────────────────────────────────────────────────────────

def runde(cents, abschlag_pct):
    return max(0, round(cents * (100 - abschlag_pct) / 100))


def schuljahr_start(d):
    return d.year if d.month >= 8 else d.year - 1


def check(condition, msg):
    if condition:
        print(f"  OK  {msg}")
    else:
        print(f"  FAIL {msg}")
        global _failures
        _failures += 1


_failures = 0


# ── load settings ─────────────────────────────────────────────────────────────

def load_settings(db):
    rows = db.execute("SELECT schluessel, wert FROM einstellungen").fetchall()
    s = {r["schluessel"]: r["wert"] for r in rows}
    abschlaege = {}
    for i in range(1, 6):
        key = f"nutzungsjahr_abschlag_{i}_prozent"
        try:
            abschlaege[i] = max(0, min(100, int(s.get(key, 0))))
        except (ValueError, TypeError):
            abschlaege[i] = 0
    try:
        aufschlag = max(0, int(s.get("rueckgabe_aufschlag_cents", 0)))
    except (ValueError, TypeError):
        aufschlag = 0
    return abschlaege, aufschlag


# ── test setup ────────────────────────────────────────────────────────────────

def get_or_create_test_buch(db):
    existing = db.execute(
        "SELECT id, preis_cents, schutzgebuehr_cents FROM buecher WHERE titel='__TEST_BUCH__'"
    ).fetchone()
    if existing:
        return dict(existing)
    db.execute(
        "INSERT INTO buecher (id, titel, fach, stufe, preis_cents, gutschrift_cents, bestand_gesamt, bestand_ausgegeben) "
        "VALUES ('test-buch-001', '__TEST_BUCH__', 'Test', 9, 2800, 0, 10, 0)"
    )
    db.commit()
    return {"id": "test-buch-001", "preis_cents": 2800, "schutzgebuehr_cents": None}


def get_or_create_test_schueler(db):
    existing = db.execute(
        "SELECT id FROM schueler WHERE vorname='__TEST__' AND nachname='SCHUELER'"
    ).fetchone()
    if existing:
        return existing["id"]
    db.execute(
        "INSERT INTO schueler (id, vorname, nachname, klasse, email_eltern) "
        "VALUES ('test-schueler-001', '__TEST__', 'SCHUELER', '9', 'test@test.de')"
    )
    db.commit()
    return "test-schueler-001"


def cleanup_test_data(db):
    """Remove all test data from the DB."""
    db.execute("DELETE FROM gutschrift_posten WHERE gutschrift_id LIKE 'TEST-%'")
    db.execute("DELETE FROM gutschriften WHERE schueler_id='test-schueler-001'")
    db.execute("DELETE FROM rechnungs_posten WHERE rechnung_id LIKE 'TEST-%'")
    db.execute("DELETE FROM rechnungen WHERE schueler_id='test-schueler-001'")
    db.execute("DELETE FROM buch_zustand_bestand WHERE buch_id='test-buch-001'")
    db.execute("DELETE FROM buecher WHERE id='test-buch-001'")
    db.execute("DELETE FROM schueler WHERE id='test-schueler-001'")
    db.commit()


# ── simulate sale ──────────────────────────────────────────────────────────────

def do_sale(db, buch, schueler_id, abschlaege, aufschlag_cents, nj, kaufdatum=None):
    """Create a Verkauf for buch at the given NJ. Returns (rechnung_id, rp_id, preis_cents)."""
    preis_basis = buch["preis_cents"]
    if nj <= 0:
        preis_bucket = preis_basis
    elif nj >= 6:
        preis_bucket = max(0, buch["schutzgebuehr_cents"] or 0)
    else:
        preis_bucket = runde(preis_basis, abschlaege[nj])

    # Verkaufspreis = bucket + aufschlag (same logic as frontend/backend)
    preis_verkauf = preis_bucket + aufschlag_cents
    datum = kaufdatum or date.today().isoformat()

    import time
    rechnung_id = f"TEST-R-{datum}-{nj}-{int(time.time()*1000) % 100000}"

    # Create or use inventory bucket
    existing_bucket = db.execute(
        "SELECT id, bestand_verfuegbar FROM buch_zustand_bestand WHERE buch_id=? AND zustand='sehr_gut' AND verkaufspreis_cents=?",
        (buch["id"], preis_bucket)
    ).fetchone()
    if not existing_bucket:
        db.execute(
            "INSERT INTO buch_zustand_bestand (buch_id, zustand, verkaufspreis_cents, bestand_verfuegbar, nutzungsjahr) VALUES (?, 'sehr_gut', ?, 1, ?)",
            (buch["id"], preis_bucket, nj)
        )
    else:
        if existing_bucket["bestand_verfuegbar"] < 1:
            db.execute(
                "UPDATE buch_zustand_bestand SET bestand_verfuegbar=1, nutzungsjahr=? WHERE id=?",
                (nj, existing_bucket["id"])
            )

    db.execute(
        "INSERT INTO rechnungen (id, schueler_id, schuljahr, datum, status, summe_cents, verrechnet_cents, erstellt_am) "
        "VALUES (?, ?, '2025/2026', ?, 'offen', ?, 0, ?)",
        (rechnung_id, schueler_id, datum, preis_verkauf, datum)
    )

    bucket_row = db.execute(
        "SELECT id FROM buch_zustand_bestand WHERE buch_id=? AND zustand='sehr_gut' AND verkaufspreis_cents=?",
        (buch["id"], preis_bucket)
    ).fetchone()

    db.execute(
        "INSERT INTO rechnungs_posten (rechnung_id, buch_id, zustand, preis_cents, nutzungsjahr_beim_kauf, zurueckgegeben) "
        "VALUES (?, ?, 'sehr_gut', ?, ?, 0)",
        (rechnung_id, buch["id"], preis_verkauf, nj)
    )
    # Update book bestand
    db.execute("UPDATE buecher SET bestand_ausgegeben=bestand_ausgegeben+1 WHERE id=?", (buch["id"],))
    # Decrement bucket
    db.execute(
        "UPDATE buch_zustand_bestand SET bestand_verfuegbar=bestand_verfuegbar-1 WHERE id=?",
        (bucket_row["id"],)
    )

    rp_id_val = db.execute("SELECT last_insert_rowid()").fetchone()[0]
    db.commit()
    return rechnung_id, rp_id_val, preis_verkauf, preis_bucket


# ── simulate return (gutschrift) ───────────────────────────────────────────────

def do_return(db, rp_id, schueler_id, buch, abschlaege, aufschlag_cents, return_date=None):
    """Simulate a Gutschrift for one rechnungs_posten. Returns (credit_cents, bucket_preis, nj_returned)."""
    rp = db.execute("SELECT * FROM rechnungs_posten WHERE id=?", (rp_id,)).fetchone()
    rechnung = db.execute("SELECT * FROM rechnungen WHERE id=?", (rp["rechnung_id"],)).fetchone()

    kaufdatum = date.fromisoformat(rechnung["datum"][:10])
    today = date.fromisoformat(return_date) if return_date else date.today()
    schuljahr_diff = schuljahr_start(today) - schuljahr_start(kaufdatum)

    nj_kauf = rp["nutzungsjahr_beim_kauf"]
    preis_kauf = rp["preis_cents"]
    basis = buch["preis_cents"]
    fee = max(0, buch["schutzgebuehr_cents"] or 0)

    if schuljahr_diff == 0:
        # Same school year: full refund of purchase price, NJ unchanged
        credit = preis_kauf
        nj_return = nj_kauf
        bucket_preis = runde(basis, abschlaege.get(nj_return, 0))
    else:
        # Different year: advance NJ, recalculate from current basis
        nj_return = min(6, nj_kauf + schuljahr_diff)
        if nj_return >= 6:
            credit = max(0, fee)
            bucket_preis = max(0, fee)
        else:
            bucket_preis = runde(basis, abschlaege.get(nj_return, 0))
            credit = bucket_preis  # Credit equals new NJ price (no surcharge in credit)

    # Create bucket entry
    existing = db.execute(
        "SELECT id, bestand_verfuegbar FROM buch_zustand_bestand WHERE buch_id=? AND zustand='sehr_gut' AND verkaufspreis_cents=?",
        (buch["id"], bucket_preis)
    ).fetchone()
    if existing:
        db.execute(
            "UPDATE buch_zustand_bestand SET bestand_verfuegbar=bestand_verfuegbar+1, nutzungsjahr=? WHERE id=?",
            (nj_return, existing["id"])
        )
    else:
        db.execute(
            "INSERT INTO buch_zustand_bestand (buch_id, zustand, verkaufspreis_cents, bestand_verfuegbar, nutzungsjahr) VALUES (?, 'sehr_gut', ?, 1, ?)",
            (buch["id"], bucket_preis, nj_return)
        )

    # Mark rp as returned
    db.execute("UPDATE rechnungs_posten SET zurueckgegeben=1, zurueckgegeben_am=? WHERE id=?",
               (today.isoformat(), rp_id))
    db.execute("UPDATE buecher SET bestand_ausgegeben=MAX(0,bestand_ausgegeben-1) WHERE id=?",
               (buch["id"],))

    gutschrift_id = f"TEST-G-{today.isoformat()}-NJ{nj_return}"
    db.execute(
        "INSERT INTO gutschriften (id, schueler_id, schuljahr, datum, summe_cents, ausgezahlt) VALUES (?, ?, '2025/2026', ?, ?, 0)",
        (gutschrift_id, schueler_id, today.isoformat(), credit)
    )
    db.commit()

    return credit, bucket_preis, nj_return


# ── actual tests ──────────────────────────────────────────────────────────────

def run_api_verification():
    """Verify actual DB state via the service functions (unit-test style)."""
    import importlib.util

    # Load zustand service
    spec = importlib.util.spec_from_file_location(
        "zustand",
        os.path.join(os.path.dirname(__file__), "app", "services", "zustand.py")
    )
    zustand_mod = importlib.util.load_from_spec = spec  # noqa - not needed

    # Just import directly
    sys.path.insert(0, os.path.join(os.path.dirname(__file__)))
    from app.services.zustand import berechne_gutschrift_nutzungsjahr, berechne_bucket_preis

    print("\n=== Unit-Test: berechne_gutschrift_nutzungsjahr ===")

    abschlaege = {1: 16, 2: 33, 3: 49, 4: 66, 5: 82}
    basis = 2800
    fee = 0
    aufschlag = 100

    # NJ1 sale price = basis * (100-16)/100 = 2352, + aufschlag = 2452
    preis_kauf_nj1 = runde(basis, 16) + aufschlag  # 2452

    # Same-year return of NJ1 book
    credit, nj, abschr = berechne_gutschrift_nutzungsjahr(
        preis_cents=preis_kauf_nj1,
        kaufdatum_str=date.today().isoformat(),
        abschlaege=abschlaege,
        schutzgebuehr_cents=fee,
        basispreis_cents=basis,
        nutzungsjahr_beim_kauf=1,
    )
    check(credit == preis_kauf_nj1, f"Same-year return: credit={credit/100:.2f} == preis_kauf={preis_kauf_nj1/100:.2f}")
    check(nj == 1, f"Same-year return: NJ={nj} == 1")

    # Bucket price for NJ1 (no surcharge)
    bucket = berechne_bucket_preis(basis, 1, abschlaege, fee)
    expected_bucket_nj1 = runde(basis, 16)  # 2352
    check(bucket == expected_bucket_nj1, f"NJ1 bucket price: {bucket/100:.2f} == {expected_bucket_nj1/100:.2f} (no surcharge)")
    check(bucket < preis_kauf_nj1, f"Bucket ({bucket/100:.2f}) < Verkaufspreis ({preis_kauf_nj1/100:.2f}) — surcharge not stored")

    # Different-year return: NJ1 -> NJ2 (1 school year later)
    last_year = date(date.today().year - 1, date.today().month, date.today().day)
    credit2, nj2, abschr2 = berechne_gutschrift_nutzungsjahr(
        preis_cents=preis_kauf_nj1,
        kaufdatum_str=last_year.isoformat(),
        abschlaege=abschlaege,
        schutzgebuehr_cents=fee,
        basispreis_cents=basis,
        nutzungsjahr_beim_kauf=1,
    )
    expected_nj2_price = runde(basis, 33)  # 1876
    check(nj2 == 2, f"Diff-year return: NJ={nj2} == 2")
    check(credit2 == expected_nj2_price, f"Diff-year return: credit={credit2/100:.2f} == NJ2 price={expected_nj2_price/100:.2f}")

    bucket2 = berechne_bucket_preis(basis, 2, abschlaege, fee)
    check(bucket2 == expected_nj2_price, f"NJ2 bucket price: {bucket2/100:.2f} == {expected_nj2_price/100:.2f}")


def run_db_integrity_check(db):
    print("\n=== DB Integrity Check ===")

    null_nj = db.execute(
        "SELECT COUNT(*) FROM buch_zustand_bestand WHERE nutzungsjahr IS NULL AND bestand_verfuegbar > 0"
    ).fetchone()[0]
    check(null_nj == 0, f"No active buckets with NULL nutzungsjahr (found {null_nj})")

    # Check for duplicate (buch_id, zustand, nutzungsjahr) combinations with same NJ AND same price
    dups = db.execute(
        "SELECT buch_id, zustand, nutzungsjahr, verkaufspreis_cents, COUNT(*) AS cnt "
        "FROM buch_zustand_bestand "
        "WHERE bestand_verfuegbar > 0 "
        "GROUP BY buch_id, zustand, nutzungsjahr, verkaufspreis_cents "
        "HAVING cnt > 1"
    ).fetchall()
    check(len(dups) == 0, f"No duplicate (buch, zustand, nj, preis) buckets (found {len(dups)})")
    if dups:
        for d in dups:
            print(f"    DUP: buch={d['buch_id']} zustand={d['zustand']} nj={d['nutzungsjahr']} count={d['cnt']}")

    # Check all rechnungsposten have nutzungsjahr_beim_kauf set
    missing_nj = db.execute(
        "SELECT COUNT(*) FROM rechnungs_posten WHERE nutzungsjahr_beim_kauf IS NULL"
    ).fetchone()[0]
    check(missing_nj == 0, f"All rechnungsposten have nutzungsjahr_beim_kauf (missing: {missing_nj})")

    # Show current inventory state
    print("\n  Inventory summary (non-empty buckets):")
    for r in db.execute(
        "SELECT b.titel, bzb.zustand, bzb.verkaufspreis_cents, bzb.bestand_verfuegbar, bzb.nutzungsjahr "
        "FROM buch_zustand_bestand bzb "
        "JOIN buecher b ON b.id = bzb.buch_id "
        "WHERE bzb.bestand_verfuegbar > 0 "
        "ORDER BY b.titel, bzb.nutzungsjahr"
    ):
        print(f"    {r['titel'][:30]:30s} | {r['zustand']:10s} | NJ={r['nutzungsjahr']} | {r['verkaufspreis_cents']/100:.2f} EUR | Bestand={r['bestand_verfuegbar']}")

    print("\n  Active rechnungsposten (not returned):")
    for r in db.execute(
        "SELECT rp.id, b.titel, rp.preis_cents, rp.nutzungsjahr_beim_kauf, r.datum "
        "FROM rechnungs_posten rp "
        "JOIN rechnungen r ON r.id = rp.rechnung_id "
        "JOIN buecher b ON b.id = rp.buch_id "
        "WHERE rp.zurueckgegeben = 0 "
        "ORDER BY r.datum DESC LIMIT 10"
    ):
        print(f"    RP={r['id']} | {r['titel'][:25]:25s} | NJ_kauf={r['nutzungsjahr_beim_kauf']} | {r['preis_cents']/100:.2f} EUR | datum={r['datum']}")


def run_simulation_test(db, abschlaege, aufschlag):
    print("\n=== Simulation Test: Sale -> Same-Year Return -> Different-Year Return ===")

    # Clean up any leftover test data from crashed runs
    cleanup_test_data(db)

    buch = get_or_create_test_buch(db)
    schueler_id = get_or_create_test_schueler(db)
    basis = buch["preis_cents"]  # 2800

    print(f"\n  Buch: {buch['id']} | Basis={basis/100:.2f} EUR")
    print(f"  Abschlaege: {abschlaege}")
    print(f"  Aufschlag: {aufschlag/100:.2f} EUR")

    expected_nj1_bucket = runde(basis, abschlaege[1])
    expected_nj1_sale = expected_nj1_bucket + aufschlag
    expected_nj2_bucket = runde(basis, abschlaege[2])

    print(f"\n  Expected NJ1 bucket price: {expected_nj1_bucket/100:.2f} EUR")
    print(f"  Expected NJ1 sale price (with aufschlag): {expected_nj1_sale/100:.2f} EUR")
    print(f"  Expected NJ2 bucket price: {expected_nj2_bucket/100:.2f} EUR")

    # --- TEST 1: Sale at NJ1 ---
    print("\n  [1] Sale at NJ1 today")
    rech_id, rp_id, preis_verkauf, preis_bucket = do_sale(
        db, buch, schueler_id, abschlaege, aufschlag, nj=1
    )
    rp = db.execute("SELECT * FROM rechnungs_posten WHERE id=?", (rp_id,)).fetchone()
    check(rp["nutzungsjahr_beim_kauf"] == 1, f"Sale stores NJ=1 in rechnungs_posten (got {rp['nutzungsjahr_beim_kauf']})")
    check(rp["preis_cents"] == expected_nj1_sale, f"Sale price={rp['preis_cents']/100:.2f} == {expected_nj1_sale/100:.2f} EUR")

    bucket = db.execute(
        "SELECT * FROM buch_zustand_bestand WHERE buch_id=? AND zustand='sehr_gut' AND nutzungsjahr=1",
        (buch["id"],)
    ).fetchone()
    check(bucket is not None and bucket["nutzungsjahr"] == 1, f"Bucket NJ=1 stored")
    bucket_price_str = f"{bucket['verkaufspreis_cents']/100:.2f}" if bucket else "N/A"
    check(bucket is not None and bucket["verkaufspreis_cents"] == expected_nj1_bucket,
          f"Bucket price={bucket_price_str} == {expected_nj1_bucket/100:.2f} (no surcharge)")

    # --- TEST 2: Same-year return ---
    print("\n  [2] Same-year return")
    credit, bucket_preis_ret, nj_ret = do_return(
        db, rp_id, schueler_id, buch, abschlaege, aufschlag
    )
    check(credit == expected_nj1_sale, f"Same-year credit={credit/100:.2f} == sale price={expected_nj1_sale/100:.2f}")
    check(nj_ret == 1, f"Same-year return NJ={nj_ret} == 1")
    check(bucket_preis_ret == expected_nj1_bucket,
          f"Return bucket price={bucket_preis_ret/100:.2f} == {expected_nj1_bucket/100:.2f} (no surcharge stored)")

    returned_bucket = db.execute(
        "SELECT * FROM buch_zustand_bestand WHERE buch_id=? AND zustand='sehr_gut' AND nutzungsjahr=1 AND verkaufspreis_cents=?",
        (buch["id"], expected_nj1_bucket)
    ).fetchone()
    check(returned_bucket is not None, "Return bucket exists with correct NJ=1 and price")
    if returned_bucket:
        check(returned_bucket["bestand_verfuegbar"] >= 1, f"Return bucket bestand >= 1 (got {returned_bucket['bestand_verfuegbar']})")

    # --- TEST 3: Sale again at NJ1 (to set up for different-year test) ---
    print("\n  [3] Sale again at NJ1 (for different-year test)")
    # Simulate the sale as if it happened one school year ago
    past_date = date(date.today().year - 1, date.today().month, date.today().day)
    rech_id2, rp_id2, preis_verkauf2, preis_bucket2 = do_sale(
        db, buch, schueler_id, abschlaege, aufschlag, nj=1, kaufdatum=past_date.isoformat()
    )
    rp2 = db.execute("SELECT * FROM rechnungs_posten WHERE id=?", (rp_id2,)).fetchone()
    check(rp2["nutzungsjahr_beim_kauf"] == 1, f"Past sale stores NJ=1 in rechnungs_posten")

    # --- TEST 4: Different-year return (1 year later = today) ---
    print("\n  [4] Different-year return (kaufdatum=1 year ago, return=today)")
    credit2, bucket_preis2, nj_ret2 = do_return(
        db, rp_id2, schueler_id, buch, abschlaege, aufschlag
    )
    check(nj_ret2 == 2, f"Diff-year return NJ={nj_ret2} == 2 (advanced by 1)")
    check(bucket_preis2 == expected_nj2_bucket,
          f"Diff-year bucket price={bucket_preis2/100:.2f} == NJ2 price={expected_nj2_bucket/100:.2f}")
    check(credit2 == expected_nj2_bucket,
          f"Diff-year credit={credit2/100:.2f} == NJ2 price={expected_nj2_bucket/100:.2f} (no surcharge in credit)")

    nj2_bucket = db.execute(
        "SELECT * FROM buch_zustand_bestand WHERE buch_id=? AND zustand='sehr_gut' AND nutzungsjahr=2",
        (buch["id"],)
    ).fetchone()
    check(nj2_bucket is not None, "NJ2 bucket exists in inventory after different-year return")

    # --- TEST 5: No duplicates ---
    print("\n  [5] No duplicate (buch, zustand, nj) buckets")
    dups = db.execute(
        "SELECT nutzungsjahr, COUNT(*) AS cnt FROM buch_zustand_bestand "
        "WHERE buch_id=? AND zustand='sehr_gut' GROUP BY nutzungsjahr HAVING cnt > 1",
        (buch["id"],)
    ).fetchall()
    check(len(dups) == 0, f"No duplicate NJ buckets for test book (found {len(dups)})")

    # Cleanup test data
    cleanup_test_data(db)
    print("\n  Test data cleaned up.")


# ── main ──────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 60)
    print("Schulbuch Lifecycle Test")
    print("=" * 60)

    db = sqlite3.connect(DB_PATH)
    db.row_factory = sqlite3.Row

    abschlaege, aufschlag = load_settings(db)
    print(f"\nLoaded settings: abschlaege={abschlaege}, aufschlag={aufschlag}")

    try:
        run_api_verification()
        run_db_integrity_check(db)
        run_simulation_test(db, abschlaege, aufschlag)
    except Exception as e:
        import traceback
        print(f"\nERROR: {e}")
        traceback.print_exc()
        _failures += 1
    finally:
        db.close()

    print("\n" + "=" * 60)
    if _failures == 0:
        print(f"ALL TESTS PASSED")
    else:
        print(f"FAILURES: {_failures}")
    print("=" * 60)
    sys.exit(0 if _failures == 0 else 1)
