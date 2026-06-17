from unittest.mock import patch
from shariah_algo_trader.factors.scorer import rank_by_factor_score

MOMENTUM = {"AAPL": 1.0, "MSFT": 0.5, "AMZN": -0.5, "GOOG": -1.0}
QUALITY  = {"AAPL": 0.8, "MSFT": 0.2, "AMZN": -0.2, "GOOG": -0.8}
VOL      = {"AAPL": 0.5, "MSFT": 0.3, "AMZN": -0.3, "GOOG": -0.5}
VALUE    = {"AAPL": 0.6, "MSFT": 0.1, "AMZN": -0.1, "GOOG": -0.6}
# Composite: AAPL=0.725, MSFT=0.275, AMZN=-0.275, GOOG=-0.725

_NO_SECTOR = {}  # patch _fetch_sectors to return this (no sector caps applied)


def _rank(*args, **kwargs):
    with patch("shariah_algo_trader.factors.scorer._fetch_sectors", return_value=_NO_SECTOR):
        return rank_by_factor_score(*args, **kwargs)


class TestRanking:
    def test_returns_top_n_tickers_in_descending_factor_score_order(self):
        result = _rank(MOMENTUM, QUALITY, VOL, VALUE, top_n=2)
        assert result == ["AAPL", "MSFT"]

    def test_returns_all_tickers_when_universe_smaller_than_top_n(self):
        result = _rank(MOMENTUM, QUALITY, VOL, VALUE, top_n=10)
        assert set(result) == {"AAPL", "MSFT", "AMZN", "GOOG"}
        assert len(result) == 4

    def test_ordering_is_descending_by_composite_score(self):
        result = _rank(MOMENTUM, QUALITY, VOL, VALUE, top_n=4)
        assert result == ["AAPL", "MSFT", "AMZN", "GOOG"]

    def test_tied_scores_produce_consistent_ordering(self):
        momentum = {"A": 1.0, "B": 1.0}
        quality  = {"A": 0.0, "B": 0.0}
        vol      = {"A": 0.0, "B": 0.0}
        value    = {"A": 0.0, "B": 0.0}

        result1 = _rank(momentum, quality, vol, value, top_n=2)
        result2 = _rank(momentum, quality, vol, value, top_n=2)

        assert set(result1) == {"A", "B"}
        assert result1 == result2


class TestMissingFactorData:
    def test_ticker_missing_from_quality_is_excluded(self):
        momentum = {"AAPL": 1.0, "MSFT": 0.5, "ORPHAN": 2.0}
        quality  = {"AAPL": 0.8, "MSFT": 0.2}

        result = _rank(momentum, quality, VOL, VALUE, top_n=3)

        assert "ORPHAN" not in result
        assert set(result) == {"AAPL", "MSFT"}

    def test_ticker_missing_from_momentum_is_excluded(self):
        momentum = {"AAPL": 1.0, "MSFT": 0.5}
        quality  = {"AAPL": 0.8, "MSFT": 0.2, "ORPHAN": 2.0}

        result = _rank(momentum, quality, VOL, VALUE, top_n=3)

        assert "ORPHAN" not in result
        assert set(result) == {"AAPL", "MSFT"}

    def test_missing_vol_and_value_use_neutral_score(self):
        # Tickers missing vol/value should still be included with neutral z=0
        result = _rank(MOMENTUM, QUALITY, {}, {}, top_n=4)
        assert set(result) == {"AAPL", "MSFT", "AMZN", "GOOG"}

    def test_empty_intersection_returns_empty_list(self):
        result = _rank({"AAPL": 1.0}, {"MSFT": 1.0}, {}, {}, top_n=5)
        assert result == []


class TestSectorCap:
    def test_sector_cap_limits_stocks_per_sector(self):
        # All 4 tickers in "Technology" — cap at 1 (25% of top_n=4)
        sectors = {"AAPL": "Technology", "MSFT": "Technology", "AMZN": "Technology", "GOOG": "Technology"}
        with patch("shariah_algo_trader.factors.scorer._fetch_sectors", return_value=sectors):
            result = rank_by_factor_score(MOMENTUM, QUALITY, VOL, VALUE, top_n=4, sector_cap=0.25)
        assert len(result) == 1
        assert result[0] == "AAPL"  # highest scorer

    def test_sector_cap_allows_diverse_selections(self):
        sectors = {"AAPL": "Technology", "MSFT": "Healthcare", "AMZN": "Consumer", "GOOG": "Technology"}
        with patch("shariah_algo_trader.factors.scorer._fetch_sectors", return_value=sectors):
            result = rank_by_factor_score(MOMENTUM, QUALITY, VOL, VALUE, top_n=4, sector_cap=0.25)
        # AAPL (Tech), MSFT (Healthcare), AMZN (Consumer) — GOOG capped out (Tech already at 1)
        assert "AAPL" in result
        assert "GOOG" not in result
