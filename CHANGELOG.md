# Changelog

## 2026-05-28

- **Schüler**: Sortierung nach Nachname (Liste + CSV-Preview)
- **Verkauf**: Kein Rückgabe-Aufschlag bei Neubüchern (NJ=0) — Legacy-Inventory-Fix
- **Rechnung PDF**: Rechnungsnummer entfernt; Rückgaben auf Seite 2
- **Archiv**: Suchfeld nach Name, ID, Klasse
- **Buchhaltung**: Tab „Klassenliste" — ein Eintrag pro Schüler, offene Beträge summiert, Filter nach Schuljahr/Klasse, Download als PDF und CSV
- **Oberstufe**: Klassen 11+12 in `api.js` ergänzt; Abgangsstufe auf 12; Buchauswahl im Verkauf für 11/12 ausgeblendet
- **Glocke**: Leuchtet gelb + pulsiert bei Benachrichtigungen; Schuljahres-Erinnerung wenn eingestelltes Schuljahr älter als erwartet; Link navigiert zu `profil`
- **Config**: `.env` angelegt; `ADMIN_INITIAL_PASSWORD` überschreibt Hash bei jedem Start
