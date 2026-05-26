import datetime
import logging
from unittest.mock import MagicMock, call, patch
import pytest
from shariah_algo_trader.scheduling.trading_calendar import (
    is_trading_day,
    is_first_trading_day_of_month,
)
from shariah_algo_trader.scheduling.scheduler import run_daily_jobs


# ---------------------------------------------------------------------------
# Trading calendar tests — use real exchange_calendars with known dates
# ---------------------------------------------------------------------------

class TestIsTradingDay:
    def test_regular_weekday_is_trading_day(self):
        # 2024-11-04 is a Monday, no holiday
        assert is_trading_day(datetime.date(2024, 11, 4)) is True

    def test_saturday_is_not_trading_day(self):
        assert is_trading_day(datetime.date(2024, 11, 2)) is False

    def test_sunday_is_not_trading_day(self):
        assert is_trading_day(datetime.date(2024, 11, 3)) is False

    def test_christmas_is_not_trading_day(self):
        # NYSE is closed on Christmas
        assert is_trading_day(datetime.date(2024, 12, 25)) is False

    def test_thanksgiving_is_not_trading_day(self):
        # NYSE closed on Thanksgiving 2024-11-28
        assert is_trading_day(datetime.date(2024, 11, 28)) is False


class TestIsFirstTradingDayOfMonth:
    def test_first_trading_day_of_month_returns_true(self):
        # 2024-11-01 is a Friday — first trading day of November 2024
        assert is_first_trading_day_of_month(datetime.date(2024, 11, 1)) is True

    def test_second_trading_day_returns_false(self):
        # 2024-11-04 is the second trading day of November 2024
        assert is_first_trading_day_of_month(datetime.date(2024, 11, 4)) is False

    def test_month_starting_on_weekend_uses_first_weekday(self):
        # 2024-12-01 is a Sunday — first trading day of December is 2024-12-02
        assert is_first_trading_day_of_month(datetime.date(2024, 12, 2)) is True
        assert is_first_trading_day_of_month(datetime.date(2024, 12, 1)) is False


# ---------------------------------------------------------------------------
# Dispatch tests — calendar functions are injected so we control the date
# ---------------------------------------------------------------------------

def make_dispatch(is_trading: bool, is_first: bool):
    return (
        lambda d: is_trading,
        lambda d: is_first,
    )


class TestRunDailyJobs:
    def test_calls_compliance_check_on_regular_trading_day(self):
        compliance = MagicMock()
        rebalance = MagicMock()
        is_td, is_ftd = make_dispatch(is_trading=True, is_first=False)

        run_daily_jobs(
            datetime.date(2024, 11, 4),
            run_compliance_check=compliance,
            run_rebalance=rebalance,
            is_trading_day=is_td,
            is_first_trading_day=is_ftd,
        )

        compliance.assert_called_once()
        rebalance.assert_not_called()

    def test_calls_both_jobs_on_first_trading_day_of_month(self):
        compliance = MagicMock()
        rebalance = MagicMock()
        is_td, is_ftd = make_dispatch(is_trading=True, is_first=True)

        run_daily_jobs(
            datetime.date(2024, 11, 1),
            run_compliance_check=compliance,
            run_rebalance=rebalance,
            is_trading_day=is_td,
            is_first_trading_day=is_ftd,
        )

        compliance.assert_called_once()
        rebalance.assert_called_once()

    def test_calls_nothing_on_non_trading_day(self):
        compliance = MagicMock()
        rebalance = MagicMock()
        is_td, is_ftd = make_dispatch(is_trading=False, is_first=False)

        run_daily_jobs(
            datetime.date(2024, 11, 2),
            run_compliance_check=compliance,
            run_rebalance=rebalance,
            is_trading_day=is_td,
            is_first_trading_day=is_ftd,
        )

        compliance.assert_not_called()
        rebalance.assert_not_called()

    def test_compliance_exception_is_caught_and_rebalance_still_runs(self, caplog):
        compliance = MagicMock(side_effect=RuntimeError("FMP down"))
        rebalance = MagicMock()
        is_td, is_ftd = make_dispatch(is_trading=True, is_first=True)

        with caplog.at_level(logging.ERROR):
            run_daily_jobs(
                datetime.date(2024, 11, 1),
                run_compliance_check=compliance,
                run_rebalance=rebalance,
                is_trading_day=is_td,
                is_first_trading_day=is_ftd,
            )

        rebalance.assert_called_once()
        assert "FMP down" in caplog.text

    def test_rebalance_exception_is_caught_and_does_not_propagate(self, caplog):
        compliance = MagicMock()
        rebalance = MagicMock(side_effect=RuntimeError("Alpaca timeout"))
        is_td, is_ftd = make_dispatch(is_trading=True, is_first=True)

        with caplog.at_level(logging.ERROR):
            run_daily_jobs(
                datetime.date(2024, 11, 1),
                run_compliance_check=compliance,
                run_rebalance=rebalance,
                is_trading_day=is_td,
                is_first_trading_day=is_ftd,
            )

        assert "Alpaca timeout" in caplog.text
