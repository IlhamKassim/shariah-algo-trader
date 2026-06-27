# 50 high-volume, liquid US stocks — mix of tech, finance, energy, travel, consumer
_DEFAULT_WATCHLIST: list[str] = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD", "INTC", "MU",
    # Finance
    "BAC", "JPM", "WFC", "C", "GS", "MS", "SOFI", "HOOD", "COIN", "SQ",
    # Energy
    "XOM", "CVX", "OXY", "SLB", "HAL",
    # Consumer / travel
    "F", "GM", "CCL", "AAL", "DAL", "UBER", "LYFT", "ABNB", "DASH", "NFLX",
    # Growth / tech
    "PLTR", "SHOP", "SNAP", "RBLX", "PINS", "DKNG", "PYPL", "DIS", "T", "PFE",
    # EV / speculative
    "NIO", "RIVN", "LCID", "MARA", "RIOT",
]


def get_watchlist() -> list[str]:
    return list(_DEFAULT_WATCHLIST)
