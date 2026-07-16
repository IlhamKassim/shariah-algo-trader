# Phase 3: Real-Time Telegram Notification Integration #1

**Type:** Feature / Integration  
**Milestone:** Phase 3 — Messaging Integrations  
**Status:** Backlog  
**Assignee:** @antigravity  

---

## 📖 Description
Traders want real-time transaction updates directly on their mobile devices without checking the web dashboard. This issue implements **real-time push notifications to Telegram** for trades, compliance check exceptions, and platform-level infrastructure errors.

Users will be able to set up their own Telegram Bot Token and Chat ID inside the **Settings** page and toggle specific alert categories on or off.

---

## 🛠️ Technical Specifications

### 1. Database Schema Extension
Extend the user settings or a new `notification_preferences` SQLite table to store credentials securely (values will be blurred using our new passcode settings lock):
* `telegram_bot_token`: Masked text (e.g., `123456789:ABCdefGhI...`)
* `telegram_chat_id`: User's channel/group ID or user chat ID.
* `telegram_enabled`: Boolean preference.

### 2. Dispatcher Logic (`dashboard/api/telegram_service.py`)
Create a thread-safe helper to send messages via the Telegram Bot API:
```python
import requests

def send_telegram_message(bot_token: str, chat_id: str, text: str) -> bool:
    url = f"https://api.telegram.org/bot{bot_token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": text,
        "parse_mode": "HTML"
    }
    # Send request...
```

### 3. Log Hook integration
Inside `dashboard/api/notifications_seeder.py`, whenever a new notification is generated:
* If the event matches the user's category subscription toggles.
* Call the telegram dispatcher to send the message immediately.

### 4. Setting Form Updates (`Settings.tsx`)
In the **Authentication & Access** or a new **Notifications** tab in the Settings view:
* Bot Token Input (password-masked field).
* Chat ID Input.
* "Test Integration" button that sends a `↗ Test message from Shariah Algo Trader`.

---

## 🎨 Message Visual Styles

```
↗ <b>[CRITICAL] Compliance Check Failed</b>

<b>Source:</b> Shariah Algo Trader
<b>Logged:</b> Jul 16, 2026, 09:30 AM ET

Alpaca API returned HTTP 504 Gateway Timeout during universe re-ranking. Rebalance skipped.
```

---

## 📋 Acceptance Criteria
* [ ] DB supports Telegram configuration columns.
* [ ] Outgoing HTTP requests to Telegram Bot API are non-blocking (run on a background thread or async task).
* [ ] Bot token and Chat ID are obfuscated/blurred by default in Settings.
* [ ] Settings page includes a "Test Connection" button that validates credentials.
* [ ] Muting a source in settings successfully silences outgoing Telegram alerts.
* [ ] Documentation updated to explain how users can generate a custom bot token via `@BotFather`.
