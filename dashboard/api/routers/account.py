from fastapi import APIRouter, Depends

from dashboard.api.deps import get_alpaca
from dashboard.api.models import AccountResponse
from shariah_algo_trader.execution.alpaca_client import AlpacaClient

router = APIRouter()


@router.get("/api/account", response_model=AccountResponse)
def get_account(client: AlpacaClient = Depends(get_alpaca)) -> AccountResponse:
    data = client.get("/v2/account")
    equity = float(data["equity"])
    last_equity = float(data.get("last_equity") or equity)
    dayl_pl = equity - last_equity
    dayl_pl_pct = (dayl_pl / last_equity * 100) if last_equity else 0.0
    return AccountResponse(
        equity=equity,
        cash=float(data["cash"]),
        buying_power=float(data["buying_power"]),
        portfolio_value=float(data["portfolio_value"]),
        dayl_pl=dayl_pl,
        dayl_pl_pct=dayl_pl_pct,
    )
