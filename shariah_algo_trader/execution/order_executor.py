from shariah_algo_trader.execution.alpaca_client import AlpacaClient


class OrderExecutor:
    def __init__(self, client: AlpacaClient):
        self._client = client

    def buy(self, ticker: str) -> None:
        """Submit a market buy for 5% of current portfolio equity."""
        account = self._client.get("/v2/account")
        equity = float(account["equity"])
        notional = round(equity * 0.05, 2)

        self._client.post("/v2/orders", {
            "symbol": ticker,
            "notional": notional,
            "side": "buy",
            "type": "market",
            "time_in_force": "day",
        })

    def sell(self, ticker: str) -> None:
        """Close the full position for ticker via Alpaca's liquidation endpoint."""
        self._client.delete(f"/v2/positions/{ticker}")
