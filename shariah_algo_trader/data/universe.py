from shariah_algo_trader.data.fmp_client import FMPClient, FMPError


def fetch_eligible_universe(etf_symbol: str, client: FMPClient) -> set[str]:
    """Return the Eligible Universe as ticker symbols from an ETF's Holdings Snapshot.

    Raises FMPError if the ETF has no holdings or if the FMP request fails.
    """
    data = client.get(f"/etf-holder/{etf_symbol}")

    if not isinstance(data, list) or len(data) == 0:
        raise FMPError(f"ETF {etf_symbol!r} has no holdings in the Holdings Snapshot")

    return {holding["asset"] for holding in data}
