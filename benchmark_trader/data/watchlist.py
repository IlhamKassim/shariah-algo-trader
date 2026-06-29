# Unrestricted high-volume watchlist for benchmark comparison.
# No Shariah screening — includes banks, airlines, crypto, and leveraged ETFs
# to maximise the available opportunity set for Gap and Go.
_DEFAULT_WATCHLIST: list[str] = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD", "INTC", "MU",
    # Financials (excluded from Shariah trader)
    "JPM", "BAC", "GS", "MS", "WFC",
    # Crypto-adjacent (high gap frequency)
    "COIN", "MARA", "RIOT", "HOOD", "SOFI",
    # Consumer / marketplace
    "NFLX", "DIS", "UBER", "ABNB", "DASH",
    # Airlines (gap on news/weather/fuel)
    "AAL", "DAL", "UAL",
    # Energy
    "XOM", "CVX", "OXY",
    # Growth tech
    "PLTR", "SHOP", "SNAP", "RBLX", "PYPL", "SQ",
    # EV
    "RIVN", "NIO", "LCID",
    # Index ETFs (liquid, often gap on macro news)
    "SPY", "QQQ", "IWM",
    # Leveraged ETFs (amplified gap moves)
    "SOXL", "TQQQ",
]


def get_watchlist() -> list[str]:
    return list(_DEFAULT_WATCHLIST)
