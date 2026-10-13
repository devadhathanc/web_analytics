from datetime import datetime
from flask import Blueprint, request, jsonify
from config import get_database

events_bp = Blueprint("events", __name__)


def parse_iso_datetime(val):
    """Parse ISO datetime string to a datetime object."""
    if not val:
        return datetime.utcnow()
    if isinstance(val, datetime):
        return val
    try:
        clean_str = str(val).replace("Z", "+00:00")
        return datetime.fromisoformat(clean_str)
    except Exception:
        return datetime.utcnow()


@events_bp.route("/api/events", methods=["POST", "OPTIONS"])
def receive_events():
    """
    High-performance event ingestion endpoint.
    Supports single event or batch payloads with bulk insert.
    """
    if request.method == "OPTIONS":
        return "", 204

    payload = request.get_json(silent=True)
    if not payload:
        try:
            import json
            payload = json.loads(request.data.decode('utf-8'))
        except Exception:
            return jsonify({"error": "Invalid or missing JSON payload"}), 400

    db = get_database()

    # Normalize single event or batch
    events_list = payload if isinstance(payload, list) else [payload]

    # Pre-process all events and group by session
    event_docs = []
    session_updates = {}  # session_id -> aggregated updates

    for raw_event in events_list:
        session_id = str(raw_event.get("session_id") or raw_event.get("sessionId") or "")
        event_type = raw_event.get("event") or raw_event.get("eventType")
        url = raw_event.get("url") or ""

        if not session_id or not event_type:
            continue

        dt = parse_iso_datetime(raw_event.get("timestamp"))
        iso_str = dt.isoformat()

        # Build clean event document
        event_doc = {
            "session_id": session_id,
            "event": str(event_type),
            "url": str(url),
            "pathname": raw_event.get("pathname") or "",
            "timestamp": iso_str,
            "created_at": dt,
            "viewportWidth": raw_event.get("viewportWidth") or 0,
            "viewportHeight": raw_event.get("viewportHeight") or 0,
        }

        # Click specific attributes
        if event_type == "click":
            event_doc.update({
                "x": raw_event.get("x", 0),
                "y": raw_event.get("y", 0),
                "pageX": raw_event.get("pageX", raw_event.get("x", 0)),
                "pageY": raw_event.get("pageY", raw_event.get("y", 0)),
                "xPercent": raw_event.get("xPercent", 0),
                "yPercent": raw_event.get("yPercent", 0),
                "targetTag": raw_event.get("targetTag", ""),
                "targetId": raw_event.get("targetId", ""),
                "targetClass": raw_event.get("targetClass", ""),
                "targetText": raw_event.get("targetText", ""),
                "targetSelector": raw_event.get("targetSelector", ""),
            })
        elif event_type == "page_view":
            event_doc.update({
                "title": raw_event.get("title", ""),
                "referrer": raw_event.get("referrer", ""),
            })

        event_docs.append(event_doc)

        # Accumulate session updates
        if session_id not in session_updates:
            session_updates[session_id] = {
                "events": 0, "clicks": 0, "page_views": 0,
                "first_dt": dt, "last_dt": dt, "last_url": url,
                "first_url": url
            }

        su = session_updates[session_id]
        su["events"] += 1
        su["clicks"] += 1 if event_type == "click" else 0
        su["page_views"] += 1 if event_type == "page_view" else 0
        su["last_dt"] = max(su["last_dt"], dt)
        su["first_dt"] = min(su["first_dt"], dt)
        su["last_url"] = url

    # Bulk insert all events at once
    inserted_count = 0
    if event_docs:
        db.events.insert_many(event_docs)
        inserted_count = len(event_docs)

    # Update sessions using atomic operations
    for session_id, su in session_updates.items():
        existing = db.sessions.find_one({"session_id": session_id})

        if existing:
            first_seen = parse_iso_datetime(existing.get("first_seen_at"))
            last_seen = max(su["last_dt"], parse_iso_datetime(existing.get("last_seen_at", su["last_dt"].isoformat())))
            duration = max(0, int((last_seen - first_seen).total_seconds()))

            db.sessions.update_one(
                {"session_id": session_id},
                {
                    "$inc": {
                        "total_events": su["events"],
                        "clicks": su["clicks"],
                        "page_views": su["page_views"],
                    },
                    "$set": {
                        "last_seen_at": last_seen.isoformat(),
                        "last_url": su["last_url"],
                        "duration_seconds": duration
                    }
                }
            )
        else:
            db.sessions.insert_one({
                "session_id": session_id,
                "first_seen_at": su["first_dt"].isoformat(),
                "last_seen_at": su["last_dt"].isoformat(),
                "initial_url": su["first_url"],
                "last_url": su["last_url"],
                "total_events": su["events"],
                "clicks": su["clicks"],
                "page_views": su["page_views"],
                "duration_seconds": max(0, int((su["last_dt"] - su["first_dt"]).total_seconds()))
            })

    return jsonify({
        "success": True,
        "received": len(events_list),
        "inserted": inserted_count
    }), 201
