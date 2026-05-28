import sqlite3
db = sqlite3.connect("schulbuch.db")
db.row_factory = sqlite3.Row

print("=== BuchZustandBestand (Buckets) ===")
rows = db.execute("""
  SELECT bzb.id, b.titel, bzb.zustand, bzb.verkaufspreis_cents,
         bzb.bestand_verfuegbar, bzb.nutzungsjahr, b.preis_cents AS basis
  FROM buch_zustand_bestand bzb
  JOIN buecher b ON b.id = bzb.buch_id
  ORDER BY b.titel, bzb.zustand, bzb.verkaufspreis_cents
""").fetchall()
for r in rows:
    nj_label = "NJ " + str(r["nutzungsjahr"]) if r["nutzungsjahr"] is not None else "NJ ?"
    titel = r["titel"][:28]
    print(f"  {titel:28s} | {r['zustand']:10s} | {r['verkaufspreis_cents']/100:.2f} EUR (Basis: {r['basis']/100:.2f}) | Verfuegbar: {r['bestand_verfuegbar']} | {nj_label}")

print()
print("=== Rechnungen / Posten ===")
rows2 = db.execute("""
  SELECT r.id, s.vorname||' '||s.nachname AS name, rp.id AS rp_id,
         b.titel, rp.preis_cents, rp.nutzungsjahr_beim_kauf, rp.zurueckgegeben
  FROM rechnungen r
  JOIN schueler s ON s.id = r.schueler_id
  JOIN rechnungs_posten rp ON rp.rechnung_id = r.id
  JOIN buecher b ON b.id = rp.buch_id
  ORDER BY r.id
""").fetchall()
for r in rows2:
    zurueck = "zurueck" if r["zurueckgegeben"] else "aktiv"
    titel = r["titel"][:22]
    name = r["name"][:18]
    print(f"  {r['id']:15s} | {name:18s} | {titel:22s} | {r['preis_cents']/100:.2f} EUR | NJ_kauf={r['nutzungsjahr_beim_kauf']} | {zurueck}")

db.close()
