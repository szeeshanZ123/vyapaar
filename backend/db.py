
import logging
import os
from typing import Any, Dict, Optional
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING, GEOSPHERE
from pymongo.database import Database
from pymongo.errors import ConnectionFailure, PyMongoError

from pathlib import Path

# Load environment variables from backend/.env or root .env
env_file = Path(__file__).resolve().parent / ".env"
if env_file.exists():
    load_dotenv(dotenv_path=env_file)
else:
    load_dotenv()

logger = logging.getLogger("vyapar.db")

# Read database configuration
MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
DATABASE_NAME: str = os.getenv("DATABASE_NAME", "vyapar")

# Global reusable client instance
_client: Optional[MongoClient] = None


def get_client() -> MongoClient:
    """
    Get or initialize a reusable PyMongo MongoClient instance.
    """
    global _client
    if _client is None:
        uri = os.getenv("MONGO_URI", "mongodb://localhost:27017")
        # Ensure fallback if empty string was provided in .env
        if not uri.strip():
            uri = "mongodb://localhost:27017"
        
        _client = MongoClient(
            uri,
            serverSelectionTimeoutMS=2000,  # 2 second timeout for connection checks
            connectTimeoutMS=2000
        )
    return _client


def get_database(db_name: Optional[str] = None) -> Database:
    """
    Get the PyMongo Database instance.
    """
    client = get_client()
    target_db_name = db_name or os.getenv("DATABASE_NAME", "vyapar") or "vyapar"
    return client[target_db_name]


def ping_database() -> Dict[str, Any]:
    """
    Verifies the MongoDB connection by issuing a ping command.
    Returns status dictionary indicating connectivity.
    """
    try:
        client = get_client()
        # Ping the admin database to verify server connectivity
        result = client.admin.command("ping")
        return {
            "status": "connected",
            "database": os.getenv("DATABASE_NAME", "vyapar") or "vyapar",
            "ping": result.get("ok", 1) == 1
        }
    except (ConnectionFailure, PyMongoError, Exception) as e:
        logger.warning(f"MongoDB ping check failed: {e}")
        return {
            "status": "disconnected",
            "database": os.getenv("DATABASE_NAME", "vyapar") or "vyapar",
            "error": str(e)
        }


def init_db_indexes(db: Optional[Database] = None) -> Dict[str, Any]:
    """
    Initialize all required indexes for Phase 1 collections:
    - 2dsphere indexes for location-based queries
    - Unique and compound indexes for identity and relational integrity
    """
    target_db = db if db is not None else get_database()
    results = {}

    try:
        # 1. Vendors collection
        # - Unique vendor identifier
        # - Unique user_id (sparse to allow legacy vendors without user_id)
        # - 2dsphere index on current_location for spatial proximity
        target_db.vendors.create_index([("vendor_id", ASCENDING)], unique=True)
        target_db.vendors.create_index([("user_id", ASCENDING)], unique=True, sparse=True)
        target_db.vendors.create_index([("current_location", GEOSPHERE)])
        results["vendors"] = ["vendor_id (unique)", "user_id (unique, sparse)", "current_location (2dsphere)"]

        # 2. Users collection (Phase 5)
        # - Unique user_id (Supabase authenticated user ID)
        target_db.users.create_index([("user_id", ASCENDING)], unique=True)
        results["users"] = ["user_id (unique)"]

        # 3. Check-ins collection
        # - 2dsphere index on location
        # - Compound index on category + checked_in_at for time-filtered category queries
        target_db.check_ins.create_index([("location", GEOSPHERE)])
        target_db.check_ins.create_index([("category", ASCENDING), ("checked_in_at", DESCENDING)])
        results["check_ins"] = ["location (2dsphere)", "category + checked_in_at"]

        # 4. Alerts collection
        # - 2dsphere index on location
        # - Alert expiration index on expires_at
        # - Alert type index on alert_type
        target_db.alerts.create_index([("location", GEOSPHERE)])
        target_db.alerts.create_index([("expires_at", ASCENDING)])
        target_db.alerts.create_index([("alert_type", ASCENDING)])
        results["alerts"] = ["location (2dsphere)", "expires_at", "alert_type"]

        # 5. Alert Confirmations collection
        # - Unique compound index on (alert_id, user_id) to prevent duplicate confirmations
        target_db.alert_confirmations.create_index(
            [("alert_id", ASCENDING), ("user_id", ASCENDING)],
            unique=True
        )
        results["alert_confirmations"] = ["(alert_id, user_id) (unique compound)"]

        # 5b. Alert Flags collection
        # - Unique compound index on (alert_id, user_id) to prevent duplicate flags
        target_db.alert_flags.create_index(
            [("alert_id", ASCENDING), ("user_id", ASCENDING)],
            unique=True
        )
        results["alert_flags"] = ["(alert_id, user_id) (unique compound)"]

        # 6. Spots collection
        # - 2dsphere index on location
        target_db.spots.create_index([("location", GEOSPHERE)])
        results["spots"] = ["location (2dsphere)"]

        # 7. Events collection
        # - 2dsphere index on location
        target_db.events.create_index([("location", GEOSPHERE)])
        results["events"] = ["location (2dsphere)"]

        # 8. Sales logs collection (ready for future phase logs)
        results["sales_logs"] = ["collection initialized"]

        logger.info("MongoDB indexes successfully created/verified.")
        return {"status": "success", "indexes": results}

    except Exception as e:
        logger.warning(f"Failed to initialize MongoDB indexes (DB may be offline): {e}")
        return {"status": "error", "error": str(e)}


def close_db_connection() -> None:
    """Closes the MongoClient connection if open."""
    global _client
    if _client is not None:
        _client.close()
        _client = None
