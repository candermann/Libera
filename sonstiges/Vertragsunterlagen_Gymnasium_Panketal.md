# Änderungsvorschläge – Vertragsunterlagen Gymnasium Panketal / BP Mediawork GmbH

---

&nbsp;

# WERKVERTRAG

---

### § 1 Abs. 1 – Verweis auf Anlage A

Satz nach dem ersten Satz einfügen:

> „Der vollständige Funktionsumfang ergibt sich aus Anlage A (Leistungsbeschreibung)."

---

### § 1 Abs. 2 – Verweis auf Anlage B

Nach dem Satz „…ist im Leistungsumfang nach § 3 Abs. 1 enthalten." einfügen:

> „Das technische Format der CSV-Datei ergibt sich aus Anlage B."

---

### § 4 Abs. 5 – Neu: Open-Source-Lizenzen

Neuen Absatz (5) einfügen:

> „Das Tool nutzt quelloffene Softwarekomponenten Dritter, insbesondere FastAPI, SQLAlchemy, Uvicorn, Pydantic, Jinja2, WeasyPrint, bcrypt, PyJWT (serverseitig) sowie React 18 und Babel Standalone (clientseitig). Diese Komponenten unterliegen ihren jeweiligen Open-Source-Lizenzen (u. a. MIT License, Apache License 2.0). Die Nutzung dieser Komponenten erfolgt lizenzkonform. Der Auftragnehmer stellt dem Auftraggeber auf Anfrage eine Liste der eingesetzten Komponenten samt Lizenzangaben zur Verfügung. Ansprüche aus diesen Drittlizenzen gegenüber dem Auftraggeber sind nach aktuellem Kenntnisstand des Auftragnehmers nicht bekannt."

---

### § 5 Abs. 1 – Verweis auf Anlage A

„…die in § 1 beschriebenen Funktionen…" ersetzen durch:

> „…die in § 1 und Anlage A beschriebenen Funktionen…"

---

### Anlage A – Neu: Leistungsbeschreibung Funktionsumfang

Als neue Anlage A beifügen:

> **Anlage A zum Werkvertrag vom ________ – Leistungsbeschreibung Funktionsumfang**
>
> Das Tool umfasst folgende Funktionsbereiche:
>
> **1. Schülerverwaltung**
> Anlage, Suche und Bearbeitung von Schülerdatensätzen (Vorname, Nachname, Klasse, Adresse, Eltern-E-Mail, Notizen); Einzelimport sowie Massenimport per CSV-Datei mit Vorschau und Fehlerprüfung (Pflichtfelder, Duplikaterkennung); Schülerdetailansicht mit Kontostand, aktiven Ausleihen und vollständigem Kontoauszug; Archivierung inaktiver bzw. abgegangener Schüler.
>
> **2. Bücherverwaltung**
> Pflege eines Bücherkatalogs mit Zuordnung zu Fächern; Stückzahl-Tracking nach Nutzungsjahren (neu, Jahr 1–5, abgeschrieben); automatische Preisberechnung auf Basis von Grundpreis und konfigurierter Abschreibungslogik nach Nutzungsjahr.
>
> **3. Lernmaterialverwaltung**
> Pflege von zusätzlichen Materialien (z. B. Hefte, Taschenrechner) mit Kategorie, Preis und Lagerbestand; automatische Lagerbestandsführung bei Ausgabe und Rückgabe.
>
> **4. Buchausgabe (Verkauf)**
> Dreistufiger Ausgabe-Workflow: Schülerauswahl, Zusammenstellung von Büchern und Materialien inkl. individueller Freiposten (mit optionaler Vorlagenspeicherung), Prüfung auf Lagerbestand; Anrechnung vorhandener Schülerguthaben; Erstellung und Druck einer Rechnung als PDF.
>
> **5. Buchrückgabe**
> Zweistufiger Rückgabe-Workflow: Schülerauswahl, Markierung zurückgegebener Bücher aus aktiven Ausleihen; automatische Gutschriftberechnung; Erstellung einer Gutschrift als PDF; Gutschriftbuchung auf das Schülerkonto.
>
> **6. Kombinierter Ausgabe- & Rückgabe-Workflow**
> Gleichzeitige Buchausgabe und -rückgabe in einem einzigen Arbeitsschritt.
>
> **7. Buchhaltung & Rechnungsverwaltung**
> Übersicht aller Rechnungen und Gutschriften; Filterung nach Schuljahr, Klasse und Status (offen, bezahlt, versendet, storniert); Stornierung von Rechnungen; manuelle Zahlungserfassung; Auszahlungen von Schülerguthaben mit Bestätigungs-PDF; Batch-Versand unversandter Rechnungen per E-Mail.
>
> **8. Klassenversetzung**
> Jahresübergangs-Workflow mit Vorschau der betroffenen Schüler, selektiver Bestätigung und automatischer Klassenversetzung (Klasse 5→6 bis 12→13); Überführung von Abgängern in das Archiv.
>
> **9. Archivverwaltung**
> Langfristige Aufbewahrung der Datensätze archivierter Schüler inkl. vollständiger Transaktionshistorie; Benachrichtigung bei ablaufenden Aufbewahrungsfristen; Möglichkeit zur Massenlöschung abgelaufener Einträge.
>
> **10. Dashboard**
> Übersichtsseite mit Monatskennzahlen (Verkäufe, Rückgaben, offene Ausleihen), den letzten Transaktionen sowie Hinweisen auf unversandte Rechnungen und anstehende Termine (Schuljahresende, Klassenversetzungsfrist).
>
> **11. Einstellungen**
> Konfiguration von Schulinformationen, Bankdaten, SMTP-E-Mail-Versand inkl. Vorlagenverwaltung mit Platzhaltervariablen sowie Anzeige von Systeminformationen.
>
> **12. Dokumentengenerierung**
> Erstellung folgender Dokumente im PDF- und HTML-Format nach gestalterischen Vorgaben des Auftraggebers: Rechnung, Gutschrift, Auszahlungsbestätigung.

---

### Anlage B – Neu: CSV-Importformat

Als neue Anlage B beifügen:

> **Anlage B zum Werkvertrag vom ________ – Technisches Format der CSV-Importdatei (Schülerdaten)**
>
> **Zeichenkodierung:** UTF-8 (mit oder ohne BOM), alternativ CP1252 oder Latin-1
>
> **Trennzeichen:** Komma (`,`) oder Semikolon (`;`), wird automatisch erkannt
>
> **Pflichtfelder** (müssen vorhanden und nicht leer sein):
>
> | Feldname | Bedeutung | Beispiel |
> |---|---|---|
> | `vorname` | Vorname des Schülers | `Max` |
> | `nachname` | Nachname des Schülers | `Mustermann` |
> | `klasse` | Klasse/Jahrgangsstufe | `8b`, `Q1`, `EF` |
>
> **Optionale Felder:**
>
> | Feldname | Bedeutung |
> |---|---|
> | `strasse` | Straße und Hausnummer |
> | `plz` | Postleitzahl |
> | `ort` | Wohnort |
> | `email_eltern` | E-Mail-Adresse der Erziehungsberechtigten |
> | `notizen` | Interne Notizen |
>
> Feldnamen sind nicht case-sensitiv; Umlaute werden automatisch normalisiert (ä→ae, ö→oe, ü→ue, ß→ss). Alternativ akzeptierte Spaltenbezeichnungen (Auswahl): `Nachname`, `familienname`, `last_name`, `Vorname`, `firstname`, `Klasse`, `class`, `stufe`, `Email`, `elternemail`.
>
> Zeilen mit fehlenden Pflichtfeldern sowie Zeilen, die eine bereits in der Datenbank vorhandene Kombination aus Vorname, Nachname und Klasse enthalten, werden im Vorschaumodus als fehlerhaft markiert und nicht importiert.

---

&nbsp;
&nbsp;

---

# AVV

---

### § 5 Abs. 2 – Konkrete IT-Dienste benennen

Den bestehenden Absatz wie folgt erweitern – nach dem Satz „…können hierfür die allgemeinen IT- und Kommunikationsdienstleister des Auftragsverarbeiters eingesetzt werden." folgenden Satz einfügen:

> „Dies umfasst insbesondere E-Mail- und Kommunikationsdienste (Microsoft 365), Fernwartungssoftware (z. B. AnyDesk oder TeamViewer) sowie interne Projektmanagement- und Dateiablagedienste."

Außerdem „Der Einsatz erfolgt nur, soweit dies für die Leistungserbringung erforderlich ist und die datenschutzrechtlichen Anforderungen eingehalten werden." ersetzen durch:

> „Der Einsatz erfolgt nur, soweit dies für die Leistungserbringung erforderlich ist, der Datenzugriff auf das notwendige Minimum beschränkt wird und die datenschutzrechtlichen Anforderungen eingehalten werden."

*Hinweis: Die genannten Tool-Namen bitte auf die tatsächlich eingesetzten Dienste anpassen.*

---

### § 7 Abs. 1 – Rückgabeoption und Backup-Löschung ergänzen

Den bestehenden Absatz ersetzen durch:

> „Personenbezogene Daten, die der Auftragsverarbeiter im Rahmen von Datenimport, Installation, Funktionsprüfung oder Support auf eigenen Systemen verarbeitet hat, werden nach Abschluss der jeweiligen Leistung vollständig gelöscht oder – auf ausdrückliche Weisung des Verantwortlichen in Textform – an diesen zurückgegeben. Die Löschung bzw. Rückgabe erfolgt innerhalb von 30 Tagen nach Abschluss der jeweiligen Leistung, sofern keine gesetzliche Aufbewahrungspflicht entgegensteht. Die Löschpflicht erstreckt sich ausdrücklich auch auf etwaige Sicherungskopien (Backups), in denen personenbezogene Daten des Verantwortlichen gespeichert sein könnten. Der Auftragsverarbeiter bestätigt die erfolgte Löschung auf Anfrage in Textform."

---

### § 9 Abs. 2 – Haftungsdeckel anpassen

Den bestehenden Absatz ersetzen durch:

> „Die Haftung des Auftragsverarbeiters ist – außer bei Vorsatz und grober Fahrlässigkeit – der Höhe nach begrenzt auf die Gesamtnettovergütung, die der Verantwortliche dem Auftragsverarbeiter auf Grundlage des zugehörigen Werkvertrags gezahlt hat oder zu zahlen hat, mindestens jedoch 2.400,00 EUR netto. Im Falle gesondert vergüteter Zusatzleistungen nach § 3 Abs. 2 des Werkvertrags erhöht sich der Deckel um die jeweils dafür gezahlten Nettovergütungen."

---

### § 10 Abs. 2 – Gerichtsstand angleichen

„Gerichtsstand ist Lüneburg" ersetzen durch:

> „Gerichtsstand ist Berlin"

*(Vereinheitlichung mit § 11 Abs. 2 des Werkvertrags)*

---

### Anlage A2, Punkt 3 – Verschlüsselung ruhender Daten

Den bestehenden Absatz ersetzen durch:

> „Temporär gespeicherte personenbezogene Daten (z. B. CSV-Importdateien) werden auf diesen Endgeräten verschlüsselt abgelegt und nach Abschluss der jeweiligen Leistung umgehend und vollständig gelöscht. Zugriffe erfolgen nur durch individuell berechtigte Personen und ausschließlich für den jeweiligen Projektzweck."

---

### Anlage A2, Punkt 4 – VPN-Verantwortung klarstellen

Den letzten Satz „Bei Fernzugriff auf den Schulserver wird eine gesicherte Verbindung (z. B. VPN) vorausgesetzt." ersetzen durch:

> „Bei Fernzugriff auf den Schulserver wird eine gesicherte Verbindung (z. B. VPN oder gleichwertiges verschlüsseltes Protokoll) vorausgesetzt. Die hierfür erforderliche technische Infrastruktur und Zugangsdaten stellt der Verantwortliche bereit. Ist eine gesicherte Verbindung nicht möglich, ist ein Fernzugriff auf personenbezogene Daten unzulässig; in diesem Fall stimmen die Parteien eine alternative sichere Vorgehensweise in Textform ab."

---

### Anlage A2, Punkt 5 – Backups in Löschpflicht einschließen

Am Ende des Absatzes anfügen:

> „Dies schließt etwaige Sicherungskopien (Backups) auf Systemen des Auftragsverarbeiters ausdrücklich ein."
