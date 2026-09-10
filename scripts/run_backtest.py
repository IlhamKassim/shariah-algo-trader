#!/usr/bin/env python3
"""One-command point-in-time backtest: preflight, sync N-PORT filings, run, report.

Safe to run on the production server. Nothing here touches Alpaca or submits an
order — the backtesting package has no broker imports at all. It reads market
data and writes result JSON, nothing else.

    export SEC_USER_AGENT="Your Name your@email.com"
    uv run python scripts/run_backtest.py

Every argument is optional; run with --help to see them. The script checks
prerequisites before doing any work, so a missing contact string or an
unreachable SEC fails in seconds with an explanation rather than halfway
through a download.
"""
import argparse
import logging
import os
import shutil
import subprocess
import sys

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logging.getLogger("yfinance").setLevel(logging.ERROR)
logger = logging.getLogger("run_backtest")

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _fail(message: str) -> int:
    print(f"\n\033[31mBLOCKED\033[0m  {message}\n", file=sys.stderr)
    return 1


def preflight(skip_sync: bool) -> int:
    """Check everything needed before any network work happens."""
    print("Preflight")
    print("-" * 60)

    if not skip_sync and not os.environ.get("SEC_USER_AGENT"):
        return _fail(
            "SEC_USER_AGENT is not set.\n"
            "  SEC EDGAR rejects requests that do not name a real contact.\n"
            '  Fix:  export SEC_USER_AGENT="Your Name your@email.com"\n'
            "  Or skip the download with --skip-sync to use filings already on disk."
        )
    if not skip_sync:
        print(f"  SEC_USER_AGENT           : {os.environ['SEC_USER_AGENT']}")

    # Reachability. The most common failure on a restricted network is a proxy
    # refusing CONNECT, which otherwise surfaces much later as a confusing
    # download error.
    if not skip_sync:
        import requests

        try:
            response = requests.get(
                "https://data.sec.gov/submissions/CIK0001742912.json",
                headers={"User-Agent": os.environ["SEC_USER_AGENT"]},
                timeout=20,
            )
            response.raise_for_status()
            print("  SEC EDGAR                : reachable")
        except Exception as exc:  # noqa: BLE001 — the reason matters to the operator
            return _fail(
                f"Cannot reach SEC EDGAR: {exc}\n"
                "  If this is a proxy or firewall, either run from a network that\n"
                "  permits data.sec.gov, or use the GitHub Actions route:\n"
                "  Actions -> backtest -> Run workflow."
            )

    if os.environ.get("FMP_API_KEY"):
        print("  FMP_API_KEY              : set (Quality and Value factors active)")
    else:
        print(
            "  FMP_API_KEY              : \033[33mNOT SET\033[0m — Quality and Value will\n"
            "                             score flat. This becomes a momentum +\n"
            "                             low-volatility backtest, not a 4-factor one."
        )

    if shutil.which("uv") is None:
        return _fail("uv is not on PATH. Install it, or run this with the project's python.")

    print("-" * 60)
    return 0


def run_module(module: str, *args: str) -> int:
    """Run a project module through uv, streaming its output."""
    command = ["uv", "run", "python", "-m", module, *args]
    logger.info("$ %s", " ".join(command))
    return subprocess.call(command, cwd=REPO_ROOT)


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--start-date", default="2020-01-01", help="Backtest start (YYYY-MM-DD)")
    parser.add_argument("--end-date", default="2026-09-01", help="Backtest end (YYYY-MM-DD)")
    parser.add_argument("--top-n", default="20", help="Holdings in the Portfolio")
    parser.add_argument("--risk-free-rate", default="0.04",
                        help="Annualised decimal used for Sharpe and alpha (0.04 = 4%%)")
    parser.add_argument("--benchmark", action="append",
                        help="Benchmark ticker, repeatable. Defaults to SPY and SPUS.")
    parser.add_argument("--compare", action="store_true", help="Also run the 3-factor variant")
    parser.add_argument("--output-dir", default="backtest-results", help="Where result JSON goes")
    parser.add_argument("--skip-sync", action="store_true",
                        help="Use filings already on disk instead of downloading from EDGAR")
    args = parser.parse_args()

    failed = preflight(args.skip_sync)
    if failed:
        return failed

    if not args.skip_sync:
        print("\nStep 1/3 — syncing N-PORT filings from SEC EDGAR")
        if run_module("shariah_algo_trader.backtesting.sync_universe") != 0:
            return _fail("Filing sync failed. See the error above.")
    else:
        print("\nStep 1/3 — skipped (--skip-sync)")

    print("\nStep 2/3 — universe coverage")
    run_module("shariah_algo_trader.backtesting.sync_universe", "--status")

    print("\nStep 3/3 — running the backtest")
    backtest_args = [
        "--start-date", args.start_date,
        "--end-date", args.end_date,
        "--top-n", str(args.top_n),
        "--risk-free-rate", str(args.risk_free_rate),
        "--output-dir", args.output_dir,
    ]
    for ticker in args.benchmark or []:
        backtest_args += ["--benchmark", ticker]
    if args.compare:
        backtest_args.append("--compare")

    exit_code = run_module("shariah_algo_trader.backtesting.run", *backtest_args)
    if exit_code != 0:
        return _fail(
            "The backtest did not produce a result. The log above names the reason.\n"
            "  - 'earliest universe snapshot is ...' means your --start-date predates\n"
            "    the filings on disk. Start later, or sync more.\n"
            "  - 'No price data retrieved' means the market data provider was\n"
            "    unreachable. If yfinance called every ticker 'possibly delisted',\n"
            "    that is a network or proxy block — real delistings never hit the\n"
            "    whole universe at once."
        )

    results = os.path.join(REPO_ROOT, args.output_dir)
    print(f"\nDone. Result JSON written to {results}")
    print(
        "\nRead the SPUS row first. Beating SPY while holding a Shariah-screened\n"
        "subset largely measures the screen; beating SPUS is what tells you the\n"
        "factor engine earns its keep."
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
