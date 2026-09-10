"""Point-in-time Eligible Universe history, sourced from SEC Form N-PORT filings.

Why this module exists
----------------------
A backtest is only honest if, on any given date, it can only see the universe
that was actually knowable on that date. The live bot derives its Eligible
Universe from an ETF's *current* Holdings Snapshot (see
``shariah_algo_trader/data/universe.py``), which by construction has no history —
yesterday's answer is overwritten by today's. Backtesting against that snapshot
projects today's membership backwards and produces survivorship bias: every
company that was dropped from the ETF for breaching the Shariah Screen (usually
by levering up, often on the way down) silently disappears from the test.

Form N-PORT-P is the fix. Registered funds file it with the SEC, it is public
domain, it is redistributable, and each filing is a dated, immutable record of
exactly what the fund held on a stated date. Reconstructing the Eligible
Universe from a series of N-PORT filings gives a true point-in-time history.

Data notes learned from real filings
------------------------------------
* ``repPdDate`` is the as-of date of the holdings snapshot. ``repPdEnd`` is the
  fund's fiscal period end, is constant across filings, and does NOT identify
  which snapshot a filing carries. Always prefer ``repPdDate``.
* Tickers live in an attribute — ``<ticker value="MMM"/>`` under
  ``<identifiers>`` — not in element text.
* ``pctVal`` is a percentage (``0.267`` means 0.267%), not a fraction.
* ``invCountry`` is the *issuer's country of domicile*, NOT its listing venue.
  Filtering on ``invCountry == "US"`` would wrongly discard ACN, MDT, GRMN,
  NXPI, TT, LULU and other large caps that are foreign-domiciled but trade on
  the NYSE/NASDAQ. Never use it as a tradability filter.
* A holding can legitimately carry no ticker, and such rows can carry junk
  values. Every SPUS filing in this repo contains a stale "ABIOMED INC" entry
  (the company was acquired in 2022) with no ticker and a pctVal of -20. Naively
  summing pctVal across all rows therefore reports ~80% instead of ~100% and
  makes a healthy filing look truncated. Untickered rows are skipped and
  counted, never guessed at, which excludes that artifact as a side effect.

This module deliberately has NO fallback to the live holdings CSV. A missing
history is reported as missing, because a silent fallback is what produced the
survivorship bias in the first place.
"""

from __future__ import annotations

import dataclasses
import datetime
import json
import logging
import os
import re
import time
import xml.etree.ElementTree as ET
from typing import Iterator, Optional

import requests

logger = logging.getLogger(__name__)

SEC_SUBMISSIONS_URL = "https://data.sec.gov/submissions/CIK{cik:010d}.json"
SEC_SUBMISSIONS_SHARD_URL = "https://data.sec.gov/submissions/{name}"
SEC_ARCHIVE_URL = "https://www.sec.gov/Archives/edgar/data/{cik}/{accession}/{document}"

NPORT_FORMS = ("NPORT-P", "NPORT-P/A")

# SEC's published fair-access limit is 10 requests/second. We stay well under it.
DEFAULT_REQUESTS_PER_SECOND = 5.0

# A filing whose kept holdings sum this far from 100% is reported as suspect —
# it usually means holdings are missing. The three real filings in this repo sum
# to 99.88%, 99.87% and 99.75% once untickered junk rows are excluded.
WEIGHT_SUM_TOLERANCE_PCT = 5.0


class NportError(Exception):
    """Raised when N-PORT data cannot be fetched or is structurally unusable."""


@dataclasses.dataclass(frozen=True)
class FundRef:
    """A fund series identified the way EDGAR identifies it."""

    ticker: str
    cik: int
    series_id: str
    name: str


# Only SPUS is listed here because its CIK and series ID were verified directly
# from filings committed to this repository. Do not add a fund to this registry
# from memory — look the CIK/series ID up on EDGAR and confirm against a real
# filing first, or pass --cik/--series on the command line.
FUND_REGISTRY: dict[str, FundRef] = {
    "SPUS": FundRef(
        ticker="SPUS",
        cik=1742912,
        series_id="S000067283",
        name="SP Funds S&P 500 Sharia Industry Exclusions ETF",
    ),
}


@dataclasses.dataclass(frozen=True)
class FilingRef:
    """A pointer to one filing in EDGAR, before it has been downloaded."""

    accession: str
    form: str
    filing_date: str
    report_date: str
    document: str

    @property
    def accession_plain(self) -> str:
        return self.accession.replace("-", "")

    @property
    def is_amendment(self) -> bool:
        return self.form.upper().endswith("/A")


@dataclasses.dataclass(frozen=True)
class NportFiling:
    """A parsed N-PORT filing: what one fund held, on one stated date."""

    series_id: str
    report_date: str
    submission_type: str
    holdings: dict[str, float]
    weight_sum_pct: float
    skipped_no_ticker: int

    @property
    def is_amendment(self) -> bool:
        return self.submission_type.upper().endswith("/A")

    @property
    def weights_look_complete(self) -> bool:
        return abs(self.weight_sum_pct - 100.0) <= WEIGHT_SUM_TOLERANCE_PCT


# ---------------------------------------------------------------------------
# XML helpers
# ---------------------------------------------------------------------------


def _tag(element: ET.Element) -> str:
    """Local tag name, with any XML namespace stripped."""
    return element.tag.split("}")[-1]


def _find(root: ET.Element, suffix: str) -> Optional[ET.Element]:
    for element in root.iter():
        if _tag(element) == suffix:
            return element
    return None


def _find_all(root: ET.Element, suffix: str) -> list[ET.Element]:
    return [element for element in root.iter() if _tag(element) == suffix]


def _text(element: Optional[ET.Element]) -> str:
    if element is None or element.text is None:
        return ""
    return element.text.strip()


def _holding_ticker(holding: ET.Element) -> str:
    """Extract a holding's ticker.

    The ticker is an attribute of an ``<identifiers><ticker value="..."/>``
    element. Some filings put it in element text instead, so both are tried.
    """
    identifiers = _find(holding, "identifiers")
    if identifiers is None:
        return ""
    ticker_el = _find(identifiers, "ticker")
    if ticker_el is None:
        return ""
    raw = ticker_el.get("value") or ticker_el.text or ""
    return raw.strip().upper()


def _is_tradable_equity(holding: ET.Element) -> bool:
    """Whether a holding is a long position in a common equity.

    ``assetCat == "EC"`` is N-PORT's code for equity-common. ``payoffProfile``
    guards against short legs — which the live bot could never hold anyway,
    being long-only spot by mandate.
    """
    asset_cat = _text(_find(holding, "assetCat")).upper()
    if asset_cat and asset_cat != "EC":
        return False
    payoff = _text(_find(holding, "payoffProfile")).upper()
    if payoff and payoff != "LONG":
        return False
    return True


def _is_cash_like(ticker: str) -> bool:
    return ticker.startswith("CASH") or ticker.startswith("USD") or ticker in {"N/A", "NA", "-"}


def parse_nport(xml_content: str, series_id: Optional[str] = None) -> Optional[NportFiling]:
    """Parse one N-PORT XML submission into a dated holdings snapshot.

    Returns ``None`` when the filing is unparseable, carries no usable report
    date, or belongs to a series other than ``series_id`` (when one is given).
    """
    try:
        root = ET.fromstring(xml_content)
    except ET.ParseError as exc:
        logger.error("N-PORT XML is not well-formed: %s", exc)
        return None

    filing_series = _text(_find(root, "seriesId"))
    if series_id is not None and filing_series != series_id:
        return None

    # repPdDate is the snapshot's as-of date; repPdEnd is the fiscal period end
    # and is identical across a fund's filings, so it cannot identify a snapshot.
    report_date = _text(_find(root, "repPdDate"))
    if not report_date:
        logger.warning(
            "Filing for series %s has no repPdDate; refusing to date it by repPdEnd",
            filing_series or "<unknown>",
        )
        return None

    submission_type = _text(_find(root, "submissionType")) or "NPORT-P"

    holdings: dict[str, float] = {}
    weight_sum = 0.0
    skipped_no_ticker = 0

    for holding in _find_all(root, "invstOrSec"):
        if not _is_tradable_equity(holding):
            continue

        ticker = _holding_ticker(holding)
        if not ticker:
            skipped_no_ticker += 1
            continue
        if _is_cash_like(ticker):
            continue

        # pctVal is a percentage of net assets (0.267 means 0.267%).
        try:
            pct = float(_text(_find(holding, "pctVal")))
        except ValueError:
            pct = 0.0

        weight_sum += pct
        # A ticker can appear twice (multiple lots / share classes); sum them.
        holdings[ticker] = holdings.get(ticker, 0.0) + pct / 100.0

    if skipped_no_ticker:
        logger.debug(
            "%s @ %s: skipped %d holding(s) with no ticker identifier",
            filing_series, report_date, skipped_no_ticker,
        )

    return NportFiling(
        series_id=filing_series,
        report_date=report_date,
        submission_type=submission_type,
        holdings=holdings,
        weight_sum_pct=weight_sum,
        skipped_no_ticker=skipped_no_ticker,
    )


# ---------------------------------------------------------------------------
# EDGAR client
# ---------------------------------------------------------------------------


class SecClient:
    """A rate-limited, politely-identified HTTP client for SEC EDGAR.

    The SEC requires a User-Agent naming the requester and a contact address,
    and rejects generic browser strings. Set ``SEC_USER_AGENT`` to something
    like ``"Shariah Record research contact@example.com"``.
    """

    def __init__(
        self,
        user_agent: Optional[str] = None,
        requests_per_second: float = DEFAULT_REQUESTS_PER_SECOND,
        timeout: float = 30.0,
        session: Optional[requests.Session] = None,
    ):
        self.user_agent = user_agent or os.environ.get("SEC_USER_AGENT", "")
        if not self.user_agent:
            raise NportError(
                "SEC_USER_AGENT is not set. SEC EDGAR rejects requests without a "
                "User-Agent naming you and a contact email, e.g. "
                'SEC_USER_AGENT="Shariah Record research you@example.com"'
            )
        self.timeout = timeout
        self._min_interval = 1.0 / requests_per_second if requests_per_second > 0 else 0.0
        self._last_request_at = 0.0
        self._session = session or requests.Session()
        self._session.headers.update(
            {"User-Agent": self.user_agent, "Accept-Encoding": "gzip, deflate"}
        )

    def _throttle(self) -> None:
        if self._min_interval <= 0:
            return
        elapsed = time.monotonic() - self._last_request_at
        if elapsed < self._min_interval:
            time.sleep(self._min_interval - elapsed)
        self._last_request_at = time.monotonic()

    def get_text(self, url: str) -> str:
        self._throttle()
        response = self._session.get(url, timeout=self.timeout)
        if response.status_code == 403:
            raise NportError(
                f"SEC returned 403 for {url}. Check that SEC_USER_AGENT names you "
                "and a contact address, and that you are under the rate limit."
            )
        response.raise_for_status()
        return response.text

    def get_json(self, url: str) -> dict:
        return json.loads(self.get_text(url))


def _filing_refs_from_block(block: dict) -> Iterator[FilingRef]:
    """Turn EDGAR's parallel-array filings block into FilingRef objects."""
    accessions = block.get("accessionNumber") or []
    forms = block.get("form") or []
    filing_dates = block.get("filingDate") or []
    report_dates = block.get("reportDate") or []
    documents = block.get("primaryDocument") or []

    for index, accession in enumerate(accessions):
        form = forms[index] if index < len(forms) else ""
        if form.upper() not in NPORT_FORMS:
            continue
        yield FilingRef(
            accession=accession,
            form=form,
            filing_date=filing_dates[index] if index < len(filing_dates) else "",
            report_date=report_dates[index] if index < len(report_dates) else "",
            document=(documents[index] if index < len(documents) else "") or "primary_doc.xml",
        )


def list_nport_filings(client: SecClient, cik: int) -> list[FilingRef]:
    """List every N-PORT-P filing a CIK has made, newest first.

    EDGAR keeps roughly a year of filings in ``filings.recent`` and pushes older
    ones into shard files listed under ``filings.files``; both are read here, so
    the full history comes back rather than just the recent page.
    """
    index = client.get_json(SEC_SUBMISSIONS_URL.format(cik=cik))
    filings = index.get("filings") or {}

    refs = list(_filing_refs_from_block(filings.get("recent") or {}))

    for shard in filings.get("files") or []:
        name = shard.get("name")
        if not name:
            continue
        logger.debug("Reading older filings shard %s", name)
        shard_data = client.get_json(SEC_SUBMISSIONS_SHARD_URL.format(name=name))
        refs.extend(_filing_refs_from_block(shard_data))

    refs.sort(key=lambda ref: (ref.filing_date, ref.accession), reverse=True)
    logger.info("CIK %d: found %d N-PORT filing(s) on EDGAR", cik, len(refs))
    return refs


def fetch_filing_xml(client: SecClient, cik: int, ref: FilingRef) -> str:
    url = SEC_ARCHIVE_URL.format(cik=cik, accession=ref.accession_plain, document=ref.document)
    return client.get_text(url)


# ---------------------------------------------------------------------------
# Local filing store
# ---------------------------------------------------------------------------

FILINGS_DIR = os.path.join(os.path.dirname(__file__), "data", "filings")
MANIFEST_NAME = "_manifest.json"

_SAFE_NAME = re.compile(r"[^A-Za-z0-9._-]")


def _filing_filename(filing: NportFiling, ref: FilingRef) -> str:
    stem = f"{filing.series_id}-{filing.report_date}-{ref.accession}"
    if filing.is_amendment:
        stem += "-A"
    return _SAFE_NAME.sub("_", stem) + ".xml"


def _load_manifest(filings_dir: str) -> dict:
    path = os.path.join(filings_dir, MANIFEST_NAME)
    if not os.path.exists(path):
        return {}
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Could not read filing manifest, starting fresh: %s", exc)
        return {}


def _save_manifest(filings_dir: str, manifest: dict) -> None:
    path = os.path.join(filings_dir, MANIFEST_NAME)
    try:
        with open(path, "w", encoding="utf-8") as handle:
            json.dump(manifest, handle, indent=2, sort_keys=True)
    except OSError as exc:
        logger.warning("Could not write filing manifest: %s", exc)


def sync_filings(
    fund: FundRef,
    filings_dir: str = FILINGS_DIR,
    client: Optional[SecClient] = None,
    limit: Optional[int] = None,
) -> list[str]:
    """Download every N-PORT filing for ``fund`` that is not already on disk.

    A trust files one N-PORT submission per series, and EDGAR's submissions
    index does not say which series a filing covers — that is only visible
    inside the XML. So filings for other series in the same trust get fetched
    once, recognised, and recorded in a manifest so they are never fetched
    again. Returns the paths written this run.
    """
    os.makedirs(filings_dir, exist_ok=True)
    client = client or SecClient()
    manifest = _load_manifest(filings_dir)
    seen = manifest.setdefault("accessions", {})

    refs = list_nport_filings(client, fund.cik)
    written: list[str] = []
    considered = 0

    for ref in refs:
        if limit is not None and considered >= limit:
            break

        record = seen.get(ref.accession)
        if record is not None:
            # Already classified. Re-download only if it is ours and the file went missing.
            if record.get("series_id") != fund.series_id:
                continue
            existing = record.get("path")
            if existing and os.path.exists(os.path.join(filings_dir, existing)):
                continue

        considered += 1
        try:
            xml_content = fetch_filing_xml(client, fund.cik, ref)
        except (requests.RequestException, NportError) as exc:
            logger.error("Failed to download %s (%s): %s", ref.accession, ref.form, exc)
            continue

        filing = parse_nport(xml_content)
        if filing is None:
            seen[ref.accession] = {"series_id": None, "form": ref.form}
            continue

        seen[ref.accession] = {"series_id": filing.series_id, "form": ref.form}
        if filing.series_id != fund.series_id:
            logger.debug(
                "%s belongs to series %s, not %s — recorded and skipped",
                ref.accession, filing.series_id, fund.series_id,
            )
            continue

        filename = _filing_filename(filing, ref)
        path = os.path.join(filings_dir, filename)
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(xml_content)

        seen[ref.accession]["path"] = filename
        seen[ref.accession]["report_date"] = filing.report_date
        written.append(path)
        logger.info(
            "Saved %s @ %s (%s, %d holdings, weights sum %.2f%%)",
            fund.ticker, filing.report_date, filing.submission_type,
            len(filing.holdings), filing.weight_sum_pct,
        )
        if not filing.weights_look_complete:
            logger.warning(
                "%s @ %s: holdings weights sum to %.2f%%, not ~100%%. This filing "
                "may be partial — treat any backtest spanning it with suspicion.",
                fund.ticker, filing.report_date, filing.weight_sum_pct,
            )

    _save_manifest(filings_dir, manifest)
    logger.info("Sync complete: %d new filing(s) written to %s", len(written), filings_dir)
    return written


def load_filings(
    filings_dir: str = FILINGS_DIR, series_id: Optional[str] = None
) -> list[NportFiling]:
    """Parse every N-PORT XML in ``filings_dir``, optionally filtered by series."""
    if not os.path.isdir(filings_dir):
        return []

    filings: list[NportFiling] = []
    for filename in sorted(os.listdir(filings_dir)):
        if not filename.endswith(".xml"):
            continue
        path = os.path.join(filings_dir, filename)
        try:
            with open(path, "r", encoding="utf-8", errors="ignore") as handle:
                content = handle.read()
        except OSError as exc:
            logger.error("Could not read %s: %s", filename, exc)
            continue

        filing = parse_nport(content, series_id=series_id)
        if filing is not None:
            filings.append(filing)

    return filings


def build_universe_history(
    filings_dir: str = FILINGS_DIR,
    series_id: Optional[str] = None,
    warn_on_incomplete: bool = True,
) -> dict[str, dict[str, float]]:
    """Build ``{report_date: {ticker: weight}}`` from filings on disk.

    Where an original and an amendment cover the same report date, the
    amendment wins — that is the entire point of an amendment.
    """
    history: dict[str, dict[str, float]] = {}
    amended_dates: set[str] = set()

    for filing in load_filings(filings_dir, series_id=series_id):
        if filing.report_date in amended_dates and not filing.is_amendment:
            continue
        if filing.is_amendment:
            amended_dates.add(filing.report_date)
        history[filing.report_date] = filing.holdings

        if warn_on_incomplete and not filing.weights_look_complete:
            logger.warning(
                "Snapshot %s: weights sum to %.2f%% (expected ~100%%). Holdings "
                "may be missing from this filing.",
                filing.report_date, filing.weight_sum_pct,
            )

    return history


def load_universe_history(
    filings_dir: str = FILINGS_DIR, series_id: Optional[str] = None
) -> dict[str, list[str]]:
    """Point-in-time Eligible Universe as ``{report_date: [tickers]}``.

    There is deliberately no fallback to current holdings. If no filings are
    present this returns empty, and callers must refuse to backtest rather than
    quietly substituting today's universe for every historical date.
    """
    history = build_universe_history(filings_dir, series_id=series_id)
    return {date: sorted(holdings.keys()) for date, holdings in history.items()}


def coverage(filings_dir: str = FILINGS_DIR, series_id: Optional[str] = None) -> dict:
    """Summarise what history is actually available, for reporting to a human."""
    history = build_universe_history(filings_dir, series_id=series_id, warn_on_incomplete=False)
    if not history:
        return {"snapshots": 0, "first_date": None, "last_date": None, "span_days": 0}

    dates = sorted(history)
    first = datetime.date.fromisoformat(dates[0])
    last = datetime.date.fromisoformat(dates[-1])
    sizes = [len(history[date]) for date in dates]
    return {
        "snapshots": len(dates),
        "first_date": dates[0],
        "last_date": dates[-1],
        "span_days": (last - first).days,
        "min_holdings": min(sizes),
        "max_holdings": max(sizes),
        "distinct_tickers": len({t for holdings in history.values() for t in holdings}),
    }
