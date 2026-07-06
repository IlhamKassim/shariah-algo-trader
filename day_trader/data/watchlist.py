# Unrestricted, high-beta watchlist for Gap and Go day trading.
# No Shariah screening. Curated for names that actually produce violent,
# catalyst-driven gaps — mega-cap anchors, banks, index/broad-sector ETFs,
# industrials, energy majors, big pharma, and other low-beta names were
# dropped since they rarely clear a meaningful gap threshold.
# Price and ADV quality filters are applied dynamically at scan time.
_DEFAULT_WATCHLIST: list[str] = [
    # Mega-cap (highest-beta only)
    "NVDA", "TSLA", "AMD",
    # Semiconductors (sector-wide earnings-gap prone)
    "QCOM", "AVGO", "TXN", "KLAC", "LRCX", "AMAT", "MRVL", "SMCI", "ARM", "ON", "MU", "INTC",
    # Software / Cloud (high-growth SaaS gaps hardest on earnings)
    "CRM", "NOW", "SNOW", "DDOG", "NET", "CRWD", "ZS", "OKTA", "HUBS", "TTD",
    "TWLO", "DOCU", "ZM", "GTLB", "BILL", "CFLT", "MDB", "ESTC",
    # Fintech (higher-beta only)
    "PYPL", "SQ", "AFRM", "UPST",
    # Crypto-adjacent
    "COIN", "MARA", "RIOT", "HOOD", "SOFI",
    # Consumer / Marketplace (higher-beta growth only)
    "UBER", "ABNB", "DASH", "SPOT", "ROKU", "ETSY", "CHWY",
    # Energy (smaller, higher-beta only)
    "OXY", "HAL", "SLB", "MRO", "DVN",
    # Biotech (binary-catalyst names only)
    "MRNA", "REGN", "VRTX", "BIIB", "BNTX",
    # EV / Auto
    "RIVN", "NIO", "LCID", "F", "GM", "STLA",
    # Growth / Momentum
    "PLTR", "SHOP", "SNAP", "RBLX", "PINS", "LYFT",
    # Sector ETF (biotech only — binary-catalyst constituents)
    "XBI",
    # Leveraged ETFs (built-in volatility amplification)
    "SOXL", "TQQQ", "UVXY", "LABU",
]


def get_watchlist() -> list[str]:
    return list(_DEFAULT_WATCHLIST)
