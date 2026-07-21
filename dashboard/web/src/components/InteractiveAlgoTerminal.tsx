import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldCheck,
  Sliders,
  CheckCircle,
  XCircle,
  Activity,
  Sparkles,
  Search,
  RefreshCw,
  Cpu,
} from "lucide-react";

interface StockScreenerData {
  ticker: string;
  name: string;
  price: string;
  change: string;
  isPositive: boolean;
  debtRatio: number; // Max 33%
  cashRatio: number; // Max 33%
  businessScreen: boolean; // True = 100% Halal
  factorScore: number; // 0-100
  momentum: number;
  quality: number;
  value: number;
  status: "PASS" | "FAIL";
  spusConstituent: boolean;
}

const MOCK_STOCKS: StockScreenerData[] = [
  {
    ticker: "NVDA",
    name: "NVIDIA Corporation",
    price: "$138.25",
    change: "+4.12%",
    isPositive: true,
    debtRatio: 12.4,
    cashRatio: 18.2,
    businessScreen: true,
    factorScore: 94.8,
    momentum: 98,
    quality: 92,
    value: 65,
    status: "PASS",
    spusConstituent: true,
  },
  {
    ticker: "AAPL",
    name: "Apple Inc.",
    price: "$224.50",
    change: "+1.05%",
    isPositive: true,
    debtRatio: 28.6,
    cashRatio: 21.0,
    businessScreen: true,
    factorScore: 89.2,
    momentum: 82,
    quality: 96,
    value: 71,
    status: "PASS",
    spusConstituent: true,
  },
  {
    ticker: "MSFT",
    name: "Microsoft Corp.",
    price: "$448.10",
    change: "-0.45%",
    isPositive: false,
    debtRatio: 19.8,
    cashRatio: 25.4,
    businessScreen: true,
    factorScore: 91.5,
    momentum: 88,
    quality: 95,
    value: 68,
    status: "PASS",
    spusConstituent: true,
  },
  {
    ticker: "JPM",
    name: "JPMorgan Chase & Co.",
    price: "$204.30",
    change: "+0.80%",
    isPositive: true,
    debtRatio: 84.5,
    cashRatio: 45.0,
    businessScreen: false, // Interest banking
    factorScore: 42.0,
    momentum: 70,
    quality: 60,
    value: 80,
    status: "FAIL",
    spusConstituent: false,
  },
  {
    ticker: "TSLA",
    name: "Tesla, Inc.",
    price: "$254.90",
    change: "+8.40%",
    isPositive: true,
    debtRatio: 14.2,
    cashRatio: 16.5,
    businessScreen: true,
    factorScore: 87.5,
    momentum: 95,
    quality: 78,
    value: 50,
    status: "PASS",
    spusConstituent: true,
  },
];

interface TradeLog {
  id: string;
  time: string;
  type: "BUY" | "REBALANCE" | "PURIFICATION";
  ticker: string;
  shares: number;
  price: string;
  reason: string;
}

export function InteractiveAlgoTerminal() {
  const [activeTab, setActiveTab] = useState<"screener" | "factors" | "execution">("screener");
  const [selectedStock, setSelectedStock] = useState<StockScreenerData>(MOCK_STOCKS[0]);
  const [searchQuery, setSearchQuery] = useState("");

  // Factor Model Sliders (Interactive State)
  const [momentumWeight, setMomentumWeight] = useState(40);
  const [qualityWeight, setQualityWeight] = useState(40);
  const [valueWeight, setValueWeight] = useState(20);

  // Live Simulated Execution Feed
  const [logs, setLogs] = useState<TradeLog[]>([
    {
      id: "1",
      time: "09:30:12 AM",
      type: "BUY",
      ticker: "NVDA",
      shares: 120,
      price: "$138.25",
      reason: "AAOIFI Compliant · Top Factor Score (94.8)",
    },
    {
      id: "2",
      time: "09:30:45 AM",
      type: "PURIFICATION",
      ticker: "MSFT",
      shares: 0,
      price: "$12.40",
      reason: "Div Purification: $12.40 Routed to Verified Charity",
    },
    {
      id: "3",
      time: "09:31:02 AM",
      type: "BUY",
      ticker: "AAPL",
      shares: 45,
      price: "$224.50",
      reason: "Monthly Factor Rebalance (Quality Score: 96)",
    },
    {
      id: "4",
      time: "09:31:18 AM",
      type: "REBALANCE",
      ticker: "UNIVERSE",
      shares: 500,
      price: "PASS",
      reason: "AAOIFI Standard No. 21 Daily Scan Complete",
    },
  ]);

  // Simulate real-time logs appearing
  useEffect(() => {
    const interval = setInterval(() => {
      const tickers = ["NVDA", "AAPL", "MSFT", "TSLA", "GOOGL"];
      const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
      const now = new Date();
      const timeStr = now.toLocaleTimeString();

      const newLog: TradeLog = {
        id: Date.now().toString(),
        time: timeStr,
        type: Math.random() > 0.3 ? "BUY" : "PURIFICATION",
        ticker: randomTicker,
        shares: Math.floor(Math.random() * 50) + 10,
        price: `$${(Math.random() * 300 + 100).toFixed(2)}`,
        reason: "Auto-Execution via Alpaca Broker API Gateway",
      };

      setLogs((prev) => [newLog, ...prev.slice(0, 5)]);
    }, 4500);

    return () => clearInterval(interval);
  }, []);

  const filteredStocks = MOCK_STOCKS.filter(
    (s) =>
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Dynamic factor composite calculation
  const calculatedScore = (stock: StockScreenerData) => {
    const totalWeight = momentumWeight + qualityWeight + valueWeight;
    if (totalWeight === 0) return stock.factorScore;
    const score =
      (stock.momentum * momentumWeight +
        stock.quality * qualityWeight +
        stock.value * valueWeight) /
      totalWeight;
    return score.toFixed(1);
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-black border border-[#333333] text-white font-sans rounded-none relative">
      {/* Editorial Header / Tab Switcher Bar */}
      <div className="px-5 py-3.5 bg-[#0a0a0a] border-b border-[#333333] flex flex-wrap items-center justify-between gap-4">
        {/* Engine Status Indicator */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs font-medium text-[#a39d96] flex items-center gap-2 uppercase tracking-widest">
            <Cpu size={14} className="text-[#ffdca1] animate-pulse" />
            shariah-algo-engine v2.4
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest">
          <button
            onClick={() => setActiveTab("screener")}
            className={`px-4 py-1.5 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "screener"
                ? "bg-black text-[#ffdca1] border border-[#ffdca1] font-semibold"
                : "text-[#a39d96] hover:text-white border border-transparent"
            }`}
          >
            <ShieldCheck size={14} />
            AAOIFI Screener
          </button>
          <button
            onClick={() => setActiveTab("factors")}
            className={`px-4 py-1.5 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "factors"
                ? "bg-black text-[#ffdca1] border border-[#ffdca1] font-semibold"
                : "text-[#a39d96] hover:text-white border border-transparent"
            }`}
          >
            <Sliders size={14} />
            Multi-Factor Engine
          </button>
          <button
            onClick={() => setActiveTab("execution")}
            className={`px-4 py-1.5 transition-all flex items-center gap-2 cursor-pointer ${
              activeTab === "execution"
                ? "bg-black text-[#ffdca1] border border-[#ffdca1] font-semibold"
                : "text-[#a39d96] hover:text-white border border-transparent"
            }`}
          >
            <Activity size={14} />
            Execution Feed
            <span className="w-1.5 h-1.5 rounded-full bg-[#6dfab4] animate-ping" />
          </button>
        </div>
      </div>

      {/* Terminal Main Content Area */}
      <div className="p-6 bg-[#050505]">
        <AnimatePresence mode="wait">
          {/* TAB 1: AAOIFI SCREENER */}
          {activeTab === "screener" && (
            <motion.div
              key="screener"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Stock Selector List */}
              <div className="lg:col-span-5 bg-black border border-[#333333] p-4 flex flex-col gap-3">
                <div className="relative border-b border-[#333333] pb-2">
                  <Search size={14} className="absolute left-1 top-2.5 text-[#a39d96]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Filter ticker (e.g. NVDA, AAPL)..."
                    className="w-full pl-7 pr-3 py-1.5 bg-transparent text-xs text-white placeholder-[#555555] font-mono focus:outline-none"
                  />
                </div>

                <div className="flex flex-col gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {filteredStocks.map((stock) => {
                    const isSelected = selectedStock.ticker === stock.ticker;
                    return (
                      <button
                        key={stock.ticker}
                        onClick={() => setSelectedStock(stock)}
                        className={`p-3 border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-[#111111] border-[#ffdca1] text-white"
                            : "bg-black border-[#222222] hover:border-[#444444] text-[#a39d96]"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`font-mono text-xs font-bold px-2 py-1 ${
                            stock.status === "PASS"
                              ? "bg-[#6dfab4]/10 text-[#6dfab4] border border-[#6dfab4]/40"
                              : "bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/40"
                          }`}>
                            {stock.ticker}
                          </span>
                          <div>
                            <div className="text-xs font-semibold text-white">
                              {stock.name}
                            </div>
                            <div className="text-[11px] font-mono text-[#a39d96]">
                              {stock.price}{" "}
                              <span className={stock.isPositive ? "text-[#6dfab4]" : "text-[#ffb4ab]"}>
                                {stock.change}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span className={`font-mono text-[10px] uppercase tracking-widest ${
                            stock.status === "PASS" ? "text-[#6dfab4]" : "text-[#ffb4ab]"
                          }`}>
                            {stock.status === "PASS" ? "SHARIAH OK" : "FAILED"}
                          </span>
                          <div className="text-[10px] font-mono text-[#a39d96] mt-0.5">
                            Score: <span className="text-[#ffdca1] font-bold">{stock.factorScore}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stock Detailed AAOIFI Audit Card */}
              <div className="lg:col-span-7 bg-black border border-[#333333] p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between border-b border-[#333333] pb-4 mb-6">
                    <div>
                      <div className="flex items-center gap-3">
                        <h3 className="font-playfair text-2xl text-white font-normal">{selectedStock.name}</h3>
                        <span className="font-mono text-xs text-[#ffdca1] border border-[#ffdca1]/50 px-2 py-0.5 uppercase tracking-widest">
                          ${selectedStock.ticker}
                        </span>
                      </div>
                      <p className="text-xs text-[#a39d96] font-sans mt-1">
                        Daily Automated Compliance Audit (AAOIFI Standard No. 21)
                      </p>
                    </div>

                    <div className={`px-3 py-1.5 border font-mono text-xs font-bold uppercase tracking-widest flex items-center gap-2 ${
                      selectedStock.status === "PASS"
                        ? "bg-[#6dfab4]/10 text-[#6dfab4] border-[#6dfab4]"
                        : "bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]"
                    }`}>
                      {selectedStock.status === "PASS" ? (
                        <>
                          <CheckCircle size={14} />
                          COMPLIANT
                        </>
                      ) : (
                        <>
                          <XCircle size={14} />
                          RESTRICTED
                        </>
                      )}
                    </div>
                  </div>

                  {/* AAOIFI Criteria Breakdown Bars */}
                  <div className="space-y-6">
                    {/* 1. Debt Ratio */}
                    <div>
                      <div className="flex justify-between text-xs mb-2 font-mono">
                        <span className="text-[#a39d96] uppercase tracking-widest">
                          Total Interest Debt / Total Assets
                          <span className="text-[#666666] ml-2">(Threshold &lt; 33%)</span>
                        </span>
                        <span className={selectedStock.debtRatio < 33 ? "text-[#6dfab4] font-bold" : "text-[#ffb4ab] font-bold"}>
                          {selectedStock.debtRatio}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#111111] border border-[#333333]">
                        <div
                          className={`h-full transition-all duration-500 ${
                            selectedStock.debtRatio < 33 ? "bg-[#6dfab4]" : "bg-[#ffb4ab]"
                          }`}
                          style={{ width: `${Math.min(selectedStock.debtRatio * 2.5, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. Cash & Interest Securities Ratio */}
                    <div>
                      <div className="flex justify-between text-xs mb-2 font-mono">
                        <span className="text-[#a39d96] uppercase tracking-widest">
                          Cash & Securities / Market Cap
                          <span className="text-[#666666] ml-2">(Threshold &lt; 33%)</span>
                        </span>
                        <span className={selectedStock.cashRatio < 33 ? "text-[#6dfab4] font-bold" : "text-[#ffb4ab] font-bold"}>
                          {selectedStock.cashRatio}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-[#111111] border border-[#333333]">
                        <div
                          className={`h-full transition-all duration-500 ${
                            selectedStock.cashRatio < 33 ? "bg-[#6dfab4]" : "bg-[#ffb4ab]"
                          }`}
                          style={{ width: `${Math.min(selectedStock.cashRatio * 2.5, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 3. Business Activity Screening */}
                    <div className="flex items-center justify-between p-3.5 bg-[#0a0a0a] border border-[#333333]">
                      <span className="text-xs text-[#a39d96] font-sans">
                        Business Activity Screening (No Riba, Alcohol, Gambling)
                      </span>
                      <span className={`font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 border ${
                        selectedStock.businessScreen
                          ? "text-[#6dfab4] border-[#6dfab4]/40 bg-[#6dfab4]/10"
                          : "text-[#ffb4ab] border-[#ffb4ab]/40 bg-[#ffb4ab]/10"
                      }`}>
                        {selectedStock.businessScreen ? "100% APPROVED" : "FAILED ACTIVITY"}
                      </span>
                    </div>

                    {/* SPUS ETF Constituent Match */}
                    <div className="flex items-center justify-between text-xs text-[#a39d96] bg-[#0a0a0a] p-3.5 border border-[#333333] font-mono">
                      <span className="flex items-center gap-2">
                        <Sparkles size={14} className="text-[#ffdca1]" />
                        SPUS ETF Constituent Match:
                      </span>
                      <span className="text-white font-bold uppercase tracking-widest">
                        {selectedStock.spusConstituent ? "VERIFIED IN SPUS" : "NOT IN ETF"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-6 pt-4 border-t border-[#333333] flex items-center justify-between text-xs text-[#a39d96] font-mono uppercase tracking-widest">
                  <span>Audit Sync: Market Open (NYSE)</span>
                  <span className="text-[#6dfab4] flex items-center gap-1.5">
                    <RefreshCw size={12} className="animate-spin" /> Automated Compliance Active
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 2: MULTI-FACTOR ENGINE */}
          {activeTab === "factors" && (
            <motion.div
              key="factors"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Factor Weight Sliders */}
              <div className="lg:col-span-6 bg-black border border-[#333333] p-6 space-y-6">
                <div>
                  <h3 className="text-base font-playfair text-white flex items-center gap-2">
                    <Sliders size={16} className="text-[#ffdca1]" />
                    Customize Factor Weights
                  </h3>
                  <p className="text-xs text-[#a39d96] font-sans mt-1">
                    Adjust quantitative factor model weights to dynamically re-rank the top 20 Shariah stocks.
                  </p>
                </div>

                {/* Slider 1: Momentum */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono uppercase tracking-widest">
                    <span className="text-[#6dfab4]">Momentum Factor</span>
                    <span className="text-white font-bold">{momentumWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={momentumWeight}
                    onChange={(e) => setMomentumWeight(Number(e.target.value))}
                    className="w-full accent-[#6dfab4] bg-[#111111] cursor-pointer"
                  />
                </div>

                {/* Slider 2: Quality */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono uppercase tracking-widest">
                    <span className="text-[#ffdca1]">Quality / ROE Factor</span>
                    <span className="text-white font-bold">{qualityWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={qualityWeight}
                    onChange={(e) => setQualityWeight(Number(e.target.value))}
                    className="w-full accent-[#ffdca1] bg-[#111111] cursor-pointer"
                  />
                </div>

                {/* Slider 3: Value */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-mono uppercase tracking-widest">
                    <span className="text-white">Value / Earnings Yield</span>
                    <span className="text-white font-bold">{valueWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={valueWeight}
                    onChange={(e) => setValueWeight(Number(e.target.value))}
                    className="w-full accent-white bg-[#111111] cursor-pointer"
                  />
                </div>

                <div className="p-3.5 bg-[#0a0a0a] border border-[#333333] text-xs text-[#a39d96] font-mono flex items-center justify-between uppercase tracking-widest">
                  <span>Composite Balance:</span>
                  <span className="font-bold text-[#6dfab4]">
                    {momentumWeight + qualityWeight + valueWeight}% TOTAL
                  </span>
                </div>
              </div>

              {/* Dynamic Re-Ranked Leaderboard */}
              <div className="lg:col-span-6 bg-black border border-[#333333] p-6">
                <h3 className="text-base font-playfair text-white mb-6 flex items-center justify-between">
                  <span>Live Ranked Portfolio</span>
                  <span className="text-xs text-[#ffdca1] font-mono font-normal uppercase tracking-widest">Re-calculating...</span>
                </h3>

                <div className="space-y-3">
                  {MOCK_STOCKS.filter((s) => s.status === "PASS").map((stock, idx) => {
                    const score = calculatedScore(stock);
                    return (
                      <div
                        key={stock.ticker}
                        className="p-3 bg-[#0a0a0a] border border-[#333333] flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 border border-[#333333] bg-black text-[#ffdca1] font-mono text-xs font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-white font-mono">{stock.ticker}</div>
                            <div className="text-[10px] text-[#a39d96] font-sans">{stock.name}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-[#6dfab4]">
                            Score: {score}
                          </div>
                          <div className="text-[10px] font-mono text-[#a39d96]">Target Weight: ~5.0%</div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          )}

          {/* TAB 3: LIVE EXECUTION FEED */}
          {activeTab === "execution" && (
            <motion.div
              key="execution"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-[#a39d96] mb-3 font-mono uppercase tracking-widest">
                <span className="flex items-center gap-2">
                  <Activity size={14} className="text-[#6dfab4] animate-pulse" />
                  Alpaca Broker API Stream - Real-Time Fills & Compliance
                </span>
                <span className="text-[#666666]">Stream: Active</span>
              </div>

              <div className="space-y-2">
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -6 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-4 bg-black border border-[#333333] flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-[#666666]">{log.time}</span>
                      <span className={`px-2 py-0.5 border text-[10px] font-bold uppercase tracking-widest ${
                        log.type === "BUY"
                          ? "bg-[#6dfab4]/10 text-[#6dfab4] border-[#6dfab4]/40"
                          : log.type === "REBALANCE"
                          ? "bg-[#ffdca1]/10 text-[#ffdca1] border-[#ffdca1]/40"
                          : "bg-[#ffb4ab]/10 text-[#ffb4ab] border-[#ffb4ab]/40"
                      }`}>
                        {log.type}
                      </span>
                      <span className="font-bold text-white text-sm">{log.ticker}</span>
                      <span className="text-[#a39d96]">
                        {log.shares} shares @ {log.price}
                      </span>
                    </div>

                    <div className="text-[#a39d96] text-[11px]">
                      {log.reason}
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Terminal Footer Bar */}
      <div className="px-6 py-3 bg-[#0a0a0a] border-t border-[#333333] flex items-center justify-between text-xs text-[#a39d96] font-mono uppercase tracking-widest">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#6dfab4]" />
          Interactive Brokers & Alpaca Gateway: Connected
        </span>
        <span className="text-white font-semibold">100% Long-Only Spot Equity · Zero Riba</span>
      </div>
    </div>
  );
}
