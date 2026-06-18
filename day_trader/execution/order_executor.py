import logging

from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)


class DayOrderExecutor:
    def __init__(self, client: AlpacaClient):
        self._client = client

    def _equity(self) -> float:
        return float(self._client.get("/v2/account")["equity"])

    def buy(self, symbol: str, position_size_pct: float) -> float | None:
        """Submit a market buy for position_size_pct × equity.

        Returns the notional spent, or None on failure.
        """
        equity = self._equity()
        notional = round(equity * position_size_pct, 2)
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

    def sell(self, symbol: str, reason: str = "signal") -> None:
        """Liquidate the full intraday position for symbol."""
        try:
            self._client.delete(f"/v2/positions/{symbol}")
            logger.info("DAY SELL %s — %s", symbol, reason)
        except Exception as exc:
            logger.error("DAY SELL %s failed: %s", symbol, exc)

    def close_all(self) -> None:
        """Liquidate all open positions (EOD)."""
        try:
            positions = self._client.get("/v2/positions")
            if not positions:
                logger.info("EOD liquidation — no open positions")
                return
            for pos in positions:
                self.sell(pos["symbol"], reason="EOD liquidation")
            logger.info("EOD liquidation complete — %d position(s) closed", len(positions))
        except Exception as exc:
            logger.error("EOD liquidation failed: %s", exc)
