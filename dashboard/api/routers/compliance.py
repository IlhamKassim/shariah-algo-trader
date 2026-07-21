import logging

from fastapi import APIRouter, Depends

from dashboard.api.cache import UniverseCache, get_universe_cache
from dashboard.api.deps import get_alpaca
from dashboard.api.models import ComplianceResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)


@router.get("/api/compliance", response_model=ComplianceResponse)
def get_compliance(
    client: AlpacaClient = Depends(get_alpaca),
    cache: UniverseCache = Depends(get_universe_cache),
) -> ComplianceResponse:
    """Check current portfolio against the cached eligible universe.

    Uses the universe cache so this endpoint is always fast (<50ms).
    Returns compliant=True when the cache is empty (can't determine violations).
    """
    try:
        positions = client.get("/v2/positions")
        held = {p["symbol"] for p in positions}
    except AlpacaError as exc:
        logger.warning("Compliance check: failed to fetch positions (%s)", exc)
        held = set()

    if not cache.stocks:
        return ComplianceResponse(
            compliant=True,
            violations=[],
            held_count=len(held),
            universe_size=0,
            last_checked=None,
        )

    eligible = cache.raw_universe if cache.raw_universe else {s["symbol"] for s in cache.stocks}
    violations = sorted(held - eligible)

    return ComplianceResponse(
        compliant=len(violations) == 0,
        violations=violations,
        held_count=len(held),
        universe_size=len(eligible),
        last_checked=(
            cache.last_computed_at.isoformat() if cache.last_computed_at else None
        ),
    )
