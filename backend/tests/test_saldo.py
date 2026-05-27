"""
Tests for student credit saldo.

Business rule: only credits (gutschriften) and their usage/payout affect saldo.
Sales and payments must not change the student credit account.
"""

from tests.conftest import create_test_schueler, create_test_buch


class TestSaldo:
    """Schulguthaben calculation tests."""

    def test_saldo_unchanged_by_sale(self, client):
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=2400, bestand_gesamt=20)

        client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })

        resp = client.get(f"/api/schueler/{schueler['id']}")
        assert resp.json()["konto"]["saldo_cents"] == 0

    def test_saldo_unchanged_by_payment(self, client):
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=3000, bestand_gesamt=20)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })

        client.post("/api/zahlungen", json={
            "schueler_id": schueler["id"],
            "rechnung_id": sale.json()["id"],
            "datum": "2025-09-01",
            "betrag_cents": 3000,
        })

        resp = client.get(f"/api/schueler/{schueler['id']}")
        assert resp.json()["konto"]["saldo_cents"] == 0

    def test_saldo_increases_with_gutschrift(self, client):
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=3000, bestand_gesamt=20)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })
        posten_id = sale.json()["posten"][0]["rechnungs_posten_id"]

        client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })

        resp = client.get(f"/api/schueler/{schueler['id']}")
        assert resp.json()["konto"]["saldo_cents"] == 3000

    def test_vorgaenge_excludes_sales_and_payments(self, client):
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=2800, bestand_gesamt=20)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })
        posten_id = sale.json()["posten"][0]["rechnungs_posten_id"]

        client.post("/api/zahlungen", json={
            "schueler_id": schueler["id"],
            "rechnung_id": sale.json()["id"],
            "datum": "2025-09-01",
            "betrag_cents": 2800,
        })

        client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })

        resp = client.get(f"/api/schueler/{schueler['id']}/vorgaenge")
        data = resp.json()
        assert len(data["items"]) == 2
        assert sorted(v["typ"] for v in data["items"]) == ["gutschrift", "rechnung"]
        assert data["items"][-1]["saldo_nach_cents"] == 2800

    def test_verrechnung_reduces_credit_saldo(self, client):
        schueler = create_test_schueler(client)
        buch1 = create_test_buch(client, titel="Buch A", preis_cents=3000, bestand_gesamt=10)
        buch2 = create_test_buch(client, titel="Buch B", preis_cents=2000, bestand_gesamt=10)

        sale1 = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch1["id"]],
        })
        posten_id = sale1.json()["posten"][0]["rechnungs_posten_id"]

        client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })

        sale2 = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch2["id"]],
            "guthaben_verrechnen": True,
        })
        assert sale2.status_code == 201
        assert sale2.json()["verrechnet_cents"] == 2000

        resp = client.get(f"/api/schueler/{schueler['id']}")
        assert resp.json()["konto"]["saldo_cents"] == 1000

        vorgaenge = client.get(f"/api/schueler/{schueler['id']}/vorgaenge").json()["items"]
        assert sorted(v["typ"] for v in vorgaenge) == ["gutschrift", "rechnung", "rechnung", "verrechnung"]
        assert vorgaenge[-1]["saldo_nach_cents"] == 1000

    def test_auszahlung_reduces_credit_saldo(self, client):
        schueler = create_test_schueler(client)
        buch = create_test_buch(client, preis_cents=3000, bestand_gesamt=10)

        sale = client.post("/api/verkauf", json={
            "schueler_id": schueler["id"],
            "buch_ids": [buch["id"]],
        })
        posten_id = sale.json()["posten"][0]["rechnungs_posten_id"]

        client.post("/api/gutschrift", json={
            "schueler_id": schueler["id"],
            "rechnungs_posten_ids": [posten_id],
        })

        payout = client.post("/api/auszahlungen", json={
            "schueler_id": schueler["id"],
            "betrag_cents": 1200,
            "datum": "2025-09-10",
        })
        assert payout.status_code == 201
        payout_id = payout.json()["id"]

        beleg = client.get(f"/api/auszahlungen/{payout_id}/html")
        assert beleg.status_code == 200
        assert "Auszahlungsbeleg" in beleg.text

        resp = client.get(f"/api/schueler/{schueler['id']}")
        assert resp.json()["konto"]["saldo_cents"] == 1800
