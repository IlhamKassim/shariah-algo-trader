import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectionOverlay } from "../components/ConnectionOverlay";
import { ObsidianCanvasBackground } from "../components/ObsidianCanvasBackground";
import { InteractiveAlgoTerminal } from "../components/InteractiveAlgoTerminal";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  Activity,
  X,
  ChevronDown,
  ChevronUp,
  Sliders,
  ArrowRight,
  Building2,
  BarChart3,
  Lock,
  Scale,
  RefreshCw,
  FileCheck2,
  DollarSign,
} from "lucide-react";

export function Landing() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isNavigatingToLogin, setIsNavigatingToLogin] = useState(false);
  const [connectionMode, setConnectionMode] = useState("INTERACTIVE BROKERS");
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleStartConnection = (mode: string) => {
    setConnectionMode(mode);
    setShowBrokerModal(false);
    setIsConnecting(true);
  };

  const handleCompleteConnection = async () => {
    localStorage.setItem("shariah_demo_mode", "true");
    await queryClient.invalidateQueries();
    window.scrollTo(0, 0);
    navigate("/");
  };

  const handleNavigateToLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsNavigatingToLogin(true);
    setTimeout(() => {
      navigate("/login");
    }, 220);
  };

  const toggleFaq = (index: number) => {
    setActiveFaq(activeFaq === index ? null : index);
  };

  const faqs = [
    {
      q: "How does the engine enforce AAOIFI Standard No. 21 compliance daily?",
      a: "Our core engine runs an automated Compliance Audit at 09:30 AM ET before market execution. It synchronizes with daily S&P 500 Shariah constituent databases and cross-verifies financial metrics: Interest-Bearing Debt / Total Assets (<33%), Cash & Interest Securities / Assets (<33%), and 100% Core Business Activity Screening.",
    },
    {
      q: "Is there any leverage, short-selling, or interest (Riba) involved?",
      a: "Strictly zero. ShariahTrading operates exclusively on a 100% Long-Only Spot Equity basis. Options, futures, margin trading, short positions, and interest-bearing fixed-income instruments are hard-blocked at the algorithmic execution layer.",
    },
    {
      q: "What occurs if an active portfolio stock becomes non-compliant?",
      a: "If a company's debt or cash ratios exceed the 33% threshold due to quarterly earnings updates or market cap swings, the compliance engine flags an immediate 'Compliance Exit Liquidation' order, selling 100% of the position on the next market open.",
    },
    {
      q: "How does the Multi-Factor Quantitative Strategy outperform passive Shariah ETFs?",
      a: "Rather than market-cap weighting where mega-caps dominate portfolio concentration, our quantitative model ranks compliant stocks across 4 proven factor metrics: Momentum, Quality (ROE), Low Volatility, and Value. The system rebalances monthly into the top 20 ranked equities.",
    },
    {
      q: "How is dividend purification calculated for non-permissible income?",
      a: "For companies with minor incidental interest income (<5%), the system automatically calculates the exact purification percentage per dividend payout and logs the required charitable donation amount directly inside your Activity Log.",
    },
  ];

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-emerald-500 selection:text-slate-950 relative overflow-x-hidden antialiased">
      {/* Precision Financial Ambient Background */}
      <ObsidianCanvasBackground />

      {/* Top Transition Loader */}
      {isNavigatingToLogin && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-slate-950 overflow-hidden">
          <div className="h-full bg-gradient-to-r from-emerald-500 to-amber-400 w-full transition-all duration-200 ease-out animate-pulse" />
        </div>
      )}

      {/* Connection Overlay Simulator */}
      {isConnecting && (
        <ConnectionOverlay
          modeName={connectionMode}
          onComplete={handleCompleteConnection}
        />
      )}

      {/* Top Live Ticker Status Ribbon */}
      <div className="w-full bg-slate-950/90 border-b border-slate-800/80 py-2 px-4 z-50 relative text-[11px] font-mono text-slate-400">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping inline-block" />
              NYSE OPEN
            </span>
            <span className="text-slate-600">|</span>
            <span>DAILY AAOIFI AUDIT COMPLETE (09:30 AM ET)</span>
            <span className="text-slate-600 hidden md:inline">|</span>
            <span className="hidden md:inline text-slate-300">SPUS CONSTITUENT SYNC: VERIFIED</span>
          </div>

          <div className="flex items-center gap-4 text-slate-400">
            <span className="hidden sm:inline">100% LONG SPOT EQUITIES</span>
            <span className="text-amber-400 font-semibold flex items-center gap-1">
              <ShieldCheck size={13} /> ZERO MARGIN / NO RIBA
            </span>
          </div>
        </div>
      </div>

      {/* Institutional Header Navigation */}
      <header className="w-full bg-slate-950/80 backdrop-blur-xl border-b border-slate-800/80 sticky top-0 z-40">
        <div className="flex justify-between items-center px-6 md:px-12 h-20 max-w-7xl mx-auto">
          {/* Brand Logo */}
          <div className="flex items-center gap-3.5 select-none">
            <div className="w-10 h-10 bg-slate-900 border border-emerald-500/40 rounded-xl flex items-center justify-center text-emerald-400 shadow-md shadow-emerald-950/50">
              <TrendingUp size={22} strokeWidth={2.2} className="text-emerald-400" />
            </div>
            <div className="flex flex-col">
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-lg md:text-xl text-slate-100 tracking-tight">
                  SHARIAH<span className="text-amber-400">ALGO</span>
                </span>
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-[10px] font-mono text-emerald-400 font-bold">
                  PRO
                </span>
              </div>
              <span className="text-[10px] font-mono text-slate-400 tracking-wider">
                QUANTITATIVE ETHICAL TRADING
              </span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-8 text-xs font-semibold uppercase tracking-wider text-slate-300">
            <a href="#screener" className="hover:text-emerald-400 transition-colors">
              Terminal Screener
            </a>
            <a href="#methodology" className="hover:text-emerald-400 transition-colors">
              AAOIFI Rules
            </a>
            <a href="#factor-model" className="hover:text-emerald-400 transition-colors">
              4-Factor Engine
            </a>
            <a href="#performance" className="hover:text-emerald-400 transition-colors">
              Backtest Alpha
            </a>
            <a href="#faqs" className="hover:text-emerald-400 transition-colors">
              FAQs
            </a>
          </nav>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleNavigateToLogin}
              className="text-xs font-semibold uppercase tracking-wider text-slate-300 hover:text-slate-100 px-3.5 py-2 rounded-lg hover:bg-slate-900 transition-colors cursor-pointer"
            >
              Sign In
            </button>
            <button
              onClick={() => setShowBrokerModal(true)}
              className="px-4 py-2.5 bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-600 hover:from-emerald-500 hover:to-emerald-400 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-950/60 hover:shadow-emerald-900/80 transition-all flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
            >
              <Building2 size={15} />
              Connect Broker Gateway
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative z-10 pt-16 pb-12 px-6 max-w-7xl mx-auto text-center">
        {/* Top Compliance Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-slate-900/90 border border-emerald-500/30 text-emerald-400 text-xs font-mono mb-6 backdrop-blur-md shadow-md shadow-emerald-950/40 uppercase tracking-wider"
        >
          <ShieldCheck size={14} className="text-amber-400" />
          <span>AAOIFI STANDARD NO. 21 · 100% LONG SPOT EQUITIES · ZERO MARGIN</span>
        </motion.div>

        {/* Hero Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-slate-100 tracking-tight leading-[1.12] max-w-5xl mx-auto"
        >
          Quantitative Spot Equities Built for <br />
          <span className="bg-gradient-to-r from-emerald-400 via-amber-300 to-emerald-500 bg-clip-text text-transparent">
            Shariah-Compliant Investors.
          </span>
        </motion.h1>

        {/* Subtitle */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-6 text-base md:text-lg text-slate-400 max-w-3xl mx-auto leading-relaxed font-normal"
        >
          Automating daily AAOIFI No. 21 financial screening, 4-factor momentum scoring, and automated compliance exit liquidations. Strictly 100% long-only spot equity execution with Interactive Brokers & Alpaca.
        </motion.p>

        {/* Hero CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-8 flex flex-wrap items-center justify-center gap-4"
        >
          <button
            onClick={() => setShowBrokerModal(true)}
            className="px-7 py-3.5 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-widest rounded-xl shadow-xl shadow-emerald-950/80 hover:shadow-emerald-900 transition-all flex items-center gap-2 cursor-pointer transform hover:-translate-y-0.5"
          >
            <Building2 size={16} />
            Connect Interactive Brokers / Alpaca
            <ArrowRight size={16} />
          </button>

          <button
            onClick={() => handleStartConnection("DEMO CONSOLE")}
            className="px-7 py-3.5 bg-slate-900/90 hover:bg-slate-800 text-slate-200 font-bold text-xs uppercase tracking-widest rounded-xl border border-slate-700/80 transition-all flex items-center gap-2 cursor-pointer backdrop-blur-md transform hover:-translate-y-0.5"
          >
            <Zap size={16} className="text-amber-400" />
            Launch Demo Sandbox
          </button>
        </motion.div>

        {/* Key Metrics Strip */}
        <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto text-left">
          <div className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-md">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Permissibility</div>
            <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">100% Spot</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Zero Margin or Derivatives</div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-md">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Max Debt / Asset</div>
            <div className="text-xl font-bold text-amber-400 mt-1 font-mono">&lt; 33.0%</div>
            <div className="text-[11px] text-slate-500 mt-0.5">AAOIFI No. 21 Threshold</div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-md">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Compliance Audit</div>
            <div className="text-xl font-bold text-slate-100 mt-1 font-mono">Daily Open</div>
            <div className="text-[11px] text-slate-500 mt-0.5">09:30 AM ET NYSE Sync</div>
          </div>

          <div className="p-4 bg-slate-900/80 border border-slate-800/80 rounded-xl backdrop-blur-md">
            <div className="text-[11px] font-mono text-slate-400 uppercase tracking-wider">Factor Model</div>
            <div className="text-xl font-bold text-emerald-400 mt-1 font-mono">Top 20</div>
            <div className="text-[11px] text-slate-500 mt-0.5">Rebalanced Monthly</div>
          </div>
        </div>

        {/* Embedded Interactive Algo Terminal Showcase */}
        <div id="screener" className="mt-14 relative">
          <div className="text-center mb-4">
            <span className="text-xs font-mono text-emerald-400 uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5">
              <Activity size={14} /> LIVE QUANTITATIVE TERMINAL DEMO
            </span>
          </div>
          <InteractiveAlgoTerminal />
        </div>
      </section>

      {/* AAOIFI Methodology & Screening Matrix */}
      <section id="methodology" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-amber-400 text-xs font-mono mb-3">
            <Scale size={13} /> AAOIFI GOVERNANCE FRAMEWORK
          </div>
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight">
            Institutional Standard No. 21 Compliance Rules
          </h2>
          <p className="mt-3 text-slate-400 text-sm leading-relaxed">
            Every security in our universe undergoes multi-layered screening against Accounting and Auditing Organization for Islamic Financial Institutions standards.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Rule Card 1 */}
          <div className="p-6 bg-slate-900/70 border border-slate-800/90 rounded-2xl backdrop-blur-md hover:border-emerald-500/40 transition-all">
            <div className="w-11 h-11 bg-slate-950 border border-emerald-500/30 rounded-xl flex items-center justify-center text-emerald-400 mb-5">
              <FileCheck2 size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">1. Business Screening</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              100% business activity verification excluding conventional banking, interest, gambling, weapons, alcohol, and pork products.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-emerald-400 font-semibold">
              Threshold: 100% Halal Revenue
            </div>
          </div>

          {/* Rule Card 2 */}
          <div className="p-6 bg-slate-900/70 border border-slate-800/90 rounded-2xl backdrop-blur-md hover:border-amber-500/40 transition-all">
            <div className="w-11 h-11 bg-slate-950 border border-amber-500/30 rounded-xl flex items-center justify-center text-amber-400 mb-5">
              <Scale size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">2. Debt-to-Asset Cap</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Total interest-bearing debt divided by total market capitalization (or 36-month average market cap) must remain strictly under 33%.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-amber-400 font-semibold">
              Cap: Max 33.0% Total Debt
            </div>
          </div>

          {/* Rule Card 3 */}
          <div className="p-6 bg-slate-900/70 border border-slate-800/90 rounded-2xl backdrop-blur-md hover:border-cyan-500/40 transition-all">
            <div className="w-11 h-11 bg-slate-950 border border-cyan-500/30 rounded-xl flex items-center justify-center text-cyan-400 mb-5">
              <DollarSign size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">3. Cash & Interest Cap</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              Cash and interest-bearing securities divided by market capitalization must remain under 33% to prevent trading pure monetary assets.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-cyan-400 font-semibold">
              Cap: Max 33.0% Cash Securities
            </div>
          </div>

          {/* Rule Card 4 */}
          <div className="p-6 bg-slate-900/70 border border-slate-800/90 rounded-2xl backdrop-blur-md hover:border-rose-500/40 transition-all">
            <div className="w-11 h-11 bg-slate-950 border border-rose-500/30 rounded-xl flex items-center justify-center text-rose-400 mb-5">
              <RefreshCw size={22} />
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-2">4. Instant Liquidation</h3>
            <p className="text-xs text-slate-400 leading-relaxed font-normal">
              If an equity fails financial ratios due to balance sheet shifts, the engine executes a mandatory compliance liquidation on the next open.
            </p>
            <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] font-mono text-rose-400 font-semibold">
              Execution: Next Market Open
            </div>
          </div>
        </div>
      </section>

      {/* Multi-Factor Alpha & Backtest Visualization Section */}
      <section id="factor-model" className="relative z-10 py-20 px-6 max-w-7xl mx-auto border-t border-slate-800/80">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Description Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-emerald-400 text-xs font-mono">
              <Sliders size={13} /> QUANTITATIVE FACTOR ENGINE
            </div>
            <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100 tracking-tight leading-tight">
              Beyond Passive Indexing: Systematic Multi-Factor Alpha
            </h2>
            <p className="text-slate-400 text-sm leading-relaxed">
              Standard Shariah ETFs (like SPUS or HLAL) use market-cap weighting, causing heavy over-concentration in top mega-caps. Our quantitative model ranks compliant equities across 4 proven factor dimensions:
            </p>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-xs font-bold flex items-center justify-center mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Momentum Factor (12-1 Month Relative Return)</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Selects equities demonstrating robust persistent medium-term price trends.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-xs font-bold flex items-center justify-center mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Quality Factor (Return on Equity & Free Cash Flow)</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Prioritizes high ROE, strong balance sheet health, and operational profitability.</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 font-mono text-xs font-bold flex items-center justify-center mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-bold text-slate-200">Low Volatility & Value Factors</h4>
                  <p className="text-xs text-slate-400 mt-0.5">Controls downside drawdown risk while maintaining favorable earnings yield valuation.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Metrics Comparison Card */}
          <div className="lg:col-span-7 bg-slate-900/80 border border-slate-800/80 rounded-2xl p-6 backdrop-blur-xl shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-6">
              <div>
                <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                  <BarChart3 size={18} className="text-emerald-400" />
                  Strategy Backtest Performance (2019 - Present)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">Historical simulation comparing Shariah Multi-Factor vs SPUS & S&P 500</p>
              </div>
              <span className="px-2.5 py-1 rounded bg-emerald-500/10 text-emerald-400 text-xs font-mono font-semibold">
                Monthly Rebalanced
              </span>
            </div>

            <div className="space-y-4">
              {/* Metric 1: CAGR */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-slate-300">Annualized Return (CAGR)</span>
                  <span className="text-emerald-400 font-bold">+21.4% (Shariah Multi-Factor)</span>
                </div>
                <div className="w-full h-3 bg-slate-950 rounded-full overflow-hidden border border-slate-800 flex">
                  <div className="h-full bg-emerald-500 w-[78%]" title="Shariah Algo: 21.4%" />
                  <div className="h-full bg-amber-500/70 w-[60%]" title="SPUS ETF: 16.2%" />
                  <div className="h-full bg-slate-600/50 w-[50%]" title="S&P 500: 13.8%" />
                </div>
                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Shariah Multi-Factor: 21.4%</span>
                  <span>SPUS ETF: 16.2%</span>
                  <span>S&P 500: 13.8%</span>
                </div>
              </div>

              {/* Metric 2: Sharpe Ratio */}
              <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800 text-center font-mono">
                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Sharpe Ratio</div>
                  <div className="text-base font-bold text-emerald-400 mt-1">1.28</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">vs 1.02 SPUS</div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">Max Drawdown</div>
                  <div className="text-base font-bold text-slate-200 mt-1">-16.4%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">vs -22.1% SPUS</div>
                </div>

                <div className="p-3 bg-slate-950/60 rounded-xl border border-slate-800">
                  <div className="text-[10px] text-slate-400 uppercase">AAOIFI Pass Rate</div>
                  <div className="text-base font-bold text-amber-400 mt-1">100.0%</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">Zero Breach</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Broker Gateway Setup Banner */}
      <section className="relative z-10 py-16 px-6 max-w-5xl mx-auto text-center">
        <div className="p-10 bg-slate-900/90 border border-slate-800/80 rounded-3xl backdrop-blur-xl relative overflow-hidden shadow-2xl">
          <div className="absolute top-0 left-1/3 right-1/3 h-px bg-gradient-to-r from-transparent via-emerald-500 to-transparent" />
          <h2 className="text-2xl md:text-4xl font-extrabold text-slate-100">
            Ready to Automate Your Shariah Strategy?
          </h2>
          <p className="mt-3 text-xs md:text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Connect your Interactive Brokers or Alpaca Securities account and deploy automated spot equity trading in minutes.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <button
              onClick={() => setShowBrokerModal(true)}
              className="px-8 py-4 bg-gradient-to-r from-emerald-500 via-emerald-400 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold text-xs uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-950/80 hover:shadow-emerald-900 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Building2 size={16} />
              Connect Broker Gateway
            </button>
            <button
              onClick={() => handleStartConnection("DEMO CONSOLE")}
              className="px-8 py-4 bg-slate-950 hover:bg-slate-800 text-slate-200 font-bold text-xs uppercase tracking-widest rounded-xl border border-slate-800 transition-all flex items-center gap-2 cursor-pointer"
            >
              <Zap size={16} className="text-amber-400" />
              Launch Paper Demo
            </button>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section id="faqs" className="relative z-10 py-20 px-6 max-w-4xl mx-auto border-t border-slate-800/80">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-extrabold text-slate-100">Frequently Asked Questions</h2>
          <p className="text-xs text-slate-400 mt-2 font-mono uppercase tracking-wider">
            Clear Answers on AAOIFI Screening, Execution, and Compliance
          </p>
        </div>

        <div className="space-y-3">
          {faqs.map((faq, idx) => (
            <div
              key={idx}
              className="bg-slate-900/70 border border-slate-800/80 rounded-xl overflow-hidden backdrop-blur-md transition-colors"
            >
              <button
                onClick={() => toggleFaq(idx)}
                className="w-full p-5 text-left flex justify-between items-center text-sm font-semibold text-slate-200 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                <span>{faq.q}</span>
                {activeFaq === idx ? (
                  <ChevronUp size={18} className="text-emerald-400 flex-shrink-0 ml-4" />
                ) : (
                  <ChevronDown size={18} className="text-slate-400 flex-shrink-0 ml-4" />
                )}
              </button>
              {activeFaq === idx && (
                <div className="px-5 pb-5 text-xs text-slate-400 leading-relaxed border-t border-slate-800/60 pt-3.5 font-normal">
                  {faq.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Institutional Footer */}
      <footer className="relative z-10 border-t border-slate-800/80 py-10 px-6 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>SHARIAHTRADING © {new Date().getFullYear()} · Spot Equity Halal Quantitative Engine</span>
          </div>
          <div>AAOIFI Standard No. 21 Compliant · 100% Long-Only Spot Equities</div>
        </div>
      </footer>

      {/* Interactive Broker Gateway Setup Modal */}
      <AnimatePresence>
        {showBrokerModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative text-slate-100"
            >
              <button
                onClick={() => setShowBrokerModal(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-100 p-1 cursor-pointer"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-emerald-950/80 border border-emerald-800 rounded-xl flex items-center justify-center text-emerald-400">
                  <Building2 size={20} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-100">Broker Gateway Setup</h3>
                  <p className="text-xs text-slate-400 font-mono">Select execution API target</p>
                </div>
              </div>

              <div className="space-y-3 my-5">
                <button
                  onClick={() => handleStartConnection("INTERACTIVE BROKERS (IBKR)")}
                  className="w-full p-4 bg-slate-950 border border-emerald-500/40 hover:border-emerald-400 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-100 flex items-center gap-2">
                      Interactive Brokers (IBKR TWS API)
                      <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-mono">
                        INSTITUTIONAL
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Automated spot equity execution & portfolio sync</div>
                  </div>
                  <ArrowRight size={16} className="text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => handleStartConnection("ALPACA SECURITIES")}
                  className="w-full p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-slate-100">Alpaca Securities API</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Commission-free equity trading API</div>
                  </div>
                  <ArrowRight size={16} className="text-slate-400 group-hover:translate-x-1 transition-transform" />
                </button>

                <button
                  onClick={() => handleStartConnection("DEMO CONSOLE")}
                  className="w-full p-4 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-left transition-all flex items-center justify-between group cursor-pointer"
                >
                  <div>
                    <div className="text-xs font-bold text-amber-400 flex items-center gap-1.5 font-mono">
                      <Zap size={14} /> Demo Console (Sandbox Mode)
                    </div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Instant browser simulation with paper funds</div>
                  </div>
                  <ArrowRight size={16} className="text-amber-400 group-hover:translate-x-1 transition-transform" />
                </button>
              </div>

              <div className="text-[11px] text-slate-500 text-center font-mono flex items-center justify-center gap-1">
                <Lock size={12} className="text-emerald-400" />
                Encrypted Local Authentication · Zero Third-Party Custody
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
