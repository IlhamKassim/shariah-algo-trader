import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Globe2,
  KeyRound,
  Cpu,
  UserCheck,
} from "lucide-react";
import { api } from "../lib/api";
import { MeshDriftShaderBackground } from "../components/MeshDriftShaderBackground";

const COUNTRIES = [
  "Malaysia",
  "United States",
  "United Kingdom",
  "Singapore",
  "United Arab Emirates",
  "Saudi Arabia",
  "Indonesia",
  "Canada",
  "Australia",
  "Germany",
  "Qatar",
  "Bahrain",
  "Kuwait",
  "Other",
];

const INVESTOR_TYPES = [
  {
    id: "individual",
    label: "Individual Trader",
    desc: "Personal portfolio algorithmic trading on Shariah-screened equities.",
  },
  {
    id: "accredited",
    label: "Accredited / Angel",
    desc: "Qualified private investor testing institutional Shariah factor strategies.",
  },
  {
    id: "family_office",
    label: "Asset Manager / Office",
    desc: "Multi-tenant portfolio management with automated AAOIFI compliance.",
  },
  {
    id: "researcher",
    label: "Researcher / Developer",
    desc: "Quantitative backtesting and algorithmic API integration.",
  },
];

const CAPITAL_TIERS = [
  { amount: 25000, label: "$25,000 USD", desc: "Starter paper sandbox" },
  { amount: 50000, label: "$50,000 USD", desc: "Growth quant node" },
  { amount: 100000, label: "$100,000 USD", desc: "Standard institutional pilot (Recommended)" },
  { amount: 500000, label: "$500,000 USD", desc: "High-allocation tier" },
];

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Personal & Quant Identity
    firstName: "",
    lastName: "",
    quantHandle: "",
    country: "Malaysia",
    investorType: "individual",

    // Step 2: Sandbox Node & Execution
    paperCapital: 100000,
    executionMode: "managed", // "managed" | "custom_keys"
    alpacaApiKey: "",
    alpacaApiSecret: "",
    riskAcknowledged: true,
  });

  const updateForm = (key: string, value: any) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  };

  const displayName =
    formData.firstName || formData.lastName
      ? `${formData.firstName} ${formData.lastName}`.trim()
      : "Quant Pilot";

  const handleNext = () => {
    if (step < 2) setStep(2);
  };

  const handleBack = () => {
    if (step > 1) setStep(1);
  };

  const handleComplete = async () => {
    setSubmitting(true);
    try {
      // Save profile metadata locally
      const userProfile = {
        firstName: formData.firstName,
        lastName: formData.lastName,
        displayName: displayName,
        quantHandle: formData.quantHandle || `@${(formData.firstName || "pilot").toLowerCase()}`,
        country: formData.country,
        investorType: formData.investorType,
        paperCapital: formData.paperCapital,
        completedAt: new Date().toISOString(),
      };
      localStorage.setItem("shariah_user_profile", JSON.stringify(userProfile));
      localStorage.setItem("shariah_onboarding_completed", "true");
      localStorage.setItem("shariah_dev_risk_acknowledged", "true");

      // Sync settings with backend and Supabase store
      const settingsPayload: any = {
        first_name: formData.firstName.trim(),
        last_name: formData.lastName.trim(),
        quant_handle: formData.quantHandle.trim() || `@${(formData.firstName || "pilot").toLowerCase()}`,
        country: formData.country,
        investor_type: formData.investorType,
        paper_capital: formData.paperCapital,
        onboarding_completed_at: new Date().toISOString(),
        trading_mode: "paper",
        shariah_trader_enabled: true,
      };


      if (formData.executionMode === "custom_keys" && formData.alpacaApiKey && formData.alpacaApiSecret) {
        settingsPayload.alpaca_api_key = formData.alpacaApiKey;
        settingsPayload.alpaca_api_secret = formData.alpacaApiSecret;
      }

      await api.updateSettings(settingsPayload).catch((e) => {
        console.warn("Non-fatal settings sync during onboarding:", e);
      });

      // Brief cinematic delay before entering console
      setTimeout(() => {
        navigate("/app", { replace: true });
      }, 700);
    } catch (err) {
      console.error("Onboarding setup failed:", err);
      navigate("/app", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-[#040706] text-[#F0FDF4] selection:bg-emerald-500/30 selection:text-[#F0FDF4] relative font-sans flex flex-col justify-between overflow-x-hidden">
      {/* Background WebGL Shader */}
      <MeshDriftShaderBackground />

      {/* Top Header */}
      <header className="relative z-20 border-b border-[#16382E] bg-[#060A08]/90 backdrop-blur-md px-6 sm:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded border border-[#1F4A3E] bg-[#090E0C] flex items-center justify-center text-emerald-400 font-mono font-bold text-xs group-hover:text-[#F0FDF4] group-hover:border-emerald-400 transition-all">
            ST
          </div>
          <span className="font-serif text-2xl tracking-wide text-[#F0FDF4]">
            SHARIAH<span className="italic text-emerald-400">TRADING</span>
          </span>
        </Link>

        {/* Step Indicator Top Bar (2 Clean Steps) */}
        <div className="hidden md:flex items-center gap-6 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 1
                  ? "bg-emerald-400 text-[#041F16]"
                  : "bg-[#090E0C] text-slate-500 border border-[#16382E]"
              }`}
            >
              1
            </span>
            <span className={step === 1 ? "text-[#F0FDF4] font-semibold" : "text-slate-500"}>
              Quant Identity
            </span>
          </div>

          <div className="w-8 h-[1px] bg-[#16382E]" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                step >= 2
                  ? "bg-emerald-400 text-[#041F16]"
                  : "bg-[#090E0C] text-slate-500 border border-[#16382E]"
              }`}
            >
              2
            </span>
            <span className={step === 2 ? "text-[#F0FDF4] font-semibold" : "text-slate-500"}>
              Sandbox Node
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-slate-400">
          <span>Step {step} of 2</span>
          <button
            type="button"
            onClick={() => navigate("/app")}
            className="text-slate-400 hover:text-emerald-300 transition-colors text-xs underline cursor-pointer"
          >
            Skip for now
          </button>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left / Center Form Container (Col 7) */}
          <div className="lg:col-span-7 bg-[#080D0B]/95 backdrop-blur-2xl border border-[#16382E] p-6 sm:p-10 shadow-[0_20px_70px_rgba(0,0,0,0.8)] relative">
            
            {/* Header Badge */}
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-[#16382E]">
              <span className="font-mono text-[10px] text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Account Setup
              </span>
            </div>

            {/* STEP 1: QUANT IDENTITY */}
            {step === 1 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="font-serif text-3xl sm:text-4xl text-[#F0FDF4] font-normal leading-tight">
                    Personal &amp; Trader Profile
                  </h1>
                  <p className="font-sans text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Set up your institutional operator credentials and configure your Shariah trading account profile.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest block">
                      First Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John"
                      value={formData.firstName}
                      onChange={(e) => updateForm("firstName", e.target.value)}
                      className="w-full bg-[#050807] border border-[#16382E] focus:border-emerald-400 px-4 py-3 text-sm font-sans text-[#F0FDF4] placeholder-slate-600 focus:outline-none transition-colors"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest block">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cena"
                      value={formData.lastName}
                      onChange={(e) => updateForm("lastName", e.target.value)}
                      className="w-full bg-[#050807] border border-[#16382E] focus:border-emerald-400 px-4 py-3 text-sm font-sans text-[#F0FDF4] placeholder-slate-600 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest block">
                      Trader Handle / Alias
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 font-mono text-xs">
                        @
                      </span>
                      <input
                        type="text"
                        placeholder="john_trader"
                        value={formData.quantHandle}
                        onChange={(e) => updateForm("quantHandle", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        className="w-full bg-[#050807] border border-[#16382E] focus:border-emerald-400 pl-8 pr-4 py-3 text-sm font-mono text-[#F0FDF4] placeholder-slate-600 focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest block">
                      Country / Jurisdiction
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => updateForm("country", e.target.value)}
                      className="w-full bg-[#050807] border border-[#16382E] focus:border-emerald-400 px-4 py-3 text-sm font-sans text-[#F0FDF4] focus:outline-none transition-colors cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c} className="bg-[#050807] text-[#F0FDF4]">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Investor Persona Selector */}
                <div className="space-y-2 pt-2">
                  <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest block">
                    Account Classification
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {INVESTOR_TYPES.map((type) => {
                      const isSelected = formData.investorType === type.id;
                      return (
                        <div
                          key={type.id}
                          onClick={() => updateForm("investorType", type.id)}
                          className={`p-3.5 border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0E1714] border-emerald-400 text-[#F0FDF4] shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                              : "bg-[#050807] border-[#16382E] text-slate-400 hover:border-emerald-500/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-xs font-semibold text-[#F0FDF4]">
                              {type.label}
                            </span>
                            {isSelected && <CheckCircle2 size={14} className="text-emerald-400" />}
                          </div>
                          <p className="text-[11px] text-slate-400 leading-snug">{type.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: SANDBOX NODE & EXECUTION */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="font-serif text-3xl sm:text-4xl text-[#F0FDF4] font-normal leading-tight">
                    Execution Node &amp; Paper Sandbox
                  </h1>
                  <p className="font-sans text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    Select your initial simulated capital and configure your paper trading environment.
                  </p>
                </div>

                {/* Capital Tier Selector */}
                <div className="space-y-2">
                  <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest block">
                    Simulated Paper Capital Allocation
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {CAPITAL_TIERS.map((tier) => {
                      const isSelected = formData.paperCapital === tier.amount;
                      return (
                        <div
                          key={tier.amount}
                          onClick={() => updateForm("paperCapital", tier.amount)}
                          className={`p-4 border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-[#0E1714] border-emerald-400 text-[#F0FDF4] shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                              : "bg-[#050807] border-[#16382E] text-slate-400 hover:border-emerald-500/40"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-mono text-sm font-bold text-[#F0FDF4]">
                              {tier.label}
                            </span>
                            {isSelected && <CheckCircle2 size={16} className="text-emerald-400" />}
                          </div>
                          <p className="text-[11px] text-slate-400">{tier.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Brokerage Connectivity Option */}
                <div className="space-y-3 pt-2">
                  <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest block">
                    Brokerage Sandbox Connection
                  </label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => updateForm("executionMode", "managed")}
                      className={`p-4 border transition-all cursor-pointer ${
                        formData.executionMode === "managed"
                          ? "bg-[#0E1714] border-emerald-400"
                          : "bg-[#050807] border-[#16382E] hover:border-emerald-500/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <Cpu size={16} className="text-emerald-400" />
                        <span className="font-mono text-xs font-bold text-[#F0FDF4]">
                          Instant Managed Sandbox
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Zero setup required. Automated paper execution with live Shariah screening.
                      </p>
                    </div>

                    <div
                      onClick={() => updateForm("executionMode", "custom_keys")}
                      className={`p-4 border transition-all cursor-pointer ${
                        formData.executionMode === "custom_keys"
                          ? "bg-[#0E1714] border-emerald-400"
                          : "bg-[#050807] border-[#16382E] hover:border-emerald-500/40"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <KeyRound size={16} className="text-emerald-400" />
                        <span className="font-mono text-xs font-bold text-[#F0FDF4]">
                          Custom Alpaca Keys
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-snug">
                        Optionally connect your personal Alpaca Paper API keys.
                      </p>
                    </div>
                  </div>

                  {formData.executionMode === "custom_keys" && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="bg-[#050807] border border-[#16382E] p-4 space-y-3 mt-2"
                    >
                      <div className="space-y-1">
                        <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest">
                          Alpaca Paper API Key
                        </label>
                        <input
                          type="text"
                          placeholder="PK..."
                          value={formData.alpacaApiKey}
                          onChange={(e) => updateForm("alpacaApiKey", e.target.value.trim())}
                          className="w-full bg-[#090E0C] border border-[#16382E] focus:border-emerald-400 px-3 py-2 text-xs font-mono text-[#F0FDF4] placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="font-mono text-[10px] uppercase text-emerald-400 tracking-widest">
                          Alpaca Paper Secret Key
                        </label>
                        <input
                          type="password"
                          placeholder="••••••••••••••••••••"
                          value={formData.alpacaApiSecret}
                          onChange={(e) => updateForm("alpacaApiSecret", e.target.value.trim())}
                          className="w-full bg-[#090E0C] border border-[#16382E] focus:border-emerald-400 px-3 py-2 text-xs font-mono text-[#F0FDF4] placeholder-slate-600 focus:outline-none"
                        />
                      </div>
                    </motion.div>
                  )}
                </div>

                {/* Consent Box */}
                <div className="bg-[#050807] border border-[#16382E] p-4 flex items-start gap-3">
                  <ShieldCheck size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-xs text-slate-400 leading-relaxed font-sans">
                    By launching the trading console, you acknowledge that execution operates in a paper sandbox environment adhering to automated AAOIFI compliance rules.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Navigation Action Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-[#16382E] mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="border border-[#16382E] bg-[#090E0C] hover:border-emerald-500/40 text-slate-300 hover:text-[#F0FDF4] px-6 py-3 font-mono text-xs uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer"
                >
                  <ArrowLeft size={14} />
                  <span>Back</span>
                </button>
              ) : (
                <div />
              )}

              {step === 1 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="bg-emerald-400 hover:bg-emerald-300 text-[#041F16] font-bold px-8 py-3.5 font-mono text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/10"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={submitting}
                  className="bg-emerald-400 hover:bg-emerald-300 text-[#041F16] font-bold px-8 py-3.5 font-mono text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 shadow-lg shadow-emerald-500/10 disabled:opacity-50"
                >
                  <Sparkles size={14} />
                  <span>{submitting ? "Launching..." : "Enter Trading Console"}</span>
                </button>
              )}
            </div>
          </div>

          {/* Right Side Live Quant Identity Terminal Pass (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Identity Badge */}
            <div className="bg-[#080D0B]/95 backdrop-blur-2xl border border-[#16382E] p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
                <UserCheck size={160} className="text-emerald-400" />
              </div>

              <div className="flex justify-between items-center pb-4 mb-6 border-b border-[#16382E]">
                <span className="font-mono text-[10px] uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  Trader Profile Card
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  PILOT NODE
                </span>
              </div>

              {/* Avatar & User Details */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded border border-emerald-500/40 bg-[#0E1714] flex items-center justify-center text-emerald-400 font-serif text-xl font-bold">
                  {(formData.firstName?.[0] || "T").toUpperCase()}
                  {(formData.lastName?.[0] || "P").toUpperCase()}
                </div>
                <div>
                  <h3 className="font-serif text-2xl text-[#F0FDF4] leading-tight">
                    {displayName}
                  </h3>
                  <span className="font-mono text-xs text-emerald-400 block mt-0.5">
                    {formData.quantHandle ? `@${formData.quantHandle}` : "@pilot.trader"}
                  </span>
                </div>
              </div>

              {/* Profile Telemetry Specs */}
              <div className="space-y-3.5 font-mono text-xs border-t border-[#16382E] pt-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase text-[10px]">Jurisdiction</span>
                  <span className="text-[#F0FDF4] flex items-center gap-1.5">
                    <Globe2 size={12} className="text-emerald-400" />
                    {formData.country}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase text-[10px]">Account Class</span>
                  <span className="text-emerald-300 font-semibold">
                    {INVESTOR_TYPES.find((t) => t.id === formData.investorType)?.label}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase text-[10px]">Compliance Standard</span>
                  <span className="text-[#F0FDF4]">
                    AAOIFI Standard No. 21
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase text-[10px]">Equity Universe</span>
                  <span className="text-[#F0FDF4]">Top 20 SPUS Equities</span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-slate-400 uppercase text-[10px]">Sandbox Capital</span>
                  <span className="text-emerald-400 font-bold">
                    ${formData.paperCapital.toLocaleString()} USD
                  </span>
                </div>
              </div>

              {/* Live Status Pill */}
              <div className="mt-6 pt-4 border-t border-[#16382E] flex items-center justify-between font-mono text-[10px]">
                <span className="text-slate-500 uppercase">Engine Status</span>
                <span className="bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 px-2 py-0.5 font-bold uppercase tracking-wider">
                  100% Spot Halal
                </span>
              </div>
            </div>

          </div>

        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-20 py-4 px-6 text-center font-mono text-[10px] text-slate-500 border-t border-[#16382E]">
        <span>© 2026 Shariah Algo Trader · Institutional Quantitative Infrastructure</span>
      </footer>
    </div>
  );
}
