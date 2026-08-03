"""Hermes monitoring dashboard — simple HTML page served by FastAPI.

GET /hermes-monitor → self-contained HTML with live system status.
No auth needed (internal tool), no external JS/CSS dependencies.
"""

import datetime
import os
import sqlite3
import subprocess
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()

SERVICES = [
    "shariah-trader.service",
    "day-trader.service",
    "shariah-trader-dashboard.service",
    "resume-builder.service",
]


@router.get("/hermes-monitor", response_class=HTMLResponse)
async def hermes_monitor():
    # service statuses
    svc_lines = []
    for svc in SERVICES:
        try:
            r = subprocess.run(
                ["systemctl", "is-active", svc], capture_output=True, text=True, timeout=5
            )
            active = r.stdout.strip() == "active"
        except Exception:
            active = False
        icon = "🟢" if active else "🔴"
        color = "#22c55e" if active else "#ef4444"
        svc_lines.append(
            f'<span style="color:{color}">{icon} {svc.replace(".service","")}</span>'
        )

    # disk
    try:
        df = subprocess.run(
            ["df", "-h", "/", "/home"], capture_output=True, text=True, timeout=5
        )
        disk_lines = df.stdout.strip().split("\n")
    except Exception:
        disk_lines = ["(disk info unavailable)"]

    # memory
    try:
        free_out = subprocess.run(["free", "-h"], capture_output=True, text=True, timeout=5)
        mem_lines = free_out.stdout.strip().split("\n")
    except Exception:
        mem_lines = ["(memory info unavailable)"]

    # uptime
    try:
        uptime_out = subprocess.run(["uptime", "-p"], capture_output=True, text=True, timeout=5)
        uptime_str = uptime_out.stdout.strip()
    except Exception:
        uptime_str = "(unknown)"

    # cron jobs (from Hermes state)
    cron_entries = []
    cron_dir = Path(os.path.expanduser("~/.hermes/cron"))
    if cron_dir.exists():
        for f in sorted(cron_dir.iterdir()):
            if f.name.endswith(".json"):
                cron_entries.append(f.name.replace(".json", ""))

    # backups
    backup_entries = []
    bk_dir = Path(os.path.expanduser("~/.hermes/backups"))
    if bk_dir.exists():
        for f in sorted(bk_dir.iterdir(), reverse=True)[:5]:
            if f.is_file():
                stat = f.stat()
                backup_entries.append(
                    f"{f.name} ({round(stat.st_size/1024, 1)} KB, "
                    f"{datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M')})"
                )

    now = datetime.datetime.now().isoformat(timespec="seconds")

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Hermes Monitor</title>
<style>
  :root {{
    --bg: #0f172a; --card-bg: #1e293b; --text: #e2e8f0; --muted: #94a3b8;
    --border: #334155;
  }}
  * {{ margin: 0; padding: 0; box-sizing: border-box; }}
  body {{ background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; padding: 1.5rem; max-width: 900px; margin: 0 auto; }}
  h1 {{ font-size: 1.25rem; font-weight: 600; margin-bottom: 0.25rem; }}
  h2 {{ font-size: 0.9rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 0.5rem; }}
  .subtitle {{ color: var(--muted); font-size: 0.75rem; margin-bottom: 1.25rem; }}
  .grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }}
  .card {{ background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }}
  .row {{ display: flex; justify-content: space-between; align-items: baseline; padding: 0.25rem 0; font-size: 0.85rem; }}
  pre {{ font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.75rem; color: var(--muted); margin: 0; white-space: pre-wrap; line-height: 1.4; }}
  .divider {{ border: none; border-top: 1px solid var(--border); margin: 0.5rem 0; }}
</style>
</head>
<body>
<h1>Hermes Server Monitor</h1>
<div class="subtitle">Oracle Cloud | {now}Z | Uptime: {uptime_str}</div>

<div class="grid">
  <div class="card">
    <h2>Services</h2>
    {"<br>".join(svc_lines)}
  </div>
  <div class="card">
    <h2>Disk</h2>
    <pre>{disk_lines[0] if disk_lines else ""}<br>{"<br>".join(disk_lines[1:3]) if len(disk_lines)>=3 else ""}</pre>
    <hr class="divider">
    <h2>Memory</h2>
    <pre>{"<br>".join(mem_lines[1:3]) if len(mem_lines)>=3 else ""}</pre>
  </div>
</div>

<div class="card" style="margin-bottom:1.25rem">
  <h2>Backups (latest 5)</h2>
  <pre>{"<br>".join(backup_entries) if backup_entries else "(no backups yet)"}</pre>
</div>

<div class="card">
  <h2>Cron Jobs ({len(cron_entries)})</h2>
  <pre>{"<br>".join(sorted(cron_entries)) if cron_entries else "(no cron jobs)"}</pre>
</div>
</body>
</html>"""
    return HTMLResponse(html)
