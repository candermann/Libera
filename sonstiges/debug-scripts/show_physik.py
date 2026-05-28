import sqlite3
db = sqlite3.connect('schulbuch.db')
db.row_factory = sqlite3.Row

print("=== Physik 9/10 Buckets ===")
rows = db.execute(
    "SELECT bzb.id, bzb.zustand, bzb.verkaufspreis_cents, bzb.bestand_verfuegbar, bzb.nutzungsjahr, b.preis_cents "
    "FROM buch_zustand_bestand bzb JOIN buecher b ON b.id=bzb.buch_id "
    "WHERE b.titel='Physik 9/10' ORDER BY bzb.nutzungsjahr, bzb.zustand, bzb.verkaufspreis_cents"
).fetchall()
for r in rows:
    print(f"  id={r['id']} zustand={r['zustand']:10s} nj={r['nutzungsjahr']} preis={r['verkaufspreis_cents']/100:.2f} bestand={r['bestand_verfuegbar']} basis={r['preis_cents']/100:.2f}")

# Jetzt bereinigen: NJ=2 gut und NJ=2 sehr_gut sind verschiedene Zustaende, kein Problem
# Aber falls gleiche Kombination (buch, zustand, nj) mehrfach: zusammenfuehren
print()
print("=== Duplikate (buch, zustand, nj) ===")
dups = db.execute(
    "SELECT bzb.buch_id, bzb.zustand, bzb.nutzungsjahr, COUNT(*) as cnt, GROUP_CONCAT(bzb.verkaufspreis_cents) as preise "
    "FROM buch_zustand_bestand bzb JOIN buecher b ON b.id=bzb.buch_id "
    "WHERE b.titel='Physik 9/10' AND bzb.bestand_verfuegbar > 0 "
    "GROUP BY bzb.buch_id, bzb.zustand, bzb.nutzungsjahr HAVING cnt > 1"
).fetchall()
if dups:
    for d in dups:
        print(f"  zustand={d['zustand']} nj={d['nutzungsjahr']} count={d['cnt']} preise={d['preise']}")
else:
    print("  Keine Duplikate (bei gleicher nj+zustand+preis Kombination)")

db.close()
