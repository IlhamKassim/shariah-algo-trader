# Multi-Broker Support & Architecture Roadmap

This document outlines the multi-broker design strategy for **Shariah Algo Trader**, allowing international and regional traders (particularly in Malaysia, Singapore, Hong Kong, and the US) to choose their preferred broker endpoint.

---

## 🏛️ Broker Ecosystem Overview

The trading engine is designed around a broker-agnostic adapter layer. While Alpaca serves as the default paper/live broker for US residents, regional brokers such as **Moomoo** and **Webull** are heavily utilized by international investors (e.g. in Malaysia, licensed under Securities Commission Malaysia).

### Broker Feature & Cost Matrix

| Feature | Alpaca | Moomoo (Malaysia/SG/HK/US) | Webull |
| :--- | :--- | :--- | :--- |
| **Primary Region** | US & Global (Paper/Live) | Malaysia, Singapore, HK, US | US, Singapore, Malaysia |
| **Connection Method** | REST API | Local **OpenD** Gateway + Python SDK (`moomoo-api`) | REST / OpenAPI SDK |
| **API Subscription Fee** | **$0 / Free** | **$0 / Free** | **$0 / Free** |
| **US Stock Commission** | $0.00 | $0 (Promo) / ~$1.99 min per trade (Standard) | $0.00 |
| **Paper Trading Support** | Yes (`paper-api.alpaca.markets`) | Yes (Simulated Trading via OpenD) | Yes |
| **Regulatory Compliance** | FINRA / SEC | SC Malaysia / MAS / SEC | SEC / FINRA / MAS |

---

## 💰 Fee & Turnover Analysis for Shariah Strategy

Because this bot operates a **Monthly Rebalancing** model (20 stocks held, top-N factor score ranking) with a **3% Drift Threshold** and a **$25 Notional Filter**, trade frequency remains low:

* **Monthly Trades**: ~5 to 10 orders per rebalance.
* **Alpaca Cost**: **$0.00 / month**
* **Moomoo MY Cost (Promotional)**: **$0.00 / month**
* **Moomoo MY Cost (Standard Rate ~$1.99/trade)**: **~$10.00 – $19.90 USD / month**
* **Webull Cost**: **$0.00 / month**

For a $10,000–$50,000 portfolio, a ~$15/month fee on Moomoo represents a negligible **~0.03% monthly drag**, making Moomoo an accessible option for Malaysian traders.

---

## 🔌 Moomoo OpenD Architecture

Moomoo API operates via a lightweight gateway daemon called **OpenD**:

```
+--------------------------+        TCP        +----------------------+        HTTPS/WSS        +--------------------+
|  Shariah Algo Trader Bot | <---------------> |  Moomoo OpenD Daemon | <---------------------> | Moomoo Broker API  |
|  (Python `moomoo-api`)   |    127.0.0.1:11111 |  (Local / Container) |                         |  Servers           |
+--------------------------+                   +----------------------+                         +--------------------+
```

1. **OpenD Gateway**: Runs locally or in a sidecar Docker container listening on port `11111`.
2. **Python Client**: `moomoo-api` connects to `OpenD` over TCP socket, routing order placement and retrieving live position data.

---

## 🗺️ Multi-Broker Integration Roadmap

### Phase 1: Broker Adapter Interface
Abstract position querying and order execution behind standard protocol interfaces:

```python
class BaseBrokerClient(Protocol):
    def get_positions(self) -> dict[str, float]: ...
    def get_equity(self) -> float: ...

class BaseOrderExecutor(Protocol):
    def buy(self, ticker: str, weight: float) -> None: ...
    def sell(self, ticker: str, value: float) -> bool: ...
    def adjust(self, ticker: str, target_weight: float, current_value: float) -> None: ...
```

### Phase 2: Configuration Selector (`.env`)
Allow users to select their active broker via environment variables:

```env
# Broker Selection: alpaca | moomoo | webull
BROKER_PROVIDER=alpaca

# Alpaca Config
ALPACA_API_KEY=your_alpaca_key
ALPACA_API_SECRET=your_alpaca_secret

# Moomoo Config (Optional)
MOOMOO_OPEND_HOST=127.0.0.1
MOOMOO_OPEND_PORT=11111
MOOMOO_ACC_ID=your_moomoo_account_id
```

### Phase 3: Driver Implementations
- `AlpacaOrderExecutor` (Existing)
- `MoomooOrderExecutor` (OpenD adapter)
- `WebullOrderExecutor` (Webull OpenAPI adapter)
