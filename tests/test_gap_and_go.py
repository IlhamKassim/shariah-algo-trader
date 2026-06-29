from day_trader.signals.gap_and_go import compute_gap, is_valid_gap_entry
from day_trader.state import GapData

_ADV = 500_000


def _gap(gap_pct=0.04, rvol=2.0, prev_close=100.0):
    gap_amount = prev_close * gap_pct
    return GapData(prev_close=prev_close, gap_pct=gap_pct, gap_amount=gap_amount, rvol=rvol)


class TestComputeGap:
    def test_returns_none_when_prev_close_zero(self):
        assert compute_gap("AAPL", 105.0, 0.0, 10_000, _ADV) is None

    def test_returns_none_when_open_price_zero(self):
        assert compute_gap("AAPL", 0.0, 100.0, 10_000, _ADV) is None

    def test_gap_pct_computed_correctly(self):
        result = compute_gap("AAPL", 103.0, 100.0, 10_000, _ADV)
        assert result is not None
        assert abs(result.gap_pct - 0.03) < 0.001

    def test_gap_amount_computed_correctly(self):
        result = compute_gap("AAPL", 103.0, 100.0, 10_000, _ADV)
        assert result is not None
        assert abs(result.gap_amount - 3.0) < 0.01

    def test_rvol_computed_correctly(self):
        # ADV=500_000, expected 1-min vol = 500_000/390 ≈ 1282
        # first_min_vol=3846 → rvol ≈ 3.0
        result = compute_gap("AAPL", 103.0, 100.0, 3_846, _ADV)
        assert result is not None
        assert abs(result.rvol - 3.0) < 0.1

    def test_rvol_zero_adv_does_not_crash(self):
        result = compute_gap("AAPL", 103.0, 100.0, 0, 0)
        assert result is not None
        # expected=1 (max guard), rvol = 0/1 = 0
        assert result.rvol == 0.0

    def test_negative_gap_is_valid(self):
        # Gaps down are valid to compute (just won't pass entry filter)
        result = compute_gap("AAPL", 97.0, 100.0, 5_000, _ADV)
        assert result is not None
        assert result.gap_pct < 0


class TestIsValidGapEntry:
    def test_passes_when_gap_and_rvol_sufficient(self):
        gap = _gap(gap_pct=0.04, rvol=2.0)
        assert is_valid_gap_entry("AAPL", gap, gap_threshold=0.03, rvol_threshold=1.5)

    def test_fails_when_gap_too_small(self):
        gap = _gap(gap_pct=0.02, rvol=2.0)
        assert not is_valid_gap_entry("AAPL", gap, gap_threshold=0.03, rvol_threshold=1.5)

    def test_fails_when_rvol_too_low(self):
        gap = _gap(gap_pct=0.04, rvol=1.0)
        assert not is_valid_gap_entry("AAPL", gap, gap_threshold=0.03, rvol_threshold=1.5)

    def test_fails_when_gap_is_negative(self):
        gap = _gap(gap_pct=-0.02, rvol=2.0)
        assert not is_valid_gap_entry("AAPL", gap, gap_threshold=0.03)

    def test_thresholds_are_configurable(self):
        gap = _gap(gap_pct=0.025, rvol=1.2)
        # fails at defaults (0.03 / 1.5)
        assert not is_valid_gap_entry("AAPL", gap, gap_threshold=0.03, rvol_threshold=1.5)
        # passes at relaxed thresholds
        assert is_valid_gap_entry("AAPL", gap, gap_threshold=0.02, rvol_threshold=1.0)

    def test_exactly_at_threshold_fails(self):
        # boundary: gap_pct=0.03 with threshold=0.03 should pass (>=)
        gap = _gap(gap_pct=0.03, rvol=1.5)
        assert is_valid_gap_entry("AAPL", gap, gap_threshold=0.03, rvol_threshold=1.5)
