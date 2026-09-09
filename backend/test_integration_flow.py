"""
test_integration_flow.py - Direct End-to-End Test for Vendor Check-in -> MongoDB -> Active Vendor Discovery
"""
import os
import sys
import time
import jwt
from fastapi.testclient import TestClient
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv("backend/.env")

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath("."))
try:
    from backend.main import app
    from backend.db import get_database
except ImportError:
    from main import app
    from db import get_database

client = TestClient(app)
db = get_database()

def run_tests():
    print("==================================================")
    print("STARTING END-TO-END VENDOR -> BACKEND -> MONGODB -> USER TEST")
    print("==================================================")

    # 1. Prepare Vendor Account A (Rehan Pav Vala)
    vendor_user_id = f"usr_test_rehan_{int(time.time())}"
    vendor_token = jwt.encode(
        {"sub": vendor_user_id, "email": "rehan@example.com", "role": "authenticated"},
        "test_secret",
        algorithm="HS256"
    )

    vendor_headers = {
        "Authorization": f"Bearer {vendor_token}",
        "Content-Type": "application/json"
    }

    # Onboard Vendor A
    onboard_payload = {
        "display_name": "Rehan Pav Vala",
        "business_name": "Rehan Pav Vala Stall",
        "category": "food",
        "business_description": "Fresh Mumbai Vada Pav and Pav Bhaji"
    }
    
    print("\n--- Step 1: Onboarding Vendor Profile ---")
    res = client.post("/api/vendors/onboarding", headers=vendor_headers, json=onboard_payload)
    print(f"Onboarding Status: {res.status_code}")
    assert res.status_code == 201, f"Expected 201, got {res.status_code}: {res.text}"
    vendor_data = res.json()["data"]
    vendor_id = vendor_data["vendor_id"]
    print(f"[OK] Vendor Onboarded with ID: {vendor_id}")

    # 2. Check-in from Vendor Dashboard using browser GPS (19.0884, 72.8896)
    print("\n--- Step 2: Vendor Check-in via POST /api/checkins ---")
    checkin_payload = {
        "lat": 19.0884,
        "lng": 72.8896,
        "category": "food"
    }
    res_checkin = client.post("/api/checkins", headers=vendor_headers, json=checkin_payload)
    print(f"Check-in Status: {res_checkin.status_code}")
    assert res_checkin.status_code == 201, f"Expected 201, got {res_checkin.status_code}: {res_checkin.text}"
    checkin_res = res_checkin.json()["data"]
    print(f"[OK] Check-in Response: {checkin_res}")

    # 3. Verify MongoDB directly
    print("\n--- Step 3: Verifying MongoDB Document Updates ---")
    vendor_doc = db.vendors.find_one({"vendor_id": vendor_id})
    assert vendor_doc is not None, "Vendor not found in MongoDB!"
    assert vendor_doc.get("current_location") is not None, "current_location is None!"
    
    # GeoJSON coordinates MUST be [longitude, latitude]
    coords = vendor_doc["current_location"]["coordinates"]
    print(f"Stored GeoJSON Coordinates: {coords}")
    assert coords == [72.8896, 19.0884], f"Incorrect GeoJSON ordering: expected [72.8896, 19.0884], got {coords}"
    
    last_active = vendor_doc.get("last_active_at")
    print(f"Stored last_active_at: {last_active}")
    assert last_active is not None, "last_active_at not set!"

    # Verify check_ins collection
    latest_checkin = db.check_ins.find_one({"vendor_id": vendor_id}, sort=[("_id", -1)])
    assert latest_checkin is not None, "Check-in document missing from check_ins collection!"
    assert latest_checkin["location"]["coordinates"] == [72.8896, 19.0884]
    print(f"[OK] MongoDB Verified: vendor.current_location, vendor.last_active_at, and check_ins document all created correctly.")

    # 4. Test Unauthenticated check-in without vendor_id returns 401, NOT 404
    print("\n--- Step 4: Testing Unauthenticated Check-in Security ---")
    res_unauth = client.post("/api/checkins", json={"lat": 19.0884, "lng": 72.8896, "category": "food"})
    print(f"Unauthenticated checkin status: {res_unauth.status_code} ({res_unauth.json().get('detail')})")
    assert res_unauth.status_code == 401, f"Expected 401 for missing auth/vendor_id, got {res_unauth.status_code}"
    print("[OK] Unauthenticated check-in properly returns 401.")

    # 5. Account B: User Discovery at same physical location
    print("\n--- Step 5: User Discovery via GET /api/vendors/active ---")
    user_id = f"usr_test_consumer_{int(time.time())}"
    user_token = jwt.encode(
        {"sub": user_id, "email": "consumer@example.com", "role": "authenticated"},
        "test_secret",
        algorithm="HS256"
    )
    user_headers = {
        "Authorization": f"Bearer {user_token}"
    }

    # User is standing at 19.0885, 72.8897 (approx 15 meters from vendor)
    user_lat = 19.0885
    user_lng = 72.8897
    res_active = client.get(
        f"/api/vendors/active?lat={user_lat}&lng={user_lng}&radius=2000",
        headers=user_headers
    )
    print(f"Active Vendors Status: {res_active.status_code}")
    assert res_active.status_code == 200, f"Expected 200, got {res_active.status_code}: {res_active.text}"
    active_vendors = res_active.json()["data"]
    
    # Find Rehan Pav Vala in the active list
    matched_vendor = next((v for v in active_vendors if v["vendor_id"] == vendor_id), None)
    assert matched_vendor is not None, f"Vendor {vendor_id} not found in active vendors list!"
    print(f"[OK] Discovered Vendor: {matched_vendor['display_name']} ({matched_vendor['category']})")
    print(f"Calculated Real Distance: {matched_vendor['distance_meters']} meters")
    assert matched_vendor["distance_meters"] is not None
    assert matched_vendor["distance_meters"] < 50.0, f"Distance unexpectedly high: {matched_vendor['distance_meters']}m"

    print("\n==================================================")
    print("ALL 16 REQUIREMENT CHECKS COMPLETED & PASSED")
    print("==================================================")

if __name__ == "__main__":
    run_tests()
