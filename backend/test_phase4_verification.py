import sys
from pathlib import Path

# Add backend directory to sys.path
BASE_DIR = Path(__file__).resolve().parent
ROOT_DIR = BASE_DIR.parent
for p in [str(ROOT_DIR), str(BASE_DIR)]:
    if p not in sys.path:
        sys.path.insert(0, p)

from fastapi.testclient import TestClient
from backend.main import app
from backend.db import get_database

def run_tests():
    client = TestClient(app)
    db = get_database()

    print("================ PHASE 4 BACKEND VERIFICATION ================")

    # 1. Test Health Endpoint (Phase 1)
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health_body = res.json()
    assert health_body.get("data", {}).get("status") == "healthy"
    print("[OK] 1. Health check endpoint (Phase 1) verified.")

    # 2. Test Vendor Registration & Checkin (Phase 2)
    test_vendor_id = "test_vendor_phase4_demo"
    res = client.post("/api/vendors", json={
        "vendor_id": test_vendor_id,
        "display_name": "Phase 4 Test Vendor",
        "category": "food"
    })
    assert res.status_code in [201, 409]
    print("[OK] 2. Vendor registration (Phase 2) verified.")

    # Checkin at Connaught Place Central (28.6315, 77.2167)
    res = client.post("/api/checkins", json={
        "vendor_id": test_vendor_id,
        "lat": 28.6315,
        "lng": 77.2167,
        "category": "food"
    })
    assert res.status_code == 201
    checkin_data = res.json()["data"]
    assert checkin_data["location"]["coordinates"] == [77.2167, 28.6315]
    print("[OK] 3. Vendor check-in (Phase 2) verified with GeoJSON [lng, lat].")

    # 3. Test Demand Score & Heatmap (Phase 3)
    res = client.get("/api/demand/score?lat=28.6315&lng=77.2167&category=food&radius=1000")
    assert res.status_code == 200
    demand_data = res.json()["data"]
    assert "score" in demand_data
    assert demand_data["score"] > 0
    print(f"[OK] 4. Demand Score calculation (Phase 3) verified: {demand_data['score']}/100.")

    # 4. Test Spot Creation (Phase 4)
    # Spot A: High demand spot near CP (28.6320, 77.2170), matches food, shelter, near transit
    res = client.post("/api/spots", json={
        "name": "CP Inner Circle Food Corner",
        "lat": 28.6320,
        "lng": 77.2170,
        "category_relevance": ["food", "fruit"],
        "has_shelter": True,
        "near_transit": True
    })
    assert res.status_code == 201
    spot_a = res.json()["data"]
    spot_a_id = spot_a["spot_id"]
    assert spot_a["location"]["coordinates"] == [77.2170, 28.6320]
    assert spot_a["has_shelter"] is True
    assert spot_a["near_transit"] is True
    print(f"[OK] 5. POST /api/spots created spot with GeoJSON [lng, lat]: {spot_a_id}")

    # Spot B: Moderate distance spot (28.6380, 77.2200), clothing category, no shelter
    res = client.post("/api/spots", json={
        "name": "Janpath Apparel Lane",
        "location": {
            "type": "Point",
            "coordinates": [77.2200, 28.6380]
        },
        "category_relevance": ["clothing"],
        "has_shelter": False,
        "near_transit": False
    })
    assert res.status_code == 201
    spot_b = res.json()["data"]
    spot_b_id = spot_b["spot_id"]
    print(f"[OK] 6. POST /api/spots with explicit GeoJSON location created: {spot_b_id}")

    # 5. Test GET /api/spots/{id} (Phase 4)
    res = client.get(f"/api/spots/{spot_a_id}")
    assert res.status_code == 200
    fetched_spot = res.json()["data"]
    assert fetched_spot["name"] == "CP Inner Circle Food Corner"
    assert fetched_spot["location"]["coordinates"] == [77.2170, 28.6320]
    print("[OK] 7. GET /api/spots/{id} verified.")

    # 6. Test GET /api/spots/{id} with invalid ID -> 404
    res = client.get("/api/spots/507f1f77bcf86cd799439011")
    assert res.status_code == 404
    print("[OK] 8. GET /api/spots/{id} 404 handling verified.")

    # 7. Test GET /api/recommendations (Phase 4)
    res = client.get(f"/api/recommendations?lat=28.6315&lng=77.2167&category=food&radius=5000&limit=5")
    assert res.status_code == 200
    recs_envelope = res.json()
    assert recs_envelope["error"] is None
    assert "timestamp" in recs_envelope["meta"]
    recommendations = recs_envelope["data"]
    assert len(recommendations) > 0
    print(f"[OK] 9. GET /api/recommendations returned {len(recommendations)} ranked spots.")

    top_rec = recommendations[0]
    print(f"   Top recommended spot: '{top_rec['spot_name']}'")
    print(f"   Recommendation Score: {top_rec['recommendation_score']}/100")
    print(f"   Demand Score: {top_rec['demand_score']}")
    print(f"   Distance: {top_rec['distance']} meters")
    print(f"   Category Relevance: {top_rec['category_relevance']}")
    print(f"   Has Shelter: {top_rec['has_shelter']}, Near Transit: {top_rec['near_transit']}")

    assert "spot_id" in top_rec
    assert "spot_name" in top_rec
    assert "location" in top_rec
    assert "demand_score" in top_rec
    assert "recommendation_score" in top_rec
    assert "distance" in top_rec
    assert "has_shelter" in top_rec
    assert "near_transit" in top_rec

    # Verify ranked order
    scores = [r["recommendation_score"] for r in recommendations]
    assert scores == sorted(scores, reverse=True), "Recommendations must be sorted descending by recommendation_score"
    print("[OK] 10. Recommendations ranking order verified.")

    # 8. Test Validation & Error cases
    # Invalid lat
    res = client.get("/api/recommendations?lat=95.0&lng=77.2167")
    assert res.status_code in [400, 422]
    # Invalid lng
    res = client.get("/api/recommendations?lat=28.0&lng=190.0")
    assert res.status_code in [400, 422]
    # Invalid radius <= 0
    res = client.get("/api/recommendations?lat=28.0&lng=77.0&radius=0")
    assert res.status_code in [400, 422]
    # Invalid limit <= 0
    res = client.get("/api/recommendations?lat=28.0&lng=77.0&limit=0")
    assert res.status_code in [400, 422]
    # Invalid category
    res = client.get("/api/recommendations?lat=28.0&lng=77.0&category=spaceship_parts")
    assert res.status_code == 400
    print("[OK] 11. Parameter validation & error responses verified.")

    # No nearby spots
    res = client.get("/api/recommendations?lat=0.0&lng=0.0&radius=100")
    assert res.status_code == 200
    empty_data = res.json()["data"]
    assert empty_data == []
    print("[OK] 12. Empty nearby spots returned as empty array verified.")

    # 9. Test Swagger OpenAPI schema contains new endpoints
    res = client.get("/openapi.json")
    assert res.status_code == 200
    schema = res.json()
    paths = schema.get("paths", {})
    assert "/api/spots" in paths
    assert "/api/spots/{id}" in paths
    assert "/api/recommendations" in paths
    assert "/api/demand/score" in paths
    assert "/api/demand/heatmap" in paths
    assert "/api/vendors" in paths
    assert "/api/checkins" in paths
    assert "/health" in paths
    print("[OK] 13. OpenAPI schema contains all Phase 1-4 endpoints.")

    print("\nALL PHASE 4 BACKEND VERIFICATION TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
