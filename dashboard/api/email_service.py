import logging
import os
import smtplib
from datetime import datetime
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger(__name__)


def get_smtp_config():
    """Retrieve SMTP settings from environment variables."""
    return {
        "host": os.environ.get("SMTP_HOST", "smtp.gmail.com"),
        "port": int(os.environ.get("SMTP_PORT", "587")),
        "user": os.environ.get("SMTP_USER"),
        "password": os.environ.get("SMTP_PASSWORD"),
    }


def get_recipients() -> list[str]:
    """Determine who gets the emails (NOTIFICATIONS_EMAIL -> Google allowed emails -> SMTP_USER)."""
    # 1. Direct configuration
    notif_email = os.environ.get("NOTIFICATIONS_EMAIL")
    if notif_email:
        return [e.strip() for e in notif_email.split(",") if e.strip()]

    # 2. Fall back to whitelisted Google OAuth emails
    try:
        from dashboard.api.deps import get_config
        cfg = get_config()
        if cfg.allowed_google_emails:
            return list(cfg.allowed_google_emails)
    except Exception:
        pass

    # 3. Fall back to SMTP login user
    smtp_user = os.environ.get("SMTP_USER")
    return [smtp_user] if smtp_user else []


def send_email(subject: str, html_body: str) -> bool:
    """Send an HTML email via SMTP STARTTLS to all defined recipients."""
    cfg = get_smtp_config()
    if not cfg["user"] or not cfg["password"]:
        logger.debug("SMTP credentials not configured. Skipping email: %s", subject)
        return False

    recipients = get_recipients()
    if not recipients:
        logger.warning("No email recipients found. Skipping email: %s", subject)
        return False

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = cfg["user"]
    msg["To"] = ", ".join(recipients)

    part = MIMEText(html_body, "html")
    msg.attach(part)

    try:
        server = smtplib.SMTP(cfg["host"], cfg["port"], timeout=15)
        server.starttls()
        server.login(cfg["user"], cfg["password"])
        server.sendmail(cfg["user"], recipients, msg.as_string())
        server.quit()
        logger.info("Notification email sent successfully to %s: %s", recipients, subject)
        return True
    except Exception as exc:
        logger.error("Failed to send notification email: %s", exc)
        return False


def send_immediate_alert(title: str, body: str, severity: str, timestamp: str) -> bool:
    """Format and send an immediate, premium HTML email for warning/critical events in a clean editorial layout."""
    # Source / Category labels
    source_label = "Platform"
    category_label = "Platform Alert"
    
    if "day" in title.lower() or "day_trader" in body.lower():
        source_label = "Day Trader"
    elif "shariah" in title.lower() or "compliance" in title.lower() or "rebalance" in title.lower():
        source_label = "Shariah Algo Trader"

    if "compliance" in title.lower() or "compliance" in body.lower():
        category_label = "Compliance"
    elif "rebalance" in title.lower() or "buy" in title.lower() or "sell" in title.lower():
        category_label = "Trade"

    # Styling accents
    accent_color = "#d97706"  # warm amber
    if severity == "critical":
        accent_color = "#ef4444"
    elif severity == "warning":
        accent_color = "#f59e0b"

    # Format ET timestamp
    try:
        dt = datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ")
        from datetime import timezone, timedelta
        dt_et = dt.replace(tzinfo=timezone.utc).astimezone(timezone(timedelta(hours=-4)))
        formatted_time = dt_et.strftime("%b %d, %Y, %I:%M %p") + " ET"
    except Exception:
        formatted_time = timestamp

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[{severity.upper()}] {title}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c0e; color: #d1d5db; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #121316; border: 1px solid #1e2025; border-radius: 6px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);">
    
    <!-- Branding Header -->
    <div style="padding: 32px 32px 16px 32px; text-align: left;">
      <!-- Logo Symbol -->
      <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="background-color: #d97706; width: 28px; height: 28px; text-align: center; vertical-align: middle; border-radius: 4px;">
            <span style="color: #0b0c0e; font-size: 16px; font-weight: bold; line-height: 28px; font-family: -apple-system, sans-serif;">↗</span>
          </td>
          <td style="padding-left: 10px; font-family: monospace; font-size: 11px; font-weight: bold; color: #f3f4f6; letter-spacing: 0.1em; text-transform: uppercase; vertical-align: middle;">
            Shariah Algo Trader
          </td>
        </tr>
      </table>
      
      <span style="font-family: monospace; font-size: 10px; font-weight: bold; color: {accent_color}; letter-spacing: 0.15em; text-transform: uppercase;">
        [{source_label} // {category_label}]
      </span>
      <h1 style="font-family: Georgia, Cambria, 'Times New Roman', Times, serif; font-size: 22px; font-weight: normal; color: #f3f4f6; margin: 10px 0 0 0; line-height: 1.3;">
        {title}
      </h1>
    </div>

    <!-- Alert Details -->
    <div style="padding: 0 32px 32px 32px; line-height: 1.7; font-size: 13.5px;">
      <p style="color: #9ca3af; margin: 0 0 24px 0; font-weight: normal;">
        {body}
      </p>
      
      <!-- Minimalist Metadata List -->
      <div style="border-top: 1px solid #1e2025; border-bottom: 1px solid #1e2025; padding: 16px 0; margin-top: 24px;">
        <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 11px; color: #9ca3af; font-family: monospace;">
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 120px; text-transform: uppercase; letter-spacing: 0.05em;">Severity</td>
            <td style="padding: 4px 0; color: {accent_color}; font-weight: bold; text-transform: uppercase;">{severity}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 120px; text-transform: uppercase; letter-spacing: 0.05em;">Source</td>
            <td style="padding: 4px 0; color: #f3f4f6;">{source_label}</td>
          </tr>
          <tr>
            <td style="padding: 4px 0; font-weight: bold; width: 120px; text-transform: uppercase; letter-spacing: 0.05em;">Logged At</td>
            <td style="padding: 4px 0; color: #f3f4f6;">{formatted_time}</td>
          </tr>
        </table>
      </div>
    </div>

    <!-- Minimal CTA Button -->
    <div style="padding: 0 32px 40px 32px; text-align: left;">
      <a href="https://shariahtrading.my" style="display: inline-block; border: 1px solid {accent_color}; color: {accent_color}; font-size: 11px; font-weight: bold; font-family: monospace; text-decoration: none; padding: 10px 20px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s;">
        Access Console Log &rarr;
      </a>
    </div>

    <!-- Elegant Sub-Footer -->
    <div style="background-color: #0c0d10; padding: 20px 32px; font-size: 10px; font-family: monospace; color: #4b5563; text-align: left; border-top: 1px solid #1e2025; line-height: 1.5;">
      SYSTEM RECORD // Do not reply to this automated transaction alert. Sent to verified subscriber address.
    </div>

  </div>
</body>
</html>
"""
    subject = f"[{severity.upper()}] {title} — Shariah Algo Trader"
    return send_email(subject, html)


def send_daily_digest() -> bool:
    """Query today's notifications and send a consolidated email summary in an elegant editorial layout with performance metrics."""
    from dashboard.api.db import fetch_notifications
    from dashboard.api.deps import get_alpaca

    today_str = datetime.now().strftime("%Y-%m-%d")
    
    # ── 1. Fetch Shariah Account ──────────────────────────────────────────────
    shariah_equity = 0.0
    shariah_pl = 0.0
    shariah_pl_pct = 0.0
    try:
        client = get_alpaca()
        acct = client.get("/v2/account")
        shariah_equity = float(acct["equity"])
        last_equity = float(acct.get("last_equity") or shariah_equity)
        shariah_pl = shariah_equity - last_equity
        shariah_pl_pct = (shariah_pl / last_equity * 100) if last_equity else 0.0
    except Exception as e:
        logger.warning("Failed to fetch Shariah account for email: %s", e)

    # ── 2. Fetch Day Trader Account (if configured) ───────────────────────────
    day_equity = None
    day_pl = 0.0
    day_pl_pct = 0.0
    day_key = os.environ.get("DAY_ALPACA_API_KEY")
    day_secret = os.environ.get("DAY_ALPACA_API_SECRET")
    day_url = os.environ.get("DAY_ALPACA_BASE_URL", "https://paper-api.alpaca.markets")
    if day_key and day_secret:
        try:
            from shariah_algo_trader.execution.alpaca_client import AlpacaClient
            day_client = AlpacaClient(day_key, day_secret, day_url)
            day_acct = day_client.get("/v2/account")
            day_equity = float(day_acct["equity"])
            day_last_equity = float(day_acct.get("last_equity") or day_equity)
            day_pl = day_equity - day_last_equity
            day_pl_pct = (day_pl / day_last_equity * 100) if day_last_equity else 0.0
        except Exception as e:
            logger.warning("Failed to fetch Day Trader account for email: %s", e)

    # ── 3. Fetch 1-Month Return Comparison ────────────────────────────────────
    comparison_html = ""
    try:
        from dashboard.api.routers.performance import get_performance
        perf = get_performance(client)
        if perf.dates and len(perf.portfolio_cumulative) > 0:
            port_ret = perf.portfolio_cumulative[-1] * 100
            spus_ret = perf.benchmark_cumulative[-1] * 100
            spy_ret = perf.sp500_cumulative[-1] * 100
            
            port_color = "#10b981" if port_ret >= 0 else "#ef4444"
            port_sign = "+" if port_ret >= 0 else ""
            
            spus_color = "#10b981" if spus_ret >= 0 else "#ef4444"
            spus_sign = "+" if spus_ret >= 0 else ""
            
            spy_color = "#10b981" if spy_ret >= 0 else "#ef4444"
            spy_sign = "+" if spy_ret >= 0 else ""
            
            comparison_html = f"""
    <!-- 1-Month Returns Comparison -->
    <div style="border-bottom: 1px solid #1e2025; padding: 20px 0; margin-bottom: 16px; text-align: left;">
      <span style="font-family: monospace; font-size: 9px; font-weight: bold; color: #4b5563; letter-spacing: 0.15em; text-transform: uppercase;">
        1-Month Cumulative Return vs Benchmarks
      </span>
      <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; margin-top: 10px; font-family: monospace;">
        <tr>
          <td style="color: #f3f4f6; padding: 6px 0; font-weight: bold;">Our Portfolio</td>
          <td align="right" style="color: {port_color}; font-weight: bold; padding: 6px 0;">{port_sign}{port_ret:,.2f}%</td>
        </tr>
        <tr>
          <td style="color: #9ca3af; padding: 6px 0;">SPUS (Halal Benchmark)</td>
          <td align="right" style="color: {spus_color}; padding: 6px 0;">{spus_sign}{spus_ret:,.2f}%</td>
        </tr>
        <tr>
          <td style="color: #9ca3af; padding: 6px 0;">S&P 500 (SPY)</td>
          <td align="right" style="color: {spy_color}; padding: 6px 0;">{spy_sign}{spy_ret:,.2f}%</td>
        </tr>
      </table>
    </div>
            """
    except Exception as e:
        logger.warning("Failed to calculate benchmark performance comparison for email: %s", e)

    # Format Performance columns
    shariah_color = "#10b981" if shariah_pl >= 0 else "#ef4444"
    shariah_sign = "+" if shariah_pl >= 0 else ""
    
    day_trader_col = ""
    col_width = "100%"
    if day_equity is not None:
        col_width = "50%"
        day_color = "#10b981" if day_pl >= 0 else "#ef4444"
        day_sign = "+" if day_pl >= 0 else ""
        day_trader_col = f"""
        <td valign="top" style="width: 50%; padding-left: 20px; border-left: 1px solid #1e2025; text-align: left;">
          <span style="font-family: monospace; font-size: 9px; font-weight: bold; color: #4b5563; letter-spacing: 0.15em; text-transform: uppercase;">
            Day Trader
          </span>
          <div style="font-family: Georgia, serif; font-size: 20px; color: #f3f4f6; margin-top: 6px;">
            ${day_equity:,.2f}
          </div>
          <div style="font-size: 11px; font-family: monospace; color: {day_color}; margin-top: 4px;">
            {day_sign}${day_pl:,.2f} ({day_sign}{day_pl_pct:,.2f}%)
          </div>
        </td>
        """

    performance_html = f"""
    <!-- Performance Summary Card -->
    <div style="border-top: 1px solid #1e2025; border-bottom: 1px solid #1e2025; padding: 24px 0; margin-bottom: 8px;">
      <table border="0" cellpadding="0" cellspacing="0" width="100%">
        <tr>
          <!-- Shariah Trader Column -->
          <td valign="top" style="width: {col_width}; padding-right: 20px; text-align: left;">
            <span style="font-family: monospace; font-size: 9px; font-weight: bold; color: #d97706; letter-spacing: 0.15em; text-transform: uppercase;">
              Shariah Trader
            </span>
            <div style="font-family: Georgia, serif; font-size: 20px; color: #f3f4f6; margin-top: 6px;">
              ${shariah_equity:,.2f}
            </div>
            <div style="font-size: 11px; font-family: monospace; color: {shariah_color}; margin-top: 4px;">
              {shariah_sign}${shariah_pl:,.2f} ({shariah_sign}{shariah_pl_pct:,.2f}%)
            </div>
          </td>
          
          {day_trader_col}
        </tr>
      </table>
    </div>
    """

    rows = fetch_notifications(limit=100)
    today_items = [r for r in rows if r["created_at"].startswith(today_str)]

    items_html = ""
    for r in today_items:
        severity = r["severity"]
        title = r["title"]
        body = r["body"]
        try:
            ts = r["created_at"].split("T")[1][:5]
        except IndexError:
            ts = "--:--"

        color = "#d97706"  # warm amber
        if severity == "critical":
            color = "#ef4444"
        elif severity == "warning":
            color = "#f59e0b"

        items_html += f"""
        <div style="padding: 20px 0; border-bottom: 1px dashed #1e2025; text-align: left;">
          <table border="0" cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td style="font-family: Georgia, serif; font-size: 15px; color: #f3f4f6;">{title}</td>
              <td align="right" style="font-family: monospace; font-size: 10px; color: #4b5563;">{ts} UTC</td>
            </tr>
          </table>
          <div style="font-size: 12px; color: #9ca3af; margin-top: 6px; line-height: 1.6; font-family: -apple-system, sans-serif;">{body}</div>
        </div>
        """

    html = f"""<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Daily Summary — Shariah Algo Trader</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0b0c0e; color: #d1d5db; margin: 0; padding: 40px 20px;">
  <div style="max-width: 520px; margin: 0 auto; background-color: #121316; border: 1px solid #1e2025; border-radius: 6px; overflow: hidden; box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);">
    
    <!-- Branding Header -->
    <div style="padding: 32px 32px 12px 32px; text-align: left;">
      <!-- Logo Symbol -->
      <table border="0" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="background-color: #d97706; width: 28px; height: 28px; text-align: center; vertical-align: middle; border-radius: 4px;">
            <span style="color: #0b0c0e; font-size: 16px; font-weight: bold; line-height: 28px; font-family: -apple-system, sans-serif;">↗</span>
          </td>
          <td style="padding-left: 10px; font-family: monospace; font-size: 11px; font-weight: bold; color: #f3f4f6; letter-spacing: 0.1em; text-transform: uppercase; vertical-align: middle;">
            Shariah Algo Trader
          </td>
        </tr>
      </table>
      
      <h1 style="font-family: Georgia, Cambria, 'Times New Roman', Times, serif; font-size: 22px; font-weight: normal; color: #f3f4f6; margin: 0; line-height: 1.3;">
        Daily Activity Summary
      </h1>
      <p style="font-size: 11px; font-family: monospace; color: #4b5563; margin: 6px 0 0 0;">
        SYSTEM COMPILATION FOR {today_str}
      </p>
    </div>

    <!-- Digest List -->
    <div style="padding: 24px 32px 32px 32px;">
      {performance_html}
      {comparison_html}
      <div>
        {items_html}
      </div>
    </div>

    <!-- Minimal CTA Button -->
    <div style="padding: 0 32px 40px 32px; text-align: left;">
      <a href="https://shariahtrading.my" style="display: inline-block; border: 1px solid #d97706; color: #d97706; font-size: 11px; font-weight: bold; font-family: monospace; text-decoration: none; padding: 10px 20px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.1em; transition: all 0.2s;">
        Open Full Audit Log &rarr;
      </a>
    </div>

    <!-- Elegant Sub-Footer -->
    <div style="background-color: #0c0d10; padding: 20px 32px; font-size: 10px; font-family: monospace; color: #4b5563; text-align: left; border-top: 1px solid #1e2025; line-height: 1.5;">
      SYSTEM RECORD // Do not reply to this automated transaction digest. Sent to verified subscriber address.
    </div>

  </div>
</body>
</html>
"""
    subject = f"Daily Activity Summary ({today_str}) — Shariah Algo Trader"
    return send_email(subject, html)
