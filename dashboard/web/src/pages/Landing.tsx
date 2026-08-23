import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { ConnectionOverlay } from "../components/ConnectionOverlay";
import { DevWarningModal } from "../components/DevWarningModal";
import { InteractiveAlgoTerminal } from "../components/InteractiveAlgoTerminal";
import { ContainerScroll } from "../components/ContainerScroll";
import { MeshDriftShaderBackground } from "../components/MeshDriftShaderBackground";
import {
  X,
  ChevronDown,
  ChevronUp,
  Search,
  AlertTriangle,
  ArrowRight,
  Info,
} from "lucide-react";

interface LandingProps {
  onOpenGuide?: () => void;
}

export function Landing({ onOpenGuide }: LandingProps = {}) {

  const [isConnecting, setIsConnecting] = useState(false);

  const [connectionMode, setConnectionMode] = useState("ALPACA PAPER");
  const [showBrokerModal, setShowBrokerModal] = useState(false);
  const [showDevModal, setShowDevModal] = useState(
    () => localStorage.getItem("shariah_dev_risk_acknowledged") !== "true"
  );
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeSection, setActiveSection] = useState<string>("overview");
  const [waitlistEmail, setWaitlistEmail] = useState("");
  const [waitlistStatus, setWaitlistStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [waitlistMessage, setWaitlistMessage] = useState("");

  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const handleScroll = () => {
      const sections = ["overview", "terminal", "compliance", "universe", "waitlist", "faqs"];
      const scrollPosition = window.scrollY + 140;

      if (window.scrollY < 100) {
        setActiveSection("overview");
        return;
      }

      for (const sectionId of sections) {
        const element = document.getElementById(sectionId);
        if (element) {
          const top = element.offsetTop;
          const height = element.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(sectionId);
            break;
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const scrollToSection = (e: React.SyntheticEvent, id: string) => {
    e.preventDefault();
    setActiveSection(id);
    if (id === "overview") {
      window.scrollTo({
        top: 0,
        behavior: "smooth",
      });
      return;
    }
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 110;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth",
      });
    }
  };

  const { data: auth } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
    refetchOnWindowFocus: false,
  });

  const isDemo = typeof window !== "undefined" && localStorage.getItem("shariah_demo_mode") === "true";
  const isAuthed = Boolean(auth?.authenticated || isDemo);

  const handleStartConnection = (mode: string) => {
    setConnectionMode(mode);
    setShowBrokerModal(false);
    setIsConnecting(true);
  };

  const handleCompleteConnection = async () => {
    localStorage.setItem("shariah_demo_mode", "true");
    await queryClient.invalidateQueries();
    window.scrollTo(0, 0);
    navigate("/app");
  };

  const handleNavigateToLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    localStorage.setItem("shariah_dev_risk_acknowledged", "true");
    setShowDevModal(false);
    if (isAuthed) {
      navigate("/app");
    } else {
      navigate("/login");
    }
  };

  const handleWaitlistSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail.trim()) {
      setWaitlistStatus("error");
      setWaitlistMessage("Please enter a valid email address");
      return;
    }

    setWaitlistStatus("loading");
    try {
      const response = await fetch("/api/public/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: waitlistEmail }),
      });

      if (response.ok) {
        setWaitlistStatus("success");
        setWaitlistMessage("Thanks for joining! We'll be in touch soon.");
        setWaitlistEmail("");
        if (typeof window.gtag === "function") {
          window.gtag("event", "waitlist_signup");
        }
        setTimeout(() => {
          setWaitlistStatus("idle");
          setWaitlistMessage("");
        }, 3000);
      } else {
        setWaitlistStatus("error");
        setWaitlistMessage("Something went wrong. Please try again.");
      }
    } catch (error) {
      setWaitlistStatus("error");
      setWaitlistMessage("Network error. Please try again.");
    }
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

  const { data: publicData, isSuccess: isPublicSuccess } = useQuery({
    queryKey: ["publicUniverse"],
    queryFn: api.publicUniverse,
    staleTime: 60_000,
  });

  const universeStocks = (publicData?.stocks && publicData.stocks.length > 0)
    ? publicData.stocks
    : [
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

      {/* Development Mode Notice Popup Modal */}
      <DevWarningModal
        isOpen={showDevModal}
        onClose={() => {
          // X button = dismiss permanently too, so the modal (which covers
          // the whole page at z-[9999]) stops blocking first-time visitors'
          // clicks on Login/nav on every return visit.
          localStorage.setItem("shariah_dev_risk_acknowledged", "true");
          setShowDevModal(false);
        }}
      />

      {/* Connection Overlay Simulator */}
      {isConnecting && (
        <ConnectionOverlay
          modeName={connectionMode}
          onComplete={handleCompleteConnection}
        />
      )}

      {/* Top Navigation Bar */}
      <nav className="fixed top-0 left-0 w-full z-50 bg-[#051F20]/90 backdrop-blur-md border-b border-[#235347]/60 shadow-xl">
        <div className="max-w-screen-2xl mx-auto flex justify-between items-center px-4 sm:px-12 py-4">
          <div className="flex items-center gap-12">
            <span className="text-[18px] font-serif tracking-wider text-[#DAF1DE] uppercase font-normal">
              SHARIAHTRADING
            </span>
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#overview"
                onClick={(e) => scrollToSection(e, "overview")}
                className={`font-mono text-[11px] uppercase tracking-widest transition-colors duration-200 cursor-pointer ${
                  activeSection === "overview"
                    ? "text-[#DAF1DE] border-b-2 border-[#8EB69B] pb-1 font-semibold"
                    : "text-[#8EB69B] hover:text-[#DAF1DE]"
                }`}
              >
                Overview
              </a>
              <a
                href="#terminal"
                onClick={(e) => scrollToSection(e, "terminal")}
                className={`font-mono text-[11px] uppercase tracking-widest transition-colors duration-200 cursor-pointer ${
                  activeSection === "terminal"
                    ? "text-[#DAF1DE] border-b-2 border-[#8EB69B] pb-1 font-semibold"
                    : "text-[#8EB69B] hover:text-[#DAF1DE]"
                }`}
              >
                Terminal
              </a>
              <a
                href="#compliance"
                onClick={(e) => scrollToSection(e, "compliance")}
                className={`font-mono text-[11px] uppercase tracking-widest transition-colors duration-200 cursor-pointer ${
                  activeSection === "compliance"
                    ? "text-[#DAF1DE] border-b-2 border-[#8EB69B] pb-1 font-semibold"
                    : "text-[#8EB69B] hover:text-[#DAF1DE]"
                }`}
              >
                Compliance
              </a>
              <a
                href="#universe"
                onClick={(e) => scrollToSection(e, "universe")}
                className={`font-mono text-[11px] uppercase tracking-widest transition-colors duration-200 cursor-pointer ${
                  activeSection === "universe"
                    ? "text-[#DAF1DE] border-b-2 border-[#8EB69B] pb-1 font-semibold"
                    : "text-[#8EB69B] hover:text-[#DAF1DE]"
                }`}
              >
                Universe
              </a>
              <a
                href="#faqs"
                onClick={(e) => scrollToSection(e, "faqs")}
                className={`font-mono text-[11px] uppercase tracking-widest transition-colors duration-200 cursor-pointer ${
                  activeSection === "faqs"
                    ? "text-[#DAF1DE] border-b-2 border-[#8EB69B] pb-1 font-semibold"
                    : "text-[#8EB69B] hover:text-[#DAF1DE]"
                }`}
              >
                FAQs
              </a>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            {onOpenGuide && (
              <button
                type="button"
                onClick={onOpenGuide}
                className="hidden sm:flex items-center gap-1.5 border border-[#235347] bg-[#0B2B26] text-[#8EB69B] hover:text-[#DAF1DE] hover:border-[#8EB69B]/40 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
                title="How the Trading Strategy Works"
              >
                <Info size={12} />
                <span>How It Works</span>
              </button>
            )}
            <button
              onClick={() => setShowDevModal(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-amber-500/10 border border-amber-500/40 hover:bg-amber-500/20 text-amber-300 rounded font-mono text-[10px] uppercase tracking-wider transition-all cursor-pointer shadow-[0_0_10px_rgba(245,158,11,0.15)]"
              title="View Development & Risk Notice"
            >
              <AlertTriangle size={12} className="text-amber-400 animate-pulse" />
              <span>Dev Mode</span>
            </button>
            <button
              onClick={handleNavigateToLogin}
              className="border border-[#235347] bg-[#0B2B26] text-[#DAF1DE] px-6 py-2 hover:bg-[#DAF1DE] hover:text-[#051F20] transition-all duration-300 font-mono text-[11px] uppercase tracking-widest cursor-pointer shadow-md"
            >
              {isAuthed ? "Dashboard" : "Login"}
            </button>
          </div>
        </div>

        {/* Live Scrolling Ticker Bar */}
        <div className="w-full bg-[#0B2B26]/90 border-t border-[#235347]/50 overflow-hidden py-1.5 flex items-center">
          <div className="flex whitespace-nowrap animate-ticker font-mono text-[10px] uppercase tracking-widest text-[#8EB69B]">
            <div className="flex items-center gap-8 px-8">
              <span>AAPL <span className="text-[#DAF1DE]">+1.2%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>MSFT <span className="text-[#DAF1DE]">+0.8%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>JPM <span className="text-rose-400 line-through">RESTRICTED</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>NVDA <span className="text-[#DAF1DE]">+3.5%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>TSLA <span className="text-[#DAF1DE]">+0.4%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>GOOGL <span className="text-[#DAF1DE]">+1.1%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>META <span className="text-[#DAF1DE]">+0.9%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>BAC <span className="text-rose-400 line-through">RESTRICTED</span></span>
            </div>
            <div className="flex items-center gap-8 px-8">
              <span>AAPL <span className="text-[#DAF1DE]">+1.2%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>MSFT <span className="text-[#DAF1DE]">+0.8%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>JPM <span className="text-rose-400 line-through">RESTRICTED</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>NVDA <span className="text-[#DAF1DE]">+3.5%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>TSLA <span className="text-[#DAF1DE]">+0.4%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>GOOGL <span className="text-[#DAF1DE]">+1.1%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>META <span className="text-[#DAF1DE]">+0.9%</span></span>
              <span className="w-1 h-1 bg-[#235347] rounded-full" />
              <span>BAC <span className="text-rose-400 line-through">RESTRICTED</span></span>
            </div>
          </div>
        </div>
      </nav>

      <main className="pt-40 md:pt-48">
        {/* Hero Section */}
        <section id="overview" className="px-4 sm:px-12 max-w-screen-2xl mx-auto mb-16 relative z-10 scroll-mt-32">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 border-none">
            {/* Main Hero Text Block */}
            <div className="lg:col-span-8 bg-[#0B2B26]/80 backdrop-blur-xl border border-[#235347]/60 p-8 md:p-12 flex flex-col justify-between min-h-[520px] md:min-h-[600px] shadow-2xl">
              <div>
                <div className="mb-8 inline-flex items-center gap-2 pb-2 border-b border-[#235347]/60">
                  <span className="font-mono text-[11px] text-[#8EB69B] uppercase tracking-widest">
                    AAOIFI Compliant Ecosystem
                  </span>
                </div>
                <h1 className="font-serif text-[48px] sm:text-[64px] lg:text-[88px] mb-8 text-[#DAF1DE] leading-none font-normal">
                  The Future of<br />
                  <span className="italic text-[#8EB69B]">Ethical</span> Investing.
                </h1>
                <p className="font-sans text-lg text-[#8EB69B] mb-12 leading-relaxed max-w-2xl border-l-2 border-[#8EB69B]/50 pl-6">
                  Institutional-grade algorithmic trading infrastructure designed strictly for Shariah-compliant portfolios. Automated screening, zero leverage, and purified returns.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={(e) => scrollToSection(e, "waitlist")}
                  className="bg-[#DAF1DE] text-[#051F20] font-semibold px-8 py-3.5 font-mono text-[11px] uppercase tracking-widest hover:bg-[#c2e8c8] transition-all cursor-pointer text-center shadow-lg shadow-[#DAF1DE]/10"
                >
                  Join Waitlist
                </button>
                {onOpenGuide && (
                  <button
                    type="button"
                    onClick={onOpenGuide}
                    className="border border-[#235347] bg-[#0B2B26] text-[#DAF1DE] hover:bg-[#163832] hover:border-[#8EB69B]/60 font-semibold px-8 py-3.5 font-mono text-[11px] uppercase tracking-widest transition-all cursor-pointer text-center flex items-center justify-center gap-2"
                  >
                    <Info size={14} /> How Strategy Works
                  </button>
                )}
              </div>
            </div>


            {/* Right Side Widgets */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              {/* System Status Widget */}
              <div className="bg-[#0B2B26]/80 backdrop-blur-xl border border-[#235347]/60 p-8 flex-1 flex flex-col justify-center shadow-2xl">
                <div className="flex justify-between items-center mb-6 border-b border-[#235347]/60 pb-2">
                  <span className="font-mono text-[10px] text-[#8EB69B] tracking-widest uppercase">
                    System Status
                  </span>
                  <span className="flex items-center gap-2 font-mono text-[10px] text-[#DAF1DE] uppercase tracking-widest">
                    <span className="w-2 h-2 rounded-full bg-[#8EB69B] animate-pulse" />
                    Live
                  </span>
                </div>
                <div className="mb-4">
                  <span className="font-serif text-[32px] text-[#DAF1DE] block font-normal">100% Halal</span>
                  <span className="font-mono text-[10px] text-[#8EB69B] uppercase tracking-widest">
                    Portfolio Purity
                  </span>
                </div>
                <div className="space-y-3 mt-6">
                  <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-[#8EB69B]">Engine</span>
                    <span className="text-[#DAF1DE]">AAOIFI_V2</span>
                  </div>
                  <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-[#8EB69B]">Latency</span>
                    <span className="text-[#DAF1DE]">12ms</span>
                  </div>
                  <div className="flex justify-between items-center font-mono text-[10px] uppercase tracking-widest">
                    <span className="text-[#8EB69B]">Last Scan</span>
                    <span className="text-[#DAF1DE]">Just Now</span>
                  </div>
                </div>
              </div>

              {/* Market Sentiment Widget */}
              <div className="bg-[#0B2B26]/80 backdrop-blur-xl border border-[#235347]/60 p-8 flex-1 flex flex-col justify-center shadow-2xl">
                <div className="flex justify-between items-center mb-6 border-b border-[#235347]/60 pb-2">
                  <span className="font-mono text-[10px] text-[#8EB69B] tracking-widest uppercase">
                    Halal Universe Sentiment
                  </span>
                </div>
                <div className="flex items-end gap-2 h-20 mb-6">
                  <div className="w-1/6 bg-[#8EB69B]/20 h-[30%] hover:bg-[#8EB69B] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#8EB69B]/40 h-[50%] hover:bg-[#8EB69B] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#8EB69B]/60 h-[40%] hover:bg-[#8EB69B] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#8EB69B]/30 h-[70%] hover:bg-[#8EB69B] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#8EB69B]/80 h-[60%] hover:bg-[#8EB69B] transition-colors cursor-pointer" />
                  <div className="w-1/6 bg-[#DAF1DE] h-[90%] hover:bg-[#DAF1DE] transition-colors cursor-pointer" />
                </div>
                <div className="flex justify-between items-center">
                  <div>
                    <span className="font-serif text-[20px] text-[#DAF1DE] block font-normal">+2.4%</span>
                    <span className="font-mono text-[10px] text-[#8EB69B] uppercase tracking-widest">
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
        <section id="terminal" className="scroll-mt-32">
          <ContainerScroll
            titleComponent={
              <div className="flex flex-col items-center">
                <span className="font-mono text-[11px] text-[#8EB69B] uppercase tracking-[0.3em] mb-3">
                  Interactive Algorithmic Terminal
                </span>
                <h2 className="font-serif text-[36px] sm:text-[56px] md:text-[68px] font-normal leading-tight text-[#DAF1DE]">
                  Unleash the power of<br />
                  <span className="italic text-[#8EB69B]">Algorithmic Compliance.</span>
                </h2>
              </div>
            }
          >
            <InteractiveAlgoTerminal />
          </ContainerScroll>
        </section>

        {/* Compliance Section (Grid Based) */}
        <section id="compliance" className="scroll-mt-32 py-16 px-4 sm:px-12 max-w-screen-2xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 border-none">
            <div className="lg:col-span-5 bg-[#0B2B26]/80 backdrop-blur-xl border border-[#235347]/60 p-8 md:p-12 flex flex-col justify-between min-h-[480px] shadow-2xl">
              <div>
                <div className="text-[#8EB69B] font-mono text-[11px] mb-6 uppercase tracking-widest flex items-center gap-3">
                  <span className="w-8 h-[1px] bg-[#8EB69B]" />
                  Compliance-as-a-Service
                </div>
                <h2 className="font-serif text-[36px] sm:text-[48px] mb-8 leading-tight text-[#DAF1DE] font-normal">
                  Screening that evolves<br />
                  <span className="italic text-[#8EB69B]">with the market.</span>
                </h2>
                <p className="text-[#8EB69B] mb-8 font-sans text-base leading-relaxed">
                  Our proprietary engine runs daily scans against AAOIFI and S&P Shariah standards. We don't just flag; we automate the purification process for fractional shares.
                </p>
              </div>
              <div className="border border-[#235347]/60 p-6 bg-[#051F20]/50 rounded-xl">
                <div className="font-mono text-[10px] text-[#8EB69B] tracking-widest uppercase mb-4">
                  Active Screening Parameters
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-xs text-[#DAF1DE] border-b border-[#235347]/40 pb-2">
                    <span>Debt / Total Assets</span>
                    <span className="text-[#DAF1DE] font-mono font-semibold">&lt; 33%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#DAF1DE] border-b border-[#235347]/40 pb-2">
                    <span>Cash / Total Assets</span>
                    <span className="text-[#DAF1DE] font-mono font-semibold">&lt; 33%</span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-[#DAF1DE]">
                    <span>Non-compliant Income</span>
                    <span className="text-[#DAF1DE] font-mono font-semibold">&lt; 5%</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7 grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Feature 1 */}
              <div className="bg-[#0B2B26]/80 backdrop-blur-xl border border-[#235347]/60 p-8 md:p-12 flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="font-serif text-[40px] text-[#8EB69B]/60 mb-6 border-b border-[#235347]/60 pb-2 inline-block font-normal">
                    01
                  </div>
                  <h3 className="font-serif text-[24px] text-[#DAF1DE] mb-3 font-normal">Automated Screening</h3>
                  <p className="text-[#8EB69B] font-sans text-sm leading-relaxed">
                    Daily balance sheet scans to ensure debt-to-equity ratios remain strictly below the 33% threshold, executing seamlessly in the background.
                  </p>
                </div>
                <div className="mt-8 border-t border-[#235347]/60 pt-6 flex justify-between items-end">
                  <div>
                    <div className="font-mono text-[10px] text-[#8EB69B] uppercase tracking-widest mb-1">
                      Debt/Equity Ratio
                    </div>
                    <div className="font-serif text-[#DAF1DE] text-[28px] font-normal">28.4%</div>
                  </div>
                  <div className="w-1/2 h-[2px] bg-[#235347] relative">
                    <div className="absolute top-0 left-0 h-full bg-[#8EB69B] w-[85%]" />
                  </div>
                </div>
              </div>

              {/* Feature 2 */}
              <div className="bg-[#0B2B26]/80 backdrop-blur-xl border border-[#235347]/60 p-8 md:p-12 flex flex-col justify-between shadow-2xl">
                <div>
                  <div className="font-serif text-[40px] text-[#8EB69B]/60 mb-6 border-b border-[#235347]/60 pb-2 inline-block font-normal">
                    02
                  </div>
                  <h3 className="font-serif text-[24px] text-[#DAF1DE] mb-3 font-normal">Dividend Purification</h3>
                  <p className="text-[#8EB69B] font-sans text-sm leading-relaxed">
                    Automatic calculation and precise redirection of non-compliant income to verified charitable organizations, maintaining portfolio purity.
                  </p>
                </div>
                <div className="mt-8 border-t border-[#235347]/60 pt-6">
                  <div className="font-mono text-[10px] text-[#8EB69B] uppercase tracking-widest mb-2">
                    Purification Queue
                  </div>
                  <div className="flex items-center justify-between border border-[#235347]/60 p-3 bg-[#051F20]/50 rounded-lg">
                    <span className="text-xs text-[#DAF1DE] font-mono">MSFT Div</span>
                    <span className="text-xs text-[#8EB69B]">→</span>
                    <span className="text-xs text-[#DAF1DE] font-mono">Charity</span>
                    <span className="font-mono text-[8px] bg-[#0B2B26] text-[#DAF1DE] px-2 py-0.5 uppercase border border-[#235347]">
                      Pending
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Universe Interactive Preview */}
        <section id="universe" className="scroll-mt-32 py-16 border-y border-[#235347]/60 bg-[#051F20]/90 backdrop-blur-md">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-12">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end mb-16 gap-8">
              <div className="max-w-2xl">
                <div className="flex items-center gap-4 mb-4 flex-wrap">
                  <h2 className="font-serif text-[48px] sm:text-[64px] leading-none font-normal text-[#DAF1DE]">The Universe</h2>
                  {isPublicSuccess && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-mono text-[10px] uppercase tracking-wider rounded">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      Live Feed
                    </span>
                  )}
                </div>
                <p className="text-[#8EB69B] font-sans text-lg">
                  Explore thousands of vetted equities. Our engine filters the noise so you focus on performance.
                </p>
              </div>
              <div className="w-full lg:w-auto border-b border-[#235347] pb-2 flex items-center gap-3">
                <Search size={16} className="text-[#8EB69B]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter Ticker..."
                  className="bg-transparent border-none focus:outline-none focus:ring-0 text-lg w-full lg:w-64 p-0 text-[#DAF1DE] placeholder:text-[#8EB69B]/70 font-mono"
                />
              </div>
            </div>

            {/* Minimal List View */}
            <div className="flex flex-col border-t border-[#235347]/60">
              {filteredStocks.slice(0, 5).map((stock) => (
                <div
                  key={stock.ticker}
                  className={`group flex flex-col sm:flex-row justify-between items-start sm:items-center py-6 border-b border-[#235347]/40 px-3 transition-colors ${
                    stock.compliant ? "hover:bg-[#0B2B26]/60 cursor-pointer" : "opacity-50 grayscale"
                  }`}
                >
                  <div className="flex items-center gap-8 w-full sm:w-1/3">
                    <span className={`font-serif text-[28px] sm:text-[32px] ${stock.compliant ? "group-hover:italic text-[#DAF1DE] transition-all" : "line-through text-[#8EB69B]"}`}>
                      {stock.ticker}
                    </span>
                    {stock.compliant ? (
                      <span className="font-mono text-[10px] border border-[#235347] bg-[#0B2B26] px-2 py-1 tracking-widest uppercase text-[#8EB69B] rounded">
                        Compliant
                      </span>
                    ) : (
                      <span className="font-mono text-[10px] border border-rose-500/40 text-rose-300 px-2 py-1 tracking-widest uppercase rounded">
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
                        <div className="hidden md:flex items-end h-7 gap-[3px] mr-6" title="5-Factor Quantitative Health Score">
                          {stock.spark?.map((h, i) => (
                            <div
                              key={i}
                              style={{ height: `${h}%` }}
                              className="w-[3px] bg-[#8EB69B]/60 group-hover:bg-[#DAF1DE] transition-colors"
                            />
                          ))}
                        </div>
                        <span className="font-mono text-sm text-[#DAF1DE] mr-6" title="24-Hour Price / Momentum Performance">{stock.change}</span>
                        <span className="font-serif text-[22px] text-[#DAF1DE] font-mono" title="Current Stock Share Price (USD)">{stock.price}</span>
                      </>
                    ) : (
                      <span className="font-mono text-xs text-rose-300/80 italic">
                        {stock.reason}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Metric Explanation Legend */}
            <div className="mt-6 p-4 border border-[#235347]/40 bg-[#0B2B26]/40 backdrop-blur-sm rounded-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-4 font-mono text-[11px]">
              <div className="flex items-center gap-2 text-[#8EB69B]">
                <Info size={14} className="text-[#DAF1DE] shrink-0" />
                <span className="text-[#DAF1DE] font-semibold uppercase tracking-wider">Metric Guide:</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 w-full md:w-auto text-[#8EB69B]">
                <div className="flex items-center gap-2">
                  <span className="text-[#DAF1DE] font-mono font-bold">$ (USD)</span>
                  <span>= Current Share Price</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#DAF1DE] font-mono font-bold">% (PCT)</span>
                  <span>= 24h Momentum Change</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[#DAF1DE] font-mono font-bold">Bars (|||)</span>
                  <span>= Factor Health Score</span>
                </div>
              </div>
            </div>

            {/* Explore Full Universe CTA Button */}
            <div className="mt-8 flex flex-col items-center gap-3">
              <button
                onClick={(e) => scrollToSection(e, "waitlist")}
                className="group flex items-center gap-3 border border-[#235347] bg-[#0B2B26] text-[#DAF1DE] hover:bg-[#DAF1DE] hover:text-[#051F20] px-8 py-3.5 font-mono text-[11px] uppercase tracking-widest transition-all duration-300 shadow-md cursor-pointer"
              >
                <span>Explore Full Universe (200+ Equities)</span>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
              <span className="font-mono text-[10px] text-[#8EB69B] uppercase tracking-widest">
                Showing Top 5 Ranked Equities • Updated Daily
              </span>
            </div>
          </div>
        </section>

        {/* FAQs Section */}
        <section id="faqs" className="scroll-mt-32 py-16 px-4 sm:px-12 max-w-4xl mx-auto border-t border-[#235347]/60">
          <div className="text-center mb-16">
            <h2 className="font-serif text-[40px] sm:text-[48px] mb-2 font-normal text-[#DAF1DE]">Engine Mechanics & Compliance FAQs</h2>
            <p className="text-[#8EB69B] font-sans text-base">
              Technical answers regarding AAOIFI screening, leverage restrictions, and factor execution.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="border border-[#235347]/60 bg-[#0B2B26]/80 backdrop-blur-xl transition-colors overflow-hidden rounded-xl shadow-lg"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-5 font-serif text-lg text-[#DAF1DE] flex justify-between items-center gap-4 hover:bg-[#163832]/60 transition-colors cursor-pointer"
                >
                  <span>{faq.q}</span>
                  {activeFaq === index ? (
                    <ChevronUp size={18} className="text-[#DAF1DE] shrink-0" />
                  ) : (
                    <ChevronDown size={18} className="text-[#8EB69B] shrink-0" />
                  )}
                </button>

                <AnimatePresence>
                  {activeFaq === index && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="px-5 pb-5 text-[#8EB69B] font-sans text-sm leading-relaxed border-t border-[#235347]/40 pt-4"
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
        <section id="waitlist" className="py-16 border-t border-[#235347]/60 bg-[#051F20]/90 backdrop-blur-md">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-12 flex flex-col items-center text-center">
            <h2 className="font-serif text-[56px] sm:text-[80px] md:text-[96px] mb-8 leading-none font-normal text-[#DAF1DE]">
              Ready to deploy.
            </h2>
            <p className="text-[#8EB69B] mb-12 font-sans max-w-2xl text-lg">
              Join the waitlist for early access. We're building the future of ethical finance.
            </p>
            
            {/* Waitlist Signup Form */}
            <form onSubmit={handleWaitlistSubmit} className="flex flex-col sm:flex-row justify-center gap-4 w-full sm:w-auto mb-8">
              <input
                type="email"
                placeholder="Enter your email"
                value={waitlistEmail}
                onChange={(e) => setWaitlistEmail(e.target.value)}
                className="bg-[#0B2B26] border border-[#235347] text-[#DAF1DE] px-6 py-4 font-mono text-[11px] uppercase tracking-widest placeholder-[#8EB69B]/70 focus:outline-none focus:border-[#8EB69B] transition-colors"
                disabled={waitlistStatus === "loading"}
              />
              <button
                type="submit"
                disabled={waitlistStatus === "loading"}
                className="bg-[#DAF1DE] text-[#051F20] font-semibold px-10 py-4 font-mono text-[11px] uppercase tracking-widest hover:bg-[#c2e8c8] transition-all cursor-pointer shadow-lg shadow-[#DAF1DE]/10 disabled:opacity-50"
              >
                {waitlistStatus === "loading" ? "Joining..." : "Join Waitlist"}
              </button>
            </form>

            {/* Waitlist Status Message */}
            {waitlistStatus === "success" && (
              <p className="text-[#8EB69B] font-sans text-sm mb-6">{waitlistMessage}</p>
            )}
            {waitlistStatus === "error" && (
              <p className="text-red-400 font-sans text-sm mb-6">{waitlistMessage}</p>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-6 w-full sm:w-auto">
              <button
                onClick={() => handleStartConnection("ALPACA PAPER")}
                className="bg-[#DAF1DE] text-[#051F20] font-semibold px-10 py-4 font-mono text-[11px] uppercase tracking-widest hover:bg-[#c2e8c8] transition-all cursor-pointer shadow-lg shadow-[#DAF1DE]/10"
              >
                Demo Mode
              </button>
              <button
                onClick={handleNavigateToLogin}
                className="border border-[#235347] bg-[#0B2B26] text-[#DAF1DE] font-semibold px-10 py-4 font-mono text-[11px] uppercase tracking-widest hover:bg-[#163832] transition-all cursor-pointer shadow-md"
              >
                Login
              </button>
            </div>
          </div>
        </section>
      </main>

      {/* Editorial Footer */}
      <footer className="border-t border-[#235347]/60 bg-[#051F20] pt-16">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-12 flex flex-col lg:flex-row justify-between items-start gap-12 pb-16">
          <div className="max-w-sm">
            <span className="font-serif text-[24px] text-[#DAF1DE] uppercase tracking-widest mb-6 block border-b border-[#235347]/60 pb-3">
              SHARIAHTRADING
            </span>
            <p className="text-[#8EB69B] font-sans text-sm mb-8 leading-relaxed">
              Leading the transition to a debt-free, ethical investment landscape. Fully AAOIFI compliant.
            </p>
            <div className="flex gap-8 text-[#8EB69B]">
              <span className="font-mono text-[10px] uppercase tracking-widest cursor-pointer hover:text-[#DAF1DE]">Global</span>
              <span className="font-mono text-[10px] uppercase tracking-widest cursor-pointer hover:text-[#DAF1DE]">Press</span>
              <span className="font-mono text-[10px] uppercase tracking-widest cursor-pointer hover:text-white">Journal</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-x-16 gap-y-8 font-mono text-[11px] uppercase tracking-widest">
            <div>
              <h3 className="text-[#a39d96] mb-6 border-b border-[#333333] pb-2">Platform</h3>
              <ul className="space-y-4 text-white">
                <li><a className="hover:text-[#a39d96] transition-colors" href="#overview">Overview</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#compliance">Compliance Policy</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#universe">Universe Stats</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#terminal">Terminal Docs</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-[#a39d96] mb-6 border-b border-[#333333] pb-2">Legal</h3>
              <ul className="space-y-4 text-white">
                <li><a className="hover:text-[#a39d96] transition-colors" href="#">Terms of Service</a></li>
                <li><a className="hover:text-[#a39d96] transition-colors" href="#">Privacy</a></li>
                <li><Link className="hover:text-[#a39d96] transition-colors" to="/risk-disclosure">Risk Disclosure</Link></li>
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
