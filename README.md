# Web Analytics Platform

A production-grade, full-stack user behavior analytics application designed to capture real-time client interactions, aggregate user journeys into sessions, and visualize click heatmaps.

---

## 🏗️ System Architecture

```
┌────────────────────────────────────────────────────────┐
│                   Client Layer                         │
├───────────────────────────────┬────────────────────────┤
│    Demo E-Commerce Store      │    Analytics SDK       │
│    (Apex Luxe Storefront)     │    (tracker.js)        │
└───────────────┬───────────────┴───────────┬────────────┘
                │                           │
                │ Uses SDK                  │ HTTP POST /api/events
                ▼                           ▼
┌────────────────────────────────────────────────────────┐
│               Backend API (Python / Flask + UV)        │
├────────────────────────────────────────────────────────┤
│  • Event Ingestion Service (/api/events)               │
│  • Session Aggregator & Journey Engine (/api/sessions) │
│  • Heatmap & Clicks Query Service (/api/analytics)     │
│  • Storage: MongoDB (Atlas / Local + In-Memory Mock)   │
└───────────────────────────────┬────────────────────────┘
                                │
                                │ REST Queries
                                ▼
┌────────────────────────────────────────────────────────┐
│             Dashboard Frontend (Next.js)               │
├────────────────────────────────────────────────────────┤
│  • Executive KPI Overview                              │
│  • Sessions View (Table + Event Counts)                │
│  • User Journey Timeline (Chronological Flow)          │
│  • Heatmap View (Thermal Density, Dots, Grid Matrix)   │
└───────────────────────────────┘
```

---

## 🛠️ Tech Stack & Rationale

| Layer | Technology | Key Rationale |
| :--- | :--- | :--- |
| **Client Tracker** | **Vanilla JavaScript (`tracker.js`)** | Zero runtime dependencies, ultra-light footprint (<3KB), unblocked page rendering, cross-browser compatibility. |
| **Backend** | **Python / Flask + `uv`** | High-performance Python package management via Astral `uv`, clean modular Blueprints, and lightweight REST APIs. |
| **Database** | **MongoDB (PyMongo / mongomock)** | High-throughput JSON document ingestion, compound indexing (`session_id + timestamp`, `url + event`), and zero-friction fallback for immediate local testing. |
| **Dashboard** | **Next.js 14 (React)** | Server-side rendering, App Router, high performance, and rapid client-side canvas interactions. |
| **Styling** | **Vanilla CSS (Design Tokens)** | Bespoke dark-mode glassmorphic design system adhering to strict performance and zero CSS-framework bloat. |

---

## 🚀 Quick Start Guide

### Prerequisites
* **Node.js** (v18+)
* **Python** (v3.9+) with **uv** installed (`curl -LsSf https://astral.sh/uv/install.sh | sh` or `brew install uv`)

### One-Command Setup
Make the startup script executable and run:
```bash
chmod +x run.sh
./run.sh
```

This will automatically:
1. Initialize the Python environment using `uv` and start the **Flask API** on `http://localhost:5000`.
2. Install frontend dependencies and launch the **Next.js Dashboard** on `http://localhost:3000`.
3. Pre-seed demonstration user journeys so the dashboard is immediately rich with data.

### Manual Setup (Alternative)

#### 1. Backend (Flask with uv)
```bash
cd backend
uv run python app.py
```
*Backend runs on `http://localhost:5000`*

#### 2. Dashboard (Next.js)
```bash
cd dashboard
npm install
npm run dev
```
*Dashboard opens on `http://localhost:3000`*

#### 3. Demo Storefront
Open `http://localhost:5000/demo/index.html` in your browser.

---

## 📦 Features Breakdown

### 1. Client Tracking SDK (`tracker.js`)
* **Session Tracking**: Automatic UUID generation stored in `localStorage` with fallback to `cookie`. Auto-expires if inactive for >30 minutes.
* **Events Tracked**:
  * `page_view`: Fires on load and captures SPA History API navigation (`pushState`, `replaceState`, `popstate`).
  * `click`: Captures exact coordinates `(x, y)`, normalized percentages `(x%, y%)`, viewport dimensions `(w, h)`, target element tag, class, ID, text, and CSS selector.
* **Network Reliability**: Micro-batching queue (transmits every 1.5s or on 5 events) and leverages `navigator.sendBeacon` upon page exit (`visibilitychange` / `beforeunload`).

### 2. Backend REST API
* `POST /api/events` — Ingest single or batch interaction events and updates session aggregate stats in real-time.
* `GET /api/sessions` — List all sessions with event counts, duration, and page view/click metrics.
* `GET /api/sessions/<id>/events` — Ordered chronological event stream representing the user journey.
* `GET /api/analytics/clicks?url=<url>` — Fetch click coordinates for heatmap rendering.
* `GET /api/analytics/pages` — List unique tracked URLs with click totals.
* `GET /api/analytics/stats` — High-level KPI metrics (Total Sessions, Events, Clicks, Avg Duration).
* `POST /api/analytics/seed` — Generates realistic e-commerce user journeys for instant testing.

### 3. Next.js Analytics Dashboard
* **Sessions View**: Filterable table with total events, duration, and landing pages. Clicking any row opens the **User Journey Timeline** drawer showing step-by-step visitor progression.
* **Heatmap View**: Select any tracked page to inspect click density:
  * **Thermal Density Mode**: Smooth continuous color gradient heatmap rendered on HTML5 Canvas.
  * **Scatter Dots Mode**: Exact coordinates with hover tooltips displaying element tags, text, and selectors.
  * **Grid Matrix Mode**: Quadrant density breakdown with click counts and percentages.
* **Overview KPI Cards**: Live telemetry cards reflecting active ingestion.

---

## ⚖️ Assumptions & Trade-Offs

1. **Database Fallback (Zero-Friction Dev Experience)**:
   - *Design Choice*: The backend attempts to connect to `MONGODB_URI` (MongoDB Atlas / local `mongod`). If unavailable, it gracefully defaults to an in-memory `mongomock` instance.
   - *Trade-off*: In-memory data resets when the server restarts unless a persistent MongoDB URI is provided in `.env`. This ensures reviewers can run the repository immediately without setting up a local database daemon.

2. **Normalized Coordinates for Heatmaps**:
   - *Design Choice*: The tracker captures both raw pixels `(x, y)` and viewport percentage `(x / viewportWidth * 100)`.
   - *Rationale*: Screen sizes vary widely (laptops, monitors, mobiles). Normalizing coordinates allows heatmaps to render accurately regardless of the viewer's current window size.

3. **Client-Side Micro-Batching**:
   - *Design Choice*: Events are queued for 1500ms or 5 events before dispatching.
   - *Trade-off*: Introduces a slight 1.5s delay before events appear on the dashboard in exchange for saving ~80% of HTTP network requests and reducing server load. Page unloads are handled immediately with `sendBeacon`.
