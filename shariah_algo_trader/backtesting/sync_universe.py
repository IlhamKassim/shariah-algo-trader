"""Download N-PORT filing history from SEC EDGAR and report what coverage exists.

Usage
-----
    export SEC_USER_AGENT="Your Name your@email.com"
    uv run python -m shariah_algo_trader.backtesting.sync_universe
    uv run python -m shariah_algo_trader.backtesting.sync_universe --status

The SEC requires a User-Agent naming a real contact. Requests without one are
rejected, so ``SEC_USER_AGENT`` is mandatory for syncing (``--status`` reads
only local files and does not need it).
"""

from __future__ import annotations

import argparse
import logging
import sys

from shariah_algo_trader.backtesting import nport

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("sync_universe")


def print_coverage(series_id: str | None) -> None:
    stats = nport.coverage(series_id=series_id)
    print("\n" + "=" * 62)
    print(" POINT-IN-TIME UNIVERSE COVERAGE ".center(62, "="))
    print("=" * 62)
    if not stats["snapshots"]:
        print("No filings on disk. Nothing can be backtested honestly yet.")
        print("Run this command without --status to download from SEC EDGAR.")
        print("=" * 62 + "\n")
        return

    years = stats["span_days"] / 365.25
    print(f"{'Snapshots':<28}: {stats['snapshots']}")
    print(f"{'Earliest':<28}: {stats['first_date']}")
    print(f"{'Latest':<28}: {stats['last_date']}")
    print(f"{'Span':<28}: {stats['span_days']} days ({years:.1f} years)")
    print(f"{'Holdings per snapshot':<28}: {stats['min_holdings']}–{stats['max_holdings']}")
    print(f"{'Distinct tickers ever seen':<28}: {stats['distinct_tickers']}")
    print("=" * 62)
    if years < 3:
        print(
            "\nWARNING: under 3 years of history. Factor premia routinely go\n"
            "negative for longer than that, so any result over this window is\n"
            "an anecdote, not evidence."
        )
    print()


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    parser.add_argument("--fund", default="SPUS", help="Fund ticker in the registry (default: SPUS)")
    parser.add_argument("--cik", type=int, help="Override the CIK (for a fund not in the registry)")
    parser.add_argument("--series", help="Override the EDGAR series ID, e.g. S000067283")
    parser.add_argument("--limit", type=int, help="Stop after downloading this many filings")
    parser.add_argument("--status", action="store_true", help="Only report local coverage; no network")
    parser.add_argument("--filings-dir", default=nport.FILINGS_DIR, help="Where filings are stored")
    args = parser.parse_args()

    fund = nport.FUND_REGISTRY.get(args.fund.upper())
    if args.cik and args.series:
        fund = nport.FundRef(ticker=args.fund.upper(), cik=args.cik, series_id=args.series, name=args.fund)
    elif fund is None:
        logger.error(
            "Fund %s is not in the registry. Pass --cik and --series, looked up on "
            "EDGAR and confirmed against a real filing.", args.fund,
        )
        return 2

    if args.status:
        print_coverage(fund.series_id)
        return 0

    try:
        written = nport.sync_filings(fund, filings_dir=args.filings_dir, limit=args.limit)
    except nport.NportError as exc:
        logger.error("%s", exc)
        return 1
    except Exception as exc:  # noqa: BLE001 — surface the real reason to the operator
        logger.error("Sync failed: %s", exc)
        return 1

    logger.info("Downloaded %d new filing(s)", len(written))
    print_coverage(fund.series_id)
    return 0


if __name__ == "__main__":
    sys.exit(main())
