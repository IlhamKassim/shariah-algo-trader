import pytest
import pandas as pd
import numpy as np
from shariah_algo_trader.backtesting.edgar_parser import parse_nport_xml
from shariah_algo_trader.backtesting.engine import z_scores, BacktestEngine

def test_parse_nport_xml():
    # Valid N-PORT XML with correct seriesId S000067283 (SPUS)
    xml_data = """<?xml version="1.0" encoding="UTF-8"?>
    <nportFiling>
        <seriesId>S000067283</seriesId>
        <repPdEnd>2024-03-31</repPdEnd>
        <formData>
            <invstOrSecs>
                <invstOrSec>
                    <name>APPLE INC</name>
                    <pctVal>7.43</pctVal>
                    <identifiers>
                        <ticker value="AAPL"/>
                    </identifiers>
                </invstOrSec>
                <invstOrSec>
                    <name>MICROSOFT CORP</name>
                    <pctVal>8.50</pctVal>
                    <identifiers>
                        <ticker value="MSFT"/>
                    </identifiers>
                </invstOrSec>
                <invstOrSec>
                    <name>CASH COLLATERAL</name>
                    <pctVal>0.50</pctVal>
                    <identifiers>
                        <ticker value="CASH_USD"/>
                    </identifiers>
                </invstOrSec>
            </invstOrSecs>
        </formData>
    </nportFiling>
    """
    res = parse_nport_xml(xml_data)
    assert res is not None
    date, holdings = res
    assert date == "2024-03-31"
    assert "AAPL" in holdings
    assert "MSFT" in holdings
    assert "CASH_USD" not in holdings  # Should filter out Cash
    assert holdings["AAPL"] == pytest.approx(0.0743)
    assert holdings["MSFT"] == pytest.approx(0.0850)

def test_parse_nport_xml_wrong_series():
    # Invalid seriesId
    xml_data = """<?xml version="1.0" encoding="UTF-8"?>
    <nportFiling>
        <seriesId>S000000000</seriesId>
        <repPdEnd>2024-03-31</repPdEnd>
    </nportFiling>
    """
    res = parse_nport_xml(xml_data)
    assert res is None

def test_z_scores():
    raw = {"A": 1.0, "B": 2.0, "C": 3.0}
    res = z_scores(raw)
    assert len(res) == 3
    # Check mean is approx 0
    vals = list(res.values())
    assert np.mean(vals) == pytest.approx(0.0, abs=1e-9)
    # Check standard deviation is 1
    assert np.std(vals) == pytest.approx(1.0)

def test_z_scores_constant():
    raw = {"A": 5.0, "B": 5.0}
    res = z_scores(raw)
    assert res == {"A": 0.0, "B": 0.0}

def test_calculate_metrics():
    # Simple upward trending series
    dates = pd.date_range("2024-01-01", periods=10, freq="D")
    equity = pd.Series([100.0 + i for i in range(10)], index=dates)
    
    engine = BacktestEngine(data_provider=None)
    metrics = engine._calculate_metrics(equity)
    
    assert metrics["total_return_pct"] == pytest.approx(9.0)
    assert metrics["win_rate_pct"] == 100.0  # Daily increase every day
    assert metrics["max_drawdown_pct"] == 0.0  # No drawdowns
