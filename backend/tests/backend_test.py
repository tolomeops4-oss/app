"""Backend tests for Progetto Oliveto (fields CRUD)."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "https://oliveto-grid-design.preview.emergentagent.com").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="module")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def created_ids():
    return []


def test_root_ok(client):
    r = client.get(f"{API}/")
    assert r.status_code == 200
    data = r.json()
    assert data.get("status") == "ok"


def test_list_fields(client):
    r = client.get(f"{API}/fields")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_create_field(client, created_ids):
    name = f"TEST_Field_{uuid.uuid4().hex[:6]}"
    r = client.post(f"{API}/fields", json={"name": name})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["name"] == name
    assert "id" in d
    assert d["config"]["interRow"] == 4.0
    assert d["irrigation"]["emitterFlow"] == 1.5
    assert d["closed"] is False
    created_ids.append(d["id"])


def test_get_field(client, created_ids):
    fid = created_ids[0]
    r = client.get(f"{API}/fields/{fid}")
    assert r.status_code == 200
    assert r.json()["id"] == fid


def test_update_field(client, created_ids):
    fid = created_ids[0]
    vertices = [
        {"id": "v1", "lat": 40.85, "lng": 17.35},
        {"id": "v2", "lat": 40.851, "lng": 17.35},
        {"id": "v3", "lat": 40.851, "lng": 17.351},
        {"id": "v4", "lat": 40.85, "lng": 17.351},
    ]
    payload = {
        "vertices": vertices,
        "closed": True,
        "azimuth": 45.0,
        "config": {"interRow": 3.5, "interPlant": 1.5, "headland": 10, "sideMargin": 2, "minSegment": 30, "variety": "Arbequina"},
    }
    r = client.put(f"{API}/fields/{fid}", json=payload)
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] == fid
    assert d["closed"] is True
    assert len(d["vertices"]) == 4
    assert d["azimuth"] == 45.0
    assert d["config"]["interRow"] == 3.5
    # Verify persistence
    r2 = client.get(f"{API}/fields/{fid}")
    assert r2.status_code == 200
    assert r2.json()["config"]["interRow"] == 3.5


def test_duplicate_field(client, created_ids):
    fid = created_ids[0]
    r = client.post(f"{API}/fields/{fid}/duplicate")
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["id"] != fid
    assert "(Copia)" in d["name"]
    assert len(d["vertices"]) == 4
    created_ids.append(d["id"])


def test_delete_field(client, created_ids):
    for fid in created_ids:
        r = client.delete(f"{API}/fields/{fid}")
        assert r.status_code == 200
        r2 = client.get(f"{API}/fields/{fid}")
        assert r2.status_code == 404


def test_delete_nonexistent(client):
    r = client.delete(f"{API}/fields/{uuid.uuid4()}")
    assert r.status_code == 404
