import os
import sys
import argparse
import logging
import json
from dotenv import load_dotenv

load_dotenv()

from shariah_algo_trader.backtesting.data_provider import DataProvider
from shariah_algo_trader.backtesting.engine import BacktestEngine, DEFAULT_BENCHMARKS
from shariah_algo_trader.backtesting import nport

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
logger = logging.getLogger("backtest_runner")


def print_metrics_table(metrics: dict, title: str):
    print("\n" + "=" * 50)
    print(f" {title.upper()} ".center(50, "="))
    print("=" * 50)
    for k, v in metrics.items():
        label = k.replace("_", " ").title()
        if "Pct" in label or "Rate" in label:
            print(f"{label:<30}: {v:.2f}%")
        else:
            print(f"{label:<30}: {v:.2f}")
    print("=" * 50 + "\n")


def print_benchmark_table(result: dict, title: str):
    """Print the strategy against each benchmark — the question that matters."""
    benchmarks = result.get("benchmarks") or {}
    if not benchmarks:
        print("\nNo benchmark comparison available (no benchmark price data).\n")
        return

    strategy_cagr = result.get("metrics", {}).get("cagr_pct", float("nan"))

    print("\n" + "=" * 78)
    print(f" {title.upper()} — VS BENCHMARKS ".center(78, "="))
    print("=" * 78)
    header = f"{'Benchmark':<10}{'Bench CAGR':>12}{'Excess':>10}{'Alpha':>10}{'Beta':>8}{'IR':>8}{'Verdict':>16}"
    print(header)
    print("-" * 78)
    for ticker, payload in benchmarks.items():
        rel = payload.get("relative") or {}
        if not rel:
            print(f"{ticker:<10}{'insufficient overlap':>68}")
            continue
        verdict = "BEATS IT" if rel.get("beat_benchmark") else "loses to it"
        print(
            f"{ticker:<10}"
            f"{rel.get('benchmark_cagr_pct', float('nan')):>11.2f}%"
            f"{rel.get('excess_cagr_pct', float('nan')):>+9.2f}%"
            f"{rel.get('alpha_pct', float('nan')):>+9.2f}%"
            f"{rel.get('beta', float('nan')):>8.2f}"
            f"{rel.get('information_ratio', float('nan')):>8.2f}"
            f"{verdict:>16}"
        )
    print("-" * 78)
    print(f"Strategy CAGR: {strategy_cagr:.2f}%")
    print("=" * 78 + "\n")


def print_price_coverage(result: dict):
    """Report universe names the price feed could not cover.

    A point-in-time universe removes survivorship bias from the universe; a
    price feed with no history for delisted names puts it back. Say so.
    """
    coverage = result.get("price_coverage") or {}
    total = coverage.get("universe_tickers", 0)
    priced = coverage.get("priced_tickers", 0)
    missing = coverage.get("missing_tickers") or []
    if not total:
        return

    print(f"Price coverage: {priced}/{total} universe tickers had price history.")
    if missing:
        shown = ", ".join(missing[:20]) + ("..." if len(missing) > 20 else "")
        print(
            f"WARNING: {len(missing)} ticker(s) excluded for want of price data: {shown}\n"
            "         These skew toward delisted and acquired names — the ones that\n"
            "         usually left the universe badly — so results are biased upward.\n"
        )


def print_coverage_warning(result: dict):
    coverage = result.get("universe_coverage") or {}
    snapshots = coverage.get("snapshots", 0)
    if not snapshots:
        return
    years = coverage.get("span_days", 0) / 365.25
    print(
        f"Universe history: {snapshots} point-in-time snapshots covering "
        f"{coverage.get('first_date')} to {coverage.get('last_date')} ({years:.1f} years)."
    )
    if years < 3:
        print(
            "WARNING: under 3 years of point-in-time universe history. Factor\n"
            "         premia go negative for longer than that. Treat this as a\n"
            "         smoke test of the machinery, not evidence about the strategy.\n"
        )


def main() -> int:
    parser = argparse.ArgumentParser(description="Isolated Shariah Algo Strategy Backtester")
    parser.add_argument("--start-date", type=str, default="2024-01-01", help="Backtest start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, default="2026-06-01", help="Backtest end date (YYYY-MM-DD)")
    parser.add_argument("--top-n", type=int, default=20, help="Number of holdings in portfolio")
    parser.add_argument("--sector-cap", type=float, default=0.20, help="Sector cap percentage (0.20 = 20%%)")
    parser.add_argument("--initial-capital", type=float, default=100000.0, help="Initial cash allocation")
    parser.add_argument("--tx-cost", type=float, default=25.0, help="Transaction cost in basis points (bps)")
    parser.add_argument("--risk-free-rate", type=float, default=0.0,
                        help="Annualised risk-free rate as a decimal (0.04 = 4%%) used for Sharpe and alpha")
    parser.add_argument("--benchmark", action="append", default=None,
                        help=f"Benchmark ticker to compare against; repeatable. Default: {', '.join(DEFAULT_BENCHMARKS)}")
    parser.add_argument("--no-benchmark", action="store_true", help="Skip benchmark comparison entirely")
    parser.add_argument("--compare", action="store_true", help="Compare 4-factor vs 3-factor strategy")
    parser.add_argument("--tickers", type=str, default="", help="Comma-separated list of tickers to restrict the backtest (recommended for free FMP keys)")
    parser.add_argument("--output-dir", type=str, default=".", help="Directory to save backtest result JSON files")

    args = parser.parse_args()
    os.makedirs(args.output_dir, exist_ok=True)

    if args.no_benchmark:
        benchmarks = []
    elif args.benchmark:
        benchmarks = [t.strip().upper() for t in args.benchmark if t.strip()]
    else:
        benchmarks = list(DEFAULT_BENCHMARKS)

    # Override universe if custom tickers are provided
    if args.tickers:
        custom_list = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
        logger.warning(
            "Restricting the universe to a fixed ticker list: %s. This list does not "
            "change over time, so it carries full survivorship bias — every name in it "
            "is one that still exists today. Use it to smoke-test the machinery, never "
            "to judge the strategy.", custom_list,
        )
        # Dated far in the past so it is the active snapshot on every backtest date.
        nport.load_universe_history = lambda *a, **k: {"1900-01-01": custom_list}

    # Verify FMP key is set or ask user
    fmp_key = os.environ.get("FMP_API_KEY")
    if not fmp_key:
        logger.warning("FMP_API_KEY is not defined in the environment (.env). Fundamentals-based screens and Quality scoring will be omitted (defaulting to Z-scores of 0 or failing compliance).")

    provider = DataProvider(fmp_api_key=fmp_key)
    engine = BacktestEngine(
        data_provider=provider,
        initial_capital=args.initial_capital,
        transaction_cost_bps=args.tx_cost,
        risk_free_rate=args.risk_free_rate,
    )

    # 1. Run 4-Factor Strategy (Standard)
    res_4f = engine.run(
        start_date=args.start_date,
        end_date=args.end_date,
        top_n=args.top_n,
        sector_cap=args.sector_cap,
        use_low_vol=True,
        benchmarks=benchmarks,
    )

    if not res_4f:
        logger.error(
            "Backtest produced no result. If this is a missing-universe error, run:\n"
            '  export SEC_USER_AGENT="Your Name your@email.com"\n'
            "  uv run python -m shariah_algo_trader.backtesting.sync_universe"
        )
        return 1

    print_metrics_table(res_4f["metrics"], "4-Factor Strategy (Standard)")
    print_benchmark_table(res_4f, "4-Factor Strategy")
    print_coverage_warning(res_4f)
    print_price_coverage(res_4f)

    # Save results
    out_path = os.path.join(args.output_dir, "results_4f.json")
    with open(out_path, "w") as f:
        json.dump({
            "metrics": res_4f["metrics"],
            "benchmarks": {t: p["relative"] for t, p in (res_4f.get("benchmarks") or {}).items()},
            "universe_coverage": res_4f.get("universe_coverage"),
            "price_coverage": res_4f.get("price_coverage"),
            "daily_equity": res_4f["daily_equity"],
        }, f, indent=2)
        logger.info("Saved 4-factor backtest results to %s", out_path)

    # 2. Run 3-Factor Strategy (If requested)
    if args.compare:
        logger.info("Running comparison strategy (3-factor, excluding Low Volatility)...")
        res_3f = engine.run(
            start_date=args.start_date,
            end_date=args.end_date,
            top_n=args.top_n,
            sector_cap=args.sector_cap,
            use_low_vol=False,
            benchmarks=benchmarks,
        )
        if res_3f:
            print_metrics_table(res_3f["metrics"], "3-Factor Strategy (No Low-Vol)")
            print_benchmark_table(res_3f, "3-Factor Strategy")

            # Save results
            out_path = os.path.join(args.output_dir, "results_3f.json")
            with open(out_path, "w") as f:
                json.dump({
                    "metrics": res_3f["metrics"],
                    "benchmarks": {t: p["relative"] for t, p in (res_3f.get("benchmarks") or {}).items()},
                    "daily_equity": res_3f["daily_equity"],
                }, f, indent=2)
                logger.info("Saved 3-factor backtest results to %s", out_path)

    return 0


if __name__ == "__main__":
    sys.exit(main())
