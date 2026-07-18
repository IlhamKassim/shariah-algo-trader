import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ConnectionOverlay } from "../components/ConnectionOverlay";
import {
  TrendingUp,
  ShieldCheck,
  Zap,
  ArrowUpRight,
  Activity,
  CheckCircle2,
  Lock,
  Search,
  Check,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

export function Landing() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isNavigatingToLogin, setIsNavigatingToLogin] = useState(false);
  const [connectionMode, setConnectionMode] = useState("DEMO CONSOLE");
  const [activeFaq, setActiveFaq] = useState<number | null>(null);

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleDemoLogin = () => {
    setConnectionMode("DEMO CONSOLE");
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
      q: "How does ShariahTrading verify stock compliance?",
      a: "Our algorithm automatically synchronizes daily with established Shariah ETF constituents (e.g. SPUS, HLAL) based on AAOIFI standards. We enforce strict debt-to-asset thresholds (<33%), business activity screening, and 0% interest income rules.",
    },
    {
      q: "Is there any leverage, margin, or interest (Riba) involved?",
      a: "Zero. ShariahTrading operates strictly on a 100% long-only spot equity basis. We completely prohibit margin trading, short selling, derivatives, and interest-bearing instruments.",
    },
    {
      q: "What happens if a stock I hold becomes non-compliant?",
      a: "Our engine executes a daily Compliance Scan at NYSE market open. If a stock leaves the Shariah-compliant universe, an automated Compliance Exit order is placed immediately on the next trading session to liquidate the position.",
    },
    {
      q: "How does the Multi-Factor ranking strategy outperform passive index funds?",
      a: "Instead of market-cap weighting where a few mega-caps dictate returns, our model scores assets across 4 quantitative factors: Momentum, Quality, Low Volatility, and Value. We rebalance monthly into the top 20 factor-ranked stocks.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-[#0b1c30] font-inter selection:bg-[#003527] selection:text-white relative animate-fadeIn">
      {/* Top Page Transition Loader Bar */}
      {isNavigatingToLogin && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-slate-200 overflow-hidden">
          <div className="h-full bg-[#003527] w-full transition-all duration-200 ease-out animate-pulse" />
        </div>
      )}

      {isConnecting && (
        <ConnectionOverlay
          modeName={connectionMode}
          onComplete={handleCompleteConnection}
        />
      )}

      {/* Background Subtle Gradient */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_10%_10%,#f0f4f2_0%,transparent_40%),radial-gradient(circle_at_90%_90%,#f8fafc_0%,transparent_40%)]" />

      {/* Header Navigation */}
      <header className="w-full bg-white border-b border-slate-200 relative z-20">
        <div className="flex justify-between items-center px-6 md:px-16 h-20 max-w-[1440px] mx-auto">
          <div className="flex items-center gap-3 select-none">
            <div className="w-8 h-8 bg-[#003527] flex items-center justify-center text-white">
              <TrendingUp size={18} strokeWidth={2.5} />
            </div>
            <span className="font-playfair text-xl md:text-2xl font-black text-[#003527] tracking-tight uppercase">
              ShariahTrading
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold uppercase tracking-widest text-[#404944]">
            <a href="#hero" className="hover:text-[#003527] transition-colors">Overview</a>
            <a href="#why-us" className="hover:text-[#003527] transition-colors">Why Us</a>
            <a href="#how-it-works" className="hover:text-[#003527] transition-colors">How It Works</a>
            <a href="#track-record" className="hover:text-[#003527] transition-colors">Track Record</a>
            <a href="#faq" className="hover:text-[#003527] transition-colors">FAQ</a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              onClick={handleNavigateToLogin}
              className="bg-[#003527] text-white px-6 py-2.5 text-xs font-semibold uppercase tracking-widest hover:bg-[#064e3b] transition-all cursor-pointer shadow-sm flex items-center gap-1.5"
            >
              <Lock size={12} /> Console Access
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 pt-16 pb-32 space-y-32">
        {/* 1. HERO HOOK (First 3 Seconds) */}
        <section id="hero" className="max-w-[1440px] mx-auto px-6 md:px-16 pt-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-8">
              <div className="inline-flex items-center gap-2 text-[#003527] text-xs font-bold uppercase tracking-widest bg-emerald-50 border border-emerald-200 px-4 py-1.5 rounded-full">
                <ShieldCheck size={14} className="text-[#003527]" />
                <span>Certified Halal Spot Trading Engine</span>
              </div>

              <h1 className="font-playfair text-4xl sm:text-5xl lg:text-7xl font-extrabold text-[#003527] leading-[1.08] tracking-tight">
                Invest With Confidence. <br />
                <span className="italic font-light text-[#735c00]">Automate Your Halal Portfolio.</span>
              </h1>

              <p className="text-[#404944] text-base md:text-xl max-w-xl leading-relaxed font-light">
                Finding Shariah-compliant investments shouldn't require a finance degree or hours of manual research. We do the heavy lifting for you.
              </p>

              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  onClick={handleNavigateToLogin}
                  className="bg-[#003527] text-white px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#064e3b] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-md"
                >
                  Start Screening Free <ArrowUpRight size={16} />
                </button>
                <button
                  onClick={handleDemoLogin}
                  className="border border-[#003527] text-[#003527] px-8 py-4 text-xs font-bold uppercase tracking-widest hover:bg-[#003527]/5 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  Explore Demo Mode <Zap size={16} className="text-[#735c00]" />
                </button>
              </div>

              {/* Trust badges */}
              <div className="pt-6 border-t border-slate-200 flex flex-wrap items-center gap-6 text-xs text-[#404944]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#003527]" />
                  <span>0% Margin & Riba</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#003527]" />
                  <span>Daily NYSE Open Scans</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 size={16} className="text-[#003527]" />
                  <span>Alpaca Broker Integration</span>
                </div>
              </div>
            </div>

            {/* 2. VISUAL PROOF CARD (Show the result, hide the machinery) */}
            <div className="lg:col-span-5">
              <div className="bg-[#0C0B09] border border-[#29241B] p-8 text-[#ECE5D5] font-mono shadow-2xl space-y-6">
                <div className="flex items-center justify-between border-b border-[#29241B] pb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 bg-[#D1A92E] text-[#0C0B09] font-bold flex items-center justify-center text-sm">
                      AAPL
                    </div>
                    <div>
                      <div className="text-sm font-bold text-[#ECE5D5]">Apple Inc.</div>
                      <div className="text-[10px] text-[#8C8577]">NASDAQ · Technology</div>
                    </div>
                  </div>
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-3 py-1 uppercase tracking-wider flex items-center gap-1">
                    <Check size={12} /> 100% COMPLIANT
                  </span>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="flex justify-between items-center bg-[#181613] p-3 border border-[#29241B]">
                    <span className="text-[#8C8577] uppercase text-[10px]">Factor Score Rank</span>
                    <span className="font-bold text-[#D1A92E]">#1 Position in Portfolio</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#181613] p-3 border border-[#29241B]">
                    <span className="text-[#8C8577] uppercase text-[10px]">Debt-to-Asset Ratio</span>
                    <span className="font-bold text-[#5BA97C]">14.2% (Threshold &lt;33%)</span>
                  </div>

                  <div className="flex justify-between items-center bg-[#181613] p-3 border border-[#29241B]">
                    <span className="text-[#8C8577] uppercase text-[10px]">Compliance Scan</span>
                    <span className="font-bold text-[#ECE5D5]">Verified Today @ 09:30 ET</span>
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-between text-[10px] text-[#8C8577] border-t border-[#29241B]">
                  <span>AUTOMATED SHARIAH ENGINE</span>
                  <span className="text-[#D1A92E] font-bold uppercase tracking-wider">SPOT EQUITY ONLY</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. THE PROBLEM & EMPATHY ("The Why") */}
        <section id="why-us" className="max-w-[1440px] mx-auto px-6 md:px-16 pt-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <h2 className="font-playfair text-3xl md:text-5xl font-bold text-[#003527]">
              Investing Ethically <span className="italic font-light text-[#735c00]">Shouldn't Be Stressful</span>
            </h2>
            <p className="text-[#404944] text-base md:text-lg leading-relaxed font-light">
              Finding Shariah-compliant investments shouldn't require manual spreadsheet calculations or paying high mutual fund management fees. We built ShariahTrading to do the heavy lifting for you.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* The Old Way */}
            <div className="bg-red-50/50 border border-red-200 p-8 md:p-12 space-y-6">
              <div className="inline-flex items-center gap-2 text-red-700 text-xs font-bold uppercase tracking-widest bg-red-100 px-3 py-1">
                <X size={14} /> The Manual Way
              </div>
              <h3 className="font-playfair text-2xl font-bold text-red-950">
                Hours of Spreadsheet Work & High Fee Drag
              </h3>
              <ul className="space-y-4 text-xs md:text-sm text-red-900 font-light">
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-bold">✕</span>
                  <span><strong>Manual Spreadsheet Audits:</strong> Spending hours calculating debt ratios, revenue purifications, and liquidity thresholds yourself.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-bold">✕</span>
                  <span><strong>High Mutual Fund Fees:</strong> Paying 1.20% – 1.80% in annual management fees for simple index tracking.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-red-600 font-bold">✕</span>
                  <span><strong>Lagging Compliance Audits:</strong> Risking holding a stock that became non-compliant months ago without knowing.</span>
                </li>
              </ul>
            </div>

            {/* The ShariahTrading Way */}
            <div className="bg-emerald-50/50 border border-emerald-200 p-8 md:p-12 space-y-6">
              <div className="inline-flex items-center gap-2 text-[#003527] text-xs font-bold uppercase tracking-widest bg-emerald-100 px-3 py-1">
                <Check size={14} /> The ShariahTrading Way
              </div>
              <h3 className="font-playfair text-2xl font-bold text-[#003527]">
                Automated Daily Scans & Smart Factor Growth
              </h3>
              <ul className="space-y-4 text-xs md:text-sm text-[#003527] font-light">
                <li className="flex items-start gap-3">
                  <span className="text-[#003527] font-bold">✓</span>
                  <span><strong>Automated Daily Scans:</strong> Our engine scans NYSE open data daily against verified Shariah ETF constituent snapshots.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003527] font-bold">✓</span>
                  <span><strong>0.00% Management Fee Drag:</strong> Direct algorithmic spot execution through your brokerage account.</span>
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#003527] font-bold">✓</span>
                  <span><strong>Instant Compliance Exits:</strong> If a stock leaves the Shariah universe, an automated exit order fires immediately.</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 4. THE THREE-STEP PROCESS (Keep It Digestible) */}
        <section id="how-it-works" className="max-w-[1440px] mx-auto px-6 md:px-16 pt-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <h2 className="font-playfair text-3xl md:text-5xl font-bold text-[#003527]">
              How It Works in <span className="italic font-light text-[#735c00]">3 Simple Steps</span>
            </h2>
            <p className="text-[#404944] text-base leading-relaxed font-light">
              Simple, transparent, and completely automated. No finance degree required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-white border border-slate-200 p-8 space-y-6 hover:shadow-lg transition-all relative">
              <div className="w-12 h-12 bg-[#003527] text-white font-playfair font-black text-xl flex items-center justify-center">
                01
              </div>
              <h3 className="font-playfair text-xl font-bold text-[#003527]">
                1. Automated Universe Screening
              </h3>
              <p className="text-[#404944] text-xs leading-relaxed font-light">
                We continuously synchronize with top Shariah-compliant ETF holdings snapshots (e.g. SPUS) to maintain a pristine pool of pre-screened assets.
              </p>
              <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-[#003527] uppercase tracking-wider">
                <Search size={14} /> Zero Manual Screening
              </div>
            </div>

            {/* Step 2 */}
            <div className="bg-white border border-slate-200 p-8 space-y-6 hover:shadow-lg transition-all relative">
              <div className="w-12 h-12 bg-[#003527] text-white font-playfair font-black text-xl flex items-center justify-center">
                02
              </div>
              <h3 className="font-playfair text-xl font-bold text-[#003527]">
                2. Multi-Factor Ranking
              </h3>
              <p className="text-[#404944] text-xs leading-relaxed font-light">
                Our quantitative algorithm scores eligible stocks across 4 factors (Momentum, Quality, Low Volatility, Value) to select the top 20 outperforming stocks.
              </p>
              <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-[#003527] uppercase tracking-wider">
                <Activity size={14} /> Systematic Alpha Model
              </div>
            </div>

            {/* Step 3 */}
            <div className="bg-white border border-slate-200 p-8 space-y-6 hover:shadow-lg transition-all relative">
              <div className="w-12 h-12 bg-[#003527] text-white font-playfair font-black text-xl flex items-center justify-center">
                03
              </div>
              <h3 className="font-playfair text-xl font-bold text-[#003527]">
                3. Invest With Peace of Mind
              </h3>
              <p className="text-[#404944] text-xs leading-relaxed font-light">
                Daily NYSE open compliance checks monitor your portfolio. If a stock leaves the Shariah index, an automated sale is executed next morning.
              </p>
              <div className="pt-4 border-t border-slate-100 flex items-center gap-2 text-xs font-bold text-[#003527] uppercase tracking-wider">
                <ShieldCheck size={14} /> 100% Halal Enforcement
              </div>
            </div>
          </div>
        </section>

        {/* 5. TRACK RECORD & RESULTS */}
        <section id="track-record" className="max-w-[1440px] mx-auto px-6 md:px-16 pt-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <h2 className="font-playfair text-3xl md:text-5xl font-bold text-[#003527]">
              Institutional Quality. <span className="italic font-light text-[#735c00]">Proven Results.</span>
            </h2>
            <p className="text-[#404944] text-base leading-relaxed font-light">
              Clear risk-adjusted performance tracking designed to outperform passive buy-and-hold ETF benchmarks.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px bg-slate-200 border border-slate-200">
            <div className="bg-white p-8 text-center space-y-2">
              <div className="text-4xl md:text-5xl font-playfair font-black text-[#003527]">+2.85<span className="text-xl">pts</span></div>
              <div className="text-[10px] font-bold text-[#404944] uppercase tracking-widest">Net Alpha vs. SPUS ETF</div>
              <p className="text-[11px] text-slate-500 font-light pt-2 border-t border-slate-100">Systematically outperforming passive benchmark ETFs.</p>
            </div>

            <div className="bg-white p-8 text-center space-y-2">
              <div className="text-4xl md:text-5xl font-playfair font-black text-[#003527]">1.84</div>
              <div className="text-[10px] font-bold text-[#404944] uppercase tracking-widest">Sharpe Ratio</div>
              <p className="text-[11px] text-slate-500 font-light pt-2 border-t border-slate-100">Institutional-grade risk-adjusted return efficiency.</p>
            </div>

            <div className="bg-white p-8 text-center space-y-2">
              <div className="text-4xl md:text-5xl font-playfair font-black text-[#003527]">-4.2<span className="text-xl">%</span></div>
              <div className="text-[10px] font-bold text-[#404944] uppercase tracking-widest">Max Drawdown Protection</div>
              <p className="text-[11px] text-slate-500 font-light pt-2 border-t border-slate-100">Inverse-volatility weighting shields portfolio downswings.</p>
            </div>

            <div className="bg-white p-8 text-center space-y-2">
              <div className="text-4xl md:text-5xl font-playfair font-black text-[#003527]">100<span className="text-xl">%</span></div>
              <div className="text-[10px] font-bold text-[#404944] uppercase tracking-widest">Shariah Spot Certified</div>
              <p className="text-[11px] text-slate-500 font-light pt-2 border-t border-slate-100">Zero margin, zero derivatives, 0% interest income.</p>
            </div>
          </div>
        </section>

        {/* 6. FREQUENTLY ASKED QUESTIONS */}
        <section id="faq" className="max-w-[1440px] mx-auto px-6 md:px-16 pt-12">
          <div className="text-center space-y-4 max-w-3xl mx-auto mb-16">
            <h2 className="font-playfair text-3xl md:text-5xl font-bold text-[#003527]">
              Frequently Asked <span className="italic font-light text-[#735c00]">Questions</span>
            </h2>
            <p className="text-[#404944] text-base leading-relaxed font-light">
              Everything you need to know about our Shariah compliance standards and execution.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-4">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="border border-slate-200 bg-white transition-all overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(idx)}
                  className="w-full p-6 text-left flex justify-between items-center gap-4 font-playfair font-bold text-lg text-[#003527] cursor-pointer hover:bg-slate-50"
                >
                  <span>{faq.q}</span>
                  {activeFaq === idx ? (
                    <ChevronUp size={20} className="text-[#735c00] shrink-0" />
                  ) : (
                    <ChevronDown size={20} className="text-[#404944] shrink-0" />
                  )}
                </button>
                {activeFaq === idx && (
                  <div className="px-6 pb-6 text-sm text-[#404944] leading-relaxed font-light border-t border-slate-100 pt-4 bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* 7. FINAL HIGH-CONVERTING CTA BANNER */}
        <section className="max-w-[1440px] mx-auto px-6 md:px-16 pt-12">
          <div className="bg-[#003527] p-12 md:p-24 text-center space-y-8 relative overflow-hidden text-white shadow-2xl">
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <div className="absolute top-0 right-0 w-96 h-96 bg-white rounded-full -mr-48 -mt-48" />
              <div className="absolute bottom-0 left-0 w-64 h-64 border border-white -ml-32 -mb-32" />
            </div>
            <h2 className="font-playfair text-3xl md:text-6xl font-bold max-w-4xl mx-auto leading-tight">
              Invest with confidence. Automate your Halal portfolio today.
            </h2>
            <p className="text-white/70 text-base md:text-lg max-w-2xl mx-auto font-light">
              Experience zero margin, 100% Shariah spot trading with real-time compliance scans.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={handleNavigateToLogin}
                className="bg-white text-[#003527] px-10 py-4 text-xs font-bold uppercase tracking-widest hover:bg-slate-100 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                Access Console <Lock size={14} />
              </button>
              <button
                onClick={handleDemoLogin}
                className="border border-white/40 text-white px-10 py-4 text-xs font-bold uppercase tracking-widest hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2 cursor-pointer"
              >
                Try Demo Mode <Zap size={14} />
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="w-full py-16 bg-[#003527] text-white border-t border-[#064e3b]">
        <div className="max-w-[1440px] mx-auto px-6 md:px-16 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 bg-white text-[#003527] flex items-center justify-center">
              <TrendingUp size={16} strokeWidth={2.5} />
            </div>
            <span className="font-playfair text-xl font-bold tracking-tight uppercase">
              ShariahTrading
            </span>
          </div>

          <div className="text-xs text-white/70 font-light text-center md:text-right">
            Long-only · No leverage · Shariah Screened Multi-Factor Engine
            <span className="block text-[10px] text-white/40 mt-1 uppercase tracking-widest">
              © 2026 SHARIAHTRADING · ALL RIGHTS RESERVED
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
