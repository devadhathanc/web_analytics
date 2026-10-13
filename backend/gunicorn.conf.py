import os

# Automatically bind to Render's assigned PORT or default to 5005
port = os.getenv("PORT", "5005")
bind = f"0.0.0.0:{port}"

# Concurrency tuning suitable for free/starter containers (512MB RAM)
workers = int(os.getenv("WEB_CONCURRENCY", "2"))
threads = int(os.getenv("PYTHON_THREADS", "4"))
timeout = 120
keepalive = 5
accesslog = "-"
errorlog = "-"
