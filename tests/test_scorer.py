import pytest
from shariah_algo_trader.factors.scorer import rank_by_factor_score


MOMENTUM = {"AAPL": 1.0, "MSFT": 0.5, "AMZN": -0.5, "GOOG": -1.0}
QUALITY  = {"AAPL": 0.8, "MSFT": 0.2, "AMZN": -0.2, "GOOG": -0.8}
# Factor scores: AAPL=0.90, MSFT=0.35, AMZN=-0.35, GOOG=-0.90


class TestRanking:
    def test_returns_top_n_tickers_in_descending_factor_score_order(self):
        result = rank_by_factor_score(MOMENTUM, QUALITY, top_n=2)

        assert result == ["AAPL", "MSFT"]

    def test_returns_all_tickers_when_universe_smaller_than_top_n(self):
        result = rank_by_factor_score(MOMENTUM, QUALITY, top_n=10)

        assert set(result) == {"AAPL", "MSFT", "AMZN", "GOOG"}
        assert len(result) == 4

    def test_ordering_is_descending_by_composite_score(self):
        result = rank_by_factor_score(MOMENTUM, QUALITY, top_n=4)

        assert result == ["AAPL", "MSFT", "AMZN", "GOOG"]

    def test_tied_scores_produce_consistent_ordering(self):
        # Two tickers with identical factor scores — must not crash or be random
        momentum = {"A": 1.0, "B": 1.0}
        quality  = {"A": 0.0, "B": 0.0}

        result1 = rank_by_factor_score(momentum, quality, top_n=2)
        result2 = rank_by_factor_score(momentum, quality, top_n=2)

        assert set(result1) == {"A", "B"}
        assert result1 == result2  # stable across identical calls


class TestMissingFactorData:
    def test_ticker_missing_from_quality_is_excluded(self):
        momentum = {"AAPL": 1.0, "MSFT": 0.5, "ORPHAN": 2.0}
        quality  = {"AAPL": 0.8, "MSFT": 0.2}  # ORPHAN absent

        result = rank_by_factor_score(momentum, quality, top_n=3)

        assert "ORPHAN" not in result
        assert set(result) == {"AAPL", "MSFT"}

    def test_ticker_missing_from_momentum_is_excluded(self):
        momentum = {"AAPL": 1.0, "MSFT": 0.5}  # ORPHAN absent
        quality  = {"AAPL": 0.8, "MSFT": 0.2, "ORPHAN": 2.0}

        result = rank_by_factor_score(momentum, quality, top_n=3)

        assert "ORPHAN" not in result
        assert set(result) == {"AAPL", "MSFT"}

    def test_empty_intersection_returns_empty_list(self):
        result = rank_by_factor_score({"AAPL": 1.0}, {"MSFT": 1.0}, top_n=5)

        assert result == []
