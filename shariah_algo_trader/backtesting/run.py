import os
import argparse
import logging
import json
from dotenv import load_dotenv

load_dotenv()

from shariah_algo_trader.backtesting.data_provider import DataProvider
from shariah_algo_trader.backtesting.engine import BacktestEngine

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

def main():
    parser = argparse.ArgumentParser(description="Isolated Shariah Algo Strategy Backtester")
    parser.add_argument("--start-date", type=str, default="2024-01-01", help="Backtest start date (YYYY-MM-DD)")
    parser.add_argument("--end-date", type=str, default="2026-06-01", help="Backtest end date (YYYY-MM-DD)")
    parser.add_argument("--top-n", type=int, default=20, help="Number of holdings in portfolio")
    parser.add_argument("--sector-cap", type=float, default=0.20, help="Sector cap percentage (0.20 = 20%)")
    parser.add_argument("--initial-capital", type=float, default=100000.0, help="Initial cash allocation")
    parser.add_argument("--tx-cost", type=float, default=25.0, help="Transaction cost in basis points (bps)")
    parser.add_argument("--compare", action="store_true", help="Compare 4-factor vs 3-factor strategy")
    parser.add_argument("--tickers", type=str, default="", help="Comma-separated list of tickers to restrict the backtest (recommended for free FMP keys)")

    args = parser.parse_args()

    # Override universe if custom tickers are provided
    if args.tickers:
        custom_list = [t.strip().upper() for t in args.tickers.split(",") if t.strip()]
        logger.info("Restricting backtest universe to custom ticker list: %s", custom_list)
        # Mock load_universe_history in edgar_parser
        from shariah_algo_trader.backtesting import edgar_parser
        edgar_parser.load_universe_history = lambda: {"fallback": custom_list}

    # Verify FMP key is set or ask user
    fmp_key = os.environ.get("FMP_API_KEY")
    if not fmp_key:
        logger.warning("FMP_API_KEY is not defined in the environment (.env). Fundamentals-based screens and Quality scoring will be omitted (defaulting to Z-scores of 0 or failing compliance).")

    provider = DataProvider(fmp_api_key=fmp_key)
    engine = BacktestEngine(
        data_provider=provider,
        initial_capital=args.initial_capital,
        transaction_cost_bps=args.tx_cost
    )

    # 1. Run 4-Factor Strategy (Standard)
    res_4f = engine.run(
        start_date=args.start_date,
        end_date=args.end_date,
        top_n=args.top_n,
        sector_cap=args.sector_cap,
        use_low_vol=True
    )
    
    if res_4f:
        print_metrics_table(res_4f["metrics"], "4-Factor Strategy (Standard)")
        
        # Save results
        out_path = os.path.join(os.path.dirname(__file__), "results_4f.json")
        with open(out_path, "w") as f:
            json.dump({
                "metrics": res_4f["metrics"],
                "daily_equity": res_4f["daily_equity"]
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
            use_low_vol=False
        )
        if res_3f:
            print_metrics_table(res_3f["metrics"], "3-Factor Strategy (No Low-Vol)")
            
            # Save results
            out_path = os.path.join(os.path.dirname(__file__), "results_3f.json")
            with open(out_path, "w") as f:
                json.dump({
                    "metrics": res_3f["metrics"],
                    "daily_equity": res_3f["daily_equity"]
                }, f, indent=2)
                logger.info("Saved 3-factor backtest results to %s", out_path)

if __name__ == "__main__":
    main()
