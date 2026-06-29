# Unrestricted high-volume watchlist for Gap and Go day trading.
# No Shariah screening — includes banks, airlines, crypto, and leveraged ETFs
# to maximise the available gap opportunities each morning.
_DEFAULT_WATCHLIST: list[str] = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD", "INTC", "MU",
    # Financials (high gap frequency on rate/earnings news)
    "JPM", "BAC", "GS", "MS", "WFC",
    # Crypto-adjacent
    "COIN", "MARA", "RIOT", "HOOD", "SOFI",
    # Consumer / marketplace
    "NFLX", "DIS", "UBER", "ABNB", "DASH",
    # Airlines (gap on news/fuel/weather)
    "AAL", "DAL", "UAL",
    # Energy
    "XOM", "CVX", "OXY",
    # Growth tech
    "PLTR", "SHOP", "SNAP", "RBLX", "PYPL", "SQ",
    # EV
    "RIVN", "NIO", "LCID",
    # Index ETFs
    "SPY", "QQQ", "IWM",
    # Leveraged ETFs (amplified gap moves)
    "SOXL", "TQQQ",
]


def get_watchlist() -> list[str]:
    return list(_DEFAULT_WATCHLIST)
