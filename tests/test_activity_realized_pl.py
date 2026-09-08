"""FIFO realized-P&L derivation for the Ledger (dashboard/api/routers/activity.py)."""

from dashboard.api.models import ActivityEntry
from dashboard.api.routers.activity import annotate_realized_pl


def fill(ts: str, symbol: str, side: str, qty: float, price: float) -> ActivityEntry:
    return ActivityEntry(
        timestamp=ts,
        level="INFO",
        type="order",
        message=f"{side} {symbol}",
        tickers=[symbol],
        symbol=symbol,
        side=side,
        qty=qty,
        price=price,
        notional=round(qty * price, 2),
    )


def by_ts(entries: list[ActivityEntry]) -> dict[str, ActivityEntry]:
    return {e.timestamp: e for e in entries}


def test_simple_round_trip():
    out = by_ts(annotate_realized_pl([
        fill("2026-01-01T10:00:00.000Z", "AAPL", "BUY", 10, 100.0),
        fill("2026-01-02T10:00:00.000Z", "AAPL", "SELL", 10, 110.0),
    ]))
    sell = out["2026-01-02T10:00:00.000Z"]
    assert sell.cost_basis == 100.0
    assert sell.realized_pl == 100.0          # (110 - 100) * 10
    assert sell.realized_pl_pct == 10.0       # percent units, not the fraction


def test_fifo_consumes_oldest_lot_first():
    out = by_ts(annotate_realized_pl([
        fill("2026-01-01T10:00:00.000Z", "MSFT", "BUY", 10, 100.0),
        fill("2026-01-02T10:00:00.000Z", "MSFT", "BUY", 10, 200.0),
        fill("2026-01-03T10:00:00.000Z", "MSFT", "SELL", 10, 150.0),
    ]))
    sell = out["2026-01-03T10:00:00.000Z"]
    # FIFO takes the $100 lot, not the $200 one and not the $150 average.
    assert sell.cost_basis == 100.0
    assert sell.realized_pl == 500.0


def test_sell_spanning_two_lots_uses_weighted_cost():
    out = by_ts(annotate_realized_pl([
        fill("2026-01-01T10:00:00.000Z", "NVDA", "BUY", 5, 100.0),
        fill("2026-01-02T10:00:00.000Z", "NVDA", "BUY", 5, 200.0),
        fill("2026-01-03T10:00:00.000Z", "NVDA", "SELL", 10, 250.0),
    ]))
    sell = out["2026-01-03T10:00:00.000Z"]
    assert sell.cost_basis == 150.0                     # (5*100 + 5*200) / 10
    assert sell.realized_pl == 1000.0                   # (250 - 150) * 10


def test_unmatched_sell_is_unknown_not_zero():
    """A position opened before the fill window has no derivable basis.

    Reporting 0.0 here would render as a real profit measured from a
    zero-cost lot — a false statement about money, not a missing value.
    """
    out = by_ts(annotate_realized_pl([
        fill("2026-01-02T10:00:00.000Z", "TSLA", "SELL", 10, 110.0),
    ]))
    sell = out["2026-01-02T10:00:00.000Z"]
    assert sell.realized_pl is None
    assert sell.realized_pl_pct is None
    assert sell.cost_basis is None


def test_partially_covered_sell_is_unknown():
    """Half the shares predate the window — the whole figure is unreliable."""
    out = by_ts(annotate_realized_pl([
        fill("2026-01-01T10:00:00.000Z", "AMD", "BUY", 5, 100.0),
        fill("2026-01-02T10:00:00.000Z", "AMD", "SELL", 10, 110.0),
    ]))
    assert out["2026-01-02T10:00:00.000Z"].realized_pl is None


def test_symbols_do_not_cross_contaminate():
    out = by_ts(annotate_realized_pl([
        fill("2026-01-01T10:00:00.000Z", "AAPL", "BUY", 10, 100.0),
        fill("2026-01-02T10:00:00.000Z", "MSFT", "SELL", 10, 110.0),
    ]))
    assert out["2026-01-02T10:00:00.000Z"].realized_pl is None  # no MSFT lot
    assert out["2026-01-01T10:00:00.000Z"].realized_pl is None  # buys carry none


def test_buys_never_carry_realized_pl():
    out = by_ts(annotate_realized_pl([
        fill("2026-01-01T10:00:00.000Z", "AAPL", "BUY", 10, 100.0),
    ]))
    assert out["2026-01-01T10:00:00.000Z"].realized_pl is None


def test_input_order_does_not_change_result():
    """Alpaca returns fills newest-first; FIFO must still walk them oldest-first."""
    newest_first = [
        fill("2026-01-03T10:00:00.000Z", "MSFT", "SELL", 10, 150.0),
        fill("2026-01-02T10:00:00.000Z", "MSFT", "BUY", 10, 200.0),
        fill("2026-01-01T10:00:00.000Z", "MSFT", "BUY", 10, 100.0),
    ]
    out = by_ts(annotate_realized_pl(newest_first))
    assert out["2026-01-03T10:00:00.000Z"].realized_pl == 500.0
    # Caller ordering is preserved.
    assert [e.timestamp for e in annotate_realized_pl(newest_first)] == [
        e.timestamp for e in newest_first
    ]
