# Libera Knowledge

Stand: 2026-07-24

Diese Datei beschreibt mein fachliches und produktbezogenes Wissen über Libera/Bibliomat, getrennt von der technischen Codebase-Dokumentation.

## Was Libera ist

Libera/Bibliomat ist ein Verwaltungswerkzeug für eine Schule, um Schulbücher, Lernmaterial, Schüler, Rechnungen, Rückgaben, Gutschriften, Zahlungen und Buchhaltung abzuwickeln.

Die Anwendung soll im Alltag schnell bedienbar sein: Schüler auswählen, Bücher oder Lernmaterial ausgeben, Rechnung erzeugen, bei Rückgabe Gutschrift erzeugen, Zahlungen verbuchen und Vorgänge nachvollziehbar halten.

## Zentrale Nutzerrollen

Aus Code und Doku bekannte Benutzer:

- `admin`
- `lehrer`
- `schulleiter`
- `sekretariat`
- zusätzlich selbst angelegte Benutzer

Wichtig für Entwürfe:

- Entwürfe gehören zu genau dem Benutzer, der sie erstellt hat.
- Andere Benutzer sollen sie nicht sehen oder fortführen.
- Auch `admin` hat für fremde Entwürfe keinen automatischen Sonderzugriff.
//entwürfe

## Hauptbereiche der App

Sidebar-Navigation:

- `Start`: Dashboard/Kennzahlen/Benachrichtigungen.
- `Ausgabe & Rückgabe`: kombinierter Vorgang aus neuen Ausgaben und Rückgaben.
- `Buchausgabe`: Bücher, Lernmaterial und Freiposten ausgeben und Rechnung erzeugen.
- `Buchrückgabe`: Bücher zurücknehmen und Gutschriften erzeugen.
- `Schüler`: Schülerliste und Schülerakte.
- `Bücher`: Buchkatalog und Bestand.
- `Lernmaterial`: Materialbestand.
- `Buchhaltung`: Rechnungsversand, Buchhaltung, Entwürfe, Klassenliste.
- `Klassenversetzung`: Schuljahreswechsel und Archivierung.
- `Schülerarchiv`: archivierte Schüler.
- `Einstellungen`: Profil/Schuldaten/System/Konten.

## Buchausgabe

Typischer Ablauf:

1. Schüler suchen/auswählen.
2. Bücher und ggf. Lernmaterial/Freiposten in den Warenkorb legen.
3. Guthaben optional verrechnen.
4. Rechnung erzeugen.
5. Rechnung anzeigen, herunterladen, drucken oder per Mail versenden.

Besonderheiten:

- Ein Schüler darf ein aktives Buch nicht doppelt erhalten.
- Bestand wird beim Erstellen der Rechnung abgebucht.
- Oberstufenklassen können gesondert behandelt werden.
- Freiposten können zusätzlich berechnet und als Vorlage gespeichert werden.

## Rückgabe und Gutschriften

Rückgabe kann separat oder kombiniert mit Ausgabe laufen.

Typischer Ablauf:

1. Schüler auswählen.
2. Aktive Bücher des Schülers auswählen.
3. Zustand/Beschädigung erfassen.
4. Gutschrift erzeugen.
5. Bestand wird bei verwertbarer Rückgabe wieder erhöht.

Beschädigte Rückgaben können zu 0-Euro-Gutschrift führen und werden anders im Bestand behandelt.

## Kombinierter Flow

`Ausgabe & Rückgabe` erlaubt, Bücher zurückzunehmen und gleichzeitig neue Bücher/Lernmaterial/Freiposten auszugeben.

Fachliche Idee:

- Rückgabewerte reduzieren den zu zahlenden Betrag.
- Überschüsse können als Guthaben beim Schüler verbleiben.
- Der Vorgang landet in einer neuen Rechnung und ggf. Gutschrift-/Verrechnungsstruktur.

## Rechnungen

Rechnungen entstehen beim Verkauf/Ausgabevorgang.

Bekannte Status:

- `offen`
- `bezahlt`
- `archiviert`
- `storniert`

Rechnungen haben:

- technische ID, z.B. `R-2025-0060`
- editierbare/anzeigbare Rechnungsnummer `anzeige_nr`
- Schülerbezug
- Schuljahr
- Datum
- Summe
- verrechnetes Guthaben
- Mailversanddaten
- Positionen für Bücher, Lernmaterial, Freiposten

## Rechnungsversand

Im Buchhaltungstab `Rechnungsversand` sieht man Rechnungen, die noch nicht per E-Mail versandt wurden, sowie bereits versandte Rechnungen.

Aktionen:

- Rechnung öffnen
- PDF herunterladen
- per E-Mail senden
- Rechnungsnummer bearbeiten
- stornieren
- archivieren

Storno ist dort inzwischen sowohl bei noch nicht versandten als auch bei bereits versandten Rechnungen verfügbar.

## Buchhaltung

Buchhaltung hat aktuell diese Tabs:

- `Rechnungsversand`
- `Buchhaltung`
- `Entwürfe`
- `Klassenliste`

Der Buchhaltung-Detailbereich zeigt Rechnungen nach Schuljahr und Klasse, inklusive Summen und Stornozähler.

## Entwürfe / Offene Vorgänge

Entwürfe sind fachlich offene Rechnungsvorgänge, die noch nicht final gebucht wurden.

Ziele:

- nichts verlieren, wenn ein Vorgang unterbrochen wird
- später exakt beim gleichen Schüler und Vorgang weitermachen
- versehentliche Übernahme durch andere Personen verhindern

Aktuelles Verhalten:

- Autosave läuft während der Bearbeitung.
- Manuelles Speichern ist möglich.
- Beim Abbrechen mit Inhalt wird automatisch als Entwurf gespeichert.
- Währenddessen erscheint ein kleines Feld/Toast: `Entwurf wird gespeichert...`.
- Entwürfe werden serverseitig gespeichert und sind nach Browserwechsel/Crash wiederherstellbar.
- Entwürfe sind nur für den Benutzer sichtbar, der sie erstellt hat.
- Entwürfe sind an den Schüler gebunden, bei dem sie erstellt wurden.
- Beim finalen Rechnungserstellen wird der zugehörige Entwurf abgeschlossen und aus der offenen Liste entfernt.
- Entwürfe können verworfen werden.

Orte, an denen Entwürfe sichtbar sind:

- in den jeweiligen Ausgabe-/Rückgabe-Flows als offene Vorgänge
- in Buchhaltung im Tab `Entwürfe`

Der neue Buchhaltung-Tab `Entwürfe` zeigt:

- Vorgangstyp
- Schüler
- Klasse
- Bearbeiter
- Änderungszeit
- Aktionen zum Fortsetzen oder Verwerfen

## Storno

Storno bedeutet: ein bereits gebuchter Vorgang wird nachvollziehbar rückgängig gemacht.

Fachliches Verhalten:

- Rechnung wird nicht gelöscht.
- Rechnung bzw. Position wird storniert.
- Bücher werden wieder verfügbar gemacht, sofern stornierte Buchpositionen betroffen sind.
- Lernmaterial wird bei Gesamtstorno wieder in den Bestand zurückgeführt.
- Zahlungen gehen nicht verloren: bei bezahlten stornierten Anteilen entsteht Guthaben/Gutschrift.
- Es wird protokolliert, wer wann welchen Storno mit welchem Grund durchgeführt hat.

UI-Verhalten:

- Storno hat einen Bestätigungsdialog.
- Grund ist Pflicht.
- Gesamtstorno und Teilstorno einzelner Buchpositionen sind möglich.
- Nach erfolgreichem Storno gibt es eine Erfolgsmeldung.
- Die betroffenen Listen werden aktualisiert.

Orte mit Storno:

- Schülerakte
- Buchhaltung Jahresdetail
- Buchhaltung Rechnungsversand

## Archivierung

Schüler können archiviert werden, insbesondere nach Abgang/Klassenversetzung.

Fachliche Punkte:

- Schülerdaten werden nicht hart gelöscht.
- Bücher können beim Archivieren als behalten markiert werden.
- Behaltene Bücher verlassen den aktiven Bestand.
- Archivierte Schüler bleiben nachvollziehbar.

Rechnungen können ebenfalls archiviert/unarchiviert werden, solange sie nicht storniert sind.

## Zahlungen, Guthaben und Saldo

Die App führt ein Schülerkonto/Saldo.

Quellen:

- Zahlungen erhöhen/gleichen Forderungen aus.
- Gutschriften aus Rückgaben erzeugen Guthaben.
- Verrechnungen reduzieren offene Rechnungsbeträge.
- Bei Storno einer bezahlten Rechnung entsteht Guthaben.

Bekannter offener Punkt aus alter Doku:

- `POST /api/gutschriften/{id}/auszahlen` setzt offenbar nur `ausgezahlt=True`, legt aber möglicherweise keinen `auszahlungen`-Datensatz an. Das könnte fachlich zu prüfen sein, falls Auszahlung aktiv genutzt wird.

## Bücher und Bestand

Bücher haben:

- Titel, Fach, Stufe, Verlag, ISBN
- Basispreis
- Schutzgebühr
- Gesamtbestand
- ausgegebenen Bestand
- Bestands-Buckets nach Zustand/Nutzungsjahr

Wichtig:

- Verfügbarkeit kommt aus den Bestands-Buckets.
- Rückgaben gehen je nach Zustand/Nutzungsjahr wieder in passende Buckets.
- Nutzungsjahre beeinflussen Preise und Gutschriften.
- Freier Bestand altert während der Lagerzeit nicht; ausgegebene Bücher altern bei der Rückgabe anhand der vergangenen Schuljahre.

## Lernmaterial

Lernmaterial ist zusätzlich zu Schulbüchern verwaltbar.

Es hat:

- Name
- Kategorie
- Preis
- Bestand gesamt
- Bestand ausgegeben

Lernmaterial kann in Rechnungen mit Menge verkauft werden. Beim Gesamtstorno wird ausgegebenes Lernmaterial wieder zurückgeführt.

## Klassen und Schuljahre

Klassen werden als kurze Werte geführt, z.B. `5` bis `12`.

Schuljahr ist eine zentrale Einstellung, z.B. `2025/2026`.

Klassenversetzung:

- erhöht Klassenstufen
- kann Abgangsklassen archivieren
- berücksichtigt aktive Bücher

## Dokumente

Die App erzeugt HTML/PDF für:

- Rechnungen
- Gutschriften
- Auszahlungen
- Mahnungen
- Klassenlisten/Listenansichten

PDFs werden serverseitig über WeasyPrint gerendert.

## E-Mail

Rechnungen können per E-Mail versendet werden.

SMTP-Konfiguration liegt in den Einstellungen. Sensitive Werte wie SMTP-Passwort werden nicht im Klartext zurückgegeben.

Rechnungsversand unterscheidet zwischen:

- noch nicht versandt
- bereits versandt

## Bedienphilosophie

Aus den bisherigen Wünschen ergibt sich:

- Buchhaltungs- und Verwaltungsoberflächen sollen funktional und schnell bedienbar sein.
- Wichtige Aktionen sollen dort verfügbar sein, wo man sie gerade erwartet, z.B. Storno direkt bei Rechnungen.
- Destruktive Aktionen brauchen Bestätigung und klaren Grund.
- Abbrüche sollen keine Arbeit verlieren.
- Entwürfe sollen sich wie Gmail-Entwürfe anfühlen: automatisch speichern, leicht fortsetzen, klares kleines Feedback.
- Entwürfe dürfen nicht zwischen Personen oder Schülern vermischt werden.

## Zuletzt fachlich gewünschte Änderungen

- Storno sollte im Rechnungsversand-Tab verfügbar sein.
- Ein `Entwürfe`-Tab sollte zwischen `Buchhaltung` und `Klassenliste` in der Buchhaltung erscheinen.
- Dieser Tab soll alle relevanten Entwürfe korrekt speichern/anzeigen.
- Entwürfe sollen nur beim Ersteller sichtbar/fortsetzbar sein.
- Abgebrochene Vorgänge sollen automatisch als Entwurf gespeichert werden.
