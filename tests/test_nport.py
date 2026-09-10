"""Tests for point-in-time universe reconstruction from SEC Form N-PORT filings.

Where possible these run against the real filings committed under
``shariah_algo_trader/backtesting/data/filings/`` rather than synthetic XML, so
the parser is checked against the shapes the SEC actually emits.
"""

import json
import os

import pytest

from shariah_algo_trader.backtesting import nport

FIXTURES_DIR = os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
    "shariah_algo_trader", "backtesting", "data", "filings",
)

SPUS_SERIES = "S000067283"


def _fixture(name: str) -> str:
    with open(os.path.join(FIXTURES_DIR, name), "r", encoding="utf-8", errors="ignore") as handle:
        return handle.read()


def _minimal_filing(series=SPUS_SERIES, rep_pd_date="2024-08-31", rep_pd_end="2024-11-30",
                    holdings_xml="", submission_type="NPORT-P") -> str:
    date_el = f"<repPdDate>{rep_pd_date}</repPdDate>" if rep_pd_date else ""
    return f"""<?xml version="1.0" encoding="UTF-8"?>
    <edgarSubmission>
        <submissionType>{submission_type}</submissionType>
        <seriesId>{series}</seriesId>
        {date_el}
        <repPdEnd>{rep_pd_end}</repPdEnd>
        <formData><invstOrSecs>{holdings_xml}</invstOrSecs></formData>
    </edgarSubmission>"""


def _holding(name, ticker=None, pct="1.0", asset_cat="EC", payoff="Long", country="US"):
    ident = f'<identifiers><ticker value="{ticker}"/></identifiers>' if ticker else "<identifiers/>"
    return f"""<invstOrSec>
        <name>{name}</name>{ident}
        <pctVal>{pct}</pctVal>
        <assetCat>{asset_cat}</assetCat>
        <payoffProfile>{payoff}</payoffProfile>
        <invCountry>{country}</invCountry>
    </invstOrSec>"""


# ---------------------------------------------------------------------------
# Parsing against real filings
# ---------------------------------------------------------------------------


@pytest.mark.parametrize("filename,expected_date,expected_holdings", [
    ("SPUS-2024-10-25-Filing.xml", "2024-08-31", 233),
    ("SPUS-2025-01-29-Filing.xml", "2024-11-30", 225),
    ("SPUS-2025-04-29-Filing.xml", "2025-02-28", 228),
])
def test_parses_real_filings(filename, expected_date, expected_holdings):
    filing = nport.parse_nport(_fixture(filename), series_id=SPUS_SERIES)
    assert filing is not None
    assert filing.series_id == SPUS_SERIES
    assert filing.report_date == expected_date
    # One holding per filing (a stale ABIOMED INC entry) carries no ticker.
    assert len(filing.holdings) == expected_holdings
    assert filing.skipped_no_ticker == 1


def test_real_filing_weights_are_fractions_not_percentages():
    filing = nport.parse_nport(_fixture("SPUS-2025-01-29-Filing.xml"), series_id=SPUS_SERIES)
    # MMM was 0.2313% of the fund on this date, i.e. a weight of ~0.002313.
    assert filing.holdings["MMM"] == pytest.approx(0.002313, abs=1e-5)
    assert all(0.0 <= w < 0.25 for w in filing.holdings.values())


def test_foreign_domiciled_but_us_listed_holdings_are_kept():
    """Regression guard: invCountry is domicile, not listing venue.

    Filtering on invCountry == "US" would silently drop these ten NYSE/NASDAQ
    large caps, shrinking the universe and quietly changing every backtest.
    """
    filing = nport.parse_nport(_fixture("SPUS-2025-01-29-Filing.xml"), series_id=SPUS_SERIES)
    for ticker in ("ACN", "MDT", "GRMN", "NXPI", "TT", "LULU", "ALLE", "APTV", "PNR", "TEL"):
        assert ticker in filing.holdings, f"{ticker} is US-listed and must not be filtered out"


@pytest.mark.parametrize("filename", [
    "SPUS-2024-10-25-Filing.xml",
    "SPUS-2025-01-29-Filing.xml",
    "SPUS-2025-04-29-Filing.xml",
])
def test_real_filings_account_for_the_whole_fund(filename):
    filing = nport.parse_nport(_fixture(filename), series_id=SPUS_SERIES)
    assert filing.weight_sum_pct == pytest.approx(100.0, abs=1.0)
    assert filing.weights_look_complete


def test_untickered_junk_row_does_not_corrupt_the_weight_sum():
    """Regression guard for a real trap in every SPUS filing here.

    Each carries a stale "ABIOMED INC" row with no ticker and pctVal of -20
    (the company was acquired in 2022). Summing pctVal across all rows makes a
    healthy filing look 20 points short and flags it as truncated. Only kept
    holdings may contribute to the weight sum.
    """
    xml = _minimal_filing(holdings_xml="".join([
        _holding("APPLE INC", "AAPL", "99.5"),
        _holding("ABIOMED INC", None, "-20"),
    ]))
    filing = nport.parse_nport(xml)
    assert filing.skipped_no_ticker == 1
    assert filing.weight_sum_pct == pytest.approx(99.5)
    assert filing.weights_look_complete


def test_genuinely_truncated_filing_is_flagged():
    xml = _minimal_filing(holdings_xml=_holding("APPLE INC", "AAPL", "60.0"))
    filing = nport.parse_nport(xml)
    assert not filing.weights_look_complete


# ---------------------------------------------------------------------------
# Parsing rules
# ---------------------------------------------------------------------------


def test_prefers_rep_pd_date_over_rep_pd_end():
    filing = nport.parse_nport(_minimal_filing(rep_pd_date="2024-08-31", rep_pd_end="2024-11-30"))
    assert filing.report_date == "2024-08-31"


def test_refuses_to_date_a_filing_by_rep_pd_end_alone():
    """repPdEnd is the fiscal year end and is identical across filings.

    Dating a snapshot by it would collapse every filing in a year onto one
    date, so a filing without repPdDate is rejected rather than mis-dated.
    """
    filing = nport.parse_nport(_minimal_filing(rep_pd_date=None))
    assert filing is None


def test_filters_by_series_id():
    xml = _minimal_filing(series="S000000000")
    assert nport.parse_nport(xml, series_id=SPUS_SERIES) is None
    # Without a series filter the same filing parses fine.
    assert nport.parse_nport(xml) is not None


def test_skips_cash_and_non_equity_and_short_positions():
    xml = _minimal_filing(holdings_xml="".join([
        _holding("APPLE INC", "AAPL", "7.43"),
        _holding("CASH COLLATERAL", "CASH_USD", "0.50"),
        _holding("US DOLLAR", "USD", "0.10"),
        _holding("SOME BOND", "BND", "1.00", asset_cat="DBT"),
        _holding("SHORT LEG", "SHRT", "1.00", payoff="Short"),
    ]))
    filing = nport.parse_nport(xml)
    assert set(filing.holdings) == {"AAPL"}
    assert filing.holdings["AAPL"] == pytest.approx(0.0743)


def test_sums_duplicate_ticker_lots():
    xml = _minimal_filing(holdings_xml="".join([
        _holding("APPLE INC", "AAPL", "3.00"),
        _holding("APPLE INC LOT 2", "AAPL", "4.43"),
    ]))
    filing = nport.parse_nport(xml)
    assert filing.holdings["AAPL"] == pytest.approx(0.0743)


def test_counts_holdings_with_no_ticker_rather_than_guessing():
    xml = _minimal_filing(holdings_xml="".join([
        _holding("APPLE INC", "AAPL", "7.43"),
        _holding("DELISTED THING", None, "0.10"),
    ]))
    filing = nport.parse_nport(xml)
    assert set(filing.holdings) == {"AAPL"}
    assert filing.skipped_no_ticker == 1


def test_malformed_xml_returns_none():
    assert nport.parse_nport("<not-xml") is None


def test_detects_amendments():
    original = nport.parse_nport(_minimal_filing(submission_type="NPORT-P"))
    amended = nport.parse_nport(_minimal_filing(submission_type="NPORT-P/A"))
    assert not original.is_amendment
    assert amended.is_amendment


# ---------------------------------------------------------------------------
# Universe history assembly
# ---------------------------------------------------------------------------


def test_build_universe_history_from_real_filings():
    history = nport.build_universe_history(FIXTURES_DIR, series_id=SPUS_SERIES)
    assert sorted(history) == ["2024-08-31", "2024-11-30", "2025-02-28"]
    assert "AAPL" in history["2024-11-30"]


def test_amendment_supersedes_original_for_same_date(tmp_path):
    original = _minimal_filing(holdings_xml=_holding("APPLE INC", "AAPL"))
    amended = _minimal_filing(
        submission_type="NPORT-P/A",
        holdings_xml="".join([_holding("APPLE INC", "AAPL"), _holding("MICROSOFT", "MSFT")]),
    )
    # Name the original last alphabetically to prove ordering is by amendment
    # status, not by filename.
    (tmp_path / "a-amended.xml").write_text(amended, encoding="utf-8")
    (tmp_path / "z-original.xml").write_text(original, encoding="utf-8")

    history = nport.build_universe_history(str(tmp_path))
    assert set(history["2024-08-31"]) == {"AAPL", "MSFT"}


def test_load_universe_history_has_no_survivorship_fallback(tmp_path):
    """An empty filings directory must yield nothing, never today's holdings."""
    history = nport.load_universe_history(str(tmp_path))
    assert history == {}


def test_load_universe_history_returns_sorted_tickers():
    history = nport.load_universe_history(FIXTURES_DIR, series_id=SPUS_SERIES)
    tickers = history["2024-11-30"]
    assert tickers == sorted(tickers)
    assert isinstance(tickers, list)


def test_coverage_reports_real_span():
    stats = nport.coverage(FIXTURES_DIR, series_id=SPUS_SERIES)
    assert stats["snapshots"] == 3
    assert stats["first_date"] == "2024-08-31"
    assert stats["last_date"] == "2025-02-28"
    assert stats["span_days"] == 181
    assert stats["distinct_tickers"] > 200


def test_coverage_of_empty_directory(tmp_path):
    stats = nport.coverage(str(tmp_path))
    assert stats == {"snapshots": 0, "first_date": None, "last_date": None, "span_days": 0}


# ---------------------------------------------------------------------------
# EDGAR client behaviour
# ---------------------------------------------------------------------------


def test_client_requires_a_contactable_user_agent(monkeypatch):
    monkeypatch.delenv("SEC_USER_AGENT", raising=False)
    with pytest.raises(nport.NportError, match="SEC_USER_AGENT"):
        nport.SecClient()


def test_client_reads_user_agent_from_environment(monkeypatch):
    monkeypatch.setenv("SEC_USER_AGENT", "Tester test@example.com")
    client = nport.SecClient(requests_per_second=0)
    assert client.user_agent == "Tester test@example.com"


def test_filing_refs_keep_only_nport_forms():
    block = {
        "accessionNumber": ["0001-24-1", "0001-24-2", "0001-24-3"],
        "form": ["NPORT-P", "10-K", "NPORT-P/A"],
        "filingDate": ["2024-01-29", "2024-02-01", "2024-03-01"],
        "reportDate": ["2023-11-30", "2023-12-31", "2023-11-30"],
        "primaryDocument": ["primary_doc.xml", "form.htm", "primary_doc.xml"],
    }
    refs = list(nport._filing_refs_from_block(block))
    assert [r.accession for r in refs] == ["0001-24-1", "0001-24-3"]
    assert refs[0].is_amendment is False
    assert refs[1].is_amendment is True
    assert refs[0].accession_plain == "0001241"


def test_filing_refs_default_missing_document_name():
    block = {
        "accessionNumber": ["0001-24-1"],
        "form": ["NPORT-P"],
        "filingDate": ["2024-01-29"],
        "reportDate": ["2023-11-30"],
        "primaryDocument": [""],
    }
    refs = list(nport._filing_refs_from_block(block))
    assert refs[0].document == "primary_doc.xml"


def test_list_nport_filings_reads_older_shards(monkeypatch):
    """EDGAR pages older filings into shard files; the full history must load."""
    recent = {
        "accessionNumber": ["0001-25-1"], "form": ["NPORT-P"],
        "filingDate": ["2025-01-29"], "reportDate": ["2024-11-30"],
        "primaryDocument": ["primary_doc.xml"],
    }
    older = {
        "accessionNumber": ["0001-20-9"], "form": ["NPORT-P"],
        "filingDate": ["2020-01-29"], "reportDate": ["2019-11-30"],
        "primaryDocument": ["primary_doc.xml"],
    }
    responses = {
        nport.SEC_SUBMISSIONS_URL.format(cik=1742912): {
            "filings": {"recent": recent, "files": [{"name": "shard-001.json"}]}
        },
        nport.SEC_SUBMISSIONS_SHARD_URL.format(name="shard-001.json"): older,
    }

    class FakeClient:
        def get_json(self, url):
            return responses[url]

    refs = nport.list_nport_filings(FakeClient(), 1742912)
    assert [r.accession for r in refs] == ["0001-25-1", "0001-20-9"]


def test_sync_records_other_series_so_they_are_not_refetched(tmp_path, monkeypatch):
    """A trust files one N-PORT per series; foreign ones are fetched once only."""
    ours = _minimal_filing(series=SPUS_SERIES, rep_pd_date="2024-08-31",
                           holdings_xml=_holding("APPLE INC", "AAPL"))
    theirs = _minimal_filing(series="S000099999", rep_pd_date="2024-08-31",
                             holdings_xml=_holding("FORD", "F"))
    fetches = []

    refs = [
        nport.FilingRef("0001-24-1", "NPORT-P", "2024-10-25", "2024-08-31", "primary_doc.xml"),
        nport.FilingRef("0001-24-2", "NPORT-P", "2024-10-25", "2024-08-31", "primary_doc.xml"),
    ]
    monkeypatch.setattr(nport, "list_nport_filings", lambda client, cik: refs)

    def fake_fetch(client, cik, ref):
        fetches.append(ref.accession)
        return ours if ref.accession == "0001-24-1" else theirs

    monkeypatch.setattr(nport, "fetch_filing_xml", fake_fetch)

    fund = nport.FUND_REGISTRY["SPUS"]
    written = nport.sync_filings(fund, filings_dir=str(tmp_path), client=object())
    assert len(written) == 1
    assert fetches == ["0001-24-1", "0001-24-2"]

    manifest = json.loads((tmp_path / nport.MANIFEST_NAME).read_text())
    assert manifest["accessions"]["0001-24-2"]["series_id"] == "S000099999"

    # A second sync re-fetches nothing.
    written_again = nport.sync_filings(fund, filings_dir=str(tmp_path), client=object())
    assert written_again == []
    assert fetches == ["0001-24-1", "0001-24-2"]


def test_registry_only_contains_verified_funds():
    """Guard against CIK/series IDs being added from memory rather than EDGAR."""
    assert set(nport.FUND_REGISTRY) == {"SPUS"}
    spus = nport.FUND_REGISTRY["SPUS"]
    assert spus.cik == 1742912
    assert spus.series_id == SPUS_SERIES
