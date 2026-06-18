from shariah_algo_trader.execution.alpaca_client import AlpacaClient


def get_open_symbols(client: AlpacaClient) -> set[str]:
    positions = client.get("/v2/positions")
    return {p["symbol"] for p in positions}


def get_positions_map(client: AlpacaClient) -> dict[str, dict]:
    """Return {symbol: position_dict} for all open positions."""
    positions = client.get("/v2/positions")
    return {p["symbol"]: p for p in positions}
