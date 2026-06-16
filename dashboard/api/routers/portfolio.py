from fastapi import APIRouter, Depends

from dashboard.api.deps import get_alpaca
from dashboard.api.models import PositionResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

router = APIRouter()


@router.get("/api/portfolio", response_model=list[PositionResponse])
def get_portfolio(client: AlpacaClient = Depends(get_alpaca)) -> list[PositionResponse]:
    positions = client.get("/v2/positions")
    return [
        PositionResponse(
            symbol=pos["symbol"],
            qty=float(pos["qty"]),
            market_value=float(pos["market_value"]),
            avg_entry_price=float(pos["avg_entry_price"]),
            unrealized_pl=float(pos["unrealized_pl"]),
            unrealized_pl_pct=float(pos["unrealized_plpc"]) * 100,
            current_price=float(pos["current_price"]),
        )
        for pos in positions
    ]
