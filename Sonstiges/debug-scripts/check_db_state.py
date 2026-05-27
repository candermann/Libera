import sqlite3

db = sqlite3.connect('schulbuch.db')
db.row_factory = sqlite3.Row

print('=== Einstellungen (Abschlaege) ===')
for r in db.execute("SELECT schluessel, wert FROM einstellungen WHERE schluessel LIKE '%abschlag%' ORDER BY schluessel"):
    print(f'  {r["schluessel"]}: {r["wert"]}')

aufschlag_row = db.execute("SELECT wert FROM einstellungen WHERE schluessel='rueckgabe_aufschlag_cents'").fetchone()
print(f'  rueckgabe_aufschlag_cents: {aufschlag_row["wert"] if aufschlag_row else "N/A"}')

print()
print('=== Schueler (aktiv) ===')
for r in db.execute('SELECT id, vorname, nachname, klasse FROM schueler WHERE geloescht_am IS NULL LIMIT 5'):
    print(f'  {r["id"]}: {r["vorname"]} {r["nachname"]} ({r["klasse"]})')

print()
print('=== Buecher (erste 8) ===')
for r in db.execute('SELECT id, titel, preis_cents, schutzgebuehr_cents FROM buecher LIMIT 8'):
    print(f'  {r["id"]}: {r["titel"]} | Preis: {r["preis_cents"]/100:.2f} EUR | Schutzgeb: {(r["schutzgebuehr_cents"] or 0)/100:.2f} EUR')

print()
print('=== BuchZustandBestand ===')
for r in db.execute('SELECT bzb.id, b.id AS buch_id, b.titel, bzb.zustand, bzb.verkaufspreis_cents, bzb.bestand_verfuegbar, bzb.nutzungsjahr FROM buch_zustand_bestand bzb JOIN buecher b ON b.id=bzb.buch_id ORDER BY b.titel LIMIT 20'):
    print(f'  ID={r["id"]} {r["titel"][:28]:28s} | {r["zustand"]:10s} | {r["verkaufspreis_cents"]/100:.2f} EUR | Bestand={r["bestand_verfuegbar"]} | NJ={r["nutzungsjahr"]}')

print()
null_count = db.execute('SELECT COUNT(*) FROM buch_zustand_bestand WHERE nutzungsjahr IS NULL').fetchone()[0]
print(f'NULL NJ Buckets: {null_count}')

dup_count = db.execute('SELECT COUNT(*) FROM (SELECT buch_id, zustand, COUNT(*) AS cnt FROM buch_zustand_bestand GROUP BY buch_id, zustand HAVING cnt > 1)').fetchone()[0]
print(f'Books with multiple buckets per zustand: {dup_count}')

print()
print('=== Aktive Rechnungsposten (nicht zurueckgegeben) ===')
for r in db.execute("SELECT rp.id, rp.buch_id, b.titel, rp.preis_cents, rp.nutzungsjahr_beim_kauf, rp.zurueckgegeben, r.datum, r.id AS rech_id FROM rechnungs_posten rp JOIN rechnungen r ON r.id=rp.rechnung_id JOIN buecher b ON b.id=rp.buch_id WHERE rp.zurueckgegeben=0 LIMIT 10"):
    print(f'  RP={r["id"]} Rechnung={r["rech_id"]} | {r["titel"][:25]:25s} | {r["preis_cents"]/100:.2f} EUR | NJ_kauf={r["nutzungsjahr_beim_kauf"]} | datum={r["datum"]}')

db.close()
