import logging

from shariah_algo_trader.execution.alpaca_client import AlpacaClient

logger = logging.getLogger(__name__)

_MIN_TRADE_NOTIONAL = 25.0  # skip adjustments smaller than this
_CASH_BUFFER_PCT = 0.005  # hold back 0.5% of equity as a settlement/slippage buffer


class OrderExecutor:
    def __init__(self, client: AlpacaClient):
        self._client = client
        self._cash_remaining: float | None = None

    def _account(self) -> dict:
        return self._client.get("/v2/account")

    def _equity(self) -> float:
        return float(self._account()["equity"])

    def start_cycle(self) -> None:
        """Reset tracked cash so it's re-read fresh. Call once before each rebalance pass."""
        self._cash_remaining = None

    def _reserve_cash(self, notional: float) -> float:
        """Cap a buy's notional to cash actually available, decrementing a running tally.

        Cash is read from the live account once per cycle (not once per order) because
        Alpaca doesn't reflect an order's cash impact instantly — re-querying between
        every order in a tight rebalance loop would still let orders collectively
        overspend. A fixed equity buffer absorbs fill slippage on the rest.
        """
        if self._cash_remaining is None:
            account = self._account()
            buffer = float(account["equity"]) * _CASH_BUFFER_PCT
            self._cash_remaining = max(float(account["cash"]) - buffer, 0.0)
        capped = round(max(min(notional, self._cash_remaining), 0.0), 2)
        self._cash_remaining -= capped
        return capped

    def buy(self, ticker: str, weight: float = 0.05) -> None:
        """Submit a market buy for `weight` × portfolio equity, capped to available cash."""
        equity = self._equity()
        notional = self._reserve_cash(round(equity * weight, 2))
        if notional < _MIN_TRADE_NOTIONAL:
            logger.warning("SKIP BUY %s — insufficient cash ($%.2f available)", ticker, notional)
            return
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
        if side == "buy":
            notional = self._reserve_cash(notional)
            if notional < _MIN_TRADE_NOTIONAL:
                logger.warning("SKIP ADJUST %s — insufficient cash ($%.2f available)", ticker, notional)
                return
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
