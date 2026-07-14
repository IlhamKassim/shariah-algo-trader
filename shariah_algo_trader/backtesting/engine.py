import os
import json
import logging
import datetime
import numpy as np
import pandas as pd
from typing import Optional

from shariah_algo_trader.backtesting.data_provider import DataProvider
from shariah_algo_trader.backtesting import edgar_parser

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
PROFILES_CACHE_FILE = os.path.join(CACHE_DIR, "profiles.json")

def z_scores(raw: dict[str, float]) -> dict[str, float]:
    if not raw:
        return {}
    values = np.array(list(raw.values()), dtype=float)
    std = values.std()
    if std == 0:
        return {t: 0.0 for t in raw}
    zs = (values - values.mean()) / std
    return dict(zip(raw.keys(), zs.tolist()))

class BacktestEngine:
    def __init__(self, data_provider: DataProvider, initial_capital: float = 100000.0, transaction_cost_bps: float = 25.0):
        self.data_provider = data_provider
        self.initial_capital = initial_capital
        self.transaction_cost_pct = transaction_cost_bps / 10000.0
        self.profiles = {}
        self._load_profiles()

    def _load_profiles(self):
        if os.path.exists(PROFILES_CACHE_FILE):
            try:
                with open(PROFILES_CACHE_FILE, "r") as f:
                    self.profiles = json.load(f)
            except Exception as exc:
                logger.warning("Failed to load profiles cache: %s", exc)

    def _save_profiles(self):
        try:
            with open(PROFILES_CACHE_FILE, "w") as f:
                json.dump(self.profiles, f, indent=2)
        except Exception as exc:
            logger.warning("Failed to save profiles cache: %s", exc)

    def get_sector(self, ticker: str) -> str:
        if ticker in self.profiles:
            return self.profiles[ticker].get("sector", "Unknown")
            
        # Fetch from FMP profile
        if self.data_provider.fmp_api_key:
            try:
                import requests
                url = f"https://financialmodelingprep.com/stable/profile?symbol={ticker}&apikey={self.data_provider.fmp_api_key}"
                res = requests.get(url, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    if data and isinstance(data, list):
                        self.profiles[ticker] = data[0]
                        self._save_profiles()
                        return data[0].get("sector", "Unknown")
            except Exception as exc:
                logger.warning("%s: Failed to fetch profile: %s", ticker, exc)
                
        return "Unknown"

    def run(self, start_date: str, end_date: str, top_n: int = 20, sector_cap: float = 0.20, use_low_vol: bool = True) -> dict:
        """Run the monthly walk-forward backtest simulation."""
        logger.info("Starting backtest from %s to %s (top_n=%d, use_low_vol=%s)", start_date, end_date, top_n, use_low_vol)
        
        # 1. Load universe history
        universe_history = edgar_parser.load_universe_history()
        
        # Collect all tickers that ever existed in the universe
        all_tickers = set()
        for t_list in universe_history.values():
            all_tickers.update(t_list)
        all_tickers = sorted(list(all_tickers))
        
        # Pre-fetch historical prices for all tickers in bulk from start_date minus lookback (e.g. 450 days)
        start_dt = datetime.datetime.strptime(start_date, "%Y-%m-%d")
        lookback_start = (start_dt - datetime.timedelta(days=450)).strftime("%Y-%m-%d")
        
        prices_df = self.data_provider.get_historical_prices(all_tickers, lookback_start, end_date)
        if prices_df.empty:
            logger.error("No price data retrieved for backtest. Aborting.")
            return {}
            
        # Re-verify tickers present in price data
        valid_tickers = [t for t in all_tickers if t in prices_df.columns]
        
        # 2. Identify monthly rebalance dates (first trading day of each month)
        trading_days = prices_df.loc[start_date:end_date].index
        if len(trading_days) == 0:
            logger.error("No trading days found in price data for backtest range.")
            return {}
            
        monthly_rebalance_dates = []
        last_month = None
        for day in trading_days:
            current_month = (day.year, day.month)
            if current_month != last_month:
                monthly_rebalance_dates.append(day)
                last_month = current_month
                
        logger.info("Found %d rebalance dates: %s", len(monthly_rebalance_dates), [d.strftime("%Y-%m-%d") for d in monthly_rebalance_dates])
        
        # Backtest states
        portfolio_value = self.initial_capital
        portfolio_holdings: dict[str, float] = {}  # ticker -> shares held
        cash = self.initial_capital
        
        daily_equity = []
        rebalance_log = []
        
        # Loop through each day to track equity value
        # We process day by day to build a correct daily equity curve
        current_rebalance_idx = 0
        active_target_weights: dict[str, float] = {}
        
        for today in trading_days:
            # Check if today is a rebalance day
            is_rebalance_day = False
            if current_rebalance_idx < len(monthly_rebalance_dates) and today == monthly_rebalance_dates[current_rebalance_idx]:
                is_rebalance_day = True
                current_rebalance_idx += 1
                
            if is_rebalance_day:
                logger.info("Rebalancing on %s", today.strftime("%Y-%m-%d"))
                # Get the active universe
                active_universe = self._get_active_universe(today.strftime("%Y-%m-%d"), universe_history)
                # Keep only tickers with prices
                active_universe = [t for t in active_universe if t in valid_tickers]
                
                # Compute scores
                scores = self._score_universe(today, active_universe, prices_df, use_low_vol)
                
                # Rank top N with sector cap
                selected_tickers = self._rank_tickers(scores, top_n, sector_cap)
                
                # Calculate new weights
                new_weights = self._calc_weights(selected_tickers, today, prices_df)
                
                # Execute rebalance trades
                # Calculate current market value of holdings
                total_asset_value = 0.0
                for ticker, shares in portfolio_holdings.items():
                    price = float(prices_df.loc[today, ticker])
                    total_asset_value += shares * price
                    
                portfolio_value = total_asset_value + cash
                
                # Rebalance trades
                new_holdings = {}
                trade_volume = 0.0
                
                for ticker in selected_tickers:
                    target_val = portfolio_value * new_weights[ticker]
                    price = float(prices_df.loc[today, ticker])
                    target_shares = target_val / price if price > 0 else 0
                    
                    old_shares = portfolio_holdings.get(ticker, 0.0)
                    trade_shares = abs(target_shares - old_shares)
                    trade_volume += trade_shares * price
                    
                    new_holdings[ticker] = target_shares
                    
                # Calculate transaction fees
                tx_fee = trade_volume * self.transaction_cost_pct
                cash = portfolio_value - sum(new_holdings[t] * float(prices_df.loc[today, t]) for t in new_holdings) - tx_fee
                portfolio_holdings = new_holdings
                portfolio_value = sum(portfolio_holdings[t] * float(prices_df.loc[today, t]) for t in portfolio_holdings) + cash
                
                logger.info("Rebalanced completed. Holdings: %d stocks. Portfolio value: $%.2f. Tx Fee: $%.2f", len(portfolio_holdings), portfolio_value, tx_fee)
                rebalance_log.append({
                    "date": today.strftime("%Y-%m-%d"),
                    "holdings": list(portfolio_holdings.keys()),
                    "portfolio_value": portfolio_value,
                    "tx_fee": tx_fee
                })
                
            else:
                # Update today's portfolio value based on price changes
                total_asset_value = 0.0
                for ticker, shares in portfolio_holdings.items():
                    price = float(prices_df.loc[today, ticker])
                    if pd.isna(price):
                        # Handle missing/stale prices by backfilling
                        price_series = prices_df[ticker].loc[:today].dropna()
                        price = float(price_series.iloc[-1]) if not price_series.empty else 0.0
                    total_asset_value += shares * price
                portfolio_value = total_asset_value + cash
                
            daily_equity.append({
                "date": today.strftime("%Y-%m-%d"),
                "value": portfolio_value
            })
            
        # Calculate stats
        equity_series = pd.Series([d["value"] for d in daily_equity], index=pd.to_datetime([d["date"] for d in daily_equity]))
        stats = self._calculate_metrics(equity_series)
        
        return {
            "daily_equity": daily_equity,
            "rebalance_log": rebalance_log,
            "metrics": stats
        }

    def _get_active_universe(self, date_str: str, universe_history: dict[str, list[str]]) -> list[str]:
        # If fallback is in history, use it
        if "fallback" in universe_history:
            return universe_history["fallback"]
            
        # Otherwise find closest historical snapshot end-date <= date_str
        valid_dates = sorted([d for d in universe_history.keys() if d <= date_str])
        if valid_dates:
            target_date = valid_dates[-1]
            return universe_history[target_date]
            
        # If no dates <= date_str, use first available date
        all_dates = sorted(universe_history.keys())
        if all_dates:
            return universe_history[all_dates[0]]
            
        return []

    def _score_universe(self, date: pd.Timestamp, tickers: list[str], prices_df: pd.DataFrame, use_low_vol: bool) -> dict[str, float]:
        """Compute the 4 factors for active tickers up to date."""
        date_str = date.strftime("%Y-%m-%d")
        
        # 1. Price-based factors (Momentum & Volatility)
        # Pull 400 calendar days of price history
        lookback_start = (date - datetime.timedelta(days=400)).strftime("%Y-%m-%d")
        subset_prices = prices_df.loc[lookback_start:date_str, tickers]
        
        # Ticker calculations
        momentum_raw = {}
        vol_raw = {}
        quality_raw = {}
        value_raw = {}
        
        one_month_ago = date - datetime.timedelta(days=30)
        
        for ticker in tickers:
            series = subset_prices[ticker].dropna()
            
            # Momentum & Volatility
            if len(series) >= 200:
                # Volatility
                daily_ret = series.pct_change().dropna()
                vol_raw[ticker] = float(daily_ret.std() * (252 ** 0.5))
                
                # Momentum
                price_13m_ago = float(series.iloc[0])
                series_until_1m = series[series.index <= one_month_ago]
                if not series_until_1m.empty and price_13m_ago > 0:
                    price_1m_ago = float(series_until_1m.iloc[-1])
                    momentum_raw[ticker] = price_1m_ago / price_13m_ago - 1
                    
            # Fundamentals (Quality & Value)
            bal_sheets, inc_stmts = self.data_provider.get_fundamentals(ticker)
            
            # Find the most recent reports filed *prior* to rebalance date
            # FMP filingDate format is typically YYYY-MM-DD
            valid_bal = [r for r in bal_sheets if r.get("filingDate") and r["filingDate"] < date_str]
            valid_inc = [r for r in inc_stmts if r.get("filingDate") and r["filingDate"] < date_str]
            
            # Get matching cash flow statement as well if we have any valid reports
            fcf_val = None
            if valid_inc:
                # Try cash flow statement
                # To save API calls, we query the cash flow statement from data provider dynamically
                try:
                    # Let's add a cache for cash flow statements in FUNDAMENTALS_DIR
                    cf_cache_path = os.path.join(FUNDAMENTALS_DIR, f"{ticker}_cashflow.json")
                    cashflows = []
                    if os.path.exists(cf_cache_path):
                        with open(cf_cache_path, "r") as f:
                            cashflows = json.load(f)
                    elif self.data_provider.fmp_api_key:
                        import requests
                        cf_url = f"https://financialmodelingprep.com/stable/cash-flow-statement?symbol={ticker}&apikey={self.data_provider.fmp_api_key}"
                        cf_res = requests.get(cf_url, timeout=10)
                        if cf_res.status_code == 200:
                            cf_data = cf_res.json()
                            if isinstance(cf_data, list):
                                cashflows = cf_data
                                with open(cf_cache_path, "w") as f:
                                    json.dump(cashflows, f, indent=2)
                    
                    valid_cf = [r for r in cashflows if r.get("filingDate") and r["filingDate"] < date_str]
                    if valid_cf:
                        fcf_val = valid_cf[0].get("freeCashFlow")
                except Exception:
                    pass
            
            if valid_bal and valid_inc:
                bal = valid_bal[0]
                inc = valid_inc[0]
                
                net_income = inc.get("netIncome")
                revenue = inc.get("revenue")
                sh_equity = bal.get("totalStockholdersEquity")
                total_assets = bal.get("totalAssets")
                total_debt = bal.get("totalDebt")
                weighted_shs = inc.get("weightedAverageShsOut")
                
                # Check complete fields
                if all(v is not None for v in (net_income, revenue, sh_equity, total_assets, total_debt)) and total_assets > 0:
                    debt_to_assets = total_debt / total_assets
                    
                    # Apply Shariah 33% debt filter
                    if debt_to_assets <= 0.33:
                        # Quality calculation
                        roe = net_income / sh_equity if sh_equity != 0 else 0
                        margin = net_income / revenue if revenue != 0 else 0
                        quality_raw[ticker] = 0.40 * roe + 0.30 * margin + 0.30 * (1 - debt_to_assets)
                        
                        # Value calculation (FCF Yield)
                        if fcf_val is not None and weighted_shs and weighted_shs > 0:
                            price_at_date = float(series.iloc[-1])
                            market_cap = weighted_shs * price_at_date
                            if market_cap > 0 and fcf_val > 0:
                                value_raw[ticker] = fcf_val / market_cap
                                
        # Standardize Z-scores
        m_scores = z_scores(momentum_raw)
        q_scores = z_scores(quality_raw)
        v_scores = z_scores({t: -v for t, v in vol_raw.items()}) if use_low_vol else {}
        val_scores = z_scores(value_raw)
        
        # Calculate composite score for tickers that survived screens
        # Tickers missing momentum or quality are excluded, value/vol default to 0
        required = m_scores.keys() & q_scores.keys()
        
        composite_scores = {}
        for ticker in required:
            m = m_scores[ticker]
            q = q_scores[ticker]
            v = v_scores.get(ticker, 0.0) if use_low_vol else 0.0
            val = val_scores.get(ticker, 0.0)
            
            # Combine weights
            if use_low_vol:
                composite_scores[ticker] = 0.25 * m + 0.25 * q + 0.25 * v + 0.25 * val
            else:
                composite_scores[ticker] = 0.333 * m + 0.333 * q + 0.333 * val
                
        return composite_scores

    def _rank_tickers(self, scores: dict[str, float], top_n: int, sector_cap: float) -> list[str]:
        ranked = sorted(scores, key=lambda t: scores[t], reverse=True)
        
        max_per_sector = max(1, int(sector_cap * top_n))
        sector_counts = {}
        selected = []
        
        for ticker in ranked:
            if len(selected) >= top_n:
                break
            sector = self.get_sector(ticker)
            if sector != "Unknown" and sector_counts.get(sector, 0) >= max_per_sector:
                continue
            selected.append(ticker)
            sector_counts[sector] = sector_counts.get(sector, 0) + 1
            
        return selected

    def _calc_weights(self, tickers: list[str], date: pd.Timestamp, prices_df: pd.DataFrame) -> dict[str, float]:
        """Compute inverse-volatility normalised position weights (capped at 2x equal weight)."""
        if not tickers:
            return {}

        n = len(tickers)
        cap = 2.0 / n

        date_str = date.strftime("%Y-%m-%d")
        lookback_start = (date - datetime.timedelta(days=400)).strftime("%Y-%m-%d")
        subset_prices = prices_df.loc[lookback_start:date_str, tickers]

        # Calculate raw volatility for each ticker
        raw_vols = {}
        for ticker in tickers:
            if ticker in subset_prices.columns:
                series = subset_prices[ticker].dropna()
                if len(series) >= 200:
                    daily_ret = series.pct_change().dropna()
                    raw_vols[ticker] = float(daily_ret.std() * (252 ** 0.5))

        inv_vol_list = []
        for t in tickers:
            vol = raw_vols.get(t, 0)
            inv_vol_list.append(1.0 / vol if vol > 0 else None)

        valid = [v for v in inv_vol_list if v is not None]
        avg = sum(valid) / len(valid) if valid else 1.0
        inv_vols = [v if v is not None else avg for v in inv_vol_list]

        total = sum(inv_vols)
        if total == 0:
            return {t: 1.0 / n for t in tickers}

        weights = [v / total for v in inv_vols]

        # Iterative cap + renormalise
        for _ in range(n):
            capped = [min(w, cap) for w in weights]
            total = sum(capped)
            if total == 0:
                break
            weights = [w / total for w in capped]
            if all(w <= cap + 1e-9 for w in weights):
                break

        return dict(zip(tickers, weights))

    def _calculate_metrics(self, equity_series: pd.Series) -> dict:
        if equity_series.empty or len(equity_series) < 2:
            return {}
            
        daily_returns = equity_series.pct_change().dropna()
        
        total_return = (equity_series.iloc[-1] / equity_series.iloc[0]) - 1
        
        # Annualised Return (CAGR)
        days = (equity_series.index[-1] - equity_series.index[0]).days
        years = max(days / 365.25, 0.01)
        cagr = (equity_series.iloc[-1] / equity_series.iloc[0]) ** (1.0 / years) - 1
        
        # Annualised Volatility
        vol = daily_returns.std() * (252 ** 0.5)
        
        # Sharpe Ratio (Assuming 0% risk free rate)
        sharpe = (cagr / vol) if vol > 0 else 0.0
        
        # Max Drawdown
        cum_returns = equity_series / equity_series.cummax() - 1
        max_dd = cum_returns.min()
        
        # Win Rate
        win_rate = (daily_returns > 0).sum() / len(daily_returns)
        
        return {
            "total_return_pct": total_return * 100.0,
            "cagr_pct": cagr * 100.0,
            "annualised_vol_pct": vol * 100.0,
            "sharpe_ratio": sharpe,
            "max_drawdown_pct": max_dd * 100.0,
            "win_rate_pct": win_rate * 100.0
        }
