import os
import sys

# Ensure immediate logging output without buffering in cloud environments
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(line_buffering=True)
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(line_buffering=True)
except Exception:
    pass

from backend.app.main import app

def run_server():
    import uvicorn
    # Render assigns the listening port via the PORT environment variable (typically 10000)
    raw_port = os.environ.get("PORT", "10000")
    try:
        port = int(raw_port)
    except (ValueError, TypeError):
        port = 10000

    print(f"[ClauseWise] Launching server on 0.0.0.0:{port}...")
    sys.stdout.flush()
    uvicorn.run("backend.app.main:app", host="0.0.0.0", port=port)

if __name__ == "__main__":
    run_server()
