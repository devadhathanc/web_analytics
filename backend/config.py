import os
from dotenv import load_dotenv
from pymongo import MongoClient

load_dotenv()

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017/causal_analytics")
PORT = int(os.getenv("PORT", 5005))
DEBUG = os.getenv("FLASK_ENV", "development") == "development"

# Module-level singleton — initialized once, reused across all requests
_db_instance = None
_client_instance = None


def get_database():
    """
    Lazily initialize and return a cached MongoDB database handle.
    The MongoClient connection pool is created once and reused for
    all subsequent calls, eliminating per-request connection overhead.

    Falls back to mongomock for zero-config local development if
    the configured MongoDB is unreachable.
    """
    global _db_instance, _client_instance

    if _db_instance is not None:
        return _db_instance

    try:
        # Connect to MongoDB (5s timeout for cloud Atlas DNS & TLS handshake)
        _client_instance = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=5000)
        _client_instance.admin.command('ping')

        # Extract DB name from URI or default to causal_analytics
        parts = MONGODB_URI.split('/')[-1].split('?')[0]
        db_name = parts if parts else "causal_analytics"
        _db_instance = _client_instance[db_name]
        print(f"[Database] ✓ Connected to MongoDB: {db_name}")
    except Exception as e:
        print(f"[Database] Notice: External MongoDB not reachable ({e}).")
        print("[Database] Using in-memory mongomock database for seamless zero-setup operation.")
        import mongomock
        _client_instance = mongomock.MongoClient()
        _db_instance = _client_instance["causal_analytics"]

    # Ensure indexes for high performance querying
    try:
        _db_instance.events.create_index([("session_id", 1), ("timestamp", 1)])
        _db_instance.events.create_index([("url", 1), ("event", 1)])
        _db_instance.events.create_index([("timestamp", -1)])
        _db_instance.events.create_index([("event", 1)])
        _db_instance.sessions.create_index([("session_id", 1)], unique=True)
        _db_instance.sessions.create_index([("last_seen_at", -1)])
    except Exception:
        pass

    return _db_instance
