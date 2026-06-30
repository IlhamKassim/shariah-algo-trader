# Unrestricted high-volume watchlist for Gap and Go day trading.
# No Shariah screening — includes banks, airlines, crypto, and leveraged ETFs
# to maximise the available gap opportunities each morning.
# Price and ADV quality filters are applied dynamically at scan time.
_DEFAULT_WATCHLIST: list[str] = [
    # Mega-cap tech
    "AAPL", "MSFT", "NVDA", "TSLA", "AMZN", "META", "GOOGL", "AMD", "INTC", "MU",
    # Semiconductors
    "QCOM", "AVGO", "TXN", "KLAC", "LRCX", "AMAT", "MRVL", "SMCI", "ARM", "ON",
    # Software / Cloud
    "CRM", "NOW", "SNOW", "DDOG", "NET", "CRWD", "ZS", "OKTA", "HUBS", "TTD",
    "TWLO", "DOCU", "ZM", "GTLB", "BILL", "CFLT", "MDB", "ESTC",
    # Financials
    "JPM", "BAC", "GS", "MS", "WFC", "C", "AXP", "BLK", "SCHW", "COF",
    # Payments / Fintech
    "V", "MA", "PYPL", "SQ", "AFRM", "UPST",
    # Crypto-adjacent
    "COIN", "MARA", "RIOT", "HOOD", "SOFI",
    # Consumer / Marketplace
    "NFLX", "DIS", "UBER", "ABNB", "DASH", "SPOT", "ROKU",
    "WMT", "TGT", "COST", "HD", "NKE", "LULU", "ETSY", "CHWY",
    # Airlines
    "AAL", "DAL", "UAL", "LUV",
    # Energy
    "XOM", "CVX", "OXY", "HAL", "SLB", "MRO", "DVN",
    # Healthcare / Biotech
    "LLY", "ABBV", "JNJ", "PFE", "MRK", "AMGN", "GILD", "MRNA",
    "REGN", "VRTX", "BIIB", "BMY", "BNTX", "IDXX",
    # EV / Auto
    "RIVN", "NIO", "LCID", "F", "GM", "STLA",
    # Industrial / Aerospace / Defense
    "BA", "RTX", "LMT", "NOC", "GE", "CAT", "DE",
    # Growth / Momentum
    "PLTR", "SHOP", "SNAP", "RBLX", "PINS", "LYFT",
    # Media
    "PARA", "WBD",
    # Index ETFs
    "SPY", "QQQ", "IWM", "DIA",
    # Sector ETFs (gap on macro/sector news)
    "XLF", "XLE", "XLK", "XLV", "XBI", "GLD", "SLV",
    # Leveraged ETFs (amplified gap moves)
    "SOXL", "TQQQ", "UVXY", "LABU",
]


def get_watchlist() -> list[str]:
    return list(_DEFAULT_WATCHLIST)
