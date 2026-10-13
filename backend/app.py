import os
from flask import Flask, jsonify, send_from_directory, send_file
from flask_cors import CORS
from config import get_database, PORT, DEBUG
from routes.events import events_bp
from routes.sessions import sessions_bp
from routes.analytics import analytics_bp

app = Flask(__name__, static_folder="../demo-store", static_url_path="/demo")
CORS(app, resources={r"/*": {"origins": "*"}})

# Register blueprints
app.register_blueprint(events_bp)
app.register_blueprint(sessions_bp)
app.register_blueprint(analytics_bp)

@app.route("/api/health", methods=["GET"])
def health_check():
    db = get_database()
    return jsonify({
        "status": "healthy",
        "service": "Web Analytics Engine (Flask)",
        "database": "connected"
    })

@app.route("/tracker.js", methods=["GET"])
def serve_tracker():
    """
    Directly serve the client tracking script so any website can embed it via:
    <script src="http://localhost:5005/tracker.js" data-endpoint="http://localhost:5005/api/events"></script>
    """
    tracker_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../tracker/tracker.js"))
    if os.path.exists(tracker_path):
        return send_file(tracker_path, mimetype="application/javascript")
    return jsonify({"error": "tracker.js not found"}), 404

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "service": "Web Analytics API",
        "version": "1.0.0",
        "documentation": {
            "health": "/api/health",
            "events_ingestion": "POST /api/events",
            "sessions_list": "GET /api/sessions",
            "session_journey": "GET /api/sessions/<session_id>/events",
            "heatmap_clicks": "GET /api/analytics/clicks?url=<url>",
            "tracked_pages": "GET /api/analytics/pages",
            "overview_stats": "GET /api/analytics/stats",
            "seed_demo_data": "POST /api/analytics/seed",
            "tracker_script": "/tracker.js",
            "demo_store": "/demo/index.html"
        }
    })

def initialize_database():
    """Auto-seed sample journeys if empty on first boot"""
    db = get_database()
    if db.sessions.count_documents({}) == 0:
        print("[Database] Initializing with realistic e-commerce demonstration journeys...")
        from routes.analytics import seed_demo_data
        with app.app_context():
            seed_demo_data()

if __name__ == "__main__":
    initialize_database()
    print(f"🚀 Web Analytics API running on http://localhost:{PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
