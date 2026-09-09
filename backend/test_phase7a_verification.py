"""
test_phase7a_verification.py - Verification suite for Phase 7A: Crowdsourced + Municipal Alerts
"""
import os
import sys
import time
from datetime import datetime, timezone, timedelta
import jwt
from fastapi.testclient import TestClient
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("backend/.env")

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath("."))
try:
    from backend.main import app
    from backend.db import get_database, init_db_indexes
except ImportError:
    from main import app
    from db import get_database, init_db_indexes

client = TestClient(app)
db = get_database()

JWT_SECRET = "test_phase7a_secret"

def make_token(user_id: str, email: str = "test@example.com") -> str:
    return jwt.encode(
        {"sub": user_id, "email": email, "role": "authenticated"},
        JWT_SECRET,
        algorithm="HS256"
    )

def run_phase7a_tests():
    print("==================================================")
    print("STARTING PHASE 7A: CROWDSOURCED + MUNICIPAL ALERTS VERIFICATION")
    print("==================================================")

    init_db_indexes(db)
    # Clean test alerts
    db.alerts.delete_many({"message": {"$regex": ".*(test|Test|evening|commuter|spot|van).*"}})

    vendor_user_id = f"usr_vnd_alert_{int(time.time())}"
    vendor_token = make_token(vendor_user_id, "vendor_alert@example.com")
    vendor_headers = {"Authorization": f"Bearer {vendor_token}", "Content-Type": "application/json"}

    user_user_id = f"usr_csm_alert_{int(time.time())}"
    user_token = make_token(user_user_id, "user_alert@example.com")
    user_headers = {"Authorization": f"Bearer {user_token}", "Content-Type": "application/json"}

    user2_id = f"usr_csm2_alert_{int(time.time())}"
    user2_token = make_token(user2_id, "user2_alert@example.com")
    user2_headers = {"Authorization": f"Bearer {user2_token}", "Content-Type": "application/json"}

    # Onboard Vendor
    client.post("/api/vendors/onboarding", headers=vendor_headers, json={
        "display_name": "Alert Test Vendor",
        "business_name": "Alert Vendor Stall",
        "category": "food"
    })

    # --- TEST 1: Create Crowd Alert using GPS ---
    print("\n--- TEST 1: Vendor creates Crowd Alert ---")
    crowd_payload = {
        "alert_type": "crowd",
        "lat": 19.0760,
        "lng": 72.8777,
        "message": "Heavy evening commuter crowd gathering near east exit"
    }
    res = client.post("/api/alerts", headers=vendor_headers, json=crowd_payload)
    print(f"Create Crowd Alert status: {res.status_code}")
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    alert_1 = res.json()["data"]
    alert_1_id = alert_1["alert_id"]
    assert alert_1["location"]["coordinates"] == [72.8777, 19.0760]  # [lng, lat]
    assert alert_1["confirmations"] == 1
    assert alert_1["status"] == "active"
    print(f"[OK] TEST 1 PASSED: Alert created with ID {alert_1_id} and GeoJSON coordinates [72.8777, 19.0760].")

    # --- TEST 2: User at nearby location sees the real Crowd alert ---
    print("\n--- TEST 2: User discovery of nearby alert ---")
    res_nearby = client.get(
        "/api/alerts/nearby?lat=19.0765&lng=72.8780&radius=1000",
        headers=user_headers
    )
    print(f"Nearby Alerts status: {res_nearby.status_code}")
    assert res_nearby.status_code == 200
    alerts_found = res_nearby.json()["data"]
    matched = next((a for a in alerts_found if a["alert_id"] == alert_1_id), None)
    assert matched is not None, f"Alert {alert_1_id} not found in nearby alerts!"
    print(f"[OK] TEST 2 PASSED: Alert discovered at distance {matched['distance_meters']}m.")

    # --- TEST 3: User confirms alert -> duplicate confirmation rejected ---
    print("\n--- TEST 3: Alert confirmation and anti-duplicate check ---")
    res_conf = client.post(f"/api/alerts/{alert_1_id}/confirm", headers=user_headers)
    print(f"First Confirmation status: {res_conf.status_code}")
    assert res_conf.status_code == 200
    updated_alert = res_conf.json()["data"]
    assert updated_alert["confirmations"] == 2

    # Duplicate confirmation attempt by same user
    res_conf_dup = client.post(f"/api/alerts/{alert_1_id}/confirm", headers=user_headers)
    print(f"Duplicate Confirmation status: {res_conf_dup.status_code}")
    assert res_conf_dup.status_code == 409
    print("[OK] TEST 3 PASSED: Confirmation incremented and duplicate confirmation rejected with 409.")

    # --- TEST 4: Deduplication within 100m and 5 minutes ---
    print("\n--- TEST 4: Alert Deduplication (100m / 5min) ---")
    duplicate_payload = {
        "alert_type": "crowd",
        "lat": 19.0762,  # ~30 meters away
        "lng": 72.8778,
        "message": "Another crowd report at same spot"
    }
    res_dup = client.post("/api/alerts", headers=user_headers, json=duplicate_payload)
    print(f"Duplicate alert create status: {res_dup.status_code} ({res_dup.json().get('detail')})")
    assert res_dup.status_code == 409, f"Expected 409 Conflict for duplicate, got {res_dup.status_code}"
    print("[OK] TEST 4 PASSED: Duplicate alert within 100m/5min rejected with 409 Conflict.")

    # --- TEST 5: Alert created > 100m away succeeds ---
    print("\n--- TEST 5: Alert created > 100m away succeeds ---")
    far_payload = {
        "alert_type": "spot_free",
        "lat": 19.0850,  # ~1000m away
        "lng": 72.8850,
        "message": "Open shaded spot available near north gate"
    }
    res_far = client.post("/api/alerts", headers=user_headers, json=far_payload)
    print(f"Far alert create status: {res_far.status_code}")
    assert res_far.status_code == 201
    print(f"[OK] TEST 5 PASSED: Far alert created successfully: {res_far.json()['data']['alert_id']}")

    # --- TEST 6: Municipal Check Confirmation Rule ---
    print("\n--- TEST 6: Municipal Alert 2-confirmation rule ---")
    muni_payload = {
        "alert_type": "municipal_check",
        "lat": 19.0770,
        "lng": 72.8790,
        "message": "Municipal van spotted checking vendor licenses"
    }
    res_muni = client.post("/api/alerts", headers=vendor_headers, json=muni_payload)
    assert res_muni.status_code == 201
    muni_alert_id = res_muni.json()["data"]["alert_id"]

    # Other user checks nearby alerts: municipal alert should NOT be widely surfaced yet (only 1 confirmation)
    res_muni_check1 = client.get(
        "/api/alerts/nearby?lat=19.0770&lng=72.8790&radius=2000",
        headers=user_headers
    )
    unverified_found = next((a for a in res_muni_check1.json()["data"] if a["alert_id"] == muni_alert_id), None)
    assert unverified_found is None, "Municipal alert with 1 confirmation was surfaced widely!"
    print("[OK] 6a. Municipal alert with 1 confirmation is NOT widely surfaced to other users.")

    # Second user confirms municipal alert
    res_muni_conf = client.post(f"/api/alerts/{muni_alert_id}/confirm", headers=user_headers)
    assert res_muni_conf.status_code == 200
    assert res_muni_conf.json()["data"]["confirmations"] == 2

    # Now third user checks: municipal alert IS now surfaced widely (2 confirmations)
    res_muni_check2 = client.get(
        "/api/alerts/nearby?lat=19.0770&lng=72.8790&radius=2000",
        headers=user2_headers
    )
    verified_found = next((a for a in res_muni_check2.json()["data"] if a["alert_id"] == muni_alert_id), None)
    assert verified_found is not None, "Municipal alert with 2 confirmations was NOT surfaced!"
    assert verified_found["widely_surfaced"] is True
    print("[OK] 6b. Municipal alert with 2 confirmations is now widely surfaced.")

    # --- TEST 7: Expired alert is not returned ---
    print("\n--- TEST 7: Expired alert filtering ---")
    from bson import ObjectId
    expired_time = (datetime.now(timezone.utc) - timedelta(minutes=10)).isoformat()
    db.alerts.update_one({"_id": ObjectId(alert_1_id)}, {"$set": {"expires_at": expired_time}})

    res_expired_check = client.get(
        "/api/alerts/nearby?lat=19.0765&lng=72.8780&radius=2000",
        headers=user_headers
    )
    expired_found = next((a for a in res_expired_check.json()["data"] if a["alert_id"] == alert_1_id), None)
    assert expired_found is None, "Expired alert was returned in GET /api/alerts/nearby!"
    print("[OK] TEST 7 PASSED: Expired alert correctly excluded from active feed.")

    # --- TEST 8: Alert flagging & moderation ---
    print("\n--- TEST 8: Alert Flagging ---")
    res_flag = client.post(f"/api/alerts/{muni_alert_id}/flag", headers=user2_headers)
    print(f"Flag status: {res_flag.status_code}")
    assert res_flag.status_code == 200
    assert res_flag.json()["data"]["flags"] == 1

    # Duplicate flag attempt
    res_flag_dup = client.post(f"/api/alerts/{muni_alert_id}/flag", headers=user2_headers)
    assert res_flag_dup.status_code == 409
    print("[OK] TEST 8 PASSED: Alert flagged and duplicate flag prevented.")

    # --- TEST 9: Unauthenticated caller blocked from creating / confirming ---
    print("\n--- TEST 9: Authentication Security Guard ---")
    res_no_auth_create = client.post("/api/alerts", json=crowd_payload)
    assert res_no_auth_create.status_code == 401
    res_no_auth_conf = client.post(f"/api/alerts/{muni_alert_id}/confirm")
    assert res_no_auth_conf.status_code == 401
    print("[OK] TEST 9 PASSED: Unauthenticated create and confirm strictly return 401 Unauthorized.")

    print("\n==================================================")
    print("ALL PHASE 7A ALERTS VERIFICATION TESTS PASSED (100% GREEN)")
    print("==================================================")

if __name__ == "__main__":
    run_phase7a_tests()
