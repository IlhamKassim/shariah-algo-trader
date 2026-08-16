#!/usr/bin/env python3
"""Dry-run the live-account rebalance: compute target portfolio + weights and
print the sell/stay/buy diff WITHOUT submitting any orders."""
import logging
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logging.getLogger("yfinance").setLevel(logging.ERROR)

from shariah_algo_trader.config import Config
from shariah_algo_trader.data.regime import is_bull_market
from shariah_algo_trader.data.universe import fetch_combined_universe
from shariah_algo_trader.execution.alpaca_client import AlpacaClient
from shariah_algo_trader.execution.portfolio import get_current_portfolio
from shariah_algo_trader.factors.momentum import compute_momentum_factor
from shariah_algo_trader.factors.quality import compute_quality_factor
from shariah_algo_trader.factors.scorer import rank_by_factor_score
from shariah_algo_trader.factors.value import compute_value_factor
from shariah_algo_trader.factors.volatility import (
    compute_inv_vol_weights, compute_raw_volatility, compute_volatility_factor,
)

USER = "5b7fb8dd-5f45-4225-a62e-5c908be06279"

def main():
    cfg = Config()
    from shariah_algo_trader.execution.tenant_manager import get_active_tenant_accounts
    tenants = [t for t in get_active_tenant_accounts(cfg)
               if t["raw_user_id"] == USER and t["trading_mode"] == "live"]
    if not tenants:
        print("ERROR: no live tenant found"); sys.exit(1)
    t = tenants[0]
    print(f"=== DRY RUN: {t['user_id']} | {t['trading_mode']} | etf={t['etf_symbol']} | top_n={t['top_n']} ===")

    universe = fetch_combined_universe([t["etf_symbol"]])
    print(f"universe: {len(universe)} tickers")

    momentum = compute_momentum_factor(universe)
    quality = compute_quality_factor(universe)
    raw_vols = compute_raw_volatility(universe)
    vol_scores = compute_volatility_factor(raw_vols)
    value = compute_value_factor(universe)
    regime_ok = is_bull_market()

    target = rank_by_factor_score(momentum, quality, vol_scores, value,
                                  top_n=t["top_n"], sector_cap=t["sector_cap"])
    weights = compute_inv_vol_weights(target, raw_vols)

    client = AlpacaClient(t["alpaca_api_key"], t["alpaca_api_secret"], t["alpaca_base_url"])
    current = get_current_portfolio(client)
    positions = {p["symbol"]: float(p["market_value"]) for p in client.get("/v2/positions")}

    eligible_target = {x for x in target if x in universe}
    sells = current - eligible_target
    buys = eligible_target - current
    stays = current & eligible_target

    print(f"regime_ok: {regime_ok}")
    print(f"target top-{t['top_n']}: {sorted(target)}")
    print(f"SELLS ({len(sells)}): {sorted(sells)}")
    print(f"STAYS ({len(stays)}): {len(stays)} positions")
    print(f"BUYS ({len(buys)}): {sorted(buys)}")
    print("\nPer-buy notional estimate (weight x equity):")
    acct = client.get("/v2/account")
    equity = float(acct["equity"]); cash = float(acct["cash"])
    print(f"equity=${equity:.2f} cash=${cash:.2f} buying_power=${float(acct.get('buying_power') or 0):.2f}")
    for b in sorted(buys):
        w = weights.get(b, 1.0 / max(len(eligible_target), 1))
        print(f"  BUY {b}: {w*100:.1f}% = ${equity*w:.2f}")

if __name__ == "__main__":
    main()
