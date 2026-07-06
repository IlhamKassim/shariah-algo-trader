import logging

from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

_CASH_BUFFER_PCT = 0.005  # hold back 0.5% of equity as a settlement/slippage buffer


class DayOrderExecutor:
    def __init__(self, client: AlpacaClient):
        self._client = client
        self._cash_remaining: float | None = None

    def _account(self) -> dict:
        return self._client.get("/v2/account")

    def _equity(self) -> float:
        return float(self._account()["equity"])

    def equity(self) -> float | None:
        """Return current account equity, or None on API failure."""
        try:
            return self._equity()
        except Exception as exc:
            logger.error("Failed to fetch equity: %s", exc)
            return None

    def start_cycle(self) -> None:
        """Reset tracked cash so it's re-read fresh. Call once before each market scan."""
        self._cash_remaining = None

    def _reserve_cash(self, notional: float) -> float:
        """Cap a buy's notional to cash actually available, decrementing a running tally.

        A single scan can enter several positions back-to-back; sizing each purely off
        equity (as before) let them collectively overspend settled cash. Cash is read
        once per cycle since Alpaca doesn't reflect an order's impact instantly.
        """
        if self._cash_remaining is None:
            account = self._account()
            buffer = float(account["equity"]) * _CASH_BUFFER_PCT
            self._cash_remaining = max(float(account["cash"]) - buffer, 0.0)
        capped = round(max(min(notional, self._cash_remaining), 0.0), 2)
        self._cash_remaining -= capped
        return capped

    def buy(self, symbol: str, position_size_pct: float) -> float | None:
        """Submit a market buy for position_size_pct × equity, capped to available cash.

        Returns the notional spent, or None on failure or insufficient cash.
        """
        equity = self._equity()
        notional = self._reserve_cash(round(equity * position_size_pct, 2))
        if notional <= 0:
            logger.warning("SKIP DAY BUY %s — no cash available", symbol)
            return None
        try:
            self._client.post("/v2/orders", {
                "symbol": symbol,
                "notional": notional,
                "side": "buy",
                "type": "market",
                "time_in_force": "day",
            })
            logger.info(
                "DAY BUY %s — $%.2f (%.0f%% of $%.2f equity)",
                symbol, notional, position_size_pct * 100, equity,
            )
            return notional
        except Exception as exc:
            logger.error("DAY BUY %s failed: %s", symbol, exc)
            return None

    def sell(self, symbol: str, reason: str = "signal") -> bool:
        """Liquidate the full intraday position for symbol. Returns True on success."""
        try:
            self._client.delete(f"/v2/positions/{symbol}")
            logger.info("DAY SELL %s — %s", symbol, reason)
            return True
        except Exception as exc:
            logger.error("DAY SELL %s failed: %s", symbol, exc)
            return False

    def list_positions(self) -> list[dict]:
        """Return Alpaca's current list of open positions for this account."""
        return self._client.get("/v2/positions")

    def close_all(self) -> set[str]:
        """Liquidate all open positions (EOD). Returns the set of symbols that failed."""
        failed: set[str] = set()
        try:
            positions = self.list_positions()
            if not positions:
                logger.info("EOD liquidation — no open positions")
                return failed
            for pos in positions:
                if not self.sell(pos["symbol"], reason="EOD liquidation"):
                    failed.add(pos["symbol"])
            closed = len(positions) - len(failed)
            logger.info(
                "EOD liquidation complete — %d closed, %d failed",
                closed, len(failed),
            )
        except Exception as exc:
            logger.error("EOD liquidation failed: %s", exc)
        return failed
