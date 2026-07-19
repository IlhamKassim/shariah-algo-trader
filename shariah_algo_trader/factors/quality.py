import logging

import pandas as pd
import yfinance as yf

from shariah_algo_trader.factors._utils import z_scores

logger = logging.getLogger(__name__)

DEBT_TO_ASSETS_LIMIT = 0.33


def compute_quality_factor(tickers: set[str]) -> dict[str, float]:
    """Compute Quality Factor z-scores for each ticker in the Eligible Universe.

    Hard filter: tickers with Total Debt / Total Assets > 0.33 are excluded before
    scoring — they receive no Factor Score regardless of profitability metrics.

    Composite for survivors:
        raw_quality = 0.40 × ROE + 0.30 × net_profit_margin + 0.30 × (1 − debt_to_assets)

    Returns a dict mapping ticker → z-score. Excluded tickers are logged as warnings.
    """
    logger.info("Computing Quality Factor for %d tickers", len(tickers))
    raw_scores: dict[str, float] = {}

    for ticker in tickers:
        try:
            t = yf.Ticker(ticker)
            income = t.income_stmt
            balance = t.balance_sheet
        except Exception as exc:
            logger.warning(
                "%s: failed to fetch financial data (%s), excluding from Quality Factor",
                ticker, exc,
            )
            continue

        if income is None or income.empty or balance is None or balance.empty:
            logger.warning("%s: no fundamental data, excluding from Quality Factor", ticker)
            continue

        net_income = _get(income, "Net Income")
        revenue = _get(income, "Total Revenue")
        total_assets = _get(balance, "Total Assets")
        total_debt = _get(balance, "Total Debt", "Long Term Debt")
        equity = _get(balance, "Stockholders Equity", "Total Stockholders Equity", "Common Stock Equity")

        if any(v is None for v in (net_income, revenue, total_assets, total_debt, equity)):
            logger.warning("%s: incomplete fundamental data, excluding from Quality Factor", ticker)
            continue

        if revenue == 0 or equity == 0 or total_assets == 0:
            logger.warning(
                "%s: zero denominator in fundamentals, excluding from Quality Factor", ticker
            )
            continue

        roe = net_income / equity
        margin = net_income / revenue
        debt_to_assets = total_debt / total_assets

        if debt_to_assets > DEBT_TO_ASSETS_LIMIT:
            logger.warning(
                "%s: debt/assets %.4f exceeds Islamic finance limit of %.2f, excluding from Quality Factor",
                ticker, debt_to_assets, DEBT_TO_ASSETS_LIMIT,
            )
            continue

        raw_scores[ticker] = 0.40 * roe + 0.30 * margin + 0.30 * (1 - debt_to_assets)

    logger.info("Quality Factor: %d/%d tickers scored", len(raw_scores), len(tickers))
    return z_scores(raw_scores)


def _get(df: pd.DataFrame, *keys: str) -> float | None:
    """Return the most recent non-NA numeric value for the first matching row label."""
    for key in keys:
        if key in df.index:
            item = df.loc[key]
            if isinstance(item, pd.DataFrame):
                item = item.iloc[0]
            if isinstance(item, pd.Series):
                for val in item:
                    if pd.notna(val):
                        try:
                            return float(val)
                        except (ValueError, TypeError):
                            continue
            elif pd.notna(item):
                try:
                    return float(item)
                except (ValueError, TypeError):
                    pass
    return None
