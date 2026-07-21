import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectionOverlay } from "../components/ConnectionOverlay";
import { InteractiveAlgoTerminal } from "../components/InteractiveAlgoTerminal";
import { ContainerScroll } from "../components/ContainerScroll";
import { MeshDriftShaderBackground } from "../components/MeshDriftShaderBackground";
import {
  X,
  ChevronDown,
  ChevronUp,
  Search,
} from "lucide-react";

export function Landing() {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isNavigatingToLogin, setIsNavigatingToLogin] = useState(false);
  const [connectionMode, setConnectionMode] = useState("ALPACA PAPER");
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const universeStocks = [
    { ticker: "AAPL", name: "Apple Inc.", status: "Compliant", change: "+1.24%", price: "$224.50", compliant: true, spark: [50, 66, 33, 75, 100] },
    { ticker: "NVDA", name: "NVIDIA Corp.", status: "Compliant", change: "+3.55%", price: "$121.15", compliant: true, spark: [25, 50, 66, 83, 100] },
    { ticker: "JPM", name: "JPMorgan Chase", status: "Restricted", reason: "Core business violation", compliant: false },
    { ticker: "MSFT", name: "Microsoft Corp.", status: "Compliant", change: "+0.82%", price: "$440.32", compliant: true, spark: [66, 75, 50, 66, 75] },
    { ticker: "GOOGL", name: "Alphabet Inc.", status: "Compliant", change: "+1.12%", price: "$182.40", compliant: true, spark: [40, 55, 70, 60, 90] },
    { ticker: "BAC", name: "Bank of America", status: "Restricted", reason: "Interest banking prohibited", compliant: false },
    { ticker: "AMZN", name: "Amazon.com Inc.", status: "Compliant", change: "+1.45%", price: "$186.20", compliant: true, spark: [30, 45, 60, 80, 95] },
  ];

  const filteredStocks = universeStocks.filter(
    (s) =>
      s.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-transparent text-white font-sans overflow-x-hidden antialiased selection:bg-[#ffdca1] selection:text-black relative z-10">
      {/* Animated WebGL Mesh Drift Shader Background */}
      <MeshDriftShaderBackground />
      {/* Top Transition Loader */}
      {isNavigatingToLogin && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-[#1a1a1a] overflow-hidden">
          <div className="h-full bg-[#ffdca1] w-full transition-all duration-200 ease-out animate-pulse" />
        </div>
      )}

      {/* Connection Overlay Simulator */}
      {isConnecting && (
        <ConnectionOverlay
          modeName={connectionMode}
          onComplete={handleCompleteConnection}
        />
      )}

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-black/90 backdrop-blur-md border-b border-[#333333]">
        <div className="max-w-screen-2xl mx-auto flex justify-between items-center px-4 sm:px-12 py-4">
          <div className="flex items-center gap-12">
            <span className="text-[18px] font-playfair tracking-wider text-white uppercase font-normal">
              SHARIAHTRADING
            </span>
            <div className="hidden md:flex items-center gap-8">
              <a href="#compliance" className="text-white border-b border-white pb-1 font-mono text-[11px] uppercase tracking-widest">
                Compliance
              </a>
              <a href="#universe" className="text-[#a39d96] hover:text-white transition-colors duration-200 font-mono text-[11px] uppercase tracking-widest">
                Universe
              </a>
              <a href="#terminal" className="text-[#a39d96] hover:text-white transition-colors duration-200 font-mono text-[11px] uppercase tracking-widest">
                Terminal
              </a>
              <a href="#faqs" className="text-[#a39d96] hover:text-white transition-colors duration-200 font-mono text-[11px] uppercase tracking-widest">
                FAQs
              </a>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <button
              onClick={handleNavigateToLogin}
              className="text-white px-3 py-1 font-mono text-[11px] uppercase tracking-widest hover:text-[#a39d96] transition-colors cursor-pointer"
            >
              Login
            </button>
            <button
              onClick={() => setShowBrokerModal(true)}
              className="border border-white text-white px-6 py-2 hover:bg-white hover:text-black transition-all duration-300 font-mono text-[11px] uppercase tracking-widest cursor-pointer"
            >
              Start Trading
            </button>
          </div>
        </div>

        {/* Live Scrolling Ticker Bar */}
        <div className="w-full bg-[#111111]/80 border-t border-[#333333] overflow-hidden py-1.5 flex items-center">
          <div className="flex whitespace-nowrap animate-ticker font-mono text-[10px] uppercase tracking-widest text-[#a39d96]">
            <div className="flex items-center gap-8 px-8">
              <span>AAPL <span className="text-[#ffdca1]">+1.2%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>MSFT <span className="text-[#ffdca1]">+0.8%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>JPM <span className="text-[#ffb4ab] line-through">RESTRICTED</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>NVDA <span className="text-[#ffdca1]">+3.5%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>TSLA <span className="text-[#ffdca1]">+0.4%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>GOOGL <span className="text-[#ffdca1]">+1.1%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>META <span className="text-[#ffdca1]">+0.9%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>BAC <span className="text-[#ffb4ab] line-through">RESTRICTED</span></span>
            </div>
            <div className="flex items-center gap-8 px-8">
              <span>AAPL <span className="text-[#ffdca1]">+1.2%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>MSFT <span className="text-[#ffdca1]">+0.8%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>JPM <span className="text-[#ffb4ab] line-through">RESTRICTED</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>NVDA <span className="text-[#ffdca1]">+3.5%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>TSLA <span className="text-[#ffdca1]">+0.4%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>GOOGL <span className="text-[#ffdca1]">+1.1%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>META <span className="text-[#ffdca1]">+0.9%</span></span>
              <span className="w-1 h-1 bg-[#333333] rounded-full" />
              <span>BAC <span className="text-[#ffb4ab] line-through">RESTRICTED</span></span>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-40 md:pt-48">
        {/* Editorial Hero Grid */}
        <section className="px-4 sm:px-12 max-w-screen-2xl mx-auto mb-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 border-none">
            {/* Main Hero Text Block */}
            <div className="lg:col-span-8 bg-black/70 border border-[#333333] p-8 md:p-12 flex flex-col justify-between min-h-[520px] md:min-h-[600px]">
              <div>
                <div className="mb-8 inline-flex items-center gap-2 pb-2 border-b border-[#333333]">
                  <span className="font-mono text-[11px] text-[#a39d96] uppercase tracking-widest">
                    AAOIFI Compliant Ecosystem
                  </span>
                </div>
                <h1 className="font-playfair text-[48px] sm:text-[64px] lg:text-[88px] mb-8 text-white leading-none font-normal">
                  The Future of<br />
                  <span className="italic text-[#a39d96]">Ethical</span> Investing.
                </h1>
                <p className="font-sans text-lg text-[#a39d96] mb-12 leading-relaxed max-w-2xl border-l-2 border-[#ffdca1]/50 pl-6">
                  Institutional-grade algorithmic trading infrastructure designed strictly for Shariah-compliant portfolios. Automated screening, zero leverage, and purified returns.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={() => handleStartConnection("ALPACA PAPER")}
                  className="bg-white text-black font-medium px-8 py-3 font-mono text-[11px] uppercase tracking-widest hover:bg-[#a39d96] transition-all cursor-pointer text-center"
                >
                  Open Account
                </button>
                <button
                  onClick={() => setShowBrokerModal(true)}
                  className="border border-[#333333] text-white font-medium px-8 py-3 font-mono text-[11px] uppercase tracking-widest hover:border-white transition-all cursor-pointer text-center"
                >
                  View Gateway
                </button>
              </div>
            </div>

            {/* Right Side Widgets */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* System Status Widget */}
              <div className="bg-black/70 border border-[#333333] p-8 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-6 border-b border-[#333333] pb-2">
                  <span className="font-mono text-[10px] text-[#a39d96] tracking-widest uppercase">
                    System Status
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[10px] text-[#ffdca1] uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-[#ffdca1] animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="mb-4">
                  <span className="font-playfair text-[32px] text-white block">100% Halal</span>
                  <span className="font-mono text-[10px] text-[#a39d96] uppercase tracking-widest">
                    Portfolio Purity
                  </span>
                </div>
                <div className="space-y-3 mt-6">
                  <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-[#a39d96]">Engine</span>
                    <span className="text-white">AAOIFI_V2</span>
                  </div>
                  <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-[#a39d96]">Latency</span>
                    <span className="text-white">12ms</span>
                  </div>
                  <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-[#a39d96]">Last Scan</span>
                    <span className="text-white">Just Now</span>
                  </div>
                </div>
              </div>

              {/* Market Sentiment Widget */}
              <div className="bg-black/70 border border-[#333333] p-8 flex-1 flex flex-col justify-center">
                <div className="flex justify-between items-center mb-6 border-b border-[#333333] pb-2">
                  <span className="font-mono text-[10px] text-[#a39d96] tracking-widest uppercase">
                    Halal Universe Sentiment
                  </span>
                </div>
                <div className="flex items-end gap-2 h-20 mb-6">
                  <div className="w-1/6 bg-[#ffdca1]/20 h-[30%] hover:bg-[#ffdca1] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#ffdca1]/40 h-[50%] hover:bg-[#ffdca1] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#ffdca1]/60 h-[40%] hover:bg-[#ffdca1] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#ffdca1]/30 h-[70%] hover:bg-[#ffdca1] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#ffdca1]/80 h-[60%] hover:bg-[#ffdca1] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#ffdca1] h-[90%] hover:bg-[#ffdca1] transition-colors cursor-pointer" />
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-playfair text-[20px] text-white block">+2.4%</span>
                    <span className="font-mono text-[10px] text-[#a39d96] uppercase tracking-widest">
                      7 Day Avg
                    </span>
                  </div>
                  <span className="font-mono text-[10px] border border-[#ffdca1] text-[#ffdca1] px-2 py-1 tracking-widest uppercase">
                    Bullish
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Platform Interface Showcase */}
        <section id="terminal">
          <ContainerScroll
            titleComponent={
              <div className="flex flex-col items-center">
                <span className="font-mono text-[11px] text-[#ffdca1] uppercase tracking-[0.3em] mb-3">
                  Interactive Algorithmic Terminal
                </span>
                <h2 className="font-playfair text-[36px] sm:text-[56px] md:text-[68px] font-normal leading-tight text-white">
                  Unleash the power of<br />
                  <span className="italic text-[#a39d96]">Algorithmic Compliance.</span>
                </h2>
              </div>
            }
          >
            <InteractiveAlgoTerminal />
          </ContainerScroll>
        </section>

        {/* Compliance Section (Grid Based) */}
        <section id="compliance" className="py-16 px-4 sm:px-12 max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 border-none">
            <div className="lg:col-span-5 bg-black/70 border border-[#333333] p-8 md:p-12 flex flex-col justify-between min-h-[480px]">
              <div>
                <div className="text-[#a39d96] font-mono text-[11px] mb-6 uppercase tracking-widest flex items-center gap-3">
                  <span className="w-8 h-[1px] bg-[#a39d96]" />
                  Compliance-as-a-Service
                </div>
                <h2 className="font-playfair text-[36px] sm:text-[48px] mb-8 leading-tight text-white font-normal">
                  Screening that evolves<br />
                  <span className="italic text-[#a39d96]">with the market.</span>
                </h2>
                <p className="text-[#a39d96] mb-8 font-sans text-base leading-relaxed">
                  Our proprietary engine runs daily scans against AAOIFI and S&P Shariah standards. We don't just flag; we automate the purification process for fractional shares.
                </p>
              </div>
              <div className="border border-[#333333] p-6 bg-[#111111]/30">
                <div className="font-mono text-[10px] text-[#a39d96] tracking-widest uppercase mb-4">
                  Active Screening Parameters
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-white border-b border-[#333333]/60 pb-2">
                    <span>Debt / Total Assets</span>
                    <span className="text-[#ffdca1] font-mono font-semibold">&lt; 33%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-white border-b border-[#333333]/60 pb-2">
                    <span>Cash / Total Assets</span>
                    <span className="text-[#ffdca1] font-mono font-semibold">&lt; 33%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-white">
                    <span>Non-compliant Income</span>
                    <span className="text-[#ffdca1] font-mono font-semibold">&lt; 5%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Feature 1 */}
              <div className="bg-black/70 border border-[#333333] p-8 md:p-12 flex flex-col justify-between">
                <div>
                  <div className="font-playfair text-[40px] text-white/20 mb-6 border-b border-[#333333] pb-2 inline-block">
                    01
                  </div>
                  <h4 className="font-playfair text-[24px] text-white mb-3">Automated Screening</h4>
                  <p className="text-[#a39d96] font-sans text-sm leading-relaxed">
                    Daily balance sheet scans to ensure debt-to-equity ratios remain strictly below the 33% threshold, executing seamlessly in the background.
                  </p>
                </div>
                <div className="mt-8 border-t border-[#333333] pt-6 flex justify-between items-end">
                  <div>
                    <div className="font-mono text-[10px] text-[#a39d96] uppercase tracking-widest mb-1">
                      Debt/Equity Ratio
                    </div>
                    <div className="font-playfair text-white text-[28px]">28.4%</div>
                  </div>
                  <div className="w-1/2 h-[2px] bg-[#333333] relative">
                    <div className="absolute top-0 left-0 h-full bg-[#ffdca1] w-[85%]" />
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-black/70 border border-[#333333] p-8 md:p-12 flex flex-col justify-between">
                <div>
                  <div className="font-playfair text-[40px] text-white/20 mb-6 border-b border-[#333333] pb-2 inline-block">
                    02
                  </div>
                  <h4 className="font-playfair text-[24px] text-white mb-3">Dividend Purification</h4>
                  <p className="text-[#a39d96] font-sans text-sm leading-relaxed">
                    Automatic calculation and precise redirection of non-compliant income to verified charitable organizations, maintaining portfolio purity.
                  </p>
                </div>
                <div className="mt-8 border-t border-[#333333] pt-6">
                  <div className="font-mono text-[10px] text-[#a39d96] uppercase tracking-widest mb-2">
                    Purification Queue
                  </div>
                  <div className="flex items-center justify-between border border-[#333333] p-3 bg-[#111111]/40">
                    <span className="text-xs text-white font-mono">MSFT Div</span>
                    <span className="text-xs text-[#a39d96]">→</span>
                    <span className="text-xs text-[#ffdca1] font-mono">Charity</span>
                    <span className="font-mono text-[8px] bg-[#111111] text-[#ffdca1] px-2 py-0.5 uppercase border border-[#ffdca1]/30">
                      Pending
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Universe Interactive Preview */}
        <section id="universe" className="py-16 border-y border-[#333333] bg-[#050505]">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-12">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8">
              <div className="max-w-2xl">
                <h2 className="font-playfair text-[48px] sm:text-[64px] mb-4 leading-none font-normal">The Universe</h2>
                <p className="text-[#a39d96] font-sans text-lg">
                  Explore thousands of vetted equities. Our engine filters the noise so you focus on performance.
                </p>
              </div>
              <div className="w-full lg:w-auto border-b border-white pb-2 flex items-center gap-3">
                <Search size={16} className="text-[#a39d96]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter Ticker..."
                  className="bg-transparent border-none focus:outline-none focus:ring-0 text-lg w-full lg:w-64 p-0 text-white placeholder:text-[#333333] font-mono"
                />
              </div>
            </div>

            {/* Minimal List View */}
            <div className="flex flex-col border-t border-[#333333]">
              {filteredStocks.map((stock) => (
                <div
                  key={stock.ticker}
                  className={`group flex flex-col sm:flex-row justify-between items-start sm:items-center py-6 border-b border-[#333333] px-3 transition-colors ${
                    stock.compliant ? "hover:bg-[#111111]/50 cursor-pointer" : "opacity-50 grayscale"
                  }`}
                >
                  <div className="flex items-center gap-8 w-full sm:w-1/3">
                    <span className={`font-playfair text-[28px] sm:text-[32px] ${stock.compliant ? "group-hover:italic transition-all" : "line-through text-[#a39d96]"}`}>
                      {stock.ticker}
                    </span>
                    {stock.compliant ? (
                      <span className="font-mono text-[10px] border border-[#333333] px-2 py-1 tracking-widest uppercase text-[#a39d96]">
                        Compliant
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] border border-[#ffb4ab]/50 text-[#ffb4ab] px-2 py-1 tracking-widest uppercase">
                        Restricted
                      </span>
                    )}
                  </div>

                  <div className="text-[#a39d96] font-sans text-base w-full sm:w-1/3 mt-3 sm:mt-0">
                    {stock.name}
                  </div>

                  <div className="flex items-end justify-between sm:justify-end w-full sm:w-1/3 mt-3 sm:mt-0 text-right">
                    {stock.compliant ? (
                      <>
                        <div className="hidden md:flex items-end h-7 gap-[3px] mr-6">
                          {stock.spark?.map((h, i) => (
                            <div
                              key={i}
                              style={{ height: `${h}%` }}
                              className="w-[3px] bg-[#ffdca1]/60 group-hover:bg-[#ffdca1] transition-colors"
                            />
                          ))}
                        </div>
                        <span className="font-mono text-sm text-[#ffdca1] mr-6">{stock.change}</span>
                        <span className="font-playfair text-[22px] text-white font-mono">{stock.price}</span>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-[#ffb4ab]/80 italic">
                        {stock.reason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQs Section */}
        <section id="faqs" className="py-16 px-4 sm:px-12 max-w-4xl mx-auto border-t border-[#333333]">
          <div className="text-center mb-16">
            <h2 className="font-playfair text-[40px] sm:text-[48px] mb-2 font-normal">Engine Mechanics & Compliance FAQs</h2>
            <p className="text-[#a39d96] font-sans text-base">
              Technical answers regarding AAOIFI screening, leverage restrictions, and factor execution.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-[#333333] bg-[#111111]/30 transition-colors overflow-hidden"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-5 font-playfair text-lg text-white flex justify-between items-center gap-4 hover:bg-[#111111]/60 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {activeFaq === index ? (
                    <ChevronUp size={18} className="text-[#ffdca1] shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-[#a39d96] shrink-0" />
                  )}
                </button>

                <AnimatePresence>
                  {activeFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pb-5 text-[#a39d96] font-sans text-sm leading-relaxed border-t border-[#333333]/40 pt-4"
                    >
                      {faq.a}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ))}
          </div>
        </section>

        {/* Final Call to Action */}
        <section className="py-16 border-t border-[#333333] bg-[#050505]">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-12 flex flex-col items-center text-center">
            <h2 className="font-playfair text-[56px] sm:text-[80px] md:text-[96px] mb-8 leading-none font-normal">
              Ready to deploy.
            </h2>
            <p className="text-[#a39d96] mb-12 font-sans max-w-2xl text-lg">
              Join 500+ institutional and retail investors building the future of ethical finance. Get started in minutes.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-6 w-full sm:w-auto">
              <button
                onClick={() => handleStartConnection("ALPACA PAPER")}
                className="bg-white text-black font-medium px-10 py-4 font-mono text-[11px] uppercase tracking-widest hover:bg-[#a39d96] transition-all cursor-pointer"
              >
                Start Trading Now
              </button>
              <button
                onClick={() => setShowBrokerModal(true)}
                className="border border-[#333333] text-white font-medium px-10 py-4 font-mono text-[11px] uppercase tracking-widest hover:border-white transition-all cursor-pointer"
              >
                Schedule Demo
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#333333] bg-black pt-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-12 flex flex-col lg:flex-row justify-between items-start gap-12 pb-16">
          <div className="max-w-sm">
            <span className="font-playfair text-[24px] text-white uppercase tracking-widest mb-6 block border-b border-[#333333] pb-3">
              SHARIAHTRADING
            </span>
            <p className="text-[#a39d96] font-sans text-sm mb-8 leading-relaxed">
              Leading the transition to a debt-free, ethical investment landscape. Fully AAOIFI compliant.
            </p>
            <div className="flex gap-8 text-[#a39d96]">
              <span className="font-mono text-[10px] uppercase tracking-widest cursor-pointer hover:text-white">Global</span>
              <span className="font-mono text-[10px] uppercase tracking-widest cursor-pointer hover:text-white">Press</span>
              <span className="font-mono text-[10px] uppercase tracking-widest cursor-pointer hover:text-white">Journal</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-16 gap-y-8 font-mono text-[11px] uppercase tracking-widest">
            <div>
              <h5 className="text-[#a39d96] mb-6 border-b border-[#333333] pb-2">Platform</h5>
              <ul className="space-y-4 text-white">
                <li><a className="hover:text-[#a39d96] transition-colors" href="#compliance">Compliance Policy</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#universe">Universe Stats</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#terminal">Terminal Docs</a></li>
              </ul>
            </div>
            <div>
              <h5 className="text-[#a39d96] mb-6 border-b border-[#333333] pb-2">Legal</h5>
              <ul className="space-y-4 text-white">
                <li><a className="hover:text-[#a39d96] transition-colors" href="#">Terms of Service</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#">Privacy</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#">Risk Disclosure</a></li>
              </ul>
            </div>
          </div>
        </div>
      </footer>

      {/* Broker Connection Modal */}
      {showBrokerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
          <div className="bg-black border border-[#333333] p-6 md:p-8 max-w-md w-full relative">
            <button
              onClick={() => setShowBrokerModal(false)}
              className="absolute top-4 right-4 text-[#a39d96] hover:text-white cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="font-playfair text-2xl mb-2 text-white">Connect Trading Gateway</h3>
            <p className="text-[#a39d96] text-sm font-sans mb-6">
              Select your broker environment to sync AAOIFI compliance rules and factor strategy execution.
            </p>

            <div className="space-y-3">
              <button
                onClick={() => handleStartConnection("ALPACA PAPER")}
                className="w-full text-left p-4 border border-[#333333] hover:border-[#ffdca1] bg-[#111111]/40 hover:bg-[#111111]/80 transition-all cursor-pointer flex justify-between items-center"
              >
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-white">Alpaca Paper Trading</div>
                  <div className="text-xs text-[#a39d96] font-mono">Zero-risk simulated environment</div>
                </div>
                <span className="font-mono text-[10px] text-[#ffdca1] border border-[#ffdca1]/40 px-2 py-0.5 uppercase">Instant</span>
              </button>

              <button
                onClick={() => handleStartConnection("INTERACTIVE BROKERS")}
                className="w-full text-left p-4 border border-[#333333] hover:border-[#ffdca1] bg-[#111111]/40 hover:bg-[#111111]/80 transition-all cursor-pointer flex justify-between items-center"
              >
                <div>
                  <div className="font-mono text-xs uppercase tracking-widest text-white">Interactive Brokers API</div>
                  <div className="text-xs text-[#a39d96] font-mono">Live Institutional execution gateway</div>
                </div>
                <span className="font-mono text-[10px] text-[#a39d96] border border-[#333333] px-2 py-0.5 uppercase">OAuth</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
