# Patchnotes

## 2026-05-26 - Bibliomat Redesign & UX-Verbesserungen

### Design & Branding
- Neues **SVG-Logo** für Bibliomat erstellt: stilisiertes Buch mit Mauszeiger als Symbol für Digitalisierung
- **Playfair Display** Schriftart wird jetzt für alle Seitenüberschriften, die Startseiten-Begrüßung und Flow-Titel (Ausgabe, Buchrückgabe) verwendet
- **Sidebar** mit dezenten Blau-Verlauf (`#eef3ff → #f8fafc`) für mehr visuelle Tiefe
- Aktiver Navigationseintrag wird jetzt **farbig gefüllt** (Akzentfarbe mit weißem Text)
- **Input-Fokus-Glow** global: alle Eingabefelder zeigen beim Fokus einen blauen Rahmen und subtilen Schimmer
- **Login-Screen** komplett modernisiert: Verlaufshintergrund, Bibliomat-Branding in Playfair Display, neues SVG-Logo, Untertitel „Schulbuchverwaltungssoftware"

### Navigation & Bezeichnungen
- „Bücherei Sekretariat" → **„Bibliomat"** in der Sidebar (Playfair Display, größere Schrift)
- „Rechnungsversand & Buchhaltung" → **„Buchhaltung"** in Navigation und Seitenüberschrift
- „Verkauf" → **„Ausgabe"** in allen Schritten des Buchausgabe-Flows
- „Verkauf" → **„Buchausgabe"** im Schülerprofil-Button
- „Schutzgebühr" → **„Gebühr"** überall in der Oberfläche und in PDF-Dokumenten

### Bücher
- **Fächer löschen & umbenennen** direkt aus der Bücher-Ansicht möglich
- **Gebühr** (ehemals Schutzgebühr) bereits beim Anlegen eines neuen Buches eingebbar
- Gebühr-Feld zeigt grauen Platzhalter statt „0,00" wenn kein Wert eingetragen ist

### Lernmaterial
- Lernmaterial-Ansicht jetzt mit **Kategorien-Gruppenansicht** (analog zur Bücher-Fächeransicht)
- Jede Kategorie hat ein eigenes passendes Icon (Hefter, Taschenrechner, Zirkel etc.)

### Nutzungsjahre-Farbskala
- Nutzungsjahr-Badges zeigen jetzt eine **Farbskala je Alter**: grün (Neu/Jahr 1) → limette (Jahr 2) → amber (Jahr 3) → orange (Jahr 4) → rot (Jahr 5) → dunkelrot (Jahr 6+)
- Gilt in der Buchauswahl (Ausgabe-Flow), im Rückgabe-Flow und in der Bücher-Bestandsübersicht

### Archiv & Benachrichtigungen
- Archivierte Schüler werden korrekt dem **Schuljahr der Archivierung** zugeordnet (statt dem aktuellen Kalenderjahr)
- **10-Jahres-Aufbewahrungspflicht**: System erkennt automatisch Archiveinträge, die älter als 10 Schuljahre sind
- **Benachrichtigungs-Glocke** auf dem Startbildschirm mit Popup für Systemhinweise
- Benutzer kann abgelaufene Archiveinträge nach Bestätigung endgültig löschen

### Bugfixes
- Eurozeichen in der Buchhaltungs-Karte nicht mehr auf separater Zeile (`whiteSpace: nowrap`)
- Klasse 5 fehlte im Schüler-Klassen-Filter — jetzt ergänzt

---

## 2026-05-25 - Rückgabe-Aufschlag als Prozentsatz & Start-Screen-Verbesserungen

### Rückgabe-Aufschlag auf Prozentsatz umgestellt
- Der Rückgabe-Aufschlag wird nicht mehr als fester Centbetrag (`rueckgabe_aufschlag_cents`), sondern als Prozentsatz (`rueckgabe_aufschlag_prozent`) konfiguriert.
- Formel: Wiederverkaufspreis = Bucket-Preis × (1 + Aufschlag%) — gilt weiterhin nur für gebrauchte Bücher (NJ ≥ 1), neue Bücher bleiben ohne Aufschlag.
- Das Einstellungsfeld im Bücher-Screen zeigt jetzt ein Prozentfeld statt eines Euro-Feldes.
- Backend (Rechnungserstellung), Frontend (Buchausgabe-Anzeige, Bestandsübersicht) und PDF-Erstellung wurden entsprechend angepasst.
- Standard-Einstellung: 0 % (kein Aufschlag).

### Start-Screen
- Klick auf einen Eintrag in "Letzte Vorgänge" öffnet direkt die Schülerkartei des zugehörigen Schülers.
- "Berechnung"-Box und "Version 2.0"-Badge wurden aus den Statistik-Detailfenstern entfernt.

### Bücher-Einstellungen
- Nach "Regeln Speichern" erscheint eine Erfolgsmeldung.

### Bugfixes
- seed.py: Fehler behoben, der beim wiederholten Seed-Aufruf einen Unique-Constraint-Fehler verursachte (Admin-Passwort wurde doppelt geschrieben).

## 2026-05-22 14:24 CEST - Dashboard-Statistiken Version 2.0

- Die drei Dashboard-Felder "Verkaeufe (Monat)", "Rueckgaben (Monat)" und "Offene Ausleihen" sind jetzt anklickbar.
- Beim Anklicken oeffnet sich ein Detailfenster mit Kennzahl, Zeitraum, Zusatzwert und Berechnungslogik.
- Das Detailfenster markiert die neue Ansicht als "Version 2.0".
- Pro Kennzahl gibt es eine passende Weiterleitung:
  - "Verkaeufe im Monat" fuehrt zur Buchhaltung.
  - "Rueckgaben im Monat" startet die Buchrueckgabe.
  - "Offene Ausleihen" fuehrt zur Schuelersuche.
- Die Kacheln haben Hover-Zustand, Tastatur-/Screenreader-Beschriftung und Tooltips erhalten.
- Der Cache-Buster fuer `frontend/home.jsx` wurde von `v=12` auf `v=13` erhoeht, damit Browser die neue Dashboard-Version laden.
- Browser-Pruefung: Login, Dashboard-Aufruf und alle drei Detailfenster wurden lokal geprueft; es gab keine neuen Konsolenfehler.

## 2026-05-22 14:32 CEST - Archivfilter zeigt ungefilterte Listen

- Bestehende Archivlogik geprueft: Bisher wurde die Schuelerliste nur angezeigt, wenn gleichzeitig Schuljahr und Klasse ausgewaehlt waren.
- Die Archivliste zeigt jetzt ohne aktive Filter alle archivierten Schueler.
- Wenn nur ein Schuljahr ausgewaehlt ist, werden alle archivierten Schueler dieses Schuljahres ueber alle Klassen hinweg angezeigt.
- Wenn zusaetzlich eine Klasse ausgewaehlt ist, bleibt die Liste wie bisher auf diese Klasse eingeschraenkt.
- Die Listenueberschrift zeigt jetzt den aktuellen Kontext und die Anzahl der angezeigten Schueler.
- Bei der Gesamtansicht wurde eine Schuljahr-Spalte ergaenzt; die Klasse wird in allen Listen sichtbar angezeigt.
- Der Cache-Buster fuer `frontend/screens.jsx` wurde von `v=21` auf `v=22` erhoeht.
- Browser-Pruefung: Mit isolierter Testdatenbank und gemockten Archivdaten geprueft, dass ohne Filter alle Schueler, mit Schuljahr alle Klassen und mit Klasse nur diese Klasse angezeigt werden.
