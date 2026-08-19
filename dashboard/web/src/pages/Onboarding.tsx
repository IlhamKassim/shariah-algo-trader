import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  KeyRound,
  ExternalLink,
  Info,
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

export function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    // Step 1: Personal & Quant Identity
    firstName: "",
    lastName: "",
    quantHandle: "",
    country: "Malaysia",
    investorType: "individual",

    // Step 2: Alpaca Paper API Keys (Required)
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
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setErrorMsg("Please enter both your first and last name to continue.");
      return;
    }
    setErrorMsg(null);
    if (step < 2) setStep(2);
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (step > 1) setStep(1);
  };

  const handleComplete = async () => {
    if (!formData.alpacaApiKey.trim() || !formData.alpacaApiSecret.trim()) {
      setErrorMsg("Alpaca Paper API Key and Secret Key are required to connect your terminal.");
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      // Save profile metadata locally
      const userProfile = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        displayName: displayName,
        quantHandle: formData.quantHandle.trim() || `@${(formData.firstName || "pilot").toLowerCase()}`,
        country: formData.country,
        investorType: formData.investorType,
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
        alpaca_api_key: formData.alpacaApiKey.trim(),
        alpaca_api_secret: formData.alpacaApiSecret.trim(),
        alpaca_base_url: "https://paper-api.alpaca.markets",
        trading_mode: "paper",
        shariah_trader_enabled: true,
        onboarding_completed_at: new Date().toISOString(),
      };

      await api.updateSettings(settingsPayload);

      // Brief cinematic delay before entering console
      setTimeout(() => {
        navigate("/app", { replace: true });
      }, 500);
    } catch (err: any) {
      console.error("Onboarding setup failed:", err);
      setErrorMsg(err.message || "Failed to save broker credentials. Please verify your keys and try again.");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#040706] text-[#ECE5D5] selection:bg-brand-gold/30 selection:text-[#ECE5D5] relative font-sans flex flex-col justify-between overflow-x-hidden">
      {/* Background WebGL Shader */}
      <MeshDriftShaderBackground />

      {/* Top Header */}
      <header className="relative z-20 border-b border-[#29241B] bg-[#0C0B09]/95 backdrop-blur-md px-6 sm:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded-none border border-[#D1A92E]/40 bg-[#0C0B09] flex items-center justify-center text-brand-gold font-mono font-bold text-xs group-hover:text-primary group-hover:border-brand-gold transition-all">
            ST
          </div>
          <span className="font-serif text-2xl tracking-wide text-primary">
            SHARIAH<span className="italic text-brand-gold">TRADING</span>
          </span>
        </Link>

        {/* Step Indicator Top Bar (2 Clean Steps) */}
        <div className="hidden md:flex items-center gap-6 font-mono text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold ${
                step >= 1
                  ? "bg-brand-gold text-page"
                  : "bg-sidebar text-muted border border-divider"
              }`}
            >
              1
            </span>
            <span className={step === 1 ? "text-primary font-semibold" : "text-muted"}>
              Quant Identity
            </span>
          </div>

          <div className="w-8 h-[1px] bg-divider" />

          <div className="flex items-center gap-2">
            <span
              className={`w-6 h-6 flex items-center justify-center text-[10px] font-bold ${
                step >= 2
                  ? "bg-brand-gold text-page"
                  : "bg-sidebar text-muted border border-divider"
              }`}
            >
              2
            </span>
            <span className={step === 2 ? "text-primary font-semibold" : "text-muted"}>
              Alpaca Paper Keys
            </span>
          </div>
        </div>

        <div className="flex items-center gap-4 font-mono text-xs text-muted">
          <span>Step {step} of 2</span>
        </div>
      </header>

      {/* Main Content Workspace */}
      <main className="relative z-10 max-w-7xl mx-auto px-4 sm:px-8 py-8 sm:py-12 flex-1 w-full">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          
          {/* Left / Center Form Container (Col 7) */}
          <div className="lg:col-span-7 bg-[#0C0B09]/95 backdrop-blur-2xl border border-divider p-6 sm:p-10 shadow-2xl relative">
            
            {/* Header Badge */}
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-divider">
              <span className="font-mono text-[10px] text-brand-gold uppercase tracking-widest flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                Terminal Activation
              </span>
              <span className="font-mono text-[10px] text-muted uppercase">
                Paper Trading Mode
              </span>
            </div>

            {errorMsg && (
              <div className="mb-5 p-3.5 border border-brand-red/40 bg-brand-red/10 text-brand-red text-xs font-mono flex items-center gap-2.5">
                <Info size={15} className="shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

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
                  <h1 className="font-serif text-3xl sm:text-4xl text-primary font-normal leading-tight">
                    Personal &amp; Trader Profile
                  </h1>
                  <p className="font-sans text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                    Set up your institutional operator credentials and configure your Shariah trading account profile.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-brand-gold tracking-widest block">
                      First Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. John"
                      value={formData.firstName}
                      onChange={(e) => updateForm("firstName", e.target.value)}
                      className="w-full bg-[#050807] border border-divider focus:border-brand-gold px-4 py-3 text-sm font-sans text-primary placeholder-faint focus:outline-none transition-colors"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-brand-gold tracking-widest block">
                      Last Name *
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Cena"
                      value={formData.lastName}
                      onChange={(e) => updateForm("lastName", e.target.value)}
                      className="w-full bg-[#050807] border border-divider focus:border-brand-gold px-4 py-3 text-sm font-sans text-primary placeholder-faint focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-brand-gold tracking-widest block">
                      Trader Handle / Alias
                    </label>
                    <div className="relative">
                      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-faint font-mono text-xs">
                        @
                      </span>
                      <input
                        type="text"
                        placeholder="john_trader"
                        value={formData.quantHandle}
                        onChange={(e) => updateForm("quantHandle", e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
                        className="w-full bg-[#050807] border border-divider focus:border-brand-gold pl-8 pr-4 py-3 text-sm font-mono text-brand-gold placeholder-faint focus:outline-none transition-colors"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-brand-gold tracking-widest block">
                      Country / Jurisdiction
                    </label>
                    <select
                      value={formData.country}
                      onChange={(e) => updateForm("country", e.target.value)}
                      className="w-full bg-[#050807] border border-divider focus:border-brand-gold px-4 py-3 text-sm font-sans text-primary focus:outline-none transition-colors cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c} className="bg-[#0C0B09] text-primary">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <label className="font-mono text-[10px] uppercase text-brand-gold tracking-widest block">
                    Investor Classification Persona
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INVESTOR_TYPES.map((type) => {
                      const isSelected = formData.investorType === type.id;
                      return (
                        <div
                          key={type.id}
                          onClick={() => updateForm("investorType", type.id)}
                          className={`p-3.5 border transition-all cursor-pointer ${
                            isSelected
                              ? "bg-brand-gold/10 border-brand-gold text-primary"
                              : "bg-[#050807] border-divider text-muted hover:border-muted hover:text-primary"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-sans font-semibold text-xs text-primary">{type.label}</span>
                            {isSelected && <CheckCircle2 size={14} className="text-brand-gold" />}
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed">{type.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}

            {/* STEP 2: MANDATORY ALPACA PAPER KEYS */}
            {step === 2 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                <div>
                  <h1 className="font-serif text-3xl sm:text-4xl text-primary font-normal leading-tight">
                    Connect Alpaca Paper API Keys
                  </h1>
                  <p className="font-sans text-xs sm:text-sm text-muted mt-2 leading-relaxed">
                    To execute algorithmic Shariah rebalancing in the paper trading sandbox, connect your personal Alpaca Paper API credentials.
                  </p>
                </div>

                {/* Alpaca Setup Instruction Card */}
                <div className="bg-[#12110E] border border-divider p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-mono text-xs font-bold text-brand-gold uppercase">
                      <KeyRound size={15} />
                      <span>How to obtain free Paper API keys</span>
                    </div>
                    <a
                      href="https://app.alpaca.markets"
                      target="_blank"
                      rel="noreferrer"
                      className="text-[11px] font-mono text-brand-gold hover:underline flex items-center gap-1"
                    >
                      <span>alpaca.markets</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                  <ol className="list-decimal list-inside text-xs font-mono text-muted space-y-1.5 pl-1">
                    <li>Log into your free Alpaca account at <strong className="text-primary">app.alpaca.markets</strong>.</li>
                    <li>Switch the toggle at the top/left to <strong className="text-brand-gold">Paper Trading</strong>.</li>
                    <li>On the right side of the dashboard, click <strong className="text-primary">Generate API Key</strong>.</li>
                    <li>Copy and paste your <strong className="text-primary">Key ID</strong> and <strong className="text-primary">Secret Key</strong> below.</li>
                  </ol>
                </div>

                {/* API Key Inputs */}
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-brand-gold tracking-widest block">
                      Alpaca Paper API Key ID *
                    </label>
                    <input
                      type="text"
                      placeholder="PKI4MGJIDVVHHTZOG37RMREWGB"
                      value={formData.alpacaApiKey}
                      onChange={(e) => updateForm("alpacaApiKey", e.target.value.trim())}
                      className="w-full bg-[#050807] border border-divider focus:border-brand-gold px-4 py-3 text-xs font-mono text-primary placeholder-faint focus:outline-none transition-colors"
                      autoFocus
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-mono text-[10px] uppercase text-brand-gold tracking-widest block">
                      Alpaca Paper Secret Key *
                    </label>
                    <input
                      type="password"
                      placeholder="••••••••••••••••••••••••••••••••••••••••"
                      value={formData.alpacaApiSecret}
                      onChange={(e) => updateForm("alpacaApiSecret", e.target.value.trim())}
                      className="w-full bg-[#050807] border border-divider focus:border-brand-gold px-4 py-3 text-xs font-mono text-primary placeholder-faint focus:outline-none transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Endpoint Confirmation */}
                <div className="bg-[#050807] border border-divider p-3.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-muted uppercase text-[10px]">Execution Endpoint:</span>
                  <span className="text-brand-green font-semibold">https://paper-api.alpaca.markets</span>
                </div>

                {/* Shariah Safety Consent */}
                <div className="bg-[#050807] border border-divider p-4 flex items-start gap-3">
                  <ShieldCheck size={18} className="text-brand-green shrink-0 mt-0.5" />
                  <p className="text-xs text-muted leading-relaxed font-sans">
                    All algorithmic executions strictly adhere to <strong>AAOIFI Standard No. 21</strong> (100% cash-backed spot equity, zero shorting, zero margin leverage) in your isolated Alpaca Paper sandbox.
                  </p>
                </div>
              </motion.div>
            )}

            {/* Navigation Action Buttons */}
            <div className="flex items-center justify-between pt-8 border-t border-divider mt-8">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="border border-divider bg-sidebar hover:border-brand-gold/40 text-muted hover:text-primary px-6 py-3 font-mono text-xs uppercase tracking-widest flex items-center gap-2 transition-all cursor-pointer"
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
                  className="bg-brand-gold hover:bg-brand-gold/90 text-page font-bold px-8 py-3.5 font-mono text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2"
                >
                  <span>Continue</span>
                  <ArrowRight size={14} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleComplete}
                  disabled={submitting || !formData.alpacaApiKey.trim() || !formData.alpacaApiSecret.trim()}
                  className="bg-brand-gold hover:bg-brand-gold/90 text-page font-bold px-8 py-3.5 font-mono text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <span>{submitting ? "Connecting Keys..." : "Connect & Launch Terminal"}</span>
                  <ArrowRight size={14} />
                </button>
              )}
            </div>
          </div>

          {/* Right Side Live Quant Identity Terminal Pass (Col 5) */}
          <div className="lg:col-span-5 space-y-6">
            
            {/* Live Identity Badge */}
            <div className="bg-[#0C0B09]/95 backdrop-blur-2xl border border-divider p-6 sm:p-8 shadow-2xl relative overflow-hidden">
              <div className="flex justify-between items-center pb-4 mb-6 border-b border-divider">
                <span className="font-mono text-[10px] uppercase tracking-widest text-brand-gold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-brand-gold animate-pulse" />
                  Trader Profile Card
                </span>
                <span className="font-mono text-[10px] text-muted uppercase tracking-widest">
                  PILOT NODE
                </span>
              </div>

              {/* Avatar & User Details */}
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 rounded-none border border-brand-gold/60 bg-sidebar flex items-center justify-center text-brand-gold font-serif text-xl font-bold">
                  {(formData.firstName?.[0] || "T").toUpperCase()}
                  {(formData.lastName?.[0] || "P").toUpperCase()}
                </div>
                <div>
                  <h3 className="font-sans font-bold text-lg text-primary tracking-tight">
                    {displayName}
                  </h3>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-brand-gold font-semibold">
                      {formData.quantHandle || `@${(formData.firstName || "pilot").toLowerCase()}`}
                    </span>
                    <span className="text-muted text-xs">·</span>
                    <span className="font-sans text-xs text-muted">
                      {formData.country}
                    </span>
                  </div>
                </div>
              </div>

              {/* Status Grid */}
              <div className="grid grid-cols-2 gap-3 pt-4 border-t border-divider text-xs font-mono">
                <div className="p-3 bg-sidebar border border-divider">
                  <span className="text-muted text-[10px] uppercase block">Mandate:</span>
                  <span className="font-bold text-brand-green mt-0.5 block">AAOIFI No. 21</span>
                </div>
                <div className="p-3 bg-sidebar border border-divider">
                  <span className="text-muted text-[10px] uppercase block">Target:</span>
                  <span className="font-bold text-primary mt-0.5 block">SPUS Top 20</span>
                </div>
                <div className="p-3 bg-sidebar border border-divider col-span-2">
                  <span className="text-muted text-[10px] uppercase block">Broker Endpoint:</span>
                  <span className="font-bold text-brand-gold mt-0.5 block truncate">
                    {formData.alpacaApiKey ? "Alpaca Paper (Connected)" : "Alpaca Paper (Pending Key)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Quick Helper Note */}
            <div className="bg-[#0C0B09]/95 border border-divider p-6 text-xs text-muted space-y-2">
              <span className="font-mono text-[10px] uppercase tracking-wider text-primary font-bold block">
                Security & Encryption
              </span>
              <p className="leading-relaxed">
                All Alpaca API secrets are encrypted using AES-256-GCM before saving to your isolated database record. Your keys are never exposed in plaintext.
              </p>
            </div>
          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-20 border-t border-divider bg-[#0C0B09]/95 px-6 sm:px-12 py-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs font-mono text-muted">
        <span>&copy; {new Date().getFullYear()} Shariah Algo Trader · Algorithmic Halal Engine</span>
        <span>Paper Sandbox Execution Only</span>
      </footer>
    </div>
  );
}
