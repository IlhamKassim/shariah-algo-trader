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
    change: "+3.40%",
    isPositive: true,
    debtRatio: 9.1,
    cashRatio: 15.3,
    businessScreen: true,
    factorScore: 86.4,
    momentum: 94,
    quality: 78,
    value: 52,
    status: "PASS",
    spusConstituent: true,
  },
];

interface ExecutionLog {
  id: string;
  time: string;
  ticker: string;
  type: "BUY" | "REBALANCE" | "COMPLIANCE_EXIT";
  shares: number;
  price: string;
  reason: string;
}

export function InteractiveAlgoTerminal() {
  const [activeTab, setActiveTab] = useState<"screener" | "factors" | "execution">("screener");
  const [selectedStock, setSelectedStock] = useState<StockScreenerData>(MOCK_STOCKS[0]);
  const [searchQuery, setSearchQuery] = useState("");

  // Factor Sliders State
  const [momentumWeight, setMomentumWeight] = useState(40);
  const [qualityWeight, setQualityWeight] = useState(30);
  const [valueWeight, setValueWeight] = useState(30);

  // Simulated Execution Log Stream
  const [logs, setLogs] = useState<ExecutionLog[]>([
    {
      id: "1",
      time: "09:30:14 ET",
      ticker: "NVDA",
      type: "BUY",
      shares: 45,
      price: "$138.25",
      reason: "Rank #1 Composite Score (94.8)",
    },
    {
      id: "2",
      time: "09:30:15 ET",
      ticker: "AAPL",
      type: "BUY",
      shares: 28,
      price: "$224.50",
      reason: "Rank #2 Composite Score (89.2)",
    },
    {
      id: "3",
      time: "09:30:18 ET",
      ticker: "SBUX",
      type: "COMPLIANCE_EXIT",
      shares: 50,
      price: "$78.40",
      reason: "Liquidation: Failed AAOIFI Debt Ratio (>33%)",
    },
  ]);

  // Simulate auto-streaming live signals
  useEffect(() => {
    const interval = setInterval(() => {
      const tickers = ["NVDA", "AAPL", "MSFT", "AVGO", "AMD", "TSLA"];
      const randomTicker = tickers[Math.floor(Math.random() * tickers.length)];
      const types: Array<"BUY" | "REBALANCE"> = ["BUY", "REBALANCE"];
      const randomType = types[Math.floor(Math.random() * types.length)];
      const newLog: ExecutionLog = {
        id: Date.now().toString(),
        time: new Date().toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }) + " ET",
        ticker: randomTicker,
        type: randomType,
        shares: Math.floor(Math.random() * 30) + 10,
        price: "$" + (Math.random() * 200 + 100).toFixed(2),
        reason: randomType === "BUY" ? "Top 20 Composite Rank Rebalance" : "Weight Re-alignment",
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
    <div className="w-full max-w-5xl mx-auto my-8 bg-slate-950/80 backdrop-blur-xl border border-slate-800/80 rounded-2xl shadow-2xl overflow-hidden text-slate-100 font-sans relative group">
      {/* Top Outer Ambient Border Light Glow */}
      <div className="absolute -top-px left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-emerald-500/60 to-transparent" />
      <div className="absolute -top-px left-1/3 right-1/3 h-[2px] bg-gradient-to-r from-transparent via-amber-400/50 to-transparent blur-xs" />

      {/* Terminal Header / Navigation Bar */}
      <div className="px-5 py-3.5 bg-slate-900/90 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        {/* Left Window Control Indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-rose-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-amber-500/80 inline-block" />
            <span className="w-3 h-3 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="text-xs font-mono font-medium text-slate-400 flex items-center gap-1.5 ml-2 border-l border-slate-800 pl-3">
            <Cpu size={13} className="text-emerald-400 animate-pulse" />
            shariah-algo-engine v2.4
          </span>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800/80 text-xs font-medium">
          <button
            onClick={() => setActiveTab("screener")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "screener"
                ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-900/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <ShieldCheck size={14} />
            AAOIFI Screener
          </button>
          <button
            onClick={() => setActiveTab("factors")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "factors"
                ? "bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold shadow-md shadow-amber-900/20"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Sliders size={14} />
            Multi-Factor Engine
          </button>
          <button
            onClick={() => setActiveTab("execution")}
            className={`px-3 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
              activeTab === "execution"
                ? "bg-gradient-to-r from-emerald-600 to-emerald-700 text-white shadow-md shadow-emerald-900/30 font-semibold"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-900/50"
            }`}
          >
            <Activity size={14} />
            Live Execution Feed
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
          </button>
        </div>
      </div>

      {/* Terminal Main Content Area */}
      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* TAB 1: AAOIFI SCREENER */}
          {activeTab === "screener" && (
            <motion.div
              key="screener"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Stock Selector List */}
              <div className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 flex flex-col gap-3">
                <div className="relative">
                  <Search size={14} className="absolute left-3 top-3 text-slate-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search stock ticker (e.g. NVDA, AAPL)..."
                    className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 transition-colors"
                  />
                </div>

                <div className="flex flex-col gap-2 max-h-[320px] overflow-y-auto pr-1">
                  {filteredStocks.map((stock) => {
                    const isSelected = selectedStock.ticker === stock.ticker;
                    return (
                      <button
                        key={stock.ticker}
                        onClick={() => setSelectedStock(stock)}
                        className={`p-3 rounded-lg border text-left transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? "bg-slate-800/80 border-emerald-500/50 shadow-md shadow-emerald-950/40"
                            : "bg-slate-950/40 border-slate-800/50 hover:bg-slate-900/60 hover:border-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs ${
                              stock.status === "PASS"
                                ? "bg-emerald-950/80 text-emerald-400 border border-emerald-800/50"
                                : "bg-rose-950/80 text-rose-400 border border-rose-800/50"
                            }`}
                          >
                            {stock.ticker}
                          </div>
                          <div>
                            <div className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                              {stock.name}
                            </div>
                            <div className="text-[11px] font-mono text-slate-400">
                              {stock.price}{" "}
                              <span
                                className={stock.isPositive ? "text-emerald-400" : "text-rose-400"}
                              >
                                {stock.change}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="text-right">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold tracking-wider ${
                              stock.status === "PASS"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                            }`}
                          >
                            {stock.status === "PASS" ? "SHARIAH OK" : "FAILED"}
                          </span>
                          <div className="text-[10px] font-mono text-slate-400 mt-1">
                            Score: <span className="text-amber-400 font-bold">{stock.factorScore}</span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stock Detailed AAOIFI Audit Card */}
              <div className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-start justify-between border-b border-slate-800 pb-4 mb-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-playfair text-xl font-bold text-slate-100">{selectedStock.name}</h3>
                        <span className="font-mono text-xs text-amber-400 bg-amber-950/50 border border-amber-800/50 px-2 py-0.5 rounded font-semibold">
                          ${selectedStock.ticker}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        Daily Automated Compliance Audit (AAOIFI Standard No. 21)
                      </p>
                    </div>

                    <div
                      className={`px-3 py-1.5 rounded-lg border flex items-center gap-1.5 text-xs font-bold ${
                        selectedStock.status === "PASS"
                          ? "bg-emerald-950/80 text-emerald-400 border-emerald-800/80 shadow-md shadow-emerald-950/50"
                          : "bg-rose-950/80 text-rose-400 border-rose-800/80"
                      }`}
                    >
                      {selectedStock.status === "PASS" ? (
                        <>
                          <CheckCircle size={15} />
                          COMPLIANT
                        </>
                      ) : (
                        <>
                          <XCircle size={15} />
                          NON-COMPLIANT
                        </>
                      )}
                    </div>
                  </div>

                  {/* AAOIFI Criteria Breakdown Bars */}
                  <div className="space-y-4">
                    {/* 1. Debt Ratio */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300 font-medium flex items-center gap-1.5">
                          Total Interest Debt / Total Assets
                          <span className="text-[10px] text-slate-500 font-mono">(Threshold &lt; 33%)</span>
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            selectedStock.debtRatio < 33 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {selectedStock.debtRatio}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            selectedStock.debtRatio < 33 ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(selectedStock.debtRatio * 2.5, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 2. Cash & Interest Securities Ratio */}
                    <div>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-slate-300 font-medium flex items-center gap-1.5">
                          Cash & Interest Securities / Market Cap
                          <span className="text-[10px] text-slate-500 font-mono">(Threshold &lt; 33%)</span>
                        </span>
                        <span
                          className={`font-mono font-bold ${
                            selectedStock.cashRatio < 33 ? "text-emerald-400" : "text-rose-400"
                          }`}
                        >
                          {selectedStock.cashRatio}%
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            selectedStock.cashRatio < 33 ? "bg-emerald-500" : "bg-rose-500"
                          }`}
                          style={{ width: `${Math.min(selectedStock.cashRatio * 2.5, 100)}%` }}
                        />
                      </div>
                    </div>

                    {/* 3. Business Activity Screening */}
                    <div className="flex items-center justify-between p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg">
                      <span className="text-xs text-slate-300">
                        Business Activity Screening (No Riba, Alcohol, Gambling)
                      </span>
                      <span
                        className={`text-xs font-mono font-bold px-2 py-0.5 rounded ${
                          selectedStock.businessScreen
                            ? "text-emerald-400 bg-emerald-950/50"
                            : "text-rose-400 bg-rose-950/50"
                        }`}
                      >
                        {selectedStock.businessScreen ? "100% APPROVED" : "FAILED ACTIVITY"}
                      </span>
                    </div>

                    {/* SPUS / HLAL Sync Badge */}
                    <div className="flex items-center justify-between text-xs text-slate-400 bg-slate-950/40 p-3 rounded-lg border border-slate-800/50">
                      <span className="flex items-center gap-1.5">
                        <Sparkles size={13} className="text-amber-400" />
                        SPUS ETF Constituent Match:
                      </span>
                      <span className="font-mono font-semibold text-slate-200">
                        {selectedStock.spusConstituent ? "VERIFIED IN SPUS" : "NOT IN ETF"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 pt-3 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400 font-mono">
                  <span>Audit Sync: Market Open (NYSE)</span>
                  <span className="text-emerald-400 font-semibold flex items-center gap-1">
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="grid grid-cols-1 lg:grid-cols-12 gap-6"
            >
              {/* Factor Weight Sliders */}
              <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-xl p-5 space-y-5">
                <div>
                  <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                    <Sliders size={16} className="text-amber-400" />
                    Customize Factor Weights
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    Adjust the quantitative factor model weights to dynamically re-rank the top 20 Shariah stocks.
                  </p>
                </div>

                {/* Slider 1: Momentum */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-emerald-400">Momentum Factor</span>
                    <span className="font-mono text-slate-200">{momentumWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={momentumWeight}
                    onChange={(e) => setMomentumWeight(Number(e.target.value))}
                    className="w-full accent-emerald-500 bg-slate-950 cursor-pointer"
                  />
                </div>

                {/* Slider 2: Quality */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-amber-400">Quality / ROE Factor</span>
                    <span className="font-mono text-slate-200">{qualityWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={qualityWeight}
                    onChange={(e) => setQualityWeight(Number(e.target.value))}
                    className="w-full accent-amber-500 bg-slate-950 cursor-pointer"
                  />
                </div>

                {/* Slider 3: Value */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs font-semibold">
                    <span className="text-cyan-400">Value / Earnings Yield</span>
                    <span className="font-mono text-slate-200">{valueWeight}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={valueWeight}
                    onChange={(e) => setValueWeight(Number(e.target.value))}
                    className="w-full accent-cyan-500 bg-slate-950 cursor-pointer"
                  />
                </div>

                <div className="p-3 bg-slate-950/60 rounded-lg border border-slate-800/80 text-xs text-slate-400 flex items-center justify-between">
                  <span>Composite Model Balance:</span>
                  <span className="font-mono font-bold text-emerald-400">
                    {momentumWeight + qualityWeight + valueWeight}% TOTAL
                  </span>
                </div>
              </div>

              {/* Dynamic Re-Ranked Leaderboard */}
              <div className="lg:col-span-6 bg-slate-900/60 border border-slate-800/80 rounded-xl p-5">
                <h3 className="text-sm font-bold text-slate-100 mb-4 flex items-center justify-between">
                  <span>Live Ranked Portfolio (Top Candidates)</span>
                  <span className="text-xs text-amber-400 font-mono font-normal">Re-calculating...</span>
                </h3>

                <div className="space-y-2.5">
                  {MOCK_STOCKS.filter((s) => s.status === "PASS").map((stock, idx) => {
                    const score = calculatedScore(stock);
                    return (
                      <div
                        key={stock.ticker}
                        className="p-3 bg-slate-950/60 border border-slate-800/80 rounded-lg flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <span className="w-6 h-6 rounded bg-slate-800 text-amber-400 font-mono text-xs font-bold flex items-center justify-center">
                            #{idx + 1}
                          </span>
                          <div>
                            <div className="text-xs font-bold text-slate-200">{stock.ticker}</div>
                            <div className="text-[10px] text-slate-400">{stock.name}</div>
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-xs font-mono font-bold text-emerald-400">
                            Score: {score}
                          </div>
                          <div className="text-[10px] text-slate-500">Target Weight: ~5.0%</div>
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
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="space-y-3"
            >
              <div className="flex items-center justify-between text-xs text-slate-400 mb-2 font-mono">
                <span className="flex items-center gap-2">
                  <Activity size={14} className="text-emerald-400 animate-pulse" />
                  Alpaca Broker API Stream - Real-Time Fills & Compliance Actions
                </span>
                <span className="text-slate-500">Auto-refresh: 4.5s</span>
              </div>

              <div className="space-y-2">
                {logs.map((log) => (
                  <motion.div
                    key={log.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3.5 bg-slate-900/80 border border-slate-800/90 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-slate-500 font-semibold">{log.time}</span>
                      <span
                        className={`px-2 py-0.5 rounded font-bold ${
                          log.type === "BUY"
                            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                            : log.type === "REBALANCE"
                            ? "bg-amber-500/10 text-amber-400 border border-amber-500/30"
                            : "bg-rose-500/10 text-rose-400 border border-rose-500/30"
                        }`}
                      >
                        {log.type}
                      </span>
                      <span className="font-bold text-slate-200 text-sm">{log.ticker}</span>
                      <span className="text-slate-400">
                        {log.shares} shares @ {log.price}
                      </span>
                    </div>

                    <div className="text-slate-400 text-[11px] italic">
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
      <div className="px-6 py-3 bg-slate-900/90 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-mono">
        <span className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          Interactive Brokers & Alpaca Gateway: Connected
        </span>
        <span className="text-slate-500">100% Long-Only Spot Equity · Zero Riba</span>
      </div>
    </div>
  );
}
