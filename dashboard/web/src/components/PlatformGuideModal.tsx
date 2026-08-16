import { useState, useEffect } from "react";
import {
  X,
  TrendingUp,
  ShieldCheck,
  Scale,
  Lock,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Layers,
  RotateCcw,
  Sliders,
  Sparkles,
  Zap,
} from "lucide-react";

interface PlatformGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const TABS = [
  { id: "factors", label: "1. 4-Factor Engine", icon: TrendingUp },
  { id: "compliance", label: "2. AAOIFI Shariah", icon: ShieldCheck },
  { id: "portfolio", label: "3. Portfolio & Sizing", icon: Scale },
  { id: "execution", label: "4. Execution & Safety", icon: Lock },
];

export function PlatformGuideModal({ isOpen, onClose }: PlatformGuideModalProps) {
  const [activeTab, setActiveTab] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(() => {
    return localStorage.getItem("shariah_guide_seen") === "true";
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleCheckboxChange = (checked: boolean) => {
    setDontShowAgain(checked);
    if (checked) {
      localStorage.setItem("shariah_guide_seen", "true");
    } else {
      localStorage.removeItem("shariah_guide_seen");
    }
  };

  const handleNext = () => {
    if (activeTab < TABS.length - 1) {
      setActiveTab((prev) => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (activeTab > 0) {
      setActiveTab((prev) => prev - 1);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-2xl animate-fadeIn">
      {/* Modal Container: Pure Obsidian Black with Emerald Structure */}
      <div className="relative w-full max-w-4xl bg-[#060A08] border border-[#16382E] shadow-[0_30px_100px_rgba(0,0,0,0.95)] overflow-hidden flex flex-col max-h-[90vh] text-[#F0FDF4]">
        
        {/* Subtle top emerald hairline glow */}
        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-emerald-500/50 to-transparent" />

        {/* Top Header Bar */}
        <div className="relative z-10 px-6 sm:px-8 py-6 border-b border-[#16382E] bg-[#090E0C] flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest border border-[#1F4A3E] px-2 py-0.5 bg-[#0D1512]">
                AAOIFI Architecture Guide
              </span>
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-emerald-400/80 uppercase tracking-widest">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                Live System Specification
              </span>
            </div>
            <h2 className="font-serif text-2xl sm:text-3xl text-[#F0FDF4] font-normal leading-tight">
              How Shariah Algo Trader Works
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="border border-[#16382E] bg-[#0A100E] p-2 text-emerald-400 hover:text-[#F0FDF4] hover:border-emerald-500/40 hover:bg-[#121B17] transition-all cursor-pointer"
            title="Close guide"
          >
            <X size={18} />
          </button>
        </div>

        {/* Segmented Architectural Tabs */}
        <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 border-b border-[#16382E] bg-[#070C0A]">
          {TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === idx;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(idx)}
                className={`px-4 py-3.5 font-mono text-[11px] uppercase tracking-widest flex items-center justify-center gap-2 border-b-2 transition-all cursor-pointer ${
                  isActive
                    ? "text-[#F0FDF4] border-emerald-400 bg-[#0E1714] font-semibold"
                    : "text-emerald-500/60 border-transparent hover:text-emerald-300 hover:bg-[#0A110E]"
                }`}
              >
                <Icon size={14} className={isActive ? "text-emerald-400" : "text-emerald-500/50"} />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Body */}
        <div className="relative z-10 flex-1 overflow-y-auto p-6 sm:p-8 space-y-6 text-sm text-slate-300">
          
          {/* TAB 1: 4-Factor Scoring Model */}
          {activeTab === 0 && (
            <div className="space-y-6">
              <div className="border-b border-[#16382E] pb-4">
                <h3 className="font-serif text-xl sm:text-2xl text-[#F0FDF4] font-normal mb-2 flex items-center gap-2">
                  <TrendingUp className="text-emerald-400" size={20} />
                  The 4-Factor Quantitative Scoring Model
                </h3>
                <p className="font-sans text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Every stock in the Shariah Eligible Universe is ranked through a multi-factor quantitative engine. Each factor generates a normalized cross-sectional z-score, combined with equal 25% weights to construct the optimal portfolio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Momentum */}
                <div className="bg-[#090E0C] border border-[#16382E] p-5 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#16382E] pb-2 mb-3">
                      <span className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                        <TrendingUp size={14} className="text-emerald-400" /> Momentum
                      </span>
                      <span className="font-mono text-[10px] text-emerald-300 border border-emerald-500/30 bg-[#0E1714] px-2 py-0.5">
                        25% WEIGHT
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      Calculates 12-month trailing return minus the 1-month short-term reversal (R_12m - R_1m) to capture intermediate momentum while eliminating noise.
                    </p>
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400/70 mt-4 pt-2 border-t border-[#16382E] flex justify-between">
                    <span>Horizon: 252 trading days</span>
                    <span>Reversal filter: 21d</span>
                  </div>
                </div>

                {/* Quality */}
                <div className="bg-[#090E0C] border border-[#16382E] p-5 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#16382E] pb-2 mb-3">
                      <span className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                        <ShieldCheck size={14} className="text-emerald-400" /> Quality
                      </span>
                      <span className="font-mono text-[10px] text-emerald-300 border border-emerald-500/30 bg-[#0E1714] px-2 py-0.5">
                        25% WEIGHT
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      Evaluates operational health: Return on Equity (ROE), operating margins, and earnings stability. Rewards durable, cash-flow generative balance sheets.
                    </p>
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400/70 mt-4 pt-2 border-t border-[#16382E] flex justify-between">
                    <span>ROE &gt; 12% target</span>
                    <span>Debt/Assets &lt; 0.33</span>
                  </div>
                </div>

                {/* Low Volatility */}
                <div className="bg-[#090E0C] border border-[#16382E] p-5 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#16382E] pb-2 mb-3">
                      <span className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                        <Scale size={14} className="text-emerald-400" /> Low Volatility
                      </span>
                      <span className="font-mono text-[10px] text-emerald-300 border border-emerald-500/30 bg-[#0E1714] px-2 py-0.5">
                        25% WEIGHT
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      Measures trailing 252-day annualized standard deviation. Lower volatility stocks receive higher z-scores to dampen downside drawdowns during volatility spikes.
                    </p>
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400/70 mt-4 pt-2 border-t border-[#16382E] flex justify-between">
                    <span>Annualized Std Dev</span>
                    <span>Downside mitigation</span>
                  </div>
                </div>

                {/* Value */}
                <div className="bg-[#090E0C] border border-[#16382E] p-5 flex flex-col justify-between hover:border-emerald-500/30 transition-colors">
                  <div>
                    <div className="flex items-center justify-between border-b border-[#16382E] pb-2 mb-3">
                      <span className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                        <Zap size={14} className="text-emerald-400" /> Value
                      </span>
                      <span className="font-mono text-[10px] text-emerald-300 border border-emerald-500/30 bg-[#0E1714] px-2 py-0.5">
                        25% WEIGHT
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">
                      Analyzes valuation multiples including Earnings Yield and Free Cash Flow Yield to prevent accumulating overvalued, speculative assets.
                    </p>
                  </div>
                  <div className="font-mono text-[10px] text-emerald-400/70 mt-4 pt-2 border-t border-[#16382E] flex justify-between">
                    <span>Forward P/E &amp; EV/EBIT</span>
                    <span>FCF Yield filter</span>
                  </div>
                </div>
              </div>

              {/* Composite Score Terminal Strip */}
              <div className="bg-[#040705] border border-[#16382E] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 font-mono text-xs">
                <span className="text-[10px] text-emerald-400/80 uppercase tracking-widest">
                  COMPOSITE FACTOR FORMULA
                </span>
                <span className="text-emerald-300 font-semibold text-xs tracking-wider">
                  Score = 0.25·Z(Mom) + 0.25·Z(Qual) + 0.25·Z(LowVol) + 0.25·Z(Value)
                </span>
              </div>
            </div>
          )}

          {/* TAB 2: Shariah Compliance Screening */}
          {activeTab === 1 && (
            <div className="space-y-6">
              <div className="border-b border-[#16382E] pb-4">
                <h3 className="font-serif text-xl sm:text-2xl text-[#F0FDF4] font-normal mb-2 flex items-center gap-2">
                  <ShieldCheck className="text-emerald-400" size={20} />
                  AAOIFI Shariah Compliance Engine
                </h3>
                <p className="font-sans text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Strict adherence to Islamic jurisprudence is programmed into the core execution pipeline. Every security is continuously audited against financial and business activity constraints.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#090E0C] border border-[#16382E] p-5 space-y-3">
                  <div className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                    <CheckCircle2 size={15} className="text-emerald-400" /> 100% Spot Equities Only
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Long-only direct common stock ownership. The engine strictly prohibits margin borrowing, short selling, leverage, options, warrants, and derivative instruments.
                  </p>
                  <div className="font-mono text-[10px] text-emerald-400/80 bg-[#040705] p-2 border border-[#16382E]">
                    Zero Margin · Zero Leverage · Zero Riba
                  </div>
                </div>

                <div className="bg-[#090E0C] border border-[#16382E] p-5 space-y-3">
                  <div className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                    <Layers size={15} className="text-emerald-400" /> Verified Shariah Universe
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Trading eligibility is strictly constrained to the live constituent holdings of certified Shariah benchmark ETFs (e.g. SPUS / HLAL).
                  </p>
                  <div className="font-mono text-[10px] text-emerald-400/80 bg-[#040705] p-2 border border-[#16382E]">
                    Universe: S&amp;P 500 Shariah Index / SPUS
                  </div>
                </div>
              </div>

              {/* Automated Exit Box */}
              <div className="bg-[#040705] border border-emerald-500/40 p-5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-semibold text-emerald-300 uppercase flex items-center gap-2">
                    <RotateCcw size={14} /> Daily Automated Compliance Exit (09:30 AM ET)
                  </span>
                  <span className="font-mono text-[10px] text-[#F0FDF4] bg-[#0E1714] px-2 py-0.5 border border-emerald-500/40">
                    AAOIFI RULE
                  </span>
                </div>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Every trading day at market open, the bot validates currently held positions against the refreshed ETF constituent list. If any held stock falls out of Shariah compliance for any financial ratio or business reason, the engine triggers an immediate market liquidation order. The slot remains in cash until the next regular monthly rebalance.
                </p>
              </div>
            </div>
          )}

          {/* TAB 3: Portfolio Construction & Rebalance */}
          {activeTab === 2 && (
            <div className="space-y-6">
              <div className="border-b border-[#16382E] pb-4">
                <h3 className="font-serif text-xl sm:text-2xl text-[#F0FDF4] font-normal mb-2 flex items-center gap-2">
                  <Scale className="text-emerald-400" size={20} />
                  Portfolio Construction &amp; Rebalancing Rules
                </h3>
                <p className="font-sans text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Translating quantitative factor z-scores into an institutional, risk-managed 20-stock spot equity portfolio.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-[#090E0C] border border-[#16382E] p-5 space-y-2">
                  <div className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                    <Sliders size={14} className="text-emerald-400" /> Top-20 Selection
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    The 20 highest-ranked securities by composite factor score enter the active portfolio each month.
                  </p>
                  <div className="font-mono text-[10px] text-emerald-400/80 pt-2 border-t border-[#16382E]">
                    Target Holdings: 20 Equities
                  </div>
                </div>

                <div className="bg-[#090E0C] border border-[#16382E] p-5 space-y-2">
                  <div className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                    <Scale size={14} className="text-emerald-400" /> Inverse-Vol Sizing
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Positions are weighted inversely to volatility. More volatile stocks receive smaller allocations, capped at 10% maximum.
                  </p>
                  <div className="font-mono text-[10px] text-emerald-400/80 pt-2 border-t border-[#16382E]">
                    Max Position Weight: 10%
                  </div>
                </div>

                <div className="bg-[#090E0C] border border-[#16382E] p-5 space-y-2">
                  <div className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                    <ShieldCheck size={14} className="text-emerald-400" /> 20% Sector Cap
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Total sector exposure (e.g. Technology, Health Care) is strictly capped at 20% to prevent over-concentration.
                  </p>
                  <div className="font-mono text-[10px] text-emerald-400/80 pt-2 border-t border-[#16382E]">
                    Diversification Boundary: 20%
                  </div>
                </div>
              </div>

              {/* Drift Buffer Explanation */}
              <div className="bg-[#040705] border border-[#16382E] p-5 space-y-2">
                <span className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                  Monthly Execution Schedule &amp; 3% Drift Threshold
                </span>
                <p className="text-xs text-slate-300 leading-relaxed font-sans">
                  Monthly rebalancing occurs on the first NYSE trading day of each month. Position re-allocations are gated by a **3% drift threshold** (orders are only dispatched if a stock's actual weight deviates from its target by &gt;3%), protecting returns from excessive transaction costs and turnover drag.
                </p>
              </div>
            </div>
          )}

          {/* TAB 4: Execution & Safety */}
          {activeTab === 3 && (
            <div className="space-y-6">
              <div className="border-b border-[#16382E] pb-4">
                <h3 className="font-serif text-xl sm:text-2xl text-[#F0FDF4] font-normal mb-2 flex items-center gap-2">
                  <Lock className="text-emerald-400" size={20} />
                  Non-Custodial Architecture &amp; Broker Execution
                </h3>
                <p className="font-sans text-sm text-slate-300 leading-relaxed max-w-3xl">
                  Trades are executed directly in your personal brokerage account with zero third-party custody of user capital.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#090E0C] border border-[#16382E] p-5 space-y-2">
                  <div className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                    <Zap size={14} className="text-emerald-400" /> Multi-Tenant Execution
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Each user operates on an isolated runtime tenant. Orders are routed independently to your Alpaca account via direct REST/WebSocket gateways.
                  </p>
                </div>

                <div className="bg-[#090E0C] border border-[#16382E] p-5 space-y-2">
                  <div className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2">
                    <Lock size={14} className="text-emerald-400" /> AES-256 GCM Cryptography
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed font-sans">
                    Broker API keys and secrets are encrypted at rest with authenticated AES-256 GCM and never exposed in logs or client-side responses.
                  </p>
                </div>
              </div>

              {/* Sandbox Card */}
              <div className="bg-[#040705] border border-[#16382E] p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <span className="font-mono text-xs font-semibold text-[#F0FDF4] uppercase flex items-center gap-2 mb-1">
                    <Sparkles size={14} className="text-emerald-400" /> Alpaca Paper Trading Sandbox
                  </span>
                  <p className="text-xs text-slate-300 font-sans">
                    Pilot accounts run safely in simulation mode with $100,000 in virtual paper funds before live trading.
                  </p>
                </div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-300 border border-emerald-500/40 px-3 py-1 bg-[#0E1714] shrink-0">
                  Risk-Free Node
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="relative z-10 px-6 sm:px-8 py-5 border-t border-[#16382E] bg-[#090E0C] flex flex-col sm:flex-row items-center justify-between gap-4">
          <label className="flex items-center gap-2.5 font-mono text-[11px] text-emerald-400/80 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={dontShowAgain}
              onChange={(e) => handleCheckboxChange(e.target.checked)}
              className="accent-emerald-400 w-4 h-4 bg-[#060A08] border border-[#16382E] cursor-pointer"
            />
            <span>Don't show this guide on startup</span>
          </label>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {activeTab > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="border border-[#16382E] bg-[#0A100E] hover:border-emerald-500/40 text-emerald-400 hover:text-[#F0FDF4] px-5 py-2.5 font-mono text-[11px] uppercase tracking-widest transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft size={14} /> Back
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="flex-1 sm:flex-none px-7 py-2.5 bg-emerald-400 hover:bg-emerald-300 text-[#041F16] font-mono text-[11px] uppercase tracking-widest font-bold transition-all shadow-lg shadow-emerald-500/10 flex items-center justify-center gap-2 cursor-pointer"
            >
              {activeTab === TABS.length - 1 ? (
                <>
                  <span>Got It, Let's Trade</span>
                  <CheckCircle2 size={14} />
                </>
              ) : (
                <>
                  <span>Next Step</span>
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
