import os
import re
import json
import logging
import csv
import io
import requests
import xml.etree.ElementTree as ET
from typing import Optional

logger = logging.getLogger(__name__)

CACHE_DIR = os.path.join(os.path.dirname(__file__), ".cache")
UNIVERSE_CACHE_DIR = os.path.join(CACHE_DIR, "universe")
FILINGS_DIR = os.path.join(os.path.dirname(__file__), "data", "filings")

os.makedirs(UNIVERSE_CACHE_DIR, exist_ok=True)
os.makedirs(FILINGS_DIR, exist_ok=True)

SPUS_SERIES_ID = "S000067283"
SPUS_HOLDINGS_URL = "https://www.sp-funds.com/wp-content/uploads/data/TidalFG_Holdings_SPUS.csv"

def find_element_by_tag_suffix(root: ET.Element, suffix: str) -> Optional[ET.Element]:
    for el in root.iter():
        if el.tag.split("}")[-1] == suffix:
            return el
    return None

def find_all_elements_by_tag_suffix(root: ET.Element, suffix: str) -> list[ET.Element]:
    return [el for el in root.iter() if el.tag.split("}")[-1] == suffix]

def parse_nport_xml(xml_content: str) -> Optional[tuple[str, dict[str, float]]]:
    """Parse Form N-PORT XML content.
    
    Returns tuple of (report_date, holdings_dict) or None if it is not SPUS.
    holdings_dict maps ticker -> weight (fraction of portfolio value).
    """
    try:
        root = ET.fromstring(xml_content)
    except Exception as exc:
        logger.error("Failed to parse XML string: %s", exc)
        return None

    # Verify Series ID (Must be SPUS)
    series_id_el = find_element_by_tag_suffix(root, "seriesId")
    if series_id_el is None or series_id_el.text != SPUS_SERIES_ID:
        # Not SPUS, skip
        return None

    # Get Report Date (repPdDate primarily, fallback to repPdEnd)
    rep_date_el = find_element_by_tag_suffix(root, "repPdDate")
    if rep_date_el is None or not rep_date_el.text:
        rep_date_el = find_element_by_tag_suffix(root, "repPdEnd")
        
    if rep_date_el is None or not rep_date_el.text:
        logger.warning("Filing has no reporting period date (repPdDate or repPdEnd)")
        return None
    report_date = rep_date_el.text.strip()

    # Extract Holdings (invstOrSec)
    holdings = {}
    invst_list = find_all_elements_by_tag_suffix(root, "invstOrSec")
    
    for invst in invst_list:
        # Get Ticker
        ticker_el = find_element_by_tag_suffix(invst, "ticker")
        ticker = None
        if ticker_el is not None:
            ticker = ticker_el.get("value") or ticker_el.text
            if ticker:
                ticker = ticker.strip().upper()
                
        # Fallback to CUSIP/name if no ticker (though we only trade tickers)
        if not ticker:
            continue
            
        # Ignore CASH/USD
        if ticker.startswith("CASH") or ticker.startswith("USD"):
            continue

        # Get Weight/Percentage Value (pctVal)
        pct_el = find_element_by_tag_suffix(invst, "pctVal")
        weight = 0.0
        if pct_el is not None and pct_el.text:
            try:
                # pctVal is a percentage (e.g. 5.43 for 5.43%), convert to decimal
                weight = float(pct_el.text.strip()) / 100.0
            except ValueError:
                pass
                
        # Store holding
        holdings[ticker] = weight

    return report_date, holdings

def load_universe_history() -> dict[str, list[str]]:
    """Load the historical constituents map: report_date -> list of tickers.
    
    1. First parses any manually-placed XML filings under backtesting/data/filings/
    2. Then checks cached JSON holdings in .cache/universe/
    3. If no holdings exist, falls back to downloading current SPUS constituents and caches it as 'fallback'.
    """
    history: dict[str, list[str]] = {}
    
    # 1. Parse local XML filings in data/filings/
    if os.path.exists(FILINGS_DIR):
        for fname in os.listdir(FILINGS_DIR):
            if fname.endswith(".xml"):
                fpath = os.path.join(FILINGS_DIR, fname)
                try:
                    with open(fpath, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()
                    parsed = parse_nport_xml(content)
                    if parsed:
                        report_date, holdings = parsed
                        logger.info("Parsed local N-PORT filing for date %s, found %d tickers", report_date, len(holdings))
                        # Save to cache
                        cache_path = os.path.join(UNIVERSE_CACHE_DIR, f"{report_date}.json")
                        with open(cache_path, "w") as f_out:
                            json.dump(holdings, f_out, indent=2)
                except Exception as exc:
                    logger.error("Failed to parse local XML filing %s: %s", fname, exc)

    # 2. Load cached holdings files
    for fname in os.listdir(UNIVERSE_CACHE_DIR):
        if fname.endswith(".json") and fname != "fallback.json":
            report_date = fname[:-5] # remove '.json'
            cache_path = os.path.join(UNIVERSE_CACHE_DIR, fname)
            try:
                with open(cache_path, "r") as f:
                    holdings = json.load(f)
                    history[report_date] = list(holdings.keys())
            except Exception as exc:
                logger.error("Failed to load cached holdings %s: %s", fname, exc)

    # 3. Fallback if empty: fetch live holdings as the base universe
    if not history:
        fallback_path = os.path.join(UNIVERSE_CACHE_DIR, "fallback.json")
        tickers = []
        if os.path.exists(fallback_path):
            try:
                with open(fallback_path, "r") as f:
                    tickers = json.load(f)
            except Exception as exc:
                logger.error("Failed to load fallback cache: %s", exc)
                
        if not tickers:
            logger.info("SEC EDGAR filings are unavailable/blocked. Fetching current SPUS constituents as fallback universe...")
            try:
                headers = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)"}
                res = requests.get(SPUS_HOLDINGS_URL, headers=headers, timeout=20)
                res.raise_for_status()
                reader = csv.DictReader(io.StringIO(res.text))
                
                # Extract ticker col
                fieldnames = list(reader.fieldnames or [])
                ticker_col = next((c for c in ["StockTicker", "Ticker", "TICKER", "Symbol", "SYMBOL", "ticker", "symbol"] if c in fieldnames), None)
                if ticker_col:
                    for row in reader:
                        val = row.get(ticker_col, "").strip().upper()
                        if val and not val.startswith("CASH") and not val.startswith("USD"):
                            tickers.append(val)
                            
                if tickers:
                    with open(fallback_path, "w") as f:
                        json.dump(tickers, f, indent=2)
                    logger.info("Successfully fetched %d fallback constituents from SPUS holdings CSV.", len(tickers))
                else:
                    logger.error("No tickers extracted from live SPUS holdings URL.")
            except Exception as exc:
                logger.error("Failed to fetch live fallback holdings from SPUS URL: %s", exc)
                
        # If we successfully got tickers, map them to a dummy historical date 'fallback'
        if tickers:
            history["fallback"] = tickers
            logger.info("Using current SPUS holdings as fallback universe (constant across timeline). Note: This introduces survivorship bias.")

    return history
