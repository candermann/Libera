# 03 · REST-API

Basis: `https://<host>/api`. Alle Antworten `application/json; charset=utf-8`.
Geldbeträge in **Cents** (Integer) übertragen. Frontend formatiert.
Datumsangaben: ISO-8601 Date-only (`YYYY-MM-DD`) wo Uhrzeit egal ist.

## Konventionen

- `GET /resource` → Liste (mit Filter via Query-Params, `?limit=`, `?offset=`)
- `GET /resource/:id` → Einzelobjekt
- `POST /resource` → Anlegen, Antwort = neues Objekt mit ID
- `PATCH /resource/:id` → Teilupdate
- `DELETE /resource/:id` → Soft-Delete (setzt `geloescht_am`)

Fehler-Schema:
```json
{ "error": { "code": "BUCH_NICHT_VERFUEGBAR", "message": "Lesbare Beschreibung", "details": { "buch_id": "B-0042", "bestand_frei": 0 } } }
```

---

## Schüler

### `GET /api/schueler`
Query-Params: `q` (Suchstring), `klasse`, `limit` (default 50), `offset`.

```json
{
  "items": [
    {
      "id": "S-0001",
      "vorname": "Lukas", "nachname": "Müller",
      "klasse": "7a",
      "strasse": "Hauptstraße 12", "plz": "52538", "ort": "Gangelt",
      "saldo_cents": -2550,
      "letzter_vorgang_datum": "2025-09-12"
    }
  ],
  "total": 1487
}
```

### `GET /api/schueler/:id`
Volle Detailansicht inkl. Konto-Zusammenfassung.

```json
{
  "id": "S-0001",
  "vorname": "Lukas", "nachname": "Müller",
  "klasse": "7a",
  "strasse": "Hauptstraße 12", "plz": "52538", "ort": "Gangelt",
  "email_eltern": null,
  "konto": {
    "saldo_cents": -2550,
    "anzahl_aktive_buecher": 6,
    "anzahl_vorgaenge": 3
  }
}
```

### `GET /api/schueler/:id/vorgaenge`
Vorgangs-Historie inkl. laufendem Saldo.

```json
{
  "items": [
    { "id": "R-2025-1042", "typ": "rechnung", "datum": "2025-08-15",
      "bezeichnung": "Schulbücher 2025/26 — 7 Titel",
      "betrag_cents": -16850, "saldo_nach_cents": -16850 },
    { "id": "Z-2025-0231", "typ": "zahlung", "datum": "2025-09-04",
      "bezeichnung": "Zahlungseingang per Überweisung",
      "betrag_cents": 16850, "saldo_nach_cents": 0 },
    { "id": "G-2026-0017", "typ": "gutschrift", "datum": "2026-04-12",
      "bezeichnung": "Buchrückgabe — 1 Titel",
      "betrag_cents": 2400, "saldo_nach_cents": 2400 }
  ]
}
```

### `GET /api/schueler/:id/aktive-buecher`
Bücher, die der Schüler aktuell offen hat (nicht zurückgegeben).

```json
{
  "items": [
    { "rechnungs_posten_id": 8123, "rechnung_id": "R-2025-1042",
      "buch_id": "B-0042", "titel": "Mathematik 7", "fach": "Mathematik",
      "verlag": "Cornelsen", "kaufdatum": "2025-08-15",
      "preis_cents": 2400, "gutschrift_cents": 2400 }
  ]
}
```

### `POST /api/schueler`
```json
// Request
{ "vorname": "Anna", "nachname": "Klein", "klasse": "5b",
  "strasse": "Lindenweg 4", "plz": "52525", "ort": "Heinsberg" }
// Response 201
{ "id": "S-1501", ...gleiche Felder, "konto": { "saldo_cents": 0, ... } }
```

### `PATCH /api/schueler/:id`
Beliebige Teilmenge der Felder.

### `DELETE /api/schueler/:id`
Soft-Delete. Antwort `204`. Schüler erscheint nicht mehr in Listen, Vorgänge bleiben erhalten.

---

## Bücher

### `GET /api/buecher`
Query: `q`, `fach`, `stufe`, `limit`, `offset`.

```json
{
  "items": [
    { "id": "B-0042", "titel": "Mathematik 7", "isbn": "978-3-12-345678-9",
      "fach": "Mathematik", "stufe": 7, "verlag": "Cornelsen",
      "preis_cents": 2400, "gutschrift_cents": 2400,
      "bestand_gesamt": 80, "bestand_ausgegeben": 47, "bestand_frei": 33 }
  ],
  "total": 298
}
```

### `GET /api/buecher/:id`
Einzelner Titel.

### `POST /api/buecher`
```json
{ "titel": "Englisch 9", "fach": "Englisch", "stufe": 9, "verlag": "Klett",
  "isbn": "978-3-12-...", "preis_cents": 2890, "bestand_gesamt": 50 }
// Response 201 mit id "B-0301"
```

### `PATCH /api/buecher/:id`
### `DELETE /api/buecher/:id`

---

## Verkauf

### `POST /api/verkauf`
Erzeugt eine Rechnung mit 1..N Posten **atomar in einer Transaktion**.

```json
// Request
{
  "schueler_id": "S-0001",
  "buch_ids": ["B-0042", "B-0107", "B-0203"],
  "guthaben_verrechnen": true,        // optional, default false
  "notizen": null
}
```

Server-Logik (Pseudocode):
```
BEGIN TRANSACTION
  Für jedes buch_id:
    - prüfe bestand_frei > 0, sonst Fehler BUCH_NICHT_VERFUEGBAR
    - lege rechnungs_posten an mit Snapshot des aktuellen Preises
    - bestand_ausgegeben += 1
  Lege rechnung an mit summe_cents = sum(posten)
  Wenn guthaben_verrechnen und saldo > 0:
    - verrechnet_cents = min(saldo, summe)
    - lege zahlung_intern an als Verrechnungsbuchung
  Erzeuge fortlaufende Rechnungsnummer R-YYYY-NNNN
COMMIT
```

```json
// Response 201
{
  "id": "R-2025-1042",
  "schueler_id": "S-0001",
  "datum": "2025-08-15",
  "summe_cents": 7200,
  "verrechnet_cents": 0,
  "zu_zahlen_cents": 7200,
  "posten": [
    { "rechnungs_posten_id": 8123, "buch_id": "B-0042", "titel": "Mathematik 7", "preis_cents": 2400 },
    { "rechnungs_posten_id": 8124, "buch_id": "B-0107", "titel": "Deutsch 7",   "preis_cents": 2400 },
    { "rechnungs_posten_id": 8125, "buch_id": "B-0203", "titel": "Englisch 7",  "preis_cents": 2400 }
  ]
}
```

### `GET /api/rechnungen/:id`
### `POST /api/rechnungen/:id/storno`
Erzeugt Storno-Buchung, setzt status auf `storniert`. Bestand wird wieder erhöht.

### `GET /api/rechnungen/:id/pdf`
Liefert PDF-Stream. Header `Content-Type: application/pdf`.

### `GET /api/rechnungen/:id/html`
Druckbares HTML (für In-App-Vorschau).

---

## Rückgabe / Gutschrift

### `POST /api/gutschrift`
Erzeugt eine Gutschrift für 1..N Verkaufsposten desselben Schülers.

```json
// Request
{
  "schueler_id": "S-0001",
  "rechnungs_posten_ids": [8123, 8125],
  "notizen": null
}
```

Server-Logik:
```
BEGIN TRANSACTION
  Für jeden rechnungs_posten_id:
    - prüfe gehört zu schueler, prüfe noch nicht zurueckgegeben
    - markiere rechnungs_posten.zurueckgegeben = 1
    - bestand_ausgegeben -= 1
    - betrag_cents = buecher.gutschrift_cents (Snapshot beim Verkauf wäre auch denkbar)
  Lege gutschrift an mit summe_cents = sum(posten)
  Erzeuge G-YYYY-NNNN
COMMIT
```

```json
// Response 201
{
  "id": "G-2026-0017",
  "schueler_id": "S-0001",
  "datum": "2026-04-12",
  "summe_cents": 4800,
  "ausgezahlt": false,            // Schulguthaben
  "posten": [
    { "rechnungs_posten_id": 8123, "buch_id": "B-0042", "titel": "Mathematik 7", "betrag_cents": 2400 },
    { "rechnungs_posten_id": 8125, "buch_id": "B-0203", "titel": "Englisch 7",  "betrag_cents": 2400 }
  ]
}
```

### `GET /api/gutschriften/:id`
### `GET /api/gutschriften/:id/pdf`
### `GET /api/gutschriften/:id/html`

### `POST /api/gutschriften/:id/auszahlen`
Markiert Gutschrift als ausgezahlt — wandelt Schulguthaben in tatsächliche Auszahlung. Saldo bleibt unverändert (es war ja schon im Guthaben).

---

## Zahlungen

### `POST /api/zahlungen`
Manuelle Erfassung eines Zahlungseingangs.

```json
{ "schueler_id": "S-0001", "rechnung_id": "R-2025-1042",
  "datum": "2025-09-04", "betrag_cents": 16850 }
```

### `GET /api/zahlungen?schueler_id=...`

---

## Mahnungen

### `GET /api/mahnungen`
Alle Schüler mit Saldo < 0, sortiert nach Tagen offen.

```json
{
  "items": [
    { "schueler_id": "S-0042", "name": "Emma Fischer", "klasse": "8a",
      "anzahl_buecher": 2, "betrag_cents": 4800, "tage_offen": 47, "stufe": 1 }
  ],
  "summary": {
    "stufe_1_anzahl": 14, "stufe_1_summe_cents": 34200,
    "stufe_2_anzahl": 9,  "stufe_2_summe_cents": 21850,
    "stufe_3_anzahl": 5,  "stufe_3_summe_cents":  9600
  }
}
```

### `POST /api/mahnungen/sammeldruck`
```json
{ "schueler_ids": ["S-0042", "S-0117"] }
// Response: PDF mit allen Mahnungen hintereinander
```

---

## Statistik / Dashboard

### `GET /api/dashboard`
```json
{
  "anzahl_schueler": 1500,
  "anzahl_buecher_titel": 300,
  "offene_ausleihen": 8420,
  "mahnungen_offen": 28,
  "verkaeufe_monat": 247,
  "rueckgaben_monat": 189,
  "umsatz_monat_cents": 684250,
  "gutschriften_monat_cents": 142800
}
```

---

## Einstellungen

### `GET /api/einstellungen`
### `PATCH /api/einstellungen`
Schul-Stammdaten + aktuelles Schuljahr.

---

## Healthcheck

### `GET /api/health` → `{"status":"ok","version":"1.0.0"}`
