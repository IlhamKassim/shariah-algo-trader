# Shariah-compliant high-volume US stocks for intraday ORB trading.
# Excluded: banks/financials (interest-based), airlines (excessive leverage),
# crypto miners (MARA, RIOT), and other non-compliant sectors.
_DEFAULT_WATCHLIST: list[str] = [
    # Mega-cap tech (SPUS core holdings)
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD", "INTC", "MU",
    # Energy (asset-backed, generally Shariah-compliant)
    "XOM", "CVX", "OXY", "SLB", "HAL",
    # Consumer / marketplace tech
    "UBER", "ABNB", "DASH", "NFLX", "DIS",
    # Growth tech / software
    "PLTR", "SHOP", "SNAP", "RBLX", "PINS", "PYPL",
    # EV / clean energy
    "NIO", "RIVN",
]


def get_watchlist() -> list[str]:
    return list(_DEFAULT_WATCHLIST)
