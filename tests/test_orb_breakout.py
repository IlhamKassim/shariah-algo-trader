from day_trader.signals.orb_breakout import is_valid_breakout_entry


class TestIsValidBreakoutEntry:
    def test_passes_when_above_range_and_rvol_sufficient(self):
        assert is_valid_breakout_entry("AAPL", 105.0, 100.0, rvol=2.0, rvol_threshold=1.5)

    def test_fails_when_price_at_range_high(self):
        # boundary: price must be strictly above the range high, not equal
        assert not is_valid_breakout_entry("AAPL", 100.0, 100.0, rvol=2.0, rvol_threshold=1.5)

    def test_fails_when_price_below_range_high(self):
        assert not is_valid_breakout_entry("AAPL", 99.0, 100.0, rvol=2.0, rvol_threshold=1.5)

    def test_fails_when_rvol_too_low(self):
        assert not is_valid_breakout_entry("AAPL", 105.0, 100.0, rvol=1.0, rvol_threshold=1.5)

    def test_thresholds_are_configurable(self):
        # fails at defaults (1.5)
        assert not is_valid_breakout_entry("AAPL", 105.0, 100.0, rvol=1.2, rvol_threshold=1.5)
        # passes at relaxed threshold
        assert is_valid_breakout_entry("AAPL", 105.0, 100.0, rvol=1.2, rvol_threshold=1.0)

    def test_exactly_at_rvol_threshold_passes(self):
        assert is_valid_breakout_entry("AAPL", 105.0, 100.0, rvol=1.5, rvol_threshold=1.5)
