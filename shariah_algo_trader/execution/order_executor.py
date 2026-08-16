import logging
import time

from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

logger = logging.getLogger(__name__)

_MIN_TRADE_NOTIONAL = 1.0  # Alpaca Live supports fractional shares down to $1 notional
_CASH_BUFFER_PCT = 0.005  # hold back 0.5% of equity as a settlement/slippage buffer


class OrderExecutor:
    def __init__(self, client: AlpacaClient):
        self._client = client
        self._cash_remaining: float | None = None
        self._pending_sells: set[str] = set()

    def _account(self) -> dict:
        return self._client.get("/v2/account")

    def _equity(self) -> float:
        return float(self._account()["equity"])

    def start_cycle(self) -> None:
        """Read live cash into the tracked pool. Call once before each rebalance pass.

        Reading eagerly (rather than on first buy) means sells submitted during
        the cycle can credit this pool directly — the broker's own `cash` field
        won't reflect those fills until they settle, so the executor tracks it.
        """
        self._cash_remaining = self._read_cash_pool()

    def _read_cash_pool(self) -> float:
        account = self._account()
        buffer = float(account["equity"]) * _CASH_BUFFER_PCT
        return max(float(account["cash"]) - buffer, 0.0)

    def _credit_cash(self, amount: float) -> None:
        """Add freed-up cash back to the tracked pool, if a cycle is in progress."""
        if self._cash_remaining is not None:
            self._cash_remaining += amount

    def settle_sells(self, timeout: float = 30.0) -> None:
        """Wait for pending sell fills so the broker's buying power reflects them.

        On cash accounts, a sell's proceeds are NOT immediately spendable:
        submitting a buy 0.2s after a sell (as the old code did) hits Alpaca
        with the pre-fill buying power and gets 403. This polls the order book
        until every tracked sell is filled (or the timeout), then re-syncs the
        internal cash pool to the broker's actual account. Safe no-op when no
        sells were tracked this cycle.
        """
        if self._pending_sells:
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline and self._pending_sells:
                try:
                    orders = self._client.get("/v2/orders?status=all&limit=200")
                    for order in orders:
                        symbol = order.get("symbol")
                        if symbol in self._pending_sells and order.get("status") == "filled":
                            self._pending_sells.discard(symbol)
                except Exception as exc:
                    logger.warning("settle_sells poll error (will retry): %s", exc)
                if self._pending_sells:
                    time.sleep(1.0)
            if self._pending_sells:
                logger.warning(
                    "settle_sells timed out after %.0fs — %d sell(s) not confirmed filled: %s",
                    timeout, len(self._pending_sells), sorted(self._pending_sells),
                )
        # Re-sync the tracked pool to the broker's real cash so buys can never
        # overspend the buying power the broker will actually grant.
        try:
            account = self._account()
            broker_cash = float(account.get("cash") or 0.0)
            buffer = float(account.get("equity") or 0.0) * _CASH_BUFFER_PCT
            self._cash_remaining = max(broker_cash - buffer, 0.0)
        except Exception as exc:
            logger.warning("settle_sells cash re-sync failed: %s", exc)

    def _reserve_cash(self, notional: float) -> float:
        """Cap a buy's notional to cash actually available, decrementing a running tally.

        Cash is read from the live account once per cycle (not once per order) because
        Alpaca doesn't reflect an order's cash impact instantly — re-querying between
        every order in a tight rebalance loop would still let orders collectively
        overspend. A fixed equity buffer absorbs fill slippage on the rest.
        """
        if self._cash_remaining is None:
            self._cash_remaining = self._read_cash_pool()
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
        try:
            self._client.post("/v2/orders", {
                "symbol": ticker,
                "notional": notional,
                "side": "buy",
                "type": "market",
                "time_in_force": "day",
            })
        except AlpacaError as exc:
            if "403" not in str(exc):
                raise
            # 403 on a buy right after sells = cash-account settlement race.
            # Re-sync with the broker and retry once; if still 403, surface it.
            logger.warning("BUY %s hit 403 — re-syncing cash and retrying: %s", ticker, exc)
            self.settle_sells(timeout=15.0)
            self._client.post("/v2/orders", {
                "symbol": ticker,
                "notional": notional,
                "side": "buy",
                "type": "market",
                "time_in_force": "day",
            })
        logger.info("BUY %s — $%.2f (%.1f%% of $%.2f equity)", ticker, notional, weight * 100, equity)

    def sell(self, ticker: str, value: float = 0.0) -> bool:
        """Liquidate the full position for ticker. Returns True on success.

        `value` is the position's known market value — credited back into the
        cash pool so a later buy in the same cycle can spend it.
        """
        try:
            self._client.delete(f"/v2/positions/{ticker}")
            logger.info("SELL %s — full position liquidated", ticker)
            self._credit_cash(value)
            self._pending_sells.add(ticker)
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
        try:
            self._client.post("/v2/orders", {
                "symbol": ticker,
                "notional": notional,
                "side": side,
                "type": "market",
                "time_in_force": "day",
            })
        except AlpacaError as exc:
            if "403" not in str(exc) or side != "buy":
                raise
            # 403 on a buy right after sells = cash-account settlement race.
            # Re-sync with the broker and retry once; if still 403, surface it.
            logger.warning("ADJUST %s hit 403 — re-syncing cash and retrying: %s", ticker, exc)
            self.settle_sells(timeout=15.0)
            self._client.post("/v2/orders", {
                "symbol": ticker,
                "notional": notional,
                "side": side,
                "type": "market",
                "time_in_force": "day",
            })
        if side == "sell":
            self._credit_cash(notional)
        logger.info(
            "ADJUST %s %s $%.2f → target %.1f%% ($%.2f)",
            ticker, side.upper(), notional, target_weight * 100, target_notional,
        )
