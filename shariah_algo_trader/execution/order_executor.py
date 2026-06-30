import logging

from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

_MIN_TRADE_NOTIONAL = 25.0  # skip adjustments smaller than this


class OrderExecutor:
    def __init__(self, client: AlpacaClient):
        self._client = client

    def _equity(self) -> float:
        return float(self._client.get("/v2/account")["equity"])

    def buy(self, ticker: str, weight: float = 0.05) -> None:
        """Submit a market buy for `weight` × portfolio equity."""
        equity = self._equity()
        notional = round(equity * weight, 2)
        self._client.post("/v2/orders", {
            "symbol": ticker,
            "notional": notional,
            "side": "buy",
            "type": "market",
            "time_in_force": "day",
        })
        logger.info("BUY %s — $%.2f (%.1f%% of $%.2f equity)", ticker, notional, weight * 100, equity)

    def sell(self, ticker: str) -> bool:
        """Liquidate the full position for ticker. Returns True on success."""
        try:
            self._client.delete(f"/v2/positions/{ticker}")
            logger.info("SELL %s — full position liquidated", ticker)
            return True
        except Exception as exc:
            logger.error("SELL %s failed: %s", ticker, exc)
            return False

    def adjust(self, ticker: str, target_weight: float, current_value: float) -> None:
        """Trim or top-up an existing position to reach target_weight × equity.

        No-ops if the required trade is below the minimum notional threshold.
        """
        equity = self._equity()
        target_notional = equity * target_weight
        delta = target_notional - current_value

        if abs(delta) < _MIN_TRADE_NOTIONAL:
            logger.debug(
                "SKIP %s — $%.2f adjustment below minimum $%.2f",
                ticker, abs(delta), _MIN_TRADE_NOTIONAL,
            )
            return

        side = "buy" if delta > 0 else "sell"
        notional = round(abs(delta), 2)
        self._client.post("/v2/orders", {
            "symbol": ticker,
            "notional": notional,
            "side": side,
            "type": "market",
            "time_in_force": "day",
        })
        logger.info(
            "ADJUST %s %s $%.2f → target %.1f%% ($%.2f)",
            ticker, side.upper(), notional, target_weight * 100, target_notional,
        )
