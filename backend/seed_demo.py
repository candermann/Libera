"""
Demo-Seed: Ergänzt die bestehende Datenbank mit Präsentationsdaten.
Berührt keine vorhandenen Datensätze.

Ergänzt:
- Lernmaterial (6 weitere Kategorien)
- Freiposten-Vorlagen (3 weitere)
- Bücher: Nutzungsjahre 1, 3, 4, 5 für Demo der Abschreibung
- Oberstufen-Bücher (EF/Q1/Q2)
- 8 Schüler in EF/Q1/Q2
- 3 archivierte Schüler (für Archiv-Demo)
- Rechnungen: einige mit mail_versandt_am=NULL (für Buchhaltungs-Demo)
- 1 Demo-Schüler mit Guthaben aus Gutschrift (für Verrechnungs-Demo)
"""

import sqlite3
import random
from datetime import date, timedelta

DB = "/Users/gedeoncipi/Downloads/Bibliomat/backend/data/schulbuch.db"
SCHULJAHR = "2025/2026"
HEUTE = date.today().isoformat()


def next_id(c, table, prefix, width=4):
    row = c.execute(
        f"SELECT id FROM {table} ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return f"{prefix}-{'1'.zfill(width)}"
    last = int(row[0].split("-")[-1])
    return f"{prefix}-{str(last + 1).zfill(width)}"


def next_rechnung_id(c, schuljahr):
    year = schuljahr.split("/")[0]
    row = c.execute(
        f"SELECT id FROM rechnungen WHERE id LIKE 'R-{year}-%' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return f"R-{year}-0001"
    last = int(row[0].split("-")[-1])
    return f"R-{year}-{str(last + 1).zfill(4)}"


def next_gutschrift_id(c, schuljahr):
    year = schuljahr.split("/")[0]
    row = c.execute(
        f"SELECT id FROM gutschriften WHERE id LIKE 'G-{year}-%' ORDER BY id DESC LIMIT 1"
    ).fetchone()
    if not row:
        return f"G-{year}-0001"
    last = int(row[0].split("-")[-1])
    return f"G-{year}-{str(last + 1).zfill(4)}"


db = sqlite3.connect(DB)
db.execute("PRAGMA foreign_keys = ON")
c = db.cursor()

print("[DEMO-SEED] Starte Ergänzung...")

# ── 1. Lernmaterial ──────────────────────────────────────────────────────────
lernmaterial_neu = [
    ("Taschenrechner Casio FX-87DE",  "Taschenrechner", 1490, 30),
    ("Lineal 30 cm",                  "Lineal",          150, 200),
    ("Zirkel-Set",                    "Zirkel",          395, 80),
    ("Hefter A4 mit Folientasche",    "Hefter",          250, 150),
    ("Formelsammlung Mathematik",     "Buch",            690, 60),
    ("Bleistift-Set 12er",            "Stifte",          195, 120),
]
lm_added = 0
for name, kat, preis, bestand in lernmaterial_neu:
    exists = c.execute("SELECT 1 FROM lernmaterial WHERE name = ?", (name,)).fetchone()
    if not exists:
        mid = next_id(c, "lernmaterial", "M")
        c.execute(
            "INSERT INTO lernmaterial (id, name, kategorie, preis_cents, bestand_gesamt, bestand_ausgegeben) VALUES (?,?,?,?,?,0)",
            (mid, name, kat, preis, bestand)
        )
        lm_added += 1
print(f"  [OK] {lm_added} Lernmaterialien ergänzt")

# ── 2. Freiposten-Vorlagen ───────────────────────────────────────────────────
vorlagen_neu = [
    ("Schülerausweis",          500,  "Pauschal"),
    ("Kopierpauschale",         300,  "Pauschal"),
    ("Sprachreise-Unkostenbeitrag", 2500, "Pauschal"),
]
vl_added = 0
for bez, betrag, typ in vorlagen_neu:
    exists = c.execute("SELECT 1 FROM freiposten_vorlagen WHERE bezeichnung = ?", (bez,)).fetchone()
    if not exists:
        c.execute(
            "INSERT INTO freiposten_vorlagen (bezeichnung, betrag_cents, typ) VALUES (?,?,?)",
            (bez, betrag, typ)
        )
        vl_added += 1
print(f"  [OK] {vl_added} Freiposten-Vorlagen ergänzt")

# ── 3. Bücher: Nutzungsjahre 1 / 4 / 5 für bestehende Bücher ────────────────
# Zeigt die Abschreibungslogik in der Demo besser
abschlaege = {1: 0, 2: 10, 3: 20, 4: 30, 5: 40}
buecher = c.execute("SELECT id, preis_cents FROM buecher WHERE geloescht_am IS NULL").fetchall()
bzb_added = 0
for buch_id, preis in buecher:
    for nutzungsjahr in [1, 4, 5]:
        exists = c.execute(
            "SELECT 1 FROM buch_zustand_bestand WHERE buch_id=? AND nutzungsjahr=?",
            (buch_id, nutzungsjahr)
        ).fetchone()
        if not exists:
            abschlag = abschlaege.get(nutzungsjahr, 0)
            vkpreis = round(preis * (100 - abschlag) / 100)
            verfuegbar = random.randint(2, 8)
            c.execute(
                "INSERT INTO buch_zustand_bestand (buch_id, nutzungsjahr, verkaufspreis_cents, bestand_verfuegbar) VALUES (?,?,?,?)",
                (buch_id, nutzungsjahr, vkpreis, verfuegbar)
            )
            bzb_added += 1
print(f"  [OK] {bzb_added} Nutzungsjahr-Bestände ergänzt (Jahr 1, 4, 5)")

# ── 4. Oberstufen-Bücher ─────────────────────────────────────────────────────
oberstufe_buecher = [
    ("Mathematik Analysis EF/Q1",  "Mathematik",  11, "Cornelsen",  3490),
    ("Mathematik Stochastik Q2",   "Mathematik",  12, "Cornelsen",  2990),
    ("Deutsch Oberstufe",          "Deutsch",     11, "Klett",      3290),
    ("Englisch Oberstufe",         "Englisch",    11, "Klett",      3390),
    ("Geschichte Oberstufe",       "Geschichte",  11, "Westermann", 3190),
    ("Biologie Oberstufe",         "Biologie",    11, "Westermann", 3290),
    ("Chemie Oberstufe",           "Chemie",      11, "Schroedel",  3190),
    ("Physik Oberstufe",           "Physik",      11, "Duden",      3290),
]
ob_added = 0
ob_buch_ids = []
for titel, fach, stufe, verlag, preis in oberstufe_buecher:
    exists = c.execute("SELECT id FROM buecher WHERE titel=?", (titel,)).fetchone()
    if exists:
        ob_buch_ids.append(exists[0])
        continue
    bid = next_id(c, "buecher", "B")
    c.execute(
        "INSERT INTO buecher (id, titel, fach, stufe, verlag, preis_cents, gutschrift_cents, bestand_gesamt, bestand_ausgegeben) VALUES (?,?,?,?,?,?,?,?,0)",
        (bid, titel, fach, stufe, verlag, preis, preis, 40)
    )
    # Nutzungsjahre 0 und 2 anlegen
    for nj, abschlag in [(0, 0), (2, 10)]:
        vkpreis = round(preis * (100 - abschlag) / 100)
        c.execute(
            "INSERT INTO buch_zustand_bestand (buch_id, nutzungsjahr, verkaufspreis_cents, bestand_verfuegbar) VALUES (?,?,?,?)",
            (bid, nj, vkpreis, random.randint(5, 15))
        )
    ob_buch_ids.append(bid)
    ob_added += 1
print(f"  [OK] {ob_added} Oberstufen-Bücher ergänzt")

# ── 5. Oberstufen-Schüler (EF, Q1, Q2) ──────────────────────────────────────
os_schueler_data = [
    ("Marie",    "Hoffmann",  "EF",  "Am Waldrand 3",     "16341", "Panketal",   "m.hoffmann@beispiel.de"),
    ("Niklas",   "Becker",    "EF",  "Lindenweg 12",      "16341", "Panketal",   ""),
    ("Sophie",   "Wagner",    "EF",  "Gartenstr. 5",      "16348", "Wandlitz",   "wagner.eltern@mail.de"),
    ("Lukas",    "Schröder",  "Q1",  "Hauptstraße 44",    "16341", "Panketal",   ""),
    ("Emma",     "Neumann",   "Q1",  "Kirchweg 7",        "16359", "Biesenthal", "neumann.familie@mail.de"),
    ("Felix",    "Braun",     "Q2",  "Birkenallee 21",    "16341", "Panketal",   ""),
    ("Lena",     "Krüger",    "Q2",  "Schulstraße 9",     "16356", "Ahrensfelde","krueger@beispiel.de"),
    ("Jonas",    "Hartmann",  "Q2",  "Rosenstraße 17",    "16341", "Panketal",   ""),
]
os_added = 0
os_ids = []
for vorname, nachname, klasse, strasse, plz, ort, email in os_schueler_data:
    exists = c.execute(
        "SELECT id FROM schueler WHERE vorname=? AND nachname=? AND klasse=?",
        (vorname, nachname, klasse)
    ).fetchone()
    if exists:
        os_ids.append(exists[0])
        continue
    sid = next_id(c, "schueler", "S")
    c.execute(
        "INSERT INTO schueler (id, vorname, nachname, klasse, strasse, plz, ort, email_eltern) VALUES (?,?,?,?,?,?,?,?)",
        (sid, vorname, nachname, klasse, strasse, plz, ort, email)
    )
    os_ids.append(sid)
    os_added += 1
print(f"  [OK] {os_added} Oberstufen-Schüler ergänzt")

# ── 6. Rechnungen für Oberstufen-Schüler ────────────────────────────────────
# Einige mit mail_versandt_am = NULL → erscheinen als "unversandt" in Buchhaltung
rech_added = 0
for sid in os_ids[:6]:
    rid = next_rechnung_id(c, SCHULJAHR)
    datum = "2025-09-03"
    buecher_sample = random.sample(ob_buch_ids[:6], min(3, len(ob_buch_ids)))
    summe = 0
    c.execute(
        "INSERT INTO rechnungen (id, schueler_id, schuljahr, datum, summe_cents, verrechnet_cents, status) VALUES (?,?,?,?,0,0,'offen')",
        (rid, sid, SCHULJAHR, datum)
    )
    for bid in buecher_sample:
        preis = c.execute("SELECT preis_cents FROM buecher WHERE id=?", (bid,)).fetchone()[0]
        summe += preis
        c.execute(
            "INSERT INTO rechnungs_posten (rechnung_id, buch_id, preis_cents, nutzungsjahr_beim_kauf) VALUES (?,?,?,0)",
            (rid, bid, preis)
        )
    c.execute("UPDATE rechnungen SET summe_cents=? WHERE id=?", (summe, rid))
    rech_added += 1
print(f"  [OK] {rech_added} Oberstufen-Rechnungen ergänzt (unversandt)")

# ── 7. Archivierte Schüler (für Archiv-Demo) ────────────────────────────────
archiv_data = [
    ("Erik",   "Sommer",  "ehemals 10", "Hauptstraße 1",  "16341", "Panketal"),
    ("Clara",  "Winter",  "ehemals 10", "Schulweg 3",     "16341", "Panketal"),
    ("Tom",    "Berg",    "ehemals Q2", "Lindenallee 8",  "16348", "Wandlitz"),
]
arch_added = 0
for vorname, nachname, klasse, strasse, plz, ort in archiv_data:
    exists = c.execute(
        "SELECT 1 FROM schueler WHERE vorname=? AND nachname=?", (vorname, nachname)
    ).fetchone()
    if not exists:
        sid = next_id(c, "schueler", "S")
        c.execute(
            "INSERT INTO schueler (id, vorname, nachname, klasse, strasse, plz, ort, archiviert_am, archiviert_schuljahr) VALUES (?,?,?,?,?,?,?,?,?)",
            (sid, vorname, nachname, klasse, strasse, plz, ort, "2025-07-31", "2024/2025")
        )
        arch_added += 1
print(f"  [OK] {arch_added} archivierte Schüler ergänzt")

# ── 8. Demo-Schüler: Guthaben aus Gutschrift, bereit zur Verrechnung ─────────
# Schüler der eine offene Gutschrift hat – ideal für Verrechnungs-Demo
demo_sid_row = c.execute(
    "SELECT id FROM schueler WHERE vorname='Marie' AND nachname='Hoffmann' AND klasse='EF'"
).fetchone()
if demo_sid_row:
    demo_sid = demo_sid_row[0]
    # Prüfen ob schon eine Gutschrift existiert
    existing_g = c.execute(
        "SELECT 1 FROM gutschriften WHERE schueler_id=? AND ausgezahlt=0", (demo_sid,)
    ).fetchone()
    if not existing_g:
        # Rechnung von Marie Hoffmann holen
        r = c.execute(
            "SELECT r.id, rp.id, rp.preis_cents FROM rechnungen r JOIN rechnungs_posten rp ON rp.rechnung_id = r.id WHERE r.schueler_id=? AND rp.zurueckgegeben=0 LIMIT 1",
            (demo_sid,)
        ).fetchone()
        if r:
            rid, rp_id, preis = r
            gid = next_gutschrift_id(c, SCHULJAHR)
            c.execute(
                "INSERT INTO gutschriften (id, schueler_id, schuljahr, datum, summe_cents, ausgezahlt) VALUES (?,?,?,?,?,0)",
                (gid, demo_sid, SCHULJAHR, "2025-10-15", preis)
            )
            c.execute(
                "INSERT INTO gutschrift_posten (gutschrift_id, rechnungs_posten_id, betrag_cents) VALUES (?,?,?)",
                (gid, rp_id, preis)
            )
            c.execute("UPDATE rechnungs_posten SET zurueckgegeben=1, zurueckgegeben_am='2025-10-15' WHERE id=?", (rp_id,))
            print(f"  [OK] Demo-Gutschrift für Marie Hoffmann angelegt ({gid}, {preis/100:.2f} €)")

db.commit()
print("\n[DONE] Demo-Daten erfolgreich ergänzt!")
print("\nZusammenfassung der Datenbank:")
for table in ["schueler", "buecher", "lernmaterial", "freiposten_vorlagen", "rechnungen", "gutschriften", "zahlungen"]:
    n = c.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
    print(f"  {table}: {n}")
archived = c.execute("SELECT COUNT(*) FROM schueler WHERE archiviert_am IS NOT NULL").fetchone()[0]
print(f"  davon archiviert: {archived}")
db.close()
