from flask import Blueprint, request, jsonify
from config import get_database

sessions_bp = Blueprint("sessions", __name__)


@sessions_bp.route("/api/sessions", methods=["GET"])
def list_sessions():
    """
    Fetch paginated sessions with optional search filtering.
    """
    db = get_database()

    search = request.args.get("search", "").strip()
    limit = min(int(request.args.get("limit", 100)), 500)
    page = max(int(request.args.get("page", 1)), 1)
    skip = (page - 1) * limit

    query = {}
    if search:
        query["$or"] = [
            {"session_id": {"$regex": search, "$options": "i"}},
            {"initial_url": {"$regex": search, "$options": "i"}},
            {"last_url": {"$regex": search, "$options": "i"}}
        ]

    total_sessions = db.sessions.count_documents(query)
    sessions = list(
        db.sessions.find(query, {"_id": 0})
        .sort("last_seen_at", -1)
        .skip(skip)
        .limit(limit)
    )

    return jsonify({
        "success": True,
        "total": total_sessions,
        "page": page,
        "limit": limit,
        "sessions": sessions
    })


@sessions_bp.route("/api/sessions/<session_id>", methods=["GET"])
def get_session(session_id):
    """Fetch single session details."""
    db = get_database()
    session = db.sessions.find_one({"session_id": str(session_id)}, {"_id": 0})
    if not session:
        return jsonify({"error": "Session not found"}), 404
    return jsonify({"success": True, "session": session})


@sessions_bp.route("/api/sessions/<session_id>/events", methods=["GET"])
def get_session_events(session_id):
    """
    Fetch all events for a specific session in chronological order.
    This powers the full User Journey timeline view.
    """
    db = get_database()

    events = list(
        db.events.find(
            {"session_id": str(session_id)},
            {"_id": 0, "created_at": 0}
        ).sort("timestamp", 1)
    )

    return jsonify({
        "success": True,
        "session_id": session_id,
        "count": len(events),
        "events": events
    })
