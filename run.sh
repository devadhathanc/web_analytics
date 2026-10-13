#!/usr/bin/env bash

# Web Analytics Runner
# Starts both Flask Backend (Port 5005 via UV) and Next.js Dashboard (Port 3000)

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

echo "=========================================================="
echo "🚀 Starting Web Analytics Platform"
echo "=========================================================="

# Ensure UV is in PATH
if [ -f "$HOME/.local/bin/uv" ]; then
    export PATH="$HOME/.local/bin:$PATH"
elif [ -f "$HOME/.cargo/bin/uv" ]; then
    export PATH="$HOME/.cargo/bin:$PATH"
fi

# 1. Setup Backend with UV
echo "📦 Setting up Flask Backend with uv..."
cd "$DIR/backend"

if command -v uv &> /dev/null; then
    echo "⚡ Starting Flask API server using uv on http://localhost:5005..."
    uv run python app.py &
    BACKEND_PID=$!
else
    echo "⚠️ uv not found in PATH, falling back to python3 venv..."
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -q -r requirements.txt
    python3 app.py &
    BACKEND_PID=$!
fi

# Trap exit to cleanup processes
cleanup() {
    echo ""
    echo "🛑 Shutting down services..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# 2. Setup Frontend
echo "📦 Setting up Next.js Dashboard..."
cd "$DIR/dashboard"
if [ ! -d "node_modules" ]; then
    echo "Installing frontend dependencies..."
    npm install
fi

echo "✨ Starting Next.js Dashboard on http://localhost:3000..."
npm run dev &
FRONTEND_PID=$!

echo ""
echo "=========================================================="
echo "🎉 System is LIVE!"
echo "   📊 Next.js Dashboard:  http://localhost:3000"
echo "   🛍️  Demo E-Commerce:    http://localhost:5005/demo/index.html"
echo "   🔌 Flask Backend API:  http://localhost:5005"
echo "   📜 Tracking Script:    http://localhost:5005/tracker.js"
echo "=========================================================="
echo "Press Ctrl+C to stop all services."
echo ""

wait
