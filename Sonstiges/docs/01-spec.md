# 01 · Funktionale Spezifikation

## Kontext & Zweck

Eine Schule (~1500 Schüler) verkauft Schulbücher an ihre Schüler zu Schuljahresbeginn und nimmt sie am Schuljahresende gegen eine Gutschrift zurück. Aktuell läuft das händisch (eine ältere Eigenbau-Lösung funktioniert nicht zuverlässig). Marktverfügbare Tools sind überdimensioniert und teuer.

Dieses System soll **bewusst schmal und funktional** sein. Es wird **ausschließlich von Schulleitung und Sekretariat** bedient. Es gibt **kein Eltern-Portal**, keine Schnittstellen zu LMS/Schulverwaltungssoftware.

## Nicht-Ziele (explizit nicht gewünscht)

- Eltern- oder Schüler-Login
- Komplexe Rollen-/Rechteverwaltung
- Mobile App
- Zahlungsabwicklung (Bezahlung läuft per Überweisung außerhalb des Systems)
- Inventarmanagement über mehrere Standorte
- Bücher-Empfehlungen, Wunschlisten, Lehrplan-Anbindung

## Nutzer & Zugriff

- **Sekretariat / Schulleitung**: Vollzugriff auf alles
- Initial **kein Login** (lokale Nutzung im Schulnetz). Falls später nötig: simpler Magic-Link, mehr nicht.

## Kernflows

### F1 · Verkauf an Schüler
1. Mitarbeiter sucht Schüler (Name, Klasse oder Schüler-ID).
2. Wählt 1..N Bücher aus dem Bestand.
3. Optional: bestehendes **Schulguthaben** des Schülers wird angeboten und kann auf die Rechnung angerechnet werden.
4. System erzeugt eine Rechnung (eine Rechnung pro Schüler, mehrere Bücher als Posten).
5. Rechnung wird als druckbares PDF/HTML ausgegeben.
6. Buchbestand der ausgewählten Titel wird reduziert (`ausgegeben += 1`).
7. Schülerkonto wird mit dem Rechnungsbetrag belastet.

### F2 · Rückgabe & Gutschrift
1. Mitarbeiter sucht Schüler.
2. System zeigt alle aktuell beim Schüler offenen Bücher.
3. Mitarbeiter markiert die zurückgegebenen Bücher.
4. System erzeugt eine Gutschrift. **Gutschriftwert pro Buch = ursprünglicher Kaufpreis** (kein Zustand-Abschlag, kein prozentualer Restwert).
5. Gutschrift wird als druckbares PDF/HTML ausgegeben.
6. Buchbestand der zurückgegebenen Titel wird wieder erhöht.
7. Der Gutschriftbetrag wird als **Schulguthaben** auf dem Schülerkonto gutgeschrieben (er wird **nicht automatisch ausgezahlt**).

### F3 · Schülerkonto / Saldo
- Jeder Schüler hat ein Konto mit fortlaufender Vorgangs-Historie.
- Konto-Vorgänge: `rechnung` (negativ), `gutschrift` (positiv), `zahlung` (positiv), `verrechnung` (positiv, wenn Guthaben in Verkauf eingerechnet).
- **Saldo > 0**: Schule schuldet Schüler (Schulguthaben).
- **Saldo < 0**: Schüler schuldet Schule (offen).
- **Saldo = 0**: ausgeglichen.

### F4 · Schüler verwalten
- Anlegen, Bearbeiten, Entfernen.
- Pflichtfelder: Vorname, Nachname, Klasse. Optional: Adresse (Straße/PLZ/Ort).
- Beim Entfernen: Schüler bleibt logisch (oder soft-deleted), damit Vorgangs-Historie konsistent bleibt.

### F5 · Bücher verwalten
- Anlegen, Bearbeiten, Entfernen.
- Pflichtfelder: Titel, Fach, Klassenstufe, Verlag, Preis, Anfangsbestand. Optional: ISBN.
- **Gutschriftwert = Kaufpreis** (kann später konfigurierbar werden, nicht jetzt).

### F6 · Mahnungen / Offene Posten
- Liste aller Schüler mit Saldo < 0.
- Sortiert nach Tagen seit ältestem offenen Posten.
- Stufen: 1. Mahnung (30+ Tage), 2. Mahnung (60+), Letzte Mahnung (90+).
- Aktion: Mahnung als PDF erzeugen, optional Sammelmahnung für mehrere Schüler.

## Geschäftsregeln (kompakt)

| Regel | Beschreibung |
|---|---|
| GR1 | Pro Schüler & Buch kann zur gleichen Zeit nur **ein** offener Verkauf existieren. |
| GR2 | Eine Rechnung enthält 1..N Posten, alle für den gleichen Schüler. |
| GR3 | Eine Gutschrift bezieht sich auf 1..N Posten **bestehender** Rechnungen desselben Schülers. |
| GR4 | Gutschriftbetrag pro Buch = Kaufpreis (Stand: aktuelle Anforderung). |
| GR5 | Bestand kann nicht negativ werden — Verkauf von ausverkauften Büchern wird abgelehnt. |
| GR6 | Schulguthaben verfällt nicht automatisch — bleibt am Schülerkonto bis manueller Auszahlung oder Verrechnung. |
| GR7 | Rechnungs- und Gutschriftnummern sind **fortlaufend pro Schuljahr**, Format `R-YYYY-NNNN` bzw. `G-YYYY-NNNN`. |
| GR8 | Schuljahr beginnt am 1. August und endet am 31. Juli. |
| GR9 | Beim Stornieren einer Rechnung wird ein Storno-Vorgang als Gegenbuchung angelegt — kein hartes Löschen. |

## PDF-Layout (existiert bereits im Frontend)

`print.jsx` im Frontend zeigt das gewünschte Layout für Rechnung und Gutschrift. Beim Backend-Build:
- Server kann das gleiche HTML rendern und mit WeasyPrint/Puppeteer als PDF ausgeben.
- Felder: Schul-Header (statisch), Rechnungsnummer, Datum, Empfänger-Block, Posten-Tabelle, Summen-Block, Fußzeile mit Bankverbindung.

## Schul-Stammdaten

Konfiguration (eine Datei oder eine kleine `settings`-Tabelle):

```yaml
schule:
  name: "Städtisches Gymnasium"
  strasse: "Schulstraße 12"
  plz: "52538"
  ort: "Gangelt"
  telefon: "02454 / 12345"
  iban: "DE12 3704 0044 0532 0130 00"
  bic: "COBADEFFXXX"
  bank: "Sparkasse Heinsberg"
schuljahr_aktuell: "2025/2026"
```

## Datenvolumen (zur Dimensionierung)

- ~1500 Schüler
- ~300 verschiedene Buchtitel, je ~30–100 Exemplare = ca. 15.000 Exemplare gesamt
- ~10.000 Rechnungen pro Jahr (Schuljahresbeginn-Spike)
- ~8.000 Gutschriften pro Jahr (Schuljahresende-Spike)

→ SQLite reicht problemlos.
