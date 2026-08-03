"""Local-only dashboard server — serves /audit and /hermes-monitor on localhost:8111.

Not tunneled through Cloudflare, not exposed to the internet. Access via:
  - http://localhost:8111/audit
  - http://localhost:8111/hermes-monitor
  - http://100.103.109.19:8111/audit   (Tailscale, from your Mac)
"""

import uvicorn
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from dashboard.api.routers import audit, monitor

app = FastAPI(
    title="Shariah Local Dashboard",
    version="0.1.0",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# No auth — localhost-only binding is the security boundary
app.include_router(monitor.router)
app.include_router(audit.router)

if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8111, log_level="info")
