"""
Tests for POST /api/verkauf and related invoice endpoints.
"""

from sqlalchemy import text

from tests.conftest import create_test_schueler, create_test_buch


class TestVerkauf:
    """Verkauf (sale) transaction tests."""

    def test_successful_sale(self, client):
        """A sale with available books should create an invoice and decrement stock."""
        schueler = create_test_schueler(client, vorname="Lukas", nachname="Müller")
        buch1 = create_test_buch(client, titel="Mathe 7", preis_cents=2400, bestand_gesamt=50)
        buch2 = create_test_buch(client, titel="Deutsch 7", preis_cents=2500, bestand_gesamt=30)

        resp = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch1["id"], buch2["id"]],
        })

        assert resp.status_code == 201
        data = resp.json()
        assert data["schueler_id"] == schueler["id"]
        assert data["summe_cents"] == 4900
        assert data["verrechnet_cents"] == 0
        assert data["zu_zahlen_cents"] == 4900
        assert len(data["posten"]) == 2
        assert data["id"].startswith("R-")

        # Verify stock was decremented
        buch1_resp = client.get(f"/api/buecher/{buch1['id']}")
        assert buch1_resp.json()["bestand_ausgegeben"] == 1
        assert buch1_resp.json()["bestand_frei"] == 49

    def test_out_of_stock_rejected(self, client):
        """Selling a book with bestand_frei == 0 should return 422."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, titel="Rares Buch", bestand_gesamt=1)

        # First sale — should succeed
        resp1 = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })
        assert resp1.status_code == 201

        # Second sale of same book — stock is now 0
        schueler2 = create_test_schueler(client, vorname="Anna", nachname="Klein")
        resp2 = client.post("/api/verkauf", json={
            "schueler_id": schueler2["id"],
            "buch_ids": [buch["id"]],
        })
        assert resp2.status_code == 422

    def test_sale_with_guthaben_verrechnung(self, client):
        """When student has credit, guthaben_verrechnen should offset the invoice."""
        schueler = create_test_schueler(client)
        buch1 = create_test_buch(client, titel="Buch A", preis_cents=3000, bestand_gesamt=10)
        buch2 = create_test_buch(client, titel="Buch B", preis_cents=2000, bestand_gesamt=10)

        # First: buy a book
        sale1 = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch1["id"]],
        })
        assert sale1.status_code == 201
        posten_id = sale1.json()["posten"][0]["rechnungs_posten_id"]

        # Pay for it
        client.post("/api/zahlungen", json={
            "schueler_id": schueler["id"],
            "rechnung_id": sale1.json()["id"],
            "datum": "2025-09-01",
            "betrag_cents": 3000,
        })

        # Return the book — creates credit of 3000
        gutschrift = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        assert gutschrift.status_code == 201

        # Now buy another book with guthaben_verrechnen
        sale2 = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch2["id"]],
            "guthaben_verrechnen": True,
        })
        assert sale2.status_code == 201
        data = sale2.json()
        assert data["summe_cents"] == 2000
        assert data["verrechnet_cents"] == 2000
        assert data["zu_zahlen_cents"] == 0

    def test_verrechnung_tracks_returned_books(self, client):
        """Invoice should keep which returned books were used as credit."""
        schueler = create_test_schueler(client)
        buch1 = create_test_buch(client, titel="Biologie 7", preis_cents=3000, bestand_gesamt=10)
        buch2 = create_test_buch(client, titel="Physik 7", preis_cents=2000, bestand_gesamt=10)

        sale1 = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch1["id"]],
        })
        assert sale1.status_code == 201
        posten_id = sale1.json()["posten"][0]["rechnungs_posten_id"]

        pay = client.post("/api/zahlungen", json={
            "schueler_id": schueler["id"],
            "rechnung_id": sale1.json()["id"],
            "datum": "2025-09-01",
            "betrag_cents": 3000,
        })
        assert pay.status_code == 201

        credit = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        assert credit.status_code == 201

        sale2 = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch2["id"]],
            "guthaben_verrechnen": True,
        })
        assert sale2.status_code == 201
        sale2_data = sale2.json()
        assert sale2_data["verrechnet_cents"] == 2000
        assert len(sale2_data["verrechnung_posten"]) == 1
        assert sale2_data["verrechnung_posten"][0]["quelle_typ"] == "rueckgabe"
        assert sale2_data["verrechnung_posten"][0]["titel"] == "Biologie 7"
        assert sale2_data["verrechnung_posten"][0]["betrag_cents"] == 2000

        detail = client.get(f"/api/rechnungen/{sale2_data['id']}")
        assert detail.status_code == 200
        detail_data = detail.json()
        assert len(detail_data["verrechnung_posten"]) == 1
        assert detail_data["verrechnung_posten"][0]["titel"] == "Biologie 7"

        html = client.get(f"/api/rechnungen/{sale2_data['id']}/html")
        assert html.status_code == 200
        assert "Gutschrift" in html.text
        assert "Biologie 7" in html.text

    def test_get_rechnung(self, client):
        """GET /api/rechnungen/:id should return the invoice detail."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })
        rechnung_id = sale.json()["id"]

        resp = client.get(f"/api/rechnungen/{rechnung_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == rechnung_id
        assert data["status"] == "offen"
        assert len(data["posten"]) == 1

    def test_storno(self, client):
        """POST /api/rechnungen/:id/storno should cancel and restore stock."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, bestand_gesamt=10)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })
        rechnung_id = sale.json()["id"]

        # Verify stock is 9
        assert client.get(f"/api/buecher/{buch['id']}").json()["bestand_frei"] == 9

        # Storno
        resp = client.post(
            f"/api/rechnungen/{rechnung_id}/storno",
            json={"grund": "Falsche Ausgabe"},
        )
        assert resp.status_code == 200

        # Stock should be restored to 10
        assert client.get(f"/api/buecher/{buch['id']}").json()["bestand_frei"] == 10

        # Rechnung should be storniert
        r = client.get(f"/api/rechnungen/{rechnung_id}")
        assert r.json()["status"] == "storniert"

    def test_draft_lifecycle(self, client):
        """Drafts should save, update, list and be completed after checkout."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, titel="Entwurfsbuch", bestand_gesamt=3)

        draft_payload = {
            "vorgang_typ": "buchausgabe",
            "schueler_id": schueler["id"],
            "form_state": {
                "selectedStudent": schueler,
                "cart": [{"buch_id": buch["id"], "bestand_id": None, "titel": "Entwurfsbuch"}],
            },
            "freigegeben_an": ["sekretariat"],
        }
        create = client.post("/api/rechnungen/entwuerfe", json=draft_payload)
        assert create.status_code == 201, create.text
        draft = create.json()
        assert draft["schueler_id"] == schueler["id"]
        assert draft["bearbeiter"] == "admin"

        draft_payload["form_state"]["bookQuery"] = "Entwurf"
        update = client.patch(f"/api/rechnungen/entwuerfe/{draft['id']}", json={
            **draft_payload,
            "geaendert_am": draft["geaendert_am"],
        })
        assert update.status_code == 200, update.text
        assert update.json()["form_state"]["bookQuery"] == "Entwurf"

        listed = client.get("/api/rechnungen/entwuerfe")
        assert listed.status_code == 200
        assert len(listed.json()["items"]) == 1

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
            "entwurf_id": draft["id"],
        })
        assert sale.status_code == 201, sale.text

        listed_after_sale = client.get("/api/rechnungen/entwuerfe")
        assert listed_after_sale.json()["items"] == []

    def test_partial_storno_restores_only_selected_book(self, client, db_session):
        """A partial storno should restore selected stock and keep invoice active."""
        schueler = create_test_schueler(client)
        buch1 = create_test_buch(client, titel="Mathe Teil", preis_cents=2400, bestand_gesamt=5)
        buch2 = create_test_buch(client, titel="Deutsch Teil", preis_cents=2600, bestand_gesamt=5)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch1["id"], buch2["id"]],
        })
        assert sale.status_code == 201, sale.text
        data = sale.json()
        posten_id = data["posten"][0]["rechnungs_posten_id"]

        resp = client.post(f"/api/rechnungen/{data['id']}/storno", json={
            "grund": "Nur ein Buch falsch ausgegeben",
            "rechnungs_posten_ids": [posten_id],
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["status"] == "offen"
        assert resp.json()["stornierte_posten_ids"] == [posten_id]

        detail = client.get(f"/api/rechnungen/{data['id']}").json()
        assert detail["status"] == "offen"
        assert detail["summe_cents"] == 2600
        assert client.get(f"/api/buecher/{buch1['id']}").json()["bestand_frei"] == 5
        assert client.get(f"/api/buecher/{buch2['id']}").json()["bestand_frei"] == 4

        audit_count = db_session.execute(
            text("SELECT COUNT(*) FROM rechnung_storno_audit WHERE rechnung_id = :rid"),
            {"rid": data["id"]},
        ).scalar()
        assert audit_count == 1

    def test_paid_storno_creates_credit(self, client):
        """A paid cancellation should create a student credit instead of losing the payment."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=2400, bestand_gesamt=5)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })
        rechnung_id = sale.json()["id"]
        pay = client.post("/api/zahlungen", json={
            "schueler_id": schueler["id"],
            "rechnung_id": rechnung_id,
            "datum": "2025-09-01",
            "betrag_cents": 2400,
        })
        assert pay.status_code == 201

        resp = client.post(f"/api/rechnungen/{rechnung_id}/storno", json={
            "grund": "Bezahlt, aber Buch nicht ausgegeben",
        })
        assert resp.status_code == 200, resp.text
        assert resp.json()["gutschrift_id"]

        schueler_detail = client.get(f"/api/schueler/{schueler['id']}").json()
        assert schueler_detail["konto"]["saldo_cents"] == 2400

    def test_nonexistent_student_rejected(self, client):
        """Sale for a non-existent student should return 404."""
        buch = create_test_buch(client)
        resp = client.post("/api/verkauf", json={
            "schueler_id": "S-9999",
            "buch_ids": [buch["id"]],
        })
        assert resp.status_code == 404

    def test_resale_uses_condition_bucket_price(self, client):
        """A returned condition bucket should be sold at its reduced resale price."""
        schueler1 = create_test_schueler(client, vorname="Anna", nachname="Alt")
        schueler2 = create_test_schueler(client, vorname="Bert", nachname="Neu")
        buch = create_test_buch(client, preis_cents=3000, bestand_gesamt=1)

        sale1 = client.post("/api/verkauf", json={
            "schueler_id": schueler1["id"],
            "buch_ids": [buch["id"]],
        })
        assert sale1.status_code == 201
        posten_id = sale1.json()["posten"][0]["rechnungs_posten_id"]

        credit = client.post("/api/gutschrift", json={
            "schueler_id": schueler1["id"],
            "rueckgaben": [
                {"rechnungs_posten_id": posten_id, "zustand": "gut"},
            ],
        })
        assert credit.status_code == 201

        buch_detail = client.get(f"/api/buecher/{buch['id']}")
        gut_bucket = next(
            z for z in buch_detail.json()["zustaende"] if z["zustand"] == "gut"
        )

        sale2 = client.post("/api/verkauf", json={
            "schueler_id": schueler2["id"],
            "positionen": [
                {"buch_id": buch["id"], "bestand_id": gut_bucket["bestand_id"]},
            ],
        })
        assert sale2.status_code == 201
        data = sale2.json()
        assert data["summe_cents"] == 2700
        assert data["posten"][0]["zustand"] == "gut"
