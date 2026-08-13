import logging

from fastapi import APIRouter, Depends

from dashboard.api.cache import UniverseCache, get_universe_cache
from dashboard.api.compliance_core import compute_compliance
from dashboard.api.deps import get_alpaca
from dashboard.api.models import ComplianceResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaClient, AlpacaError

router = APIRouter()
logger = logging.getLogger(__name__)


def _eligible_universe(cache: UniverseCache) -> set[str]:
    """The cached eligible universe (raw set when present, else derived from stocks)."""
    if cache.raw_universe:
        return set(cache.raw_universe)
    return {s["symbol"] for s in cache.stocks} if cache.stocks else set()


@router.get("/api/compliance", response_model=ComplianceResponse)
def get_compliance(
    client: AlpacaClient | None = Depends(get_alpaca),
    cache: UniverseCache = Depends(get_universe_cache),
) -> ComplianceResponse:
    """Check current portfolio against the cached eligible universe.

    Uses the universe cache so this endpoint is always fast (<50ms).
    Returns compliant=True when the cache is empty (can't determine violations).
    The violation computation itself lives in ``dashboard.api.compliance_core``
    so the admin app's per-tester compliance view (A5) reuses identical logic.
    """
    if not client:
        return ComplianceResponse(
            **compute_compliance(
                [],
                _eligible_universe(cache),
                universe_size=len(cache.stocks) if cache.stocks else 0,
                last_checked=(
                    cache.last_computed_at.isoformat() if cache.last_computed_at else None
                ),
            )
        )
    try:
        positions = client.get("/v2/positions")
        held = {p["symbol"] for p in positions}
    except AlpacaError as exc:
        logger.warning("Compliance check: failed to fetch positions (%s)", exc)
        held = set()

    if not cache.stocks:
        return ComplianceResponse(
            **compute_compliance(held, set(), universe_size=0, last_checked=None)
        )

    return ComplianceResponse(
        **compute_compliance(
            held,
            _eligible_universe(cache),
            last_checked=(
                cache.last_computed_at.isoformat() if cache.last_computed_at else None
            ),
        )
    )
