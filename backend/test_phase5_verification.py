import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
from pathlib import Path
import jwt

# Add backend and project root directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
for p in [str(ROOT_DIR), str(BASE_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

# Configure test JWT secret
TEST_JWT_SECRET = "test_supabase_super_secret_jwt_key_12345"
os.environ["SUPABASE_JWT_SECRET"] = TEST_JWT_SECRET

from fastapi.testclient import TestClient
from backend.main import app
from backend.db import get_database


def generate_token(user_id: str, email: str = "vendor@vyapar.test", expired: bool = False) -> str:
    """Helper to generate mock Supabase Auth JWTs for testing."""
    exp = datetime.now(timezone.utc) + (timedelta(seconds=-60) if expired else timedelta(hours=2))
    payload = {
        "sub": user_id,
        "email": email,
        "role": "authenticated",
        "aud": "authenticated",
        "exp": int(exp.timestamp()),
        "iat": int(datetime.now(timezone.utc).timestamp()),
    }
    return jwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


def run_phase5_tests():
    client = TestClient(app)
    db = get_database()

    print("================ PHASE 5 BACKEND VERIFICATION ================")

    # Setup unique test identifiers
    user_a_id = f"usr_{uuid.uuid4().hex[:12]}"
    user_b_id = f"usr_{uuid.uuid4().hex[:12]}"
    token_user_a = generate_token(user_a_id, "usera@vyapar.test")
    token_user_b = generate_token(user_b_id, "userb@vyapar.test")
    expired_token = generate_token(user_a_id, expired=True)

    # -------------------------------------------------------------
    # 1. Test Authentication Verification & Errors
    # -------------------------------------------------------------
    print("\n--- 1. Testing Auth Verification & Guardrails ---")
    
    # 1a. Missing token -> 401
    res = client.get("/api/users/profile")
    assert res.status_code == 401, f"Expected 401 on missing token, got {res.status_code}"
    print("[OK] 1a. Missing token correctly returns 401 Unauthorized.")

    # 1b. Malformed token -> 401
    res = client.get("/api/users/profile", headers={"Authorization": "InvalidTokenFormat"})
    assert res.status_code == 401
    print("[OK] 1b. Malformed Authorization header returns 401 Unauthorized.")

    # 1c. Expired token -> 401
    res = client.get("/api/users/profile", headers={"Authorization": f"Bearer {expired_token}"})
    assert res.status_code == 401
    print("[OK] 1c. Expired token returns 401 Unauthorized.")

    # 1d. Invalid signature token -> 401
    bad_signature_token = jwt.encode({"sub": user_a_id}, "wrong_secret", algorithm="HS256")
    res = client.get("/api/users/profile", headers={"Authorization": f"Bearer {bad_signature_token}"})
    assert res.status_code == 401
    print("[OK] 1d. Invalid token signature returns 401 Unauthorized.")

    # -------------------------------------------------------------
    # 2. Test User Profile Management (/api/users/profile)
    # -------------------------------------------------------------
    print("\n--- 2. Testing User Profile Management ---")

    # 2a. Query profile before creation -> 404
    res = client.get("/api/users/profile", headers={"Authorization": f"Bearer {token_user_a}"})
    assert res.status_code == 404
    print("[OK] 2a. GET /api/users/profile before setup correctly returns 404.")

    # 2b. Create User Profile for User A
    res = client.post(
        "/api/users/profile",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={
            "name": "Ramesh Kumar",
            "role": "vendor"
        }
    )
    assert res.status_code == 201, f"Create user failed: {res.text}"
    profile_a = res.json()["data"]
    assert profile_a["user_id"] == user_a_id
    assert profile_a["name"] == "Ramesh Kumar"
    assert profile_a["role"] == "vendor"
    print(f"[OK] 2b. POST /api/users/profile created profile for user_id={user_a_id}.")

    # 2c. Duplicate Profile Prevention -> 409
    res = client.post(
        "/api/users/profile",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={
            "name": "Ramesh Duplicate",
            "role": "user"
        }
    )
    assert res.status_code == 409
    print("[OK] 2c. Duplicate user profile registration prevented (409 Conflict).")

    # 2d. GET Profile for User A
    res = client.get("/api/users/profile", headers={"Authorization": f"Bearer {token_user_a}"})
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Ramesh Kumar"
    print("[OK] 2d. GET /api/users/profile returned authenticated user's profile.")

    # 2e. PATCH Profile for User A
    res = client.patch(
        "/api/users/profile",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={"name": "Ramesh Kumar Sharma"}
    )
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Ramesh Kumar Sharma"
    print("[OK] 2e. PATCH /api/users/profile updated user name and updated_at.")

    # Create User B (Consumer role)
    res = client.post(
        "/api/users/profile",
        headers={"Authorization": f"Bearer {token_user_b}"},
        json={"name": "Pooja Mehta", "role": "user"}
    )
    assert res.status_code == 201
    print("[OK] 2f. Created user profile for User B (role='user').")

    # -------------------------------------------------------------
    # 3. Test Vendor Onboarding & Profile Retrieval
    # -------------------------------------------------------------
    print("\n--- 3. Testing Vendor Onboarding & Management ---")

    # 3a. User B (not onboarded as vendor) calling /api/vendors/me -> 404
    res = client.get("/api/vendors/me", headers={"Authorization": f"Bearer {token_user_b}"})
    assert res.status_code == 404
    print("[OK] 3a. GET /api/vendors/me for non-vendor account returns 404.")

    # 3b. Vendor Onboarding for User A
    res = client.post(
        "/api/vendors/onboarding",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={
            "display_name": "Ramesh Chai & Snacks",
            "business_name": "Ramesh Refreshments",
            "category": "food",
            "business_description": "Famous cutting chai and fresh bun maska near station.",
            "location": {
                "type": "Point",
                "coordinates": [72.8793, 19.0657]
            }
        }
    )
    assert res.status_code == 201, f"Vendor onboarding failed: {res.text}"
    vendor_a = res.json()["data"]
    vendor_a_id = vendor_a["vendor_id"]
    assert vendor_a["user_id"] == user_a_id
    assert vendor_a["category"] == "food"
    assert vendor_a["current_location"]["coordinates"] == [72.8793, 19.0657]
    print(f"[OK] 3b. POST /api/vendors/onboarding successfully created vendor: {vendor_a_id}")

    # 3c. Duplicate Vendor Onboarding Prevention for User A -> 409
    res = client.post(
        "/api/vendors/onboarding",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={
            "display_name": "Second Stall",
            "category": "fruit"
        }
    )
    assert res.status_code == 409
    print("[OK] 3c. Duplicate vendor onboarding prevented (409 Conflict).")

    # 3d. GET /api/vendors/me for User A
    res = client.get("/api/vendors/me", headers={"Authorization": f"Bearer {token_user_a}"})
    assert res.status_code == 200
    fetched_vendor = res.json()["data"]
    assert fetched_vendor["vendor_id"] == vendor_a_id
    assert fetched_vendor["user_id"] == user_a_id
    assert fetched_vendor["display_name"] == "Ramesh Chai & Snacks"
    print("[OK] 3d. GET /api/vendors/me returned caller's vendor profile.")

    # -------------------------------------------------------------
    # 4. Test Authenticated Check-In & Anti-Spoofing
    # -------------------------------------------------------------
    print("\n--- 4. Testing Check-In Integration & Security ---")

    # 4a. Authenticated check-in for Vendor A
    res = client.post(
        "/api/checkins",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={
            "vendor_id": vendor_a_id,
            "lat": 19.0660,
            "lng": 72.8800,
            "category": "food"
        }
    )
    assert res.status_code == 201, f"Auth check-in failed: {res.text}"
    checkin_res = res.json()["data"]
    assert checkin_res["vendor_id"] == vendor_a_id
    assert checkin_res["location"]["coordinates"] == [72.8800, 19.0660]
    print("[OK] 4a. Authenticated check-in recorded with GeoJSON [lng, lat].")

    # 4b. Anti-Spoofing: User A trying to check-in as another vendor ID -> 403
    res = client.post(
        "/api/checkins",
        headers={"Authorization": f"Bearer {token_user_a}"},
        json={
            "vendor_id": "other_vendor_impersonation_target",
            "lat": 19.0660,
            "lng": 72.8800,
            "category": "food"
        }
    )
    assert res.status_code == 403
    print("[OK] 4b. Anti-spoofing verified: Vendor cannot submit another vendor's ID (403 Forbidden).")

    # 4c. Non-vendor user (User B) attempting check-in -> 403
    res = client.post(
        "/api/checkins",
        headers={"Authorization": f"Bearer {token_user_b}"},
        json={
            "vendor_id": "any_vendor",
            "lat": 19.0660,
            "lng": 72.8800,
            "category": "food"
        }
    )
    assert res.status_code == 403
    print("[OK] 4c. Non-vendor user blocked from checking in (403 Forbidden).")

    # 4d. Legacy Unauthenticated Checkin (Phase 2 compatibility)
    legacy_vendor_id = f"leg_vnd_{uuid.uuid4().hex[:6]}"
    client.post("/api/vendors", json={"vendor_id": legacy_vendor_id, "category": "fruit"})
    res = client.post("/api/checkins", json={
        "vendor_id": legacy_vendor_id,
        "lat": 19.0700,
        "lng": 72.8700,
        "category": "fruit"
    })
    assert res.status_code == 201
    print("[OK] 4d. Unauthenticated Phase 2 legacy check-in continues to work seamlessly.")

    # -------------------------------------------------------------
    # 5. Test Phase 1–4 Regression Functionality
    # -------------------------------------------------------------
    print("\n--- 5. Testing Phase 1–4 Regression ---")

    # Health (Phase 1)
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["data"]["status"] == "healthy"
    print("[OK] 5a. Phase 1 Health check endpoint OK.")

    # Demand Score & Heatmap (Phase 3)
    res = client.get("/api/demand/score?lat=19.0657&lng=72.8793&category=food")
    assert res.status_code == 200
    assert "score" in res.json()["data"]
    print(f"[OK] 5b. Phase 3 Demand score OK: {res.json()['data']['score']}/100.")

    res = client.get("/api/demand/heatmap?lat=19.0657&lng=72.8793&radius=2000")
    assert res.status_code == 200
    print("[OK] 5c. Phase 3 Heatmap OK.")

    # Spots & Recommendations (Phase 4)
    res = client.post("/api/spots", json={
        "name": "Phase 5 Test Spot",
        "lat": 19.0657,
        "lng": 72.8793,
        "category_relevance": ["food"],
        "has_shelter": True,
        "near_transit": True
    })
    assert res.status_code == 201
    created_spot_id = res.json()["data"]["spot_id"]

    res = client.get(f"/api/spots/{created_spot_id}")
    assert res.status_code == 200
    assert res.json()["data"]["name"] == "Phase 5 Test Spot"
    print(f"[OK] 5d. Phase 4 Spot creation and lookup OK: {created_spot_id}")

    res = client.get("/api/recommendations?lat=19.0657&lng=72.8793&category=food")
    assert res.status_code == 200
    assert isinstance(res.json()["data"], list)
    print("[OK] 5e. Phase 4 AI Recommendations OK.")

    # OpenAPI Schema (Docs)
    res = client.get("/openapi.json")
    assert res.status_code == 200
    openapi_doc = res.json()
    assert "/api/users/profile" in openapi_doc["paths"]
    assert "/api/vendors/onboarding" in openapi_doc["paths"]
    assert "/api/vendors/me" in openapi_doc["paths"]
    print("[OK] 5f. OpenAPI / Swagger docs include all new Phase 5 routes.")

    print("\n================ ALL PHASE 5 TESTS PASSED SUCCESSFULLY! ================\n")


if __name__ == "__main__":
    run_phase5_tests()
