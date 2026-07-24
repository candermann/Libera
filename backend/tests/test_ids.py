"""
Tests for ID-generation collision retry (services/ids.py).

Simulates the race described in IMPROVEMENTS.md: the counter lock only covers the
MAX(id)+1 read, so if the "next" id is already taken (e.g. inserted by a concurrent
request), the create endpoint should retry with a fresh id instead of a 500.
"""

from app.models import Buecher, Lernmaterial, Schueler


class TestIdRetry:
    def test_schueler_create_skips_colliding_id(self, client, db_session):
        # Pre-occupy the id the counter would naturally hand out next.
        db_session.add(Schueler(id="S-0001", vorname="X", nachname="Y", klasse="7a"))
        db_session.commit()

        resp = client.post("/api/schueler", json={
            "vorname": "Neu", "nachname": "Schüler", "klasse": "7a",
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["id"] == "S-0002"

    def test_buch_create_skips_colliding_id(self, client, db_session):
        db_session.add(Buecher(id="B-0001", titel="X", fach="Mathematik", stufe=7, preis_cents=100, gutschrift_cents=100, bestand_gesamt=0))
        db_session.commit()

        resp = client.post("/api/buecher", json={
            "titel": "Neues Buch", "fach": "Mathematik", "stufe": 7,
            "preis_cents": 1000, "bestand_gesamt": 5,
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["id"] == "B-0002"

    def test_lernmaterial_create_skips_colliding_id(self, client, db_session):
        db_session.add(Lernmaterial(id="M-0001", name="X", kategorie="Sonstiges", preis_cents=100, bestand_gesamt=0))
        db_session.commit()

        resp = client.post("/api/lernmaterial", json={
            "name": "Neues Material", "kategorie": "Sonstiges",
            "preis_cents": 500, "bestand_gesamt": 10,
        })
        assert resp.status_code == 201, resp.text
        assert resp.json()["id"] == "M-0002"
