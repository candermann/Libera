"""
Löscht alle Schüler und ihre Vorgänge, setzt bestand_ausgegeben zurück
und legt 120 neue Schüler in den Klassen 6–10 an (keine Vorgänge).

Aufruf: python reset_schueler.py
"""

import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from app.db import SessionLocal, init_db
from app.models import (
    Schueler, Rechnungen, RechnungsPosten, Gutschriften, GutschriftPosten,
    Zahlungen, Auszahlungen, RechnungVerrechnung, LernmaterialPosten,
    RechnungFreiposten, Buecher,
)
from app.services.ids import generate_schueler_id

init_db()
db = SessionLocal()

VORNAMEN_M = [
    "Luca", "Noah", "Leon", "Felix", "Paul", "Jonas", "Elias", "Ben",
    "Finn", "Max", "Tobias", "Simon", "David", "Jan", "Moritz", "Tim",
    "Lukas", "Erik", "Julian", "Anton", "Niklas", "Fabian", "Robin",
    "Philipp", "Tom", "Stefan", "Daniel", "Alexander", "Kevin", "Florian",
    "Matthias", "Patrick", "Christoph", "Dominik", "Sebastian", "Marvin",
    "Dennis", "Nils", "Ole", "Lars", "Sven", "Kai", "Marc", "Nico",
    "Jannik", "Lennart", "Oskar", "Raphael", "Benedikt", "Theo",
    "Valentin", "Constantin", "Maximilian", "Ferdinand", "Wilhelm",
    "Heinrich", "Konrad", "Klaus", "Rainer", "Dieter", "Gerhard",
]
VORNAMEN_W = [
    "Emma", "Mia", "Lena", "Anna", "Sophie", "Marie", "Laura", "Hannah",
    "Lisa", "Julia", "Lea", "Sarah", "Clara", "Charlotte", "Amelie",
    "Theresa", "Helena", "Emilia", "Frieda", "Nora", "Greta", "Ida",
    "Johanna", "Katharina", "Marlene", "Leonie", "Alina", "Jana",
    "Vanessa", "Celine", "Franziska", "Sabine", "Monika", "Petra",
    "Claudia", "Andrea", "Stefanie", "Nicole", "Katrin", "Sandra",
    "Melanie", "Daniela", "Jennifer", "Natalie", "Christina", "Birgit",
    "Ursula", "Ingrid", "Renate", "Helga", "Astrid", "Brigitte",
    "Ines", "Manuela", "Silvia", "Nadine", "Susanne", "Kerstin",
    "Tanja", "Angela",
]
NACHNAMEN = [
    "Müller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer",
    "Wagner", "Becker", "Hoffmann", "Schäfer", "Koch", "Bauer",
    "Richter", "Klein", "Wolf", "Schröder", "Neumann", "Schwarz",
    "Zimmermann", "Braun", "Krüger", "Hofmann", "Hartmann", "Lange",
    "Schmitt", "Werner", "Krause", "Meier", "Lehmann", "König",
    "Walter", "Mayer", "Huber", "Kaiser", "Fuchs", "Peters", "Lang",
    "Scholz", "Möller", "Weiß", "Jung", "Hahn", "Schubert", "Vogel",
    "Friedrich", "Berger", "Winkler", "Roth", "Beck", "Lorenz",
    "Baumann", "Franke", "Albrecht", "Engel", "Horn", "Kühn", "Busch",
    "Dietrich", "Sauer", "Arnold", "Ziegler", "Brandt", "Voigt",
    "Pohl", "Pfeiffer", "Haas", "Herrmann", "Simon", "Groß",
    "Böhm", "Jäger", "Lenz", "Naumann", "Sommer", "Kaufmann",
    "Schulze", "Keller", "Bergmann", "Heinrich", "Thoma", "Wendt",
    "Fröhlich", "Kraft", "Krug", "Stahl", "Otto", "Ritter",
    "Marx", "Michaelis", "Seifert", "Ludwig", "Stein", "Köhler",
    "Günther", "Kremer", "Lohmann", "Voss", "Schenk", "Böttcher",
    "Beyer", "Klose", "Mielke", "Radke", "Schulz", "Thiele",
    "Grabowski", "Janowski", "Kowalski", "Nowak", "Wisniewski",
    "Brauer", "Hanke", "Hübner", "Lindner", "Pfeil", "Stephan",
    "Tschirner", "Ulrich", "Voß", "Weis", "Xavier", "Zabel",
]

STRASSEN = [
    ("Zepernicker Straße", range(1, 80)),
    ("Lindenberger Straße", range(1, 60)),
    ("Bürgermeisterstraße", range(1, 40)),
    ("Bernauer Straße", range(1, 90)),
    ("Schulstraße", range(1, 35)),
    ("Gartenstraße", range(1, 50)),
    ("Bahnhofstraße", range(2, 55)),
    ("Hauptstraße", range(1, 100)),
    ("Birkenweg", range(1, 30)),
    ("Fichtenweg", range(1, 25)),
    ("Am Feldrain", range(1, 20)),
    ("Kastanienallee", range(1, 45)),
    ("Rosenweg", range(1, 28)),
    ("Eichenstraße", range(1, 38)),
    ("Kiefernweg", range(1, 22)),
    ("Lanker Straße", range(1, 60)),
    ("Schwanebecker Chaussee", range(1, 70)),
    ("Dorfstraße", range(1, 45)),
    ("Waldstraße", range(1, 55)),
    ("Am Anger", range(1, 18)),
]

ORTE = [
    ("16341", "Panketal"),
    ("16341", "Schwanebeck"),
    ("16341", "Zepernick"),
    ("16341", "Röntgental"),
    ("16356", "Ahrensfelde"),
    ("16321", "Bernau bei Berlin"),
    ("16348", "Wandlitz"),
    ("13125", "Berlin-Buch"),
    ("13158", "Berlin-Blankenburg"),
    ("16356", "Eiche"),
]

VORNAMEN_ELTERN_M = [
    "Thomas", "Michael", "Andreas", "Stefan", "Christian", "Frank",
    "Jörg", "Bernd", "Uwe", "Ralf", "Holger", "Dirk", "Torsten",
    "Sven", "Carsten", "Lars", "Markus", "Oliver", "Jens", "Klaus",
]
VORNAMEN_ELTERN_W = [
    "Petra", "Sabine", "Claudia", "Andrea", "Monika", "Stefanie",
    "Nicole", "Katrin", "Sandra", "Melanie", "Daniela", "Jennifer",
    "Susanne", "Kerstin", "Tanja", "Ute", "Silke", "Heike",
    "Birgit", "Renate",
]

try:
    from sqlalchemy import text as sa_text

    # ── 1. Alle abhängigen Daten löschen ─────────────────────────────────
    print("Lösche abhängige Datensätze …")
    db.execute(sa_text("PRAGMA foreign_keys = OFF"))
    n = db.query(RechnungVerrechnung).delete(); print(f"  rechnung_verrechnungen:   {n}")
    n = db.query(GutschriftPosten).delete();    print(f"  gutschrift_posten:        {n}")
    n = db.query(RechnungsPosten).delete();     print(f"  rechnungs_posten:         {n}")
    n = db.query(LernmaterialPosten).delete();  print(f"  lernmaterial_posten:      {n}")
    n = db.query(RechnungFreiposten).delete();  print(f"  rechnung_freiposten:      {n}")
    n = db.query(Gutschriften).delete();        print(f"  gutschriften:             {n}")
    n = db.query(Rechnungen).delete();          print(f"  rechnungen:               {n}")
    n = db.query(Zahlungen).delete();           print(f"  zahlungen:                {n}")
    n = db.query(Auszahlungen).delete();        print(f"  auszahlungen:             {n}")
    n = db.query(Schueler).delete();            print(f"  schueler:                 {n}")
    db.flush()
    db.execute(sa_text("PRAGMA foreign_keys = ON"))

    # ── 2. bestand_ausgegeben zurücksetzen ───────────────────────────────
    n = db.query(Buecher).update({"bestand_ausgegeben": 0})
    print(f"\nbestand_ausgegeben bei {n} Büchern auf 0 zurückgesetzt.")
    db.flush()

    # ── 3. 120 Schüler anlegen ───────────────────────────────────────────
    # 5 Klassen × 24 Schüler = 120
    klassen = ["6", "7", "8", "9", "10"]

    # Abwechselnd männlich/weiblich
    vornamen_pool = []
    for i in range(60):
        vornamen_pool.append((VORNAMEN_M[i % len(VORNAMEN_M)], "m"))
        vornamen_pool.append((VORNAMEN_W[i % len(VORNAMEN_W)], "w"))

    idx = 0
    print(f"\nLege 120 Schüler an …")
    for klasse in klassen:
        for _ in range(24):
            vorname, geschlecht = vornamen_pool[idx % len(vornamen_pool)]
            nachname = NACHNAMEN[idx % len(NACHNAMEN)]

            strasse_name, hausnr_range = STRASSEN[idx % len(STRASSEN)]
            hausnr = list(hausnr_range)[idx % len(list(hausnr_range))]
            strasse = f"{strasse_name} {hausnr}"

            plz, ort = ORTE[idx % len(ORTE)]

            # E-Mail der Eltern: Nachname + Anfangsbuchstabe des elterlichen Vornamens
            if geschlecht == "m":
                eltern_vorname = VORNAMEN_ELTERN_W[idx % len(VORNAMEN_ELTERN_W)]
            else:
                eltern_vorname = VORNAMEN_ELTERN_M[idx % len(VORNAMEN_ELTERN_M)]
            email = (
                f"{eltern_vorname.lower()}.{nachname.lower()}"
                .replace("ü", "ue").replace("ö", "oe").replace("ä", "ae")
                .replace("ß", "ss").replace(" ", "")
                + f"@gmail.com"
            )

            idx += 1
            sid = generate_schueler_id(db)
            db.add(Schueler(
                id=sid,
                vorname=vorname,
                nachname=nachname,
                klasse=klasse,
                strasse=strasse,
                plz=plz,
                ort=ort,
                email_eltern=email,
            ))
            db.flush()

    db.commit()
    print(f"Fertig — 120 Schüler in {len(klassen)} Klassen (je 24) angelegt.")

except Exception as e:
    db.rollback()
    print(f"FEHLER: {e}")
    raise
finally:
    db.close()
