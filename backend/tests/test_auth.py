"""Backend auth + ownership + backup tests for Progetto Oliveto."""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/")
API = f"{BASE_URL}/api"


def _mkemail():
    return f"test_{uuid.uuid4().hex[:10]}@example.com"


@pytest.fixture(scope="module")
def user_a():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = _mkemail()
    pw = "test1234"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw, "name": "User A"})
    assert r.status_code == 200, r.text
    data = r.json()
    assert data["email"] == email
    assert data["provider"] == "local"
    # Also grab bearer token from cookie for use as Authorization header (belt & suspenders)
    token = s.cookies.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return {"session": s, "email": email, "password": pw, "user_id": data["user_id"]}


@pytest.fixture(scope="module")
def user_b():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = _mkemail()
    pw = "test1234"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": pw})
    assert r.status_code == 200, r.text
    token = s.cookies.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    return {"session": s, "email": email, "password": pw, "user_id": r.json()["user_id"]}


# ---------- Auth basic ----------

def test_me_guest():
    r = requests.get(f"{API}/auth/me")
    assert r.status_code == 200
    assert r.json() is None


def test_register_duplicate_rejected(user_a):
    r = requests.post(f"{API}/auth/register", json={"email": user_a["email"], "password": "otherpass"})
    assert r.status_code == 400


def test_register_short_password():
    r = requests.post(f"{API}/auth/register", json={"email": _mkemail(), "password": "12"})
    assert r.status_code == 400


def test_login_wrong_password(user_a):
    r = requests.post(f"{API}/auth/login", json={"email": user_a["email"], "password": "wrongpass"})
    assert r.status_code == 401


def test_login_success_and_me(user_a):
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    r = s.post(f"{API}/auth/login", json={"email": user_a["email"], "password": user_a["password"]})
    assert r.status_code == 200
    assert r.json()["email"] == user_a["email"]
    # cookie set
    assert s.cookies.get("access_token"), "access_token cookie not set"
    token = s.cookies.get("access_token")
    r2 = s.get(f"{API}/auth/me")
    assert r2.status_code == 200
    d = r2.json()
    assert d is not None
    assert d["email"] == user_a["email"]
    # Bearer header path
    r3 = requests.get(f"{API}/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert r3.status_code == 200
    assert r3.json()["email"] == user_a["email"]


def test_logout_clears_cookie(user_a):
    s = requests.Session()
    s.post(f"{API}/auth/login", json={"email": user_a["email"], "password": user_a["password"]})
    assert s.cookies.get("access_token")
    r = s.post(f"{API}/auth/logout")
    assert r.status_code == 200
    # After logout, /me with fresh session should be null
    s2 = requests.Session()
    r2 = s2.get(f"{API}/auth/me")
    assert r2.json() is None


# ---------- Field ownership ----------

def test_create_field_sets_ownerId(user_a):
    s = user_a["session"]
    r = s.post(f"{API}/fields", json={"name": f"TEST_OWNED_{uuid.uuid4().hex[:6]}"})
    assert r.status_code == 200, r.text
    d = r.json()
    assert d["ownerId"] == user_a["user_id"]
    # cleanup
    s.delete(f"{API}/fields/{d['id']}")


def test_guest_cannot_see_owned_fields(user_a):
    s = user_a["session"]
    r = s.post(f"{API}/fields", json={"name": f"TEST_HIDDEN_{uuid.uuid4().hex[:6]}"})
    fid = r.json()["id"]
    # Guest list
    r2 = requests.get(f"{API}/fields")
    assert r2.status_code == 200
    ids = [f["id"] for f in r2.json()]
    assert fid not in ids
    # cleanup
    s.delete(f"{API}/fields/{fid}")


def test_user_b_cannot_modify_user_a_field(user_a, user_b):
    r = user_a["session"].post(f"{API}/fields", json={"name": f"TEST_A_{uuid.uuid4().hex[:6]}"})
    fid = r.json()["id"]
    # User B tries to delete
    rdel = user_b["session"].delete(f"{API}/fields/{fid}")
    assert rdel.status_code == 404
    rput = user_b["session"].put(f"{API}/fields/{fid}", json={"name": "hacked"})
    assert rput.status_code == 404
    # User A still owns
    rget = user_a["session"].get(f"{API}/fields/{fid}")
    assert rget.status_code == 200
    assert rget.json()["name"].startswith("TEST_A_")
    user_a["session"].delete(f"{API}/fields/{fid}")


def test_guest_and_user_can_see_ownerless_fields():
    # Create ownerless field (as guest)
    r = requests.post(f"{API}/fields", json={"name": f"TEST_GUEST_{uuid.uuid4().hex[:6]}"})
    assert r.status_code == 200
    fid = r.json()["id"]
    assert r.json()["ownerId"] is None
    # Guest sees it
    r2 = requests.get(f"{API}/fields")
    assert fid in [f["id"] for f in r2.json()]
    # cleanup as guest
    requests.delete(f"{API}/fields/{fid}")


# ---------- Backup / Restore ----------

def test_backup_shape(user_a):
    s = user_a["session"]
    # Ensure at least one field
    r = s.post(f"{API}/fields", json={"name": f"TEST_BK_{uuid.uuid4().hex[:6]}"})
    fid = r.json()["id"]
    rb = s.get(f"{API}/backup")
    assert rb.status_code == 200
    d = rb.json()
    assert d["app"] == "Progetto Oliveto"
    assert d["version"] == 1
    assert isinstance(d["fields"], list)
    assert d["count"] == len(d["fields"])
    assert any(f["id"] == fid for f in d["fields"])
    s.delete(f"{API}/fields/{fid}")


def test_restore_imports_with_new_ids(user_a):
    s = user_a["session"]
    payload = {
        "app": "Progetto Oliveto", "version": 1,
        "fields": [
            {"id": "should-be-replaced", "name": f"TEST_RS_{uuid.uuid4().hex[:6]}", "vertices": [], "closed": False},
        ],
    }
    r = s.post(f"{API}/backup/restore", json=payload)
    assert r.status_code == 200
    assert r.json()["imported"] == 1
    # Verify field appears in list with new id and ownerId set to user
    lst = s.get(f"{API}/fields").json()
    match = [f for f in lst if f["name"].startswith("TEST_RS_")]
    assert len(match) >= 1
    for f in match:
        assert f["id"] != "should-be-replaced"
        assert f["ownerId"] == user_a["user_id"]
        s.delete(f"{API}/fields/{f['id']}")


# ---------- Claim guest fields ----------

def test_claim_guest_fields():
    # Create ownerless field
    r = requests.post(f"{API}/fields", json={"name": f"TEST_CLM_{uuid.uuid4().hex[:6]}"})
    fid = r.json()["id"]
    # Register a fresh user
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    email = _mkemail()
    reg = s.post(f"{API}/auth/register", json={"email": email, "password": "test1234"})
    assert reg.status_code == 200
    uid = reg.json()["user_id"]
    token = s.cookies.get("access_token")
    if token:
        s.headers.update({"Authorization": f"Bearer {token}"})
    rc = s.post(f"{API}/auth/claim-guest-fields")
    assert rc.status_code == 200
    assert rc.json()["claimed"] >= 1
    # Now the field should have owner = uid
    g = s.get(f"{API}/fields/{fid}")
    assert g.status_code == 200
    assert g.json()["ownerId"] == uid
    # Guest should no longer see it
    gg = requests.get(f"{API}/fields")
    assert fid not in [f["id"] for f in gg.json()]
    # cleanup
    s.delete(f"{API}/fields/{fid}")


def test_claim_requires_auth():
    r = requests.post(f"{API}/auth/claim-guest-fields")
    assert r.status_code == 401
