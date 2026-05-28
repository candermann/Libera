import sqlite3
db = sqlite3.connect("schulbuch.db")
db.row_factory = sqlite3.Row

print("=== Abschlag / Aufschlag Einstellungen ===")
rows = db.execute(
    "SELECT schluessel, wert FROM einstellungen WHERE schluessel LIKE '%abschlag%' OR schluessel LIKE '%aufschlag%' ORDER BY schluessel"
).fetchall()
for r in rows:
    print(f"  {r['schluessel']}: {r['wert']}")

print()
print("=== Physik 9/10 all buckets ===")
rows2 = db.execute(
    "SELECT bzb.id, bzb.verkaufspreis_cents, bzb.bestand_verfuegbar, bzb.nutzungsjahr, bzb.zustand, b.preis_cents AS basis "
    "FROM buch_zustand_bestand bzb JOIN buecher b ON b.id = bzb.buch_id WHERE b.titel LIKE '%Physik 9%' ORDER BY bzb.verkaufspreis_cents"
).fetchall()
for r in rows2:
    print(f"  id={r['id']} preis={r['verkaufspreis_cents']/100:.2f} basis={r['basis']/100:.2f} bestand={r['bestand_verfuegbar']} nj={r['nutzungsjahr']} zustand={r['zustand']}")

print()
print("=== Gutschrift Posten (recent) ===")
rows3 = db.execute(
    "SELECT gp.*, b.titel FROM gutschrift_posten gp JOIN rechnungs_posten rp ON rp.id=gp.rechnungs_posten_id JOIN buecher b ON b.id=rp.buch_id"
).fetchall()
for r in rows3:
    print(f"  gutschrift={r['gutschrift_id']} buch={r['titel']} betrag={r['betrag_cents']/100:.2f} nj_stored=? abschreibung={r['abschreibung_prozent']}%")

db.close()
