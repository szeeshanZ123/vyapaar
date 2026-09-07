import math
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from pymongo.database import Database


def _haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculates great-circle distance between two points in meters using the Haversine formula.
    """
    earth_radius_meters = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    )
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return earth_radius_meters * c


def _parse_iso_datetime(dt_str: str) -> datetime:
    """
    Safely parses an ISO 8601 formatted datetime string into a UTC datetime object.
    """
    try:
        clean_str = dt_str.replace("Z", "+00:00")
        dt = datetime.fromisoformat(clean_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt
    except Exception:
        return datetime.now(timezone.utc)


def _get_demand_level(score: int) -> str:
    """Returns human-readable demand level for a 0-100 score."""
    if score >= 80:
        return "Very High"
    if score >= 60:
        return "High"
    if score >= 30:
        return "Moderate"
    if score > 0:
        return "Low"
    return "None"


def calculate_demand_score(
    db: Database,
    lat: float,
    lng: float,
    category: Optional[str] = None,
    radius_meters: float = 1000.0
) -> Dict[str, Any]:
    """
    Calculates a 0–100 Footfall/Demand Score around a target location using:
    - 2dsphere MongoDB geospatial query ($near on check_ins.location)
    - Exponential recency decay (24-hour half-life)
    - Category relevance weighting (full weight for match, partial for general footfall)
    - Distance proximity weighting (closer check-ins carry higher weight)
    - Bounded saturation normalization to [0, 100]
    """
    query: Dict[str, Any] = {
        "location": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "$maxDistance": radius_meters
            }
        }
    }

    cursor = db.check_ins.find(query)
    checkins = list(cursor)

    total_checkins = len(checkins)
    matching_category_checkins = 0
    now_utc = datetime.now(timezone.utc)

    if total_checkins == 0:
        return {
            "score": 0,
            "demand_level": "None",
            "total_checkins": 0,
            "matching_category_checkins": 0,
            "radius_meters": radius_meters,
            "category": category,
            "coordinates": [lng, lat]
        }

    total_weighted_demand = 0.0

    for doc in checkins:
        # 1. Recency Decay (Exponential half-life = 24 hours)
        dt = _parse_iso_datetime(doc.get("checked_in_at", ""))
        age_hours = max(0.0, (now_utc - dt).total_seconds() / 3600.0)
        # Weight drops by half every 24 hours
        w_recency = 0.5 ** (age_hours / 24.0)

        # 2. Category Relevance
        doc_category = doc.get("category", "")
        if category:
            if doc_category.lower() == category.lower():
                w_category = 1.0
                matching_category_checkins += 1
            else:
                # Other category check-ins still indicate general footfall / pedestrian flow
                w_category = 0.35
        else:
            w_category = 1.0
            matching_category_checkins += 1

        # 3. Distance Proximity
        coords = doc.get("location", {}).get("coordinates", [lng, lat])
        c_lng, c_lat = coords[0], coords[1]
        dist_m = _haversine_distance(lat, lng, c_lat, c_lng)
        # Smooth spatial decay within search radius
        w_distance = max(0.2, 1.0 - 0.5 * (min(dist_m, radius_meters) / radius_meters))

        # Combined weight for this check-in
        total_weighted_demand += w_recency * w_category * w_distance

    # 4. Score Normalization to [0, 100] via smooth diminishing returns curve
    # At W = 4 (approx 4 recent checkins), score reaches ~63; at W = 8, ~86; at W >= 16, ~98-100
    normalized_score = int(round(100.0 * (1.0 - math.exp(-total_weighted_demand / 4.0))))
    score = max(0, min(100, normalized_score))

    return {
        "score": score,
        "demand_level": _get_demand_level(score),
        "total_checkins": total_checkins,
        "matching_category_checkins": matching_category_checkins,
        "radius_meters": radius_meters,
        "category": category,
        "coordinates": [lng, lat]
    }


def generate_demand_heatmap(
    db: Database,
    lat: float,
    lng: float,
    radius_meters: float = 5000.0
) -> Dict[str, Any]:
    """
    Generates geospatial demand heatmap data within a given radius:
    - Finds recent check-ins using MongoDB 2dsphere index
    - Groups check-ins geographically into clusters (~100m grid cells)
    - Calculates cluster demand score and Leaflet-compatible intensity [0.0 - 1.0]
    - Returns GeoJSON coordinates [longitude, latitude]
    """
    query: Dict[str, Any] = {
        "location": {
            "$near": {
                "$geometry": {
                    "type": "Point",
                    "coordinates": [lng, lat]
                },
                "$maxDistance": radius_meters
            }
        }
    }

    cursor = db.check_ins.find(query)
    checkins = list(cursor)

    if not checkins:
        return {
            "points": [],
            "total_points": 0,
            "radius_meters": radius_meters
        }

    # Group check-ins by geographic coordinate grid cell (~100m resolution -> 3 decimal places)
    clusters: Dict[tuple, List[Dict[str, Any]]] = {}
    now_utc = datetime.now(timezone.utc)

    for doc in checkins:
        coords = doc.get("location", {}).get("coordinates", [])
        if len(coords) == 2:
            c_lng, c_lat = coords[0], coords[1]
            # Grid key: (round_lat, round_lng)
            grid_key = (round(c_lat, 3), round(c_lng, 3))
            if grid_key not in clusters:
                clusters[grid_key] = []
            clusters[grid_key].append(doc)

    points = []
    for (grid_lat, grid_lng), cluster_docs in clusters.items():
        cluster_weighted_demand = 0.0
        for doc in cluster_docs:
            dt = _parse_iso_datetime(doc.get("checked_in_at", ""))
            age_hours = max(0.0, (now_utc - dt).total_seconds() / 3600.0)
            w_recency = 0.5 ** (age_hours / 24.0)
            cluster_weighted_demand += w_recency

        cluster_score = int(round(100.0 * (1.0 - math.exp(-cluster_weighted_demand / 4.0))))
        cluster_score = max(0, min(100, cluster_score))
        intensity = round(cluster_score / 100.0, 2)

        points.append({
            "coordinates": [grid_lng, grid_lat],  # Strictly [longitude, latitude] GeoJSON format
            "lat": grid_lat,
            "lng": grid_lng,
            "score": cluster_score,
            "intensity": intensity,
            "checkin_count": len(cluster_docs)
        })

    # Sort hotspots by score descending
    points.sort(key=lambda p: p["score"], reverse=True)

    return {
        "points": points,
        "total_points": len(points),
        "radius_meters": radius_meters
    }
