import random
from datetime import datetime, timedelta
from flask import Blueprint, request, jsonify
from config import get_database

analytics_bp = Blueprint("analytics", __name__)


@analytics_bp.route("/api/analytics/clicks", methods=["GET"])
def get_click_data():
    """
    Fetch click data for heatmap rendering.
    Uses projection-only query with optional URL filtering.
    """
    db = get_database()
    target_url = request.args.get("url", "").strip()
    limit = int(request.args.get("limit", 2000))

    query = {"event": "click"}
    if target_url and target_url != "all":
        query["$or"] = [
            {"url": target_url},
            {"pathname": target_url},
            {"url": {"$regex": target_url, "$options": "i"}}
        ]

    projection = {
        "_id": 0, "session_id": 1, "url": 1, "pathname": 1, "timestamp": 1,
        "x": 1, "y": 1, "pageX": 1, "pageY": 1,
        "xPercent": 1, "yPercent": 1,
        "viewportWidth": 1, "viewportHeight": 1,
        "targetTag": 1, "targetId": 1, "targetClass": 1,
        "targetText": 1, "targetSelector": 1
    }

    clicks = list(
        db.events.find(query, projection)
        .sort("timestamp", -1)
        .limit(limit)
    )

    return jsonify({
        "success": True,
        "url": target_url or "all",
        "total_clicks": len(clicks),
        "clicks": clicks
    })


@analytics_bp.route("/api/analytics/pages", methods=["GET"])
def get_tracked_pages():
    """
    Fetch all tracked pages with per-page event/click/view counts.
    Uses a single aggregation pipeline instead of N+1 queries.
    """
    db = get_database()

    pipeline = [
        {
            "$group": {
                "_id": {"$ifNull": ["$url", "$pathname"]},
                "total_events": {"$sum": 1},
                "total_clicks": {
                    "$sum": {"$cond": [{"$eq": ["$event", "click"]}, 1, 0]}
                },
                "total_views": {
                    "$sum": {"$cond": [{"$eq": ["$event", "page_view"]}, 1, 0]}
                },
                "last_event_at": {"$max": "$timestamp"}
            }
        },
        {"$match": {"_id": {"$ne": None, "$ne": ""}}},
        {"$sort": {"total_events": -1}},
        {
            "$project": {
                "_id": 0,
                "url": "$_id",
                "total_events": 1,
                "total_clicks": 1,
                "total_views": 1,
                "last_event_at": 1
            }
        }
    ]

    try:
        page_stats = list(db.events.aggregate(pipeline))
    except Exception:
        # Fallback for mongomock which may not support all aggregation operators
        urls = db.events.distinct("url")
        pathnames = db.events.distinct("pathname")
        all_pages = list(set([u for u in urls if u] + [p for p in pathnames if p]))

        page_stats = []
        for page in all_pages:
            query = {"$or": [{"url": page}, {"pathname": page}]}
            total_events = db.events.count_documents(query)
            total_clicks = db.events.count_documents({**query, "event": "click"})
            total_views = db.events.count_documents({**query, "event": "page_view"})
            page_stats.append({
                "url": page,
                "total_events": total_events,
                "total_clicks": total_clicks,
                "total_views": total_views
            })
        page_stats.sort(key=lambda x: x["total_events"], reverse=True)

    return jsonify({
        "success": True,
        "count": len(page_stats),
        "pages": page_stats
    })


@analytics_bp.route("/api/analytics/stats", methods=["GET"])
def get_overall_stats():
    """
    Compute dashboard KPI stats using aggregation pipelines.
    Single database round-trip instead of multiple count_documents() calls.
    """
    db = get_database()

    try:
        # Events aggregation
        event_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total_events": {"$sum": 1},
                    "total_clicks": {
                        "$sum": {"$cond": [{"$eq": ["$event", "click"]}, 1, 0]}
                    },
                    "total_views": {
                        "$sum": {"$cond": [{"$eq": ["$event", "page_view"]}, 1, 0]}
                    }
                }
            }
        ]
        event_stats = list(db.events.aggregate(event_pipeline))
        e = event_stats[0] if event_stats else {"total_events": 0, "total_clicks": 0, "total_views": 0}

        # Sessions aggregation
        session_pipeline = [
            {
                "$group": {
                    "_id": None,
                    "total_sessions": {"$sum": 1},
                    "total_duration": {"$sum": {"$ifNull": ["$duration_seconds", 0]}},
                    "total_events_sum": {"$sum": {"$ifNull": ["$total_events", 0]}}
                }
            }
        ]
        session_stats = list(db.sessions.aggregate(session_pipeline))
        s = session_stats[0] if session_stats else {"total_sessions": 0, "total_duration": 0, "total_events_sum": 0}

        total_sessions = s.get("total_sessions", 0)
        avg_events = round(e["total_events"] / total_sessions, 1) if total_sessions > 0 else 0
        avg_duration = round(s["total_duration"] / total_sessions, 1) if total_sessions > 0 else 0

        stats = {
            "total_sessions": total_sessions,
            "total_events": e["total_events"],
            "total_clicks": e["total_clicks"],
            "total_page_views": e["total_views"],
            "avg_events_per_session": avg_events,
            "avg_duration_seconds": avg_duration
        }
    except Exception:
        # Fallback for mongomock
        total_sessions = db.sessions.count_documents({})
        total_events = db.events.count_documents({})
        total_clicks = db.events.count_documents({"event": "click"})
        total_views = db.events.count_documents({"event": "page_view"})
        avg_events = round(total_events / total_sessions, 1) if total_sessions > 0 else 0

        all_sessions = list(db.sessions.find({}, {"duration_seconds": 1, "_id": 0}))
        total_dur = sum(s.get("duration_seconds", 0) for s in all_sessions)
        avg_duration = round(total_dur / len(all_sessions), 1) if all_sessions else 0

        stats = {
            "total_sessions": total_sessions,
            "total_events": total_events,
            "total_clicks": total_clicks,
            "total_page_views": total_views,
            "avg_events_per_session": avg_events,
            "avg_duration_seconds": avg_duration
        }

    return jsonify({"success": True, "stats": stats})


@analytics_bp.route("/api/analytics/seed", methods=["POST"])
def seed_demo_data():
    """
    Populate realistic demo e-commerce user journeys using bulk operations.
    """
    db = get_database()

    pages = [
        {"url": f"http://localhost:{5005}/demo/index.html", "name": "Storefront Home"},
        {"url": f"http://localhost:{5005}/demo/index.html#featured", "name": "Apex Headphones"},
        {"url": f"http://localhost:{5005}/demo/index.html#products", "name": "Smart Watch Ultra"},
        {"url": f"http://localhost:{5005}/demo/index.html#cart", "name": "Cart & Checkout"},
    ]

    button_hotspots = [
        {"xP": 50.0, "yP": 38.0, "w": 1280, "h": 800, "sel": "button.hero-cta", "txt": "Shop Collection Now"},
        {"xP": 25.5, "yP": 62.0, "w": 1280, "h": 800, "sel": "button.btn-add-cart", "txt": "Add to Cart - $299"},
        {"xP": 74.2, "yP": 62.0, "w": 1280, "h": 800, "sel": "button.btn-add-cart", "txt": "Add to Cart - $399"},
        {"xP": 88.0, "yP": 4.5, "w": 1280, "h": 800, "sel": "a.cart-icon", "txt": "View Cart (2)"},
        {"xP": 70.0, "yP": 75.0, "w": 1280, "h": 800, "sel": "button.checkout-btn", "txt": "Proceed to Checkout"},
        {"xP": 30.0, "yP": 5.0, "w": 1280, "h": 800, "sel": "nav.nav-link", "txt": "New Arrivals"},
    ]

    base_time = datetime.utcnow() - timedelta(hours=3)
    all_events = []
    all_sessions = []

    for i in range(1, 16):  # 15 sessions for richer data
        s_id = f"demo-session-{1000 + i}"
        s_time = base_time + timedelta(minutes=i * 10)
        curr_time = s_time
        session_events = []

        # 1. Page view home
        home_url = pages[0]["url"]
        session_events.append({
            "session_id": s_id, "event": "page_view",
            "url": home_url, "pathname": "/",
            "title": pages[0]["name"],
            "timestamp": curr_time.isoformat(), "created_at": curr_time,
            "viewportWidth": 1280, "viewportHeight": 800
        })

        # 2. Click hero CTA or nav
        curr_time += timedelta(seconds=random.randint(4, 18))
        hotspot = random.choice([button_hotspots[0], button_hotspots[5]])
        jx = hotspot["xP"] + random.uniform(-2.5, 2.5)
        jy = hotspot["yP"] + random.uniform(-1.5, 1.5)
        session_events.append({
            "session_id": s_id, "event": "click",
            "url": home_url, "pathname": "/",
            "timestamp": curr_time.isoformat(), "created_at": curr_time,
            "x": int(jx * 12.8), "y": int(jy * 8.0),
            "pageX": int(jx * 12.8), "pageY": int(jy * 8.0),
            "xPercent": round(jx, 2), "yPercent": round(jy, 2),
            "viewportWidth": 1280, "viewportHeight": 800,
            "targetTag": "button", "targetSelector": hotspot["sel"],
            "targetText": hotspot["txt"]
        })

        # 3. Page view product
        curr_time += timedelta(seconds=random.randint(5, 15))
        prod_page = random.choice([pages[1], pages[2]])
        session_events.append({
            "session_id": s_id, "event": "page_view",
            "url": prod_page["url"],
            "pathname": prod_page["url"].split("localhost:5005")[-1] if "localhost" in prod_page["url"] else "/",
            "title": prod_page["name"],
            "timestamp": curr_time.isoformat(), "created_at": curr_time,
            "viewportWidth": 1280, "viewportHeight": 800
        })

        # 4. Click Add to Cart
        curr_time += timedelta(seconds=random.randint(6, 25))
        cart_spot = random.choice([button_hotspots[1], button_hotspots[2]])
        cx = cart_spot["xP"] + random.uniform(-2.0, 2.0)
        cy = cart_spot["yP"] + random.uniform(-1.5, 1.5)
        session_events.append({
            "session_id": s_id, "event": "click",
            "url": prod_page["url"],
            "pathname": prod_page["url"].split("localhost:5005")[-1] if "localhost" in prod_page["url"] else "/",
            "timestamp": curr_time.isoformat(), "created_at": curr_time,
            "x": int(cx * 12.8), "y": int(cy * 8.0),
            "pageX": int(cx * 12.8), "pageY": int(cy * 8.0),
            "xPercent": round(cx, 2), "yPercent": round(cy, 2),
            "viewportWidth": 1280, "viewportHeight": 800,
            "targetTag": "button", "targetSelector": cart_spot["sel"],
            "targetText": cart_spot["txt"]
        })

        # 5. Sometimes navigate to cart + checkout
        if i % 2 == 0:
            curr_time += timedelta(seconds=random.randint(8, 20))
            cart_page = pages[3]
            session_events.append({
                "session_id": s_id, "event": "page_view",
                "url": cart_page["url"], "pathname": "/cart",
                "title": cart_page["name"],
                "timestamp": curr_time.isoformat(), "created_at": curr_time,
                "viewportWidth": 1280, "viewportHeight": 800
            })

            curr_time += timedelta(seconds=random.randint(5, 12))
            chk = button_hotspots[4]
            chk_x = chk["xP"] + random.uniform(-1.5, 1.5)
            chk_y = chk["yP"] + random.uniform(-1.0, 1.0)
            session_events.append({
                "session_id": s_id, "event": "click",
                "url": cart_page["url"], "pathname": "/cart",
                "timestamp": curr_time.isoformat(), "created_at": curr_time,
                "x": int(chk_x * 12.8), "y": int(chk_y * 8.0),
                "pageX": int(chk_x * 12.8), "pageY": int(chk_y * 8.0),
                "xPercent": round(chk_x, 2), "yPercent": round(chk_y, 2),
                "viewportWidth": 1280, "viewportHeight": 800,
                "targetTag": "button", "targetSelector": chk["sel"],
                "targetText": chk["txt"]
            })

        # 6. Some sessions have additional random browsing
        if i % 3 == 0:
            for _ in range(random.randint(1, 3)):
                curr_time += timedelta(seconds=random.randint(3, 12))
                extra_spot = random.choice(button_hotspots)
                ex = extra_spot["xP"] + random.uniform(-3.0, 3.0)
                ey = extra_spot["yP"] + random.uniform(-2.0, 2.0)
                session_events.append({
                    "session_id": s_id, "event": "click",
                    "url": home_url, "pathname": "/",
                    "timestamp": curr_time.isoformat(), "created_at": curr_time,
                    "x": int(ex * 12.8), "y": int(ey * 8.0),
                    "pageX": int(ex * 12.8), "pageY": int(ey * 8.0),
                    "xPercent": round(ex, 2), "yPercent": round(ey, 2),
                    "viewportWidth": 1280, "viewportHeight": 800,
                    "targetTag": "button", "targetSelector": extra_spot["sel"],
                    "targetText": extra_spot["txt"]
                })

        all_events.extend(session_events)

        # Build session summary
        dur_sec = int((curr_time - s_time).total_seconds())
        clicks_cnt = sum(1 for e in session_events if e["event"] == "click")
        views_cnt = sum(1 for e in session_events if e["event"] == "page_view")
        all_sessions.append({
            "session_id": s_id,
            "first_seen_at": s_time.isoformat(),
            "last_seen_at": curr_time.isoformat(),
            "initial_url": home_url,
            "last_url": session_events[-1]["url"],
            "total_events": len(session_events),
            "clicks": clicks_cnt,
            "page_views": views_cnt,
            "duration_seconds": dur_sec
        })

    # Bulk insert all events at once
    if all_events:
        db.events.insert_many(all_events)

    # Bulk upsert sessions
    for s in all_sessions:
        db.sessions.update_one(
            {"session_id": s["session_id"]},
            {"$set": s},
            upsert=True
        )

    return jsonify({
        "success": True,
        "message": f"Successfully seeded {len(all_sessions)} sessions with {len(all_events)} events.",
        "sessions": len(all_sessions),
        "events": len(all_events)
    })
