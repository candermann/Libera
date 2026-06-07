# Changelog

## 2026-05-29

- **Lernmaterial**: CSV-Import — Massenimport von Lernmaterial per CSV-Datei (`POST /api/lernmaterial/import/csv`); Pflichtfelder: `name`, `kategorie`, `preis`; optional: `bestand`; Button „CSV importieren" in der Lernmaterial-Übersicht

## 2026-05-28

- **Schüler**: Sortierung nach Nachname (Liste + CSV-Preview)
- **Verkauf**: Kein Rückgabe-Aufschlag bei Neubüchern (NJ=0) — Legacy-Inventory-Fix
- **Rechnung PDF**: Rechnungsnummer entfernt; Rückgaben auf Seite 2
- **Archiv**: Suchfeld nach Name, ID, Klasse
- **Buchhaltung**: Tab „Klassenliste" — ein Eintrag pro Schüler, offene Beträge summiert, Filter nach Schuljahr/Klasse, Download als PDF und CSV
- **Oberstufe**: Klassen 11+12 in `api.js` ergänzt; Abgangsstufe auf 12; Buchauswahl im Verkauf für 11/12 ausgeblendet
- **Glocke**: Leuchtet gelb + pulsiert bei Benachrichtigungen; Schuljahres-Erinnerung wenn eingestelltes Schuljahr älter als erwartet; Link navigiert zu `profil`
- **Config**: `.env` angelegt; `ADMIN_INITIAL_PASSWORD` überschreibt Hash bei jedem Start
- **Namen**: Überall auf „Nachname, Vorname" umgestellt — Listen, PDFs, CSVs, Toasts, alle Screens
- **Navigation**: Klick auf aktiven Reiter springt immer zurück auf die Hauptansicht
- **Security**: Passwörter/Secrets werden nicht mehr über die Einstellungs-API zurückgegeben; SMTP-Passwort-Feld zeigt ob bereits eines gesetzt ist
- **Repo**: `.gitignore` hinzugefügt; `__pycache__`, `.env` und DB-Dateien aus Git-Tracking entfernt; `docker-compose.yml` ins Root verschoben
