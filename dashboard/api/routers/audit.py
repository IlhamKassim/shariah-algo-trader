"""Audit dashboard router — local visual platform for snapshots, errors, backups, and service health.

Serves a self-contained HTML page at /audit with inline data-fetching JavaScript.
All JSON endpoints under /api/audit/* are read-only.
"""

import datetime
import json
import os
import sqlite3
import subprocess
from pathlib import Path

from fastapi import APIRouter, Request
from fastapi.responses import HTMLResponse, JSONResponse

router = APIRouter(tags=["audit"])

AUDIT_DIR = Path(os.path.expanduser("~/.hermes/trading-audit"))
BACKUPS_DIR = Path(os.path.expanduser("~/.hermes/backups"))
SERVICES = ["shariah-trader.service", "day-trader.service", "shariah-trader-dashboard.service"]


# ── JSON data endpoints ──────────────────────────────────────────────────────


@router.get("/api/audit/snapshots")
async def audit_snapshots(request: Request):
    """Latest snapshot per account: equity, positions count, orders count, timestamp."""
    db = AUDIT_DIR / "db.sqlite"
    if not db.exists():
        return JSONResponse({"snapshots": [], "error": "no db yet"})
    con = sqlite3.connect(str(db))
    con.row_factory = sqlite3.Row
    out = []
    for row in con.execute(
        """SELECT user_id, trading_mode, snapshot_type, payload, created_at
           FROM snapshots WHERE id IN (
               SELECT MAX(id) FROM snapshots GROUP BY user_id, snapshot_type
           ) ORDER BY user_id, snapshot_type"""
    ):
        try:
            payload = json.loads(row["payload"])
        except (json.JSONDecodeError, TypeError):
            payload = {}
        entry = {
            "user_id": row["user_id"],
            "trading_mode": row["trading_mode"],
            "snapshot_type": row["snapshot_type"],
            "created_at": row["created_at"],
        }
        if row["snapshot_type"] == "account":
            entry["equity"] = payload.get("equity")
            entry["cash"] = payload.get("cash")
            entry["buying_power"] = payload.get("buying_power")
        elif row["snapshot_type"] == "positions":
            positions = payload.get("positions", [])
            entry["position_count"] = len(positions)
            entry["positions"] = [
                {"symbol": p.get("symbol"), "qty": p.get("qty"), "market_value": p.get("market_value")}
                for p in (positions if isinstance(positions, list) else [])
            ][:20]
        elif row["snapshot_type"] == "orders":
            orders = payload.get("orders", [])
            entry["order_count"] = len(orders)
            entry["orders"] = [
                {"symbol": o.get("symbol"), "side": o.get("side"), "qty": o.get("qty"),
                 "status": o.get("status"), "filled_avg_price": o.get("filled_avg_price")}
                for o in (orders if isinstance(orders, list) else [])
            ][:20]
        out.append(entry)
    con.close()
    return JSONResponse({"snapshots": out})


@router.get("/api/audit/errors")
async def audit_errors(request: Request):
    """Recent journal_errors from the trading services."""
    db = AUDIT_DIR / "db.sqlite"
    if not db.exists():
        return JSONResponse({"errors": []})
    con = sqlite3.connect(str(db))
    con.row_factory = sqlite3.Row
    errors = []
    for row in con.execute(
        """SELECT s.created_at, s.payload FROM snapshots s
           WHERE s.snapshot_type = 'journal_errors' AND s.id IN (
               SELECT MAX(id) FROM snapshots WHERE snapshot_type = 'journal_errors'
           )"""
    ):
        try:
            payload = json.loads(row["payload"])
        except (json.JSONDecodeError, TypeError):
            payload = {}
        for svc, lines in payload.items():
            for line in lines:
                errors.append({
                    "created_at": row["created_at"],
                    "service": svc,
                    "line": line,
                })
    con.close()
    run_txt = AUDIT_DIR / "last_collector_run.txt"
    collector_summary = run_txt.read_text().strip() if run_txt.exists() else ""
    return JSONResponse({"errors": errors, "collector_summary": collector_summary})


@router.get("/api/audit/services")
async def audit_services(request: Request):
    """Systemd service statuses for the 3 trading services."""
    out = []
    for svc in SERVICES:
        try:
            r = subprocess.run(
                ["systemctl", "is-active", svc], capture_output=True, text=True, timeout=5
            )
            out.append({"service": svc, "active": r.stdout.strip() == "active"})
        except Exception:
            out.append({"service": svc, "active": False})
    return JSONResponse({"services": out})


@router.get("/api/audit/backups")
async def audit_backups(request: Request):
    """Backup directory listing."""
    files = []
    if BACKUPS_DIR.exists():
        for f in sorted(BACKUPS_DIR.iterdir(), reverse=True):
            if f.is_file():
                stat = f.stat()
                files.append({
                    "name": f.name,
                    "size_kb": round(stat.st_size / 1024, 1),
                    "modified": datetime.datetime.fromtimestamp(stat.st_mtime).isoformat(),
                })
    return JSONResponse({"backups": files[:30], "dir": str(BACKUPS_DIR)})


# ── HTML page ────────────────────────────────────────────────────────────────


@router.get("/audit", response_class=HTMLResponse)
async def audit_page(request: Request):
    html = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Shariah Trader Audit</title>
<style>
  :root {
    --bg: #0f172a; --card-bg: #1e293b; --text: #e2e8f0; --muted: #94a3b8;
    --green: #22c55e; --red: #ef4444; --amber: #f59e0b; --blue: #3b82f6;
    --border: #334155;
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { background: var(--bg); color: var(--text); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif; padding: 1.5rem; max-width: 1100px; margin: 0 auto; }
  h1 { font-size: 1.25rem; font-weight: 600; margin-bottom: 0.25rem; }
  h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.75rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .subtitle { color: var(--muted); font-size: 0.8rem; margin-bottom: 1.25rem; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem; margin-bottom: 1.25rem; }
  .card { background: var(--card-bg); border: 1px solid var(--border); border-radius: 8px; padding: 1rem; }
  .row { display: flex; justify-content: space-between; align-items: baseline; padding: 0.3rem 0; }
  .label { color: var(--muted); font-size: 0.8rem; }
  .value { font-weight: 600; font-variant-numeric: tabular-nums; }
  .green { color: var(--green); } .red { color: var(--red); } .amber { color: var(--amber); }
  .badge { display: inline-block; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 600; }
  .badge-live { background: #166534; color: #4ade80; }
  .badge-paper { background: #1e3a5f; color: #93c5fd; }
  .badge-system { background: #374151; color: #d1d5db; }
  .error-line { font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.7rem; color: var(--red); padding: 0.2rem 0; border-bottom: 1px solid var(--border); overflow-x: auto; white-space: pre-wrap; }
  .divider { border: none; border-top: 1px solid var(--border); margin: 0.5rem 0; }
  .refresh { font-size: 0.7rem; color: var(--muted); cursor: pointer; text-decoration: underline; }
</style>
</head>
<body>
<h1>🔍 Shariah Trader Audit</h1>
<div class="subtitle" id="subtitle">loading...</div>

<div class="grid" id="grid">
  <div class="card">
    <h2>📊 Snapshots</h2>
    <div id="snapshots">loading...</div>
  </div>
  <div class="card">
    <h2>⚙️ Services</h2>
    <div id="services">loading...</div>
    <hr class="divider">
    <h2>💾 Backups</h2>
    <div id="backups">loading...</div>
  </div>
</div>

<div class="card" style="margin-bottom: 1.25rem;">
  <h2>⚠️ Errors</h2>
  <div id="errors">loading...</div>
</div>

<div class="card" style="margin-bottom: 1.25rem;">
  <h2>🔗 Collector</h2>
  <div id="collector">loading...</div>
</div>

<script>
function fmt(s) { return s ? Number(s).toLocaleString('en-US', {minimumFractionDigits:0, maximumFractionDigits:0}) : '\u2014'; }
function fmt2(s) { return s ? Number(s).toLocaleString('en-US', {minimumFractionDigits:2, maximumFractionDigits:2}) : '\u2014'; }

function modeBadge(mode) {
  if (mode === 'live') return '<span class="badge badge-live">LIVE</span>';
  if (mode === 'paper') return '<span class="badge badge-paper">PAPER</span>';
  return '<span class="badge badge-system">SYS</span>';
}

function shortId(uid) { return uid.length > 20 ? uid.slice(0,8)+'\u2026' : uid; }

async function load() {
  try {
    const [snapRes, errRes, svcRes, bkRes] = await Promise.all([
      fetch('/api/audit/snapshots'), fetch('/api/audit/errors'),
      fetch('/api/audit/services'), fetch('/api/audit/backups')
    ]);
    const snap = (await snapRes.json()).snapshots || [];
    const errs = (await errRes.json()).errors || [];
    const collector = (await errRes.json()).collector_summary || '';
    const svcs = (await svcRes.json()).services || [];
    const bks = (await bkRes.json()).backups || [];

    document.getElementById('subtitle').textContent = 'Last update: ' + new Date().toLocaleTimeString();

    // Snapshots by account
    const byAccount = {};
    for (const s of snap) {
      const k = s.user_id + '|' + s.trading_mode;
      if (!byAccount[k]) byAccount[k] = { user_id: s.user_id, trading_mode: s.trading_mode, items: [] };
      byAccount[k].items.push(s);
    }
    let snapHtml = '';
    for (const [_, a] of Object.entries(byAccount)) {
      const acct = a.items.find(i => i.snapshot_type === 'account');
      const pos = a.items.find(i => i.snapshot_type === 'positions');
      const ord = a.items.find(i => i.snapshot_type === 'orders');
      snapHtml += '<div style="margin-top:0.5rem"><strong>' + shortId(a.user_id) + '</strong> ' + modeBadge(a.trading_mode) + '</div>';
      if (acct) snapHtml += '<div class="row"><span class="label">Equity</span><span class="value">$' + fmt2(acct.equity) + '</span></div>';
      if (acct) snapHtml += '<div class="row"><span class="label">Cash</span><span class="value">$' + fmt2(acct.cash) + '</span></div>';
      if (pos) snapHtml += '<div class="row"><span class="label">Positions</span><span class="value">' + (pos.position_count||0) + '</span></div>';
      if (ord) snapHtml += '<div class="row"><span class="label">Orders today</span><span class="value">' + (ord.order_count||0) + '</span></div>';
      if (pos && pos.positions && pos.positions.length) {
        snapHtml += '<div style="font-size:0.7rem;color:var(--muted);margin-top:0.2rem">';
        for (const p of pos.positions.slice(0,3)) snapHtml += p.symbol + '(' + p.qty + ') ';
        if (pos.positions.length > 3) snapHtml += '+' + (pos.positions.length-3) + ' more';
        snapHtml += '</div>';
      }
    }
    if (!snap.length) snapHtml = '<div class="label">No snapshot data yet &#8212; first collect runs at 4:30 AM MYT.</div>';
    document.getElementById('snapshots').innerHTML = snapHtml;

    // Services
    let svcHtml = '';
    for (const s of svcs) {
      svcHtml += '<div class="row"><span>' + (s.active ? '\uD83D\uDFE2' : '\uD83D\uDD34') + ' ' + s.service.replace('.service','') + '</span><span class="value ' + (s.active ? 'green' : 'red') + '">' + (s.active ? 'active' : 'DOWN') + '</span></div>';
    }
    document.getElementById('services').innerHTML = svcHtml || '<div class="label">no data</div>';

    // Backups
    let bkHtml = '';
    if (bks.length) bkHtml += '<div class="row"><span class="label">' + bks.length + ' backup files</span><span class="label">' + bks[0].modified.slice(0,10) + '</span></div>';
    else bkHtml += '<div class="label">No backups yet</div>';
    document.getElementById('backups').innerHTML = bkHtml;

    // Errors
    let errHtml = '';
    if (errs.length) {
      for (const e of errs.slice(0, 10)) {
        errHtml += '<div class="error-line"><strong>' + e.service + '</strong> ' + (e.created_at||'').slice(0,16) + ' \u2014 ' + e.line + '</div>';
      }
      if (errs.length > 10) errHtml += '<div class="label">+' + (errs.length-10) + ' more errors</div>';
    } else {
      errHtml = '<div class="label green">\u2728 No errors in latest snapshot</div>';
    }
    document.getElementById('errors').innerHTML = errHtml;

    // Collector
    document.getElementById('collector').innerHTML = collector
      ? '<pre style="font-size:0.75rem;white-space:pre-wrap">' + collector + '</pre>'
      : '<div class="label">No collector run yet</div>';
  } catch(e) {
    document.getElementById('subtitle').textContent = 'Error: ' + e.message;
  }
}
load();
setInterval(load, 60000);
</script>
</body>
</html>"""
    return HTMLResponse(html)
