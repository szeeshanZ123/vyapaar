import math
from typing import Any, Dict, List, Optional
from pymongo.database import Database

try:
    from backend.crud.spots import get_nearby_spots
    from backend.engines.demand import calculate_demand_score, _haversine_distance
except ImportError:
    from crud.spots import get_nearby_spots
    from engines.demand import calculate_demand_score, _haversine_distance


def get_recommendations(
    db: Database,
    lat: float,
    lng: float,
    category: Optional[str] = None,
    radius_meters: float = 5000.0,
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Evaluates and ranks nearby spots for a vendor based on:
    - Phase 3 Demand Score (footfall & check-in activity at the spot)
    - Distance proximity penalty (closer spots score higher)
    - Category relevance matching
    - Weather shelter availability bonus
    - Public transit proximity bonus

    Returns a ranked list of top recommended spots.
    """
    # 1. Find nearby candidate spots
    nearby_spots = get_nearby_spots(db, lat=lat, lng=lng, radius_meters=radius_meters)
    if not nearby_spots:
        return []

    recommendations: List[Dict[str, Any]] = []

    for spot in nearby_spots:
        coords = spot.get("location", {}).get("coordinates", [])
        if len(coords) != 2:
            continue

        spot_lng, spot_lat = coords[0], coords[1]

        # 2. Distance calculation (vendor location to spot)
        dist_m = _haversine_distance(lat, lng, spot_lat, spot_lng)

        # 3. Calculate demand score at this spot location using Phase 3 Demand Engine
        demand_data = calculate_demand_score(
            db=db,
            lat=spot_lat,
            lng=spot_lng,
            category=category,
            radius_meters=1000.0  # 1km catchment area around spot for demand
        )
        demand_score = demand_data.get("score", 0)

        # 4. Recommendation Scoring Formula (0 to 100 points)
        # Component A: Demand Score (0 to 50 pts)
        demand_pts = 0.50 * demand_score

        # Component B: Proximity Score (0 to 30 pts)
        # Smooth linear decay over radius
        proximity_ratio = max(0.0, 1.0 - (dist_m / max(radius_meters, 1.0)))
        proximity_pts = 30.0 * proximity_ratio

        # Component C: Category Relevance (0 to 10 pts)
        cat_rel = spot.get("category_relevance", [])
        if isinstance(cat_rel, str):
            cat_rel_list = [cat_rel.lower()]
        elif isinstance(cat_rel, list):
            cat_rel_list = [str(c).lower() for c in cat_rel]
        else:
            cat_rel_list = []

        if category:
            cat_lower = category.lower()
            if cat_lower in cat_rel_list or not cat_rel_list:
                cat_pts = 10.0
            else:
                cat_pts = 2.0  # Slight score for diverse category footfall
        else:
            cat_pts = 10.0  # Full category points when no filter specified

        # Component D: Shelter Bonus (0 or 5 pts)
        has_shelter = bool(spot.get("has_shelter", False))
        shelter_pts = 5.0 if has_shelter else 0.0

        # Component E: Transit Proximity Bonus (0 or 5 pts)
        near_transit = bool(spot.get("near_transit", False))
        transit_pts = 5.0 if near_transit else 0.0

        # Total Recommendation Score (bounded 0 to 100)
        raw_score = demand_pts + proximity_pts + cat_pts + shelter_pts + transit_pts
        recommendation_score = int(round(max(0.0, min(100.0, raw_score))))

        recommendations.append({
            "spot_id": spot.get("spot_id", ""),
            "id": spot.get("spot_id", ""),
            "spot_name": spot.get("name", "Unknown Spot"),
            "name": spot.get("name", "Unknown Spot"),
            "location": spot.get("location"),
            "demand_score": demand_score,
            "demand_level": demand_data.get("demand_level", "None"),
            "recommendation_score": recommendation_score,
            "distance": round(dist_m, 1),
            "distance_meters": round(dist_m, 1),
            "category_relevance": spot.get("category_relevance", []),
            "has_shelter": has_shelter,
            "near_transit": near_transit
        })

    # 5. Rank spots by recommendation_score descending (and distance ascending as tiebreaker)
    recommendations.sort(key=lambda r: (r["recommendation_score"], -r["distance"]), reverse=True)

    return recommendations[:limit]
