"""Notification seeder.

Runs once at startup (on a daemon thread) and parses the last 30 days of
journalctl output for both bots.  Each matching log line is inserted into
the notifications SQLite DB using a deterministic SHA-1 ID, so re-seeding
on service restarts never creates duplicates.
"""

import hashlib
import logging
import re
import subprocess
import threading
from datetime import datetime, timezone
from typing import Callable

from dashboard.api.db import init_db, insert_notification, purge_old

logger = logging.getLogger(__name__)

# ── Timestamp parser ──────────────────────────────────────────────────────────

# Matches the Python-logger timestamp embedded in every log line, e.g.
#   "2026-07-13 13:49:17,084 INFO shariah_algo_trader.jobs.rebalance — …"
_TS_RE = re.compile(r"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}),\d+")


def _parse_timestamp(line: str) -> str | None:
    """Return ISO-8601 UTC string from the inner Python-logger timestamp."""
    # journalctl short format:  "Jul 13 13:49:17 host service[pid]: <python log>"
    sep = line.find("]: ")
    if sep == -1:
        return None
    inner = line[sep + 3:]
    m = _TS_RE.search(inner)
    if not m:
        return None
    try:
        dt = datetime.strptime(m.group(1), "%Y-%m-%d %H:%M:%S").replace(
            tzinfo=timezone.utc
        )
        return dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    except ValueError:
        return None


def _make_id(ts: str, title: str, body: str) -> str:
    return hashlib.sha1(f"{ts}|{title}|{body}".encode()).hexdigest()


# ── Rule table ────────────────────────────────────────────────────────────────
# Each entry: (compiled_regex, source, category, severity, title_fn, body_fn)
# title_fn / body_fn receive the re.Match object.

_TitleFn = Callable[[re.Match], str]
_BodyFn  = Callable[[re.Match], str]

_RULES: list[
    tuple[re.Pattern, str, str, str, _TitleFn, _BodyFn]
] = [
    # ── Shariah Trader ────────────────────────────────────────────────────
    (
        re.compile(
            r"Rebalance complete — (\d+) sell\(s\), (\d+) adjust\(s\), (\d+) buy\(s\) submitted"
        ),
        "shariah_trader", "trade", "info",
        lambda m: "Rebalance Executed",
        lambda m: f"{m.group(1)} sell(s) · {m.group(2)} adjustment(s) · {m.group(3)} buy(s)",
    ),
    (
        re.compile(r"Compliance Check — Portfolio fully compliant"),
        "shariah_trader", "compliance", "info",
        lambda m: "Compliance Check Passed",
        lambda m: "All held positions remain Shariah-compliant",
    ),
    (
        re.compile(r"Compliance Check failed: (.+)"),
        "shariah_trader", "compliance", "critical",
        lambda m: "Compliance Check Failed",
        lambda m: m.group(1).strip(),
    ),
    (
        re.compile(r"SELL (\w+) — full position liquidated"),
        "shariah_trader", "compliance", "warning",
        lambda m: f"{m.group(1)} Exited — Non-Compliance",
        lambda m: f"{m.group(1)} was sold in full after failing Shariah screening",
    ),
    (
        re.compile(r"Failed to fetch (\w+) holdings \(403"),
        "shariah_trader", "platform", "warning",
        lambda m: f"{m.group(1)} Holdings Feed Blocked",
        lambda m: f"Universe built without {m.group(1)} — 403 Forbidden from provider",
    ),
    (
        re.compile(r"Drift check — all (\d+) positions within"),
        "shariah_trader", "compliance", "info",
        lambda m: "Drift Check Passed",
        lambda m: f"All {m.group(1)} positions are within the drift threshold",
    ),
    # ── Day Trader ────────────────────────────────────────────────────────
    (
        re.compile(r"DAY BUY (\w+) — \$([\d,]+\.\d+) \(10% of \$([\d,]+\.\d+) equity\)"),
        "day_trader", "trade", "info",
        lambda m: f"Day Trader — Entered {m.group(1)}",
        lambda m: f"Bought {m.group(1)} · ${m.group(2)} (10% of ${m.group(3)} equity)",
    ),
    (
        re.compile(r"(\w+) profit target hit at ([\d.]+)"),
        "day_trader", "trade", "info",
        lambda m: f"Day Trader — {m.group(1)} Profit Target Hit",
        lambda m: f"{m.group(1)} closed at {m.group(2)} — profit target reached",
    ),
    (
        re.compile(r"(\w+) stop hit at ([\d.]+) — trailing stop"),
        "day_trader", "trade", "warning",
        lambda m: f"Day Trader — {m.group(1)} Stop Loss Triggered",
        lambda m: f"{m.group(1)} closed at {m.group(2)} — trailing stop hit",
    ),
    (
        re.compile(r"EOD liquidation complete — (\d+) closed"),
        "day_trader", "trade", "info",
        lambda m: "EOD Liquidation Complete",
        lambda m: f"{m.group(1)} position(s) force-closed at 3:55 PM market close",
    ),
    # ── Platform ──────────────────────────────────────────────────────────
    (
        re.compile(r"AlpacaError: Alpaca returned (5\d\d) for (/[^\s]+)"),
        "platform", "platform", "critical",
        lambda m: f"Alpaca API Error — HTTP {m.group(1)}",
        lambda m: f"Request to {m.group(2).strip()} failed with HTTP {m.group(1)}",
    ),
]



# ── Seeder logic ──────────────────────────────────────────────────────────────

def _seed_service(service: str, is_first_run: bool, startup_time: datetime) -> int:
    """Parse journalctl for one service and insert matches.

    If not the first run, and the event happened after startup_time,
    and is warning/critical severity, triggers an immediate email alert.
    """
    from dashboard.api.email_service import send_immediate_alert

    try:
        # On first run parse last 30 days. On sub-sequent runs, check last 1 hour of logs.
        since_time = "30 days ago" if is_first_run else "1 hour ago"
        result = subprocess.run(
            [
                "journalctl", "-u", service,
                "--since", since_time,
                "--no-pager", "-o", "short",
            ],
            capture_output=True,
            text=True,
            timeout=20,
        )
        lines = result.stdout.splitlines()
    except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
        logger.warning("journalctl failed for %s: %s", service, exc)
        return 0

    inserted = 0
    for line in lines:
        for regex, source, category, severity, title_fn, body_fn in _RULES:
            m = regex.search(line)
            if not m:
                continue
            ts = _parse_timestamp(line)
            if ts is None:
                continue
            title = title_fn(m)
            body  = body_fn(m)
            nid   = _make_id(ts, title, body)
            
            if insert_notification(nid, source, category, severity, title, body, ts):
                inserted += 1
                # Trigger email alerts for new warning/critical notifications after startup
                if not is_first_run:
                    try:
                        dt_event = datetime.strptime(ts, "%Y-%m-%dT%H:%M:%SZ").replace(tzinfo=timezone.utc)
                        if dt_event > startup_time and severity in ["warning", "critical"]:
                            send_immediate_alert(title, body, severity, ts)
                    except Exception as e:
                        logger.error("Failed to parse event time for alert check: %s", e)
            break  # first matching rule wins per line

    return inserted


def seed_notifications() -> None:
    """Spawn a daemon thread that seeds the DB periodically and schedules digests."""

    def _run() -> None:
        import time
        from dashboard.api.email_service import send_daily_digest

        try:
            init_db()
            purge_old(days=30)
        except Exception:
            logger.exception("Initial DB setup/purge failed")

        startup_time = datetime.now(timezone.utc)
        logger.info("Notification seeder loop starting. Startup time: %s", startup_time)

        is_first_run = True
        last_digest_date = None

        while True:
            try:
                total_inserted = 0
                for svc in ["shariah-trader.service", "day-trader.service"]:
                    n = _seed_service(svc, is_first_run, startup_time)
                    total_inserted += n
                
                if total_inserted > 0:
                    logger.info("Notification seeder: %d new event(s) parsed", total_inserted)
                
                is_first_run = False

                # Handle daily digest check (send at 16:30 Eastern Time)
                # Since we don't have pytz, check UTC hour corresponding to 16:30 ET.
                # Standard timezone offset for ET is UTC-5 (EST) or UTC-4 (EDT).
                # To be robust, let's look at standard time. Eastern 16:30 is 20:30 UTC (EDT) or 21:30 UTC (EST).
                # We can check the local system time or calculate ET.
                # A robust way is to read the time offset:
                now_utc = datetime.now(timezone.utc)
                # Simple ET offset calculation (approximate EDT/EST):
                # EDT is from 2nd Sunday in March to 1st Sunday in November (UTC-4), otherwise EST (UTC-5).
                # Let's compute offset:
                # We can get local timezone if machine is configured for America/New_York:
                # systemd servers are typically UTC. Let's compute Eastern Time:
                dt_utc = datetime.now(timezone.utc)
                # Simple estimation of offset for current date (July is always EDT: UTC-4)
                # Since today is July (7), offset is -4. Let's write a general EST/EDT checker:
                month = dt_utc.month
                is_dst = (3 < month < 11) or (month == 3 and dt_utc.day >= 8) or (month == 11 and dt_utc.day < 1)
                et_offset = -4 if is_dst else -5
                
                now_et_hour = (dt_utc.hour + et_offset) % 24
                now_et_minute = dt_utc.minute
                current_date = dt_utc.date()
                
                # Send digest at 16:30 ET
                if now_et_hour == 16 and now_et_minute >= 30 and last_digest_date != current_date:
                    logger.info("Triggering Daily Digest email notification...")
                    send_daily_digest()
                    last_digest_date = current_date

            except Exception as e:
                logger.error("Error in seeder execution loop: %s", e)

            time.sleep(30)

    threading.Thread(target=_run, daemon=True, name="notif-seeder").start()

