import datetime
import exchange_calendars as ec

_NYSE = ec.get_calendar("XNYS")


def is_trading_day(date: datetime.date) -> bool:
    """Return True if date is a NYSE trading day (weekday, not a US market holiday)."""
    ts = date.strftime("%Y-%m-%d")
    return _NYSE.is_session(ts)


def is_first_trading_day_of_month(date: datetime.date) -> bool:
    """Return True if date is the first NYSE trading day of its calendar month."""
    if not is_trading_day(date):
        return False
    # Step back one trading session and check if it was in the same month
    ts = _NYSE.date_to_session(date.strftime("%Y-%m-%d"), direction="next")
    prev = _NYSE.previous_session(ts)
    prev_date = prev.date()
    return prev_date.month != date.month
