from shariah_algo_trader.execution.alpaca_client import AlpacaClient


def get_current_portfolio(client: AlpacaClient) -> set[str]:
    """Return the current Portfolio as ticker symbols from Alpaca's /positions endpoint.

    Returns an empty set when there are no open positions (valid Portfolio State).
    Raises AlpacaError on HTTP failure or malformed response.
    """
    positions = client.get("/v2/positions")
    return {pos["symbol"] for pos in positions}
