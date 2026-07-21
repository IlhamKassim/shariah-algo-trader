import os
import json
import logging
import datetime
import pandas as pd
import yfinance as yf
import requests

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
FUNDAMENTALS_DIR = os.path.join(CACHE_DIR, "fundamentals")
PRICES_CACHE_FILE = os.path.join(CACHE_DIR, "prices.parquet")

os.makedirs(FUNDAMENTALS_DIR, exist_ok=True)

class DataProvider:
    def __init__(self, fmp_api_key: str = None):
        self.fmp_api_key = fmp_api_key or os.environ.get("FMP_API_KEY", "")
        self.prices_df = None
        self._load_prices_cache()

    def _load_prices_cache(self):
        if os.path.exists(PRICES_CACHE_FILE):
            try:
                self.prices_df = pd.read_parquet(PRICES_CACHE_FILE)
                logger.info("Loaded price cache with shape %s", self.prices_df.shape)
            except Exception as exc:
                logger.warning("Failed to load price cache: %s. Starting fresh.", exc)

    def _save_prices_cache(self):
        if self.prices_df is not None:
            try:
                self.prices_df.to_parquet(PRICES_CACHE_FILE)
                logger.info("Saved price cache with shape %s", self.prices_df.shape)
            except Exception as exc:
                logger.warning("Failed to save price cache: %s", exc)

    def get_historical_prices(self, tickers: list[str], start_date: str, end_date: str) -> pd.DataFrame:
        """Fetch historical close prices for multiple tickers. Utilises local cache and yfinance."""
        tickers_set = set(tickers)
        cached_tickers = set()
        
        if self.prices_df is not None:
            cached_tickers = set(self.prices_df.columns) & tickers_set
            
        missing_tickers = list(tickers_set - cached_tickers)
        
        if missing_tickers:
            logger.info("Fetching price history for %d missing tickers from %s to %s", len(missing_tickers), start_date, end_date)
            try:
                # yfinance download
                raw = yf.download(missing_tickers, start=start_date, end=end_date, progress=False)
                
                # Check structure (yfinance MultiIndex Close)
                if isinstance(raw, pd.DataFrame) and not raw.empty:
                    if "Close" in raw.columns:
                        close_data = raw["Close"]
                    else:
                        close_data = raw
                    
                    # Align to DataFrame
                    if isinstance(close_data, pd.Series):
                        close_df = pd.DataFrame({missing_tickers[0]: close_data})
                    else:
                        close_df = close_data
                    
                    close_df.index = pd.to_datetime(close_df.index)
                    
                    if self.prices_df is None:
                        self.prices_df = close_df
                    else:
                        # Merge along index and columns
                        self.prices_df = self.prices_df.combine_first(close_df)
                        
                    self._save_prices_cache()
            except Exception as exc:
                logger.error("Failed to fetch price history for tickers: %s", exc)
        
        if self.prices_df is not None:
            # Reindex to fit active columns
            avail = [t for t in tickers if t in self.prices_df.columns]
            df = self.prices_df[avail]
            # Filter rows by date range
            df = df.loc[start_date:end_date]
            return df
        
        return pd.DataFrame()

    def get_fundamentals(self, ticker: str) -> tuple[list[dict], list[dict]]:
        """Fetch balance sheet and income statement from local cache or FMP Stable API.
        
        Returns tuple of (balance_sheets, income_statements)
        """
        bal_cache_path = os.path.join(FUNDAMENTALS_DIR, f"{ticker}_balance.json")
        inc_cache_path = os.path.join(FUNDAMENTALS_DIR, f"{ticker}_income.json")
        
        balance_sheets = []
        income_statements = []
        
        # Load from cache if exists
        if os.path.exists(bal_cache_path) and os.path.exists(inc_cache_path):
            try:
                with open(bal_cache_path, "r") as f:
                    balance_sheets = json.load(f)
                with open(inc_cache_path, "r") as f:
                    income_statements = json.load(f)
                return balance_sheets, income_statements
            except Exception as exc:
                logger.warning("%s: Failed to load fundamentals cache: %s", ticker, exc)

        # Otherwise query FMP Stable API
        if not self.fmp_api_key:
            logger.warning("FMP_API_KEY is not configured. Cannot load fundamentals for %s", ticker)
            return [], []
            
        logger.info("Fetching fundamentals from FMP Stable API for %s", ticker)
        
        try:
            # 1. Balance Sheet
            bal_url = f"https://financialmodelingprep.com/stable/balance-sheet-statement?symbol={ticker}&apikey={self.fmp_api_key}"
            bal_res = requests.get(bal_url, timeout=15)
            if bal_res.status_code == 200:
                bal_data = bal_res.json()
                if isinstance(bal_data, list):
                    balance_sheets = bal_data
                    with open(bal_cache_path, "w") as f:
                        json.dump(balance_sheets, f, indent=2)
                else:
                    logger.warning("%s: FMP balance sheet did not return a list: %s", ticker, bal_data)
            else:
                logger.warning("%s: FMP balance sheet API returned status %d", ticker, bal_res.status_code)
                
            # 2. Income Statement
            inc_url = f"https://financialmodelingprep.com/stable/income-statement?symbol={ticker}&apikey={self.fmp_api_key}"
            inc_res = requests.get(inc_url, timeout=15)
            if inc_res.status_code == 200:
                inc_data = inc_res.json()
                if isinstance(inc_data, list):
                    income_statements = inc_data
                    with open(inc_cache_path, "w") as f:
                        json.dump(income_statements, f, indent=2)
                else:
                    logger.warning("%s: FMP income statement did not return a list: %s", ticker, inc_data)
            else:
                logger.warning("%s: FMP income statement API returned status %d", ticker, inc_res.status_code)
                
        except Exception as exc:
            logger.error("%s: FMP API request failed: %s", ticker, type(exc).__name__)
            
        return balance_sheets, income_statements
