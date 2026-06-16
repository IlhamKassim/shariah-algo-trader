import os
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from dashboard.api.routers import account, activity, performance, portfolio, status, universe

app = FastAPI(title="Shariah Algo Trader Dashboard", version="0.1.0")

_ALLOWED_ORIGINS = [
    "http://localhost:5173",
    *(os.environ.get("ALLOWED_ORIGINS", "").split(",") if os.environ.get("ALLOWED_ORIGINS") else []),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(status.router)
app.include_router(account.router)
app.include_router(portfolio.router)
app.include_router(universe.router)
app.include_router(activity.router)
app.include_router(performance.router)

_STATIC = Path(__file__).parent / "static"
if _STATIC.exists():
    app.mount("/", StaticFiles(directory=str(_STATIC), html=True), name="static")
