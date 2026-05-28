"""
Tests for CRUD endpoints (Schüler, Bücher) and additional business rules.
"""

from tests.conftest import create_test_schueler, create_test_buch
from app.models import BuchZustandBestand


class TestSchuelerCrud:
    """Schüler CRUD tests."""

    def test_create_schueler(self, client):
        """POST /api/schueler should create and return the student."""
        data = {
            "vorname": "Anna",
            "nachname": "Klein",
            "klasse": "5b",
            "strasse": "Lindenweg 4",
            "plz": "52525",
            "ort": "Heinsberg",
        }
        resp = client.post("/api/schueler", json=data)
        assert resp.status_code == 201
        s = resp.json()
        assert s["vorname"] == "Anna"
        assert s["nachname"] == "Klein"
        assert s["klasse"] == "5b"
        assert s["id"].startswith("S-")
        assert s["konto"]["saldo_cents"] == 0

    def test_list_schueler(self, client):
        """GET /api/schueler should list students."""
        create_test_schueler(client, vorname="A", nachname="Eins")
        create_test_schueler(client, vorname="B", nachname="Zwei")

        resp = client.get("/api/schueler")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 2
        assert len(data["items"]) == 2

    def test_search_schueler(self, client):
        """GET /api/schueler?q= should filter by name."""
        create_test_schueler(client, vorname="Lukas", nachname="Mueller")
        create_test_schueler(client, vorname="Anna", nachname="Klein")

        resp = client.get("/api/schueler?q=Lukas")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["vorname"] == "Lukas"

    def test_filter_by_klasse(self, client):
        """GET /api/schueler?klasse= should filter by class."""
        create_test_schueler(client, vorname="A", nachname="Eins", klasse="7a")
        create_test_schueler(client, vorname="B", nachname="Zwei", klasse="8b")

        resp = client.get("/api/schueler?klasse=7a")
        assert resp.status_code == 200
        assert resp.json()["total"] == 1

    def test_get_schueler_detail(self, client):
        """GET /api/schueler/:id should return detail with konto."""
        s = create_test_schueler(client)
        resp = client.get(f"/api/schueler/{s['id']}")
        assert resp.status_code == 200
        assert resp.json()["konto"]["saldo_cents"] == 0

    def test_update_schueler(self, client):
        """PATCH /api/schueler/:id should update fields."""
        s = create_test_schueler(client, klasse="7a")
        resp = client.patch(f"/api/schueler/{s['id']}", json={"klasse": "8a"})
        assert resp.status_code == 200
        assert resp.json()["klasse"] == "8a"

    def test_delete_schueler(self, client):
        """DELETE /api/schueler/:id should soft-delete."""
        s = create_test_schueler(client)
        resp = client.delete(f"/api/schueler/{s['id']}")
        assert resp.status_code == 204

        # Should no longer appear in list
        list_resp = client.get("/api/schueler")
        assert list_resp.json()["total"] == 0

    def test_aktive_buecher(self, client):
        """GET /api/schueler/:id/aktive-buecher should list unreturned books."""
        s = create_test_schueler(client)
        b = create_test_buch(client, bestand_gesamt=10)

        client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })

        resp = client.get(f"/api/schueler/{s['id']}/aktive-buecher")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["items"]) == 1
        assert data["items"][0]["buch_id"] == b["id"]


class TestSchuelerCsvImport:
    """CSV preview + import tests for students."""

    def test_preview_marks_missing_and_duplicates(self, client):
        create_test_schueler(
            client,
            vorname="Anna",
            nachname="Klein",
            klasse="7a",
        )
        csv_text = (
            "vorname;nachname;klasse;plz\n"
            "Anna;Klein;7a;12345\n"
            "Ben;;8b;23456\n"
            "Tom;Test;9c;34567\n"
            "Tom;Test;9c;34567\n"
        )
        resp = client.post(
            "/api/schueler/import/csv/preview",
            files={"file": ("schueler.csv", csv_text.encode("utf-8"), "text/csv")},
        )
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["total_rows"] == 4
        assert data["invalid_rows"] == 4

        anna = data["rows"][0]
        assert anna["duplicate_existing"] is True
        assert anna["valid"] is False

        ben = data["rows"][1]
        assert ben["fehlende_felder"] == ["nachname"]
        assert ben["valid"] is False

        tom1 = data["rows"][2]
        tom2 = data["rows"][3]
        assert tom1["duplicate_file"] is True
        assert tom2["duplicate_file"] is True

    def test_import_selected_rows(self, client):
        rows = [
            {
                "vorname": "Lina",
                "nachname": "Sommer",
                "klasse": "6a",
                "plz": "10115",
            },
            {
                "vorname": "Mika",
                "nachname": None,
                "klasse": "6a",
            },
        ]

        resp = client.post("/api/schueler/import/csv", json={"rows": rows})
        assert resp.status_code == 201, resp.text
        data = resp.json()
        assert data["imported"] == 1
        assert data["skipped"] == 1
        assert "Pflichtfelder fehlen" in data["skip_details"][0]["reason"]

        all_students = client.get("/api/schueler").json()
        assert all_students["total"] == 1
        assert all_students["items"][0]["vorname"] == "Lina"


class TestBuecherCrud:
    """Bücher CRUD tests."""

    def test_create_buch(self, client):
        """POST /api/buecher should create a book."""
        data = {
            "titel": "Mathe 7",
            "fach": "Mathematik",
            "stufe": 7,
            "verlag": "Cornelsen",
            "preis_cents": 2400,
            "bestand_gesamt": 50,
        }
        resp = client.post("/api/buecher", json=data)
        assert resp.status_code == 201
        b = resp.json()
        assert b["id"].startswith("B-")
        assert b["bestand_frei"] == 50
        assert b["bestand_ausgegeben"] == 0

    def test_list_buecher_with_fach_filter(self, client):
        """GET /api/buecher?fach= should filter by subject."""
        create_test_buch(client, titel="Mathe 7", fach="Mathematik")
        create_test_buch(client, titel="Englisch 7", fach="Englisch")

        resp = client.get("/api/buecher?fach=Mathematik")
        assert resp.status_code == 200
        data = resp.json()
        assert data["total"] == 1
        assert data["items"][0]["fach"] == "Mathematik"

    def test_update_buch(self, client):
        """PATCH /api/buecher/:id should update fields."""
        b = create_test_buch(client, preis_cents=2400)
        resp = client.patch(f"/api/buecher/{b['id']}", json={"preis_cents": 2800})
        assert resp.status_code == 200
        assert resp.json()["preis_cents"] == 2800

    def test_update_buch_reprices_nutzungsjahr_buckets(self, client, db_session):
        """Basispreis-Update should recalculate existing usage-year buckets."""
        create_resp = client.post(
            "/api/buecher",
            json={
                "titel": "Physik 7",
                "fach": "Physik",
                "stufe": 7,
                "preis_cents": 2000,
                "bestand_gesamt": 10,
                "schutzgebuehr_cents": 500,
            },
        )
        assert create_resp.status_code == 201, create_resp.text
        buch_id = create_resp.json()["id"]

        base_bucket = (
            db_session.query(BuchZustandBestand)
            .filter(
                BuchZustandBestand.buch_id == buch_id,
                BuchZustandBestand.zustand == "sehr_gut",
                BuchZustandBestand.verkaufspreis_cents == 2000,
            )
            .first()
        )
        assert base_bucket is not None
        base_bucket.bestand_verfuegbar = 3
        db_session.add(
            BuchZustandBestand(
                buch_id=buch_id,
                zustand="sehr_gut",
                verkaufspreis_cents=1800,
                bestand_verfuegbar=2,
            )
        )
        db_session.add(
            BuchZustandBestand(
                buch_id=buch_id,
                zustand="sehr_gut",
                verkaufspreis_cents=1600,
                bestand_verfuegbar=1,
            )
        )
        db_session.add(
            BuchZustandBestand(
                buch_id=buch_id,
                zustand="sehr_gut",
                verkaufspreis_cents=500,
                bestand_verfuegbar=4,
            )
        )
        db_session.commit()

        resp = client.patch(f"/api/buecher/{buch_id}", json={"preis_cents": 3000})
        assert resp.status_code == 200, resp.text
        data = resp.json()
        assert data["preis_cents"] == 3000

        by_price = {
            bucket["preis_cents"]: bucket["bestand_verfuegbar"]
            for bucket in data["zustaende"]
        }
        assert by_price.get(3000) == 3
        assert by_price.get(2700) == 2
        assert by_price.get(2400) == 1
        assert by_price.get(500) == 4
        assert 2000 not in by_price
        assert 1800 not in by_price
        assert 1600 not in by_price

    def test_delete_buch(self, client):
        """DELETE /api/buecher/:id should soft-delete."""
        b = create_test_buch(client)
        resp = client.delete(f"/api/buecher/{b['id']}")
        assert resp.status_code == 204

        # Should no longer appear in list
        list_resp = client.get("/api/buecher")
        assert list_resp.json()["total"] == 0


class TestGR1DuplicateBook:
    """GR1: A student can only have one open copy of a book at a time."""

    def test_duplicate_book_rejected(self, client):
        """Selling the same book to the same student twice should fail."""
        s = create_test_schueler(client)
        b = create_test_buch(client, bestand_gesamt=20)

        # First sale — should succeed
        resp1 = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        assert resp1.status_code == 201

        # Second sale of same book — should be rejected (GR1)
        resp2 = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        assert resp2.status_code == 422

    def test_duplicate_after_return_allowed(self, client):
        """After returning a book, buying it again should be allowed."""
        s = create_test_schueler(client)
        b = create_test_buch(client, bestand_gesamt=20)

        # Buy
        sale = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        assert sale.status_code == 201
        posten_id = sale.json()["posten"][0]["rechnungs_posten_id"]

        # Return
        gs = client.post("/api/gutschrift", json={
            "schueler_id": s["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        assert gs.status_code == 201

        # Buy again — should succeed since previous was returned
        resp = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        assert resp.status_code == 201

    def test_duplicate_after_storno_allowed(self, client):
        """After cancelling an invoice, buying the same book should be allowed."""
        s = create_test_schueler(client)
        b = create_test_buch(client, bestand_gesamt=20)

        # Buy
        sale = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        assert sale.status_code == 201
        rechnung_id = sale.json()["id"]

        # Storno
        client.post(f"/api/rechnungen/{rechnung_id}/storno")

        # Buy again — should succeed since invoice was cancelled
        resp = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        assert resp.status_code == 201


class TestHtmlPreview:
    """HTML preview endpoint tests."""

    def test_rechnung_html(self, client):
        """GET /api/rechnungen/:id/html should return printable HTML."""
        s = create_test_schueler(client)
        b = create_test_buch(client, bestand_gesamt=10)

        sale = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        rechnung_id = sale.json()["id"]

        resp = client.get(f"/api/rechnungen/{rechnung_id}/html")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "Rechnung" in resp.text
        assert rechnung_id in resp.text

    def test_gutschrift_html(self, client):
        """GET /api/gutschriften/:id/html should return printable HTML."""
        s = create_test_schueler(client)
        b = create_test_buch(client, bestand_gesamt=10)

        sale = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        posten_id = sale.json()["posten"][0]["rechnungs_posten_id"]

        gs = client.post("/api/gutschrift", json={
            "schueler_id": s["id"],
            "rechnungs_posten_ids": [posten_id],
        })
        gutschrift_id = gs.json()["id"]

        resp = client.get(f"/api/gutschriften/{gutschrift_id}/html")
        assert resp.status_code == 200
        assert "text/html" in resp.headers["content-type"]
        assert "Gutschrift" in resp.text


class TestDashboard:
    """Dashboard endpoint tests."""

    def test_dashboard_structure(self, client):
        """GET /api/dashboard should return all expected fields."""
        resp = client.get("/api/dashboard")
        assert resp.status_code == 200
        data = resp.json()
        assert "anzahl_schueler" in data
        assert "anzahl_buecher_titel" in data
        assert "offene_ausleihen" in data
        assert "verkaeufe_monat" in data
        assert "rueckgaben_monat" in data
        assert "umsatz_monat_cents" in data
        assert "gutschriften_monat_cents" in data

    def test_dashboard_counts(self, client):
        """Dashboard should count correctly after operations."""
        create_test_schueler(client)
        create_test_buch(client)

        resp = client.get("/api/dashboard")
        data = resp.json()
        assert data["anzahl_schueler"] == 1
        assert data["anzahl_buecher_titel"] == 1


class TestZahlungen:
    """Zahlungen endpoint tests."""

    def test_create_zahlung_and_auto_status(self, client):
        """Full payment should set invoice status to 'bezahlt'."""
        s = create_test_schueler(client)
        b = create_test_buch(client, preis_cents=3000, bestand_gesamt=10)

        sale = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })
        rechnung_id = sale.json()["id"]

        # Record payment
        resp = client.post("/api/zahlungen", json={
            "schueler_id": s["id"],
            "rechnung_id": rechnung_id,
            "datum": "2025-09-01",
            "betrag_cents": 3000,
        })
        assert resp.status_code == 201

        # Check invoice is now 'bezahlt'
        rechnung = client.get(f"/api/rechnungen/{rechnung_id}")
        assert rechnung.json()["status"] == "bezahlt"

    def test_list_zahlungen(self, client):
        """GET /api/zahlungen?schueler_id= should list payments."""
        s = create_test_schueler(client)
        b = create_test_buch(client, bestand_gesamt=10)

        sale = client.post("/api/verkauf", json={
            "schueler_id": s["id"],
            "buch_ids": [b["id"]],
        })

        client.post("/api/zahlungen", json={
            "schueler_id": s["id"],
            "rechnung_id": sale.json()["id"],
            "datum": "2025-09-01",
            "betrag_cents": 1000,
        })

        resp = client.get(f"/api/zahlungen?schueler_id={s['id']}")
        assert resp.status_code == 200
        assert len(resp.json()["items"]) == 1


class TestEinstellungen:
    """Einstellungen endpoint tests."""

    def test_get_einstellungen(self, client):
        """GET /api/einstellungen should return all settings."""
        resp = client.get("/api/einstellungen")
        assert resp.status_code == 200
        data = resp.json()
        assert "schuljahr_aktuell" in data

    def test_patch_einstellungen(self, client):
        """PATCH /api/einstellungen should update settings."""
        resp = client.patch("/api/einstellungen", json={
            "schule_name": "Test-Gymnasium",
        })
        assert resp.status_code == 200

        # Verify update
        get_resp = client.get("/api/einstellungen")
        assert get_resp.json()["schule_name"] == "Test-Gymnasium"
