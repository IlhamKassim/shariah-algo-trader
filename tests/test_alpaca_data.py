from unittest.mock import MagicMock, patch

from day_trader.data.alpaca_data import compute_opening_ranges


class TestComputeOpeningRanges:
    def test_reduces_bars_to_high_low_per_symbol(self):
        bars = {
            "AAPL": [
                {"h": 101.0, "l": 99.5, "v": 1000},
                {"h": 102.5, "l": 100.0, "v": 2000},
            ],
        }
        with patch("day_trader.data.alpaca_data.fetch_opening_range_bars", return_value=bars):
            ranges = compute_opening_ranges(MagicMock(), ["AAPL"], orb_minutes=15)
        assert ranges == {"AAPL": (102.5, 99.5)}

    def test_skips_symbol_with_no_bars(self):
        with patch("day_trader.data.alpaca_data.fetch_opening_range_bars", return_value={"AAPL": []}):
            ranges = compute_opening_ranges(MagicMock(), ["AAPL"], orb_minutes=15)
        assert ranges == {}

    def test_skips_bars_missing_high_low_keys(self):
        bars = {"AAPL": [{"v": 1000}]}
        with patch("day_trader.data.alpaca_data.fetch_opening_range_bars", return_value=bars):
            ranges = compute_opening_ranges(MagicMock(), ["AAPL"], orb_minutes=15)
        assert ranges == {}

    def test_multiple_symbols(self):
        bars = {
            "AAPL": [{"h": 101.0, "l": 99.5, "v": 1000}],
            "MSFT": [{"h": 305.0, "l": 300.0, "v": 500}],
        }
        with patch("day_trader.data.alpaca_data.fetch_opening_range_bars", return_value=bars):
            ranges = compute_opening_ranges(MagicMock(), ["AAPL", "MSFT"], orb_minutes=15)
        assert ranges == {"AAPL": (101.0, 99.5), "MSFT": (305.0, 300.0)}
