#!/usr/bin/env python3
"""One-shot: re-trigger the live-account rebalance at next market open.

Runs the full factor pipeline + order submission for user 5b7fb8dd (aqilnazri9,
live SPUS top-20). Uses the fixed OrderExecutor (settle_sells + 403 retry) and
the degenerate-target safety guard.

Retries up to 3 times on data-pipeline flakiness (yfinance rate-limit 401s can
produce an empty target — the guard aborts those runs safely, and we re-run).
Prints a short summary to stdout (no_agent cron delivers it verbatim).
"""
import logging
import sys
import time

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logging.getLogger("yfinance").setLevel(logging.ERROR)

USER = "5b7fb8dd-5f45-4225-a62e-5c908be06279"
MAX_ATTEMPTS = 3
RETRY_DELAY_S = 90  # give yfinance's rate limiter time to cool down

def main():
    from shariah_algo_trader.config import Config
    from shariah_algo_trader.execution.tenant_manager import trigger_single_tenant_rebalance

    cfg = Config()
    last_exc = None
    for attempt in range(1, MAX_ATTEMPTS + 1):
        print(f"[attempt {attempt}/{MAX_ATTEMPTS}] Triggering rebalance for {USER} ...")
        try:
            result = trigger_single_tenant_rebalance(USER, cfg)
            accounts = result.get("accounts_processed", 0)
            targets = [r.get("target_stocks") or [] for r in result.get("results", [])]
            # Safety: if every account came back with a degenerate target, treat
            # as data failure and retry rather than declaring success.
            if accounts and all(len(t) < 5 for t in targets):
                raise RuntimeError(
                    f"Degenerate target after run: {[len(t) for t in targets]} tickers. Retrying."
                )
            print(f"Done: {accounts} account(s) processed")
            for r in result.get("results", []):
                print(f"  [{r.get('trading_mode')}] target={len(r.get('target_stocks') or [])} stocks")
            return 0
        except Exception as exc:
            last_exc = exc
            print(f"  attempt {attempt} failed: {exc}")
            if attempt < MAX_ATTEMPTS:
                print(f"  sleeping {RETRY_DELAY_S}s before retry ...")
                time.sleep(RETRY_DELAY_S)
    print(f"ERROR: all {MAX_ATTEMPTS} attempts failed — last: {last_exc}", file=sys.stderr)
    return 1

if __name__ == "__main__":
    sys.exit(main())
