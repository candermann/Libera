import re

file = r"c:\Users\gedeo\Documents\Schulbuch_Verwaltung_Panketal_Mac\frontend\verkauf.jsx"
with open(file, encoding="utf-8") as f:
    content = f.read()

old = '>{(bucket.preis_cents / 100).toFixed(2).replace(\'.\', \',\')} €</span>'
new = '>{(displayPreisCents / 100).toFixed(2).replace(\'.\', \',\')} €</span>'

count_before = content.count(old)
print(f"Stellen gefunden: {count_before}")

content = content.replace(old, new)

count_after = content.count("displayPreisCents / 100")
print(f"displayPreisCents / 100 nach Fix: {count_after} (erwartet 2)")

remaining = content.count("bucket.preis_cents / 100")
print(f"bucket.preis_cents / 100 verbleibend: {remaining} (erwartet 0)")

with open(file, "w", encoding="utf-8") as f:
    f.write(content)
print("Fertig")
