"""
Tests for POST /api/gutschrift and related credit note endpoints.
"""

from tests.conftest import create_test_schueler, create_test_buch


class TestGutschrift:
    """Gutschrift (credit note / return) transaction tests."""

    def _sell_book(self, client, schueler_id, buch_id):
        """Helper: sell a single book and return the sale response."""
        resp = client.post("/api/verkauf", json={
            "schueler_id": schueler_id,
            "buch_ids": [buch_id],
        })
        assert resp.status_code == 201
        return resp.json()

    def test_successful_gutschrift(self, client):
        """Returning a book should create a credit note and restore stock."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=2400, bestand_gesamt=20)

        # Sell
        sale = self._sell_book(client, schueler["id"], buch["id"])
        posten_id = sale["posten"][0]["rechnungs_posten_id"]

        # Verify stock: 19 free
        assert client.get(f"/api/buecher/{buch['id']}").json()["bestand_frei"] == 19

        # Return
        resp = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["summe_cents"] == 2400
        assert data["ausgezahlt"] is False
        assert len(data["posten"]) == 1
        assert data["posten"][0]["betrag_cents"] == 2400
        assert data["id"].startswith("G-")

        # Stock restored: 20 free
        assert client.get(f"/api/buecher/{buch['id']}").json()["bestand_frei"] == 20

    def test_double_return_rejected(self, client):
        """Returning the same item twice should be rejected."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=2400, bestand_gesamt=20)

        sale = self._sell_book(client, schueler["id"], buch["id"])
        posten_id = sale["posten"][0]["rechnungs_posten_id"]

        # First return — should succeed
        resp1 = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        assert resp1.status_code == 201

        # Second return — should be rejected
        resp2 = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        assert resp2.status_code == 422

    def test_wrong_student_rejected(self, client):
        """Returning a book sold to another student should be rejected."""
        schueler1 = create_test_schueler(client, vorname="A", nachname="Eins")
        schueler2 = create_test_schueler(client, vorname="B", nachname="Zwei")
        buch = create_test_buch(client, bestand_gesamt=20)

        sale = self._sell_book(client, schueler1["id"], buch["id"])
        posten_id = sale["posten"][0]["rechnungs_posten_id"]

        # Try returning as schueler2
        resp = client.post("/api/gutschrift", json={
            "schueler_id": schueler2["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        assert resp.status_code == 422

    def test_multi_item_gutschrift(self, client):
        """Returning multiple items should sum correctly."""
        schueler = create_test_schueler(client)
        buch1 = create_test_buch(client, titel="Buch A", preis_cents=2400, bestand_gesamt=20)
        buch2 = create_test_buch(client, titel="Buch B", preis_cents=3000, bestand_gesamt=20)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch1["id"], buch2["id"]],
        })
        assert sale.status_code == 201
        posten_ids = [p["rechnungs_posten_id"] for p in sale.json()["posten"]]

        resp = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": posten_ids,
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["summe_cents"] == 5400  # 2400 + 3000
        assert len(data["posten"]) == 2

    def test_get_gutschrift(self, client):
        """GET /api/gutschriften/:id should return the credit note detail."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, bestand_gesamt=20)

        sale = self._sell_book(client, schueler["id"], buch["id"])
        posten_id = sale["posten"][0]["rechnungs_posten_id"]

        gs = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        gutschrift_id = gs.json()["id"]

        resp = client.get(f"/api/gutschriften/{gutschrift_id}")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == gutschrift_id
        assert data["ausgezahlt"] is False

    def test_condition_discount_is_applied(self, client):
        """Return condition should reduce the credit and create a resale bucket."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=3000, bestand_gesamt=10)

        sale = self._sell_book(client, schueler["id"], buch["id"])
        posten_id = sale["posten"][0]["rechnungs_posten_id"]

        resp = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rueckgaben": [
                {"rechnungs_posten_id": posten_id, "zustand": "gut"},
            ],
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["summe_cents"] == 2700
        assert data["posten"][0]["zustand"] == "gut"
        assert data["posten"][0]["abschreibung_prozent"] == 10
        assert data["posten"][0]["wiederverkaufspreis_cents"] == 2700

        buch_detail = client.get(f"/api/buecher/{buch['id']}")
        zustaende = buch_detail.json()["zustaende"]
        gut_bucket = next(z for z in zustaende if z["zustand"] == "gut")
        assert gut_bucket["preis_cents"] == 2700
        assert gut_bucket["bestand_verfuegbar"] == 1

    def test_auszahlen(self, client):
        """POST /api/gutschriften/:id/auszahlen should mark as paid out."""
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, bestand_gesamt=20)

        sale = self._sell_book(client, schueler["id"], buch["id"])
        posten_id = sale["posten"][0]["rechnungs_posten_id"]

        gs = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        gutschrift_id = gs.json()["id"]

        before = client.get(f"/api/schueler/{schueler['id']}").json()
        assert before["konto"]["saldo_cents"] == buch["preis_cents"]

        resp = client.post(f"/api/gutschriften/{gutschrift_id}/auszahlen")
        assert resp.status_code == 200

        detail = client.get(f"/api/gutschriften/{gutschrift_id}")
        assert detail.json()["ausgezahlt"] is True

        # Payout must actually book an Auszahlung so the saldo reflects the cash-out,
        # not just flip the flag (regression: previously left the credit balance unchanged).
        after = client.get(f"/api/schueler/{schueler['id']}").json()
        assert after["konto"]["saldo_cents"] == 0

        vorgaenge = client.get(f"/api/schueler/{schueler['id']}/vorgaenge").json()["items"]
        auszahlungen = [v for v in vorgaenge if v["typ"] == "auszahlung"]
        assert len(auszahlungen) == 1
        assert auszahlungen[0]["betrag_cents"] == -buch["preis_cents"]

        # Paying out again must be rejected, not double-book the ledger.
        resp2 = client.post(f"/api/gutschriften/{gutschrift_id}/auszahlen")
        assert resp2.status_code == 422

    def test_gutschrift_html_uses_non_returned_label_and_renders_total_for_many_items(self, client):
        """HTML preview should use the new label and keep the total visible for long credit notes."""
        schueler = create_test_schueler(client)

        buch_ids = []
        for index in range(9):
            buch = create_test_buch(
                client,
                titel=f"Buch {index + 1}",
                preis_cents=2400,
                bestand_gesamt=20,
            )
            buch_ids.append(buch["id"])

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": buch_ids,
        })
        assert sale.status_code == 201
        posten_ids = [p["rechnungs_posten_id"] for p in sale.json()["posten"]]

        resp = client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rueckgaben": [
                {"rechnungs_posten_id": posten_ids[0], "beschaedigt": True},
                *[
                    {"rechnungs_posten_id": posten_id}
                    for posten_id in posten_ids[1:]
                ],
            ],
        })
        assert resp.status_code == 201

        gutschrift_id = resp.json()["id"]
        html = client.get(f"/api/gutschriften/{gutschrift_id}/html")
        assert html.status_code == 200
        assert "Nicht zurückgenommen – keine Gutschrift" in html.text
        assert "Beschädigt" not in html.text
        assert "Gutschrift gesamt" in html.text
        assert "192,00 EUR" in html.text
