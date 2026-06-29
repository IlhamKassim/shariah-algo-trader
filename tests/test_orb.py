from day_trader.signals.orb import compute_orb, compute_stop_loss, is_breakout
from day_trader.state import ORBData

_ORB_MINUTES = 30


def _bar(h, l, v, o=None):
    return {"h": h, "l": l, "v": v, "o": o if o is not None else l, "c": h, "t": "2024-01-02T09:30:00Z"}


def _orb(high=10.0, low=9.0, open_vol=100_000, adv=500_000, rvol=None, gap_pct=0.03):
    if rvol is None:
        expected = adv * (_ORB_MINUTES / 390)
        rvol = open_vol / max(expected, 1) if adv > 0 else 0.0
    vwap = (high + low) / 2
    return ORBData(high=high, low=low, open_volume=open_vol, avg_daily_volume=adv, rvol=rvol, vwap=vwap, gap_pct=gap_pct)


class TestComputeORB:
    def test_returns_none_when_fewer_than_two_bars(self):
        assert compute_orb("AAPL", [], 1_000_000) is None
        assert compute_orb("AAPL", [_bar(10, 9, 100)], 1_000_000) is None

    def test_correct_high_low_volume(self):
        bars = [_bar(10.5, 9.0, 80_000), _bar(11.0, 9.5, 50_000), _bar(10.0, 8.5, 30_000)]
        result = compute_orb("AAPL", bars, 500_000)
        assert result is not None
        assert result.high == 11.0
        assert result.low == 8.5
        assert result.open_volume == 160_000
        assert result.avg_daily_volume == 500_000

    def test_rvol_computed_correctly(self):
        bars = [_bar(10.5, 9.0, 80_000), _bar(11.0, 9.5, 80_000)]
        result = compute_orb("AAPL", bars, 500_000, orb_minutes=30)
        assert result is not None
        # expected = 500_000 * 30/390 ≈ 38_462; rvol = 160_000 / 38_462 ≈ 4.16
        assert result.rvol > 4.0

    def test_vwap_within_high_low_range(self):
        bars = [_bar(10.5, 9.0, 80_000), _bar(11.0, 9.5, 50_000)]
        result = compute_orb("AAPL", bars, 500_000)
        assert result is not None
        assert result.low <= result.vwap <= result.high

    def test_gap_pct_computed_from_prev_close(self):
        bars = [_bar(10.5, 9.0, 80_000, o=10.2), _bar(11.0, 9.5, 50_000)]
        result = compute_orb("AAPL", bars, 500_000, prev_close=10.0)
        assert result is not None
        # gap = (10.2 - 10.0) / 10.0 = 2%
        assert abs(result.gap_pct - 0.02) < 0.001

    def test_gap_pct_zero_when_no_prev_close(self):
        bars = [_bar(10, 9, 50_000), _bar(11, 8, 50_000)]
        result = compute_orb("AAPL", bars, 500_000, prev_close=0.0)
        assert result is not None
        assert result.gap_pct == 0.0

    def test_two_bar_minimum(self):
        bars = [_bar(10, 9, 50_000), _bar(11, 8, 50_000)]
        result = compute_orb("AAPL", bars, 500_000)
        assert result is not None
        assert result.high == 11.0
        assert result.low == 8.0


class TestIsBreakout:
    def test_no_breakout_when_price_at_or_below_high(self):
        orb = _orb(high=10.0, open_vol=120_000, adv=500_000)
        assert not is_breakout("AAPL", 10.0, orb)
        assert not is_breakout("AAPL", 9.5, orb)

    def test_breakout_confirmed_above_high_with_sufficient_rvol(self):
        orb = _orb(high=10.0, open_vol=120_000, adv=500_000)
        # rvol = 120_000 / (500_000 * 30/390) ≈ 3.12 > 1.5 threshold
        assert is_breakout("AAPL", 10.01, orb, rvol_threshold=1.5)

    def test_no_breakout_when_rvol_below_threshold(self):
        orb = _orb(high=10.0, open_vol=50_000, adv=500_000)
        # rvol = 50_000 / (500_000 * 30/390) ≈ 1.30 < 1.5 threshold
        assert not is_breakout("AAPL", 10.5, orb, rvol_threshold=1.5)

    def test_breakout_skips_rvol_check_when_adv_is_zero(self):
        orb = _orb(high=10.0, open_vol=0, adv=0, rvol=0.0)
        assert is_breakout("AAPL", 10.5, orb)

    def test_rvol_threshold_is_configurable(self):
        orb = _orb(high=10.0, open_vol=50_000, adv=500_000)
        # rvol ≈ 1.30 — fails at 1.5 but passes at 1.0
        assert not is_breakout("AAPL", 10.5, orb, rvol_threshold=1.5)
        assert is_breakout("AAPL", 10.5, orb, rvol_threshold=1.0)


class TestComputeStopLoss:
    def test_uses_orb_low_when_tighter_than_pct_stop(self):
        # entry=10, orb_low=9.8 — pct stop = 10 * 0.98 = 9.8 → equal, max = 9.8
        result = compute_stop_loss(entry_price=10.0, orb_low=9.8, stop_loss_pct=0.02)
        assert result == 9.8

    def test_uses_pct_stop_when_tighter_than_orb_low(self):
        # entry=10, orb_low=5.0 — pct stop = 10 * 0.98 = 9.8 > 5.0
        result = compute_stop_loss(entry_price=10.0, orb_low=5.0, stop_loss_pct=0.02)
        assert result == 9.8

    def test_stop_is_always_below_entry(self):
        result = compute_stop_loss(entry_price=100.0, orb_low=95.0, stop_loss_pct=0.03)
        assert result < 100.0
