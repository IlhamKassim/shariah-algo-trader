import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation, Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  XCircle,
  Loader2,
  Copy,
  Check,
  Info,
  KeyRound,
  RotateCcw,
} from "lucide-react";

import { api } from "../lib/api";
import { MeshDriftShaderBackground } from "../components/MeshDriftShaderBackground";
import { PlatformGuideModal } from "../components/PlatformGuideModal";

export function Invite() {
  const { code: paramCode } = useParams<{ code?: string }>();
  const location = useLocation();
  const navigate = useNavigate();

  // Support both /invite/:code and /invite?code=XYZ
  const queryCode = new URLSearchParams(location.search).get("code") || "";
  const initialCode = (paramCode || queryCode || "").trim();

  const [inputCode, setInputCode] = useState(initialCode);
  const [activeCode, setActiveCode] = useState(initialCode);
  const [loading, setLoading] = useState(Boolean(initialCode));
  const [validation, setValidation] = useState<{
    valid: boolean;
    code: string;
    expires_at?: string;
    reason?: string;
    max_uses?: number;
    uses?: number;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (!activeCode) {
      setLoading(false);
      setValidation(null);
      return;
    }

    let isMounted = true;
    setLoading(true);

    api
      .validateInvite(activeCode)
      .then((res) => {
        if (isMounted) {
          setValidation(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setValidation({
            valid: false,
            code: activeCode,
            reason: err instanceof Error ? err.message : "Failed to validate invite code.",
          });
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeCode]);

  const handleLookup = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCode.trim()) {
      const formatted = inputCode.trim();
      setActiveCode(formatted);
      navigate(`/invite/${encodeURIComponent(formatted)}`, { replace: true });
    }
  };

  const handleProceed = (mode: "signup" | "signin") => {
    const targetCode = validation?.valid ? validation.code : activeCode;
    if (targetCode) {
      sessionStorage.setItem("shariah_pending_invite", targetCode);
      navigate(`/login?invite=${encodeURIComponent(targetCode)}&mode=${mode}`);
    } else {
      navigate("/login");
    }
  };

  const copyCode = async () => {
    if (!validation?.code) return;
    try {
      await navigator.clipboard.writeText(validation.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleReset = () => {
    setActiveCode("");
    setInputCode("");
    setValidation(null);
    navigate("/invite", { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#051F20] text-[#DAF1DE] selection:bg-[#8EB69B]/30 selection:text-[#DAF1DE] relative font-sans flex flex-col justify-between">
      {/* Background WebGL Drift */}
      <MeshDriftShaderBackground />

      {/* Clean Navigation Bar */}
      <header className="relative z-10 border-b border-[#235347]/60 bg-[#051F20]/80 backdrop-blur-md px-6 sm:px-12 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="w-8 h-8 rounded border border-[#235347] bg-[#0B2B26] flex items-center justify-center text-[#8EB69B] font-mono font-bold text-xs group-hover:text-[#DAF1DE] group-hover:border-[#8EB69B]/40 transition-all">
            ST
          </div>
          <span className="font-serif text-2xl tracking-wide text-[#DAF1DE]">
            SHARIAH<span className="italic text-[#8EB69B]">TRADING</span>
          </span>
        </Link>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="flex items-center gap-1.5 border border-[#235347] bg-[#0B2B26] text-[#8EB69B] hover:text-[#DAF1DE] hover:border-[#8EB69B]/40 px-3.5 py-1.5 font-mono text-[10px] uppercase tracking-widest cursor-pointer transition-colors"
          >
            <Info size={12} />
            <span>How It Works</span>
          </button>

          <Link
            to="/login"
            className="border border-[#235347] bg-[#0B2B26] text-[#DAF1DE] px-5 py-1.5 hover:bg-[#DAF1DE] hover:text-[#051F20] transition-all font-mono text-[10px] uppercase tracking-widest cursor-pointer"
          >
            Sign In
          </Link>
        </div>
      </header>

      {/* Main Functional Invite Card */}
      <main className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 py-12">
        <div className="w-full max-w-xl bg-[#0B2B26]/90 backdrop-blur-2xl border border-[#235347] p-8 sm:p-10 shadow-2xl relative">
          
          {/* Card Top Pill */}
          <div className="flex items-center justify-between border-b border-[#235347]/60 pb-4 mb-6">
            <span className="font-mono text-[10px] uppercase tracking-widest text-[#8EB69B] flex items-center gap-2">
              <KeyRound size={12} />
              Pilot Program Access
            </span>
            <span className="font-mono text-[10px] text-[#8EB69B] uppercase tracking-widest">
              AAOIFI V2 Engine
            </span>
          </div>

          {loading ? (
            /* Loading State */
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-center">
              <Loader2 className="w-8 h-8 text-[#8EB69B] animate-spin" />
              <div className="space-y-1">
                <span className="font-mono text-xs uppercase tracking-widest text-[#DAF1DE] block">
                  Verifying Code
                </span>
                <span className="font-mono text-[11px] text-[#8EB69B]">
                  Validating against pilot user registry...
                </span>
              </div>
            </div>
          ) : validation?.valid ? (
            /* Valid Invite State */
            <div className="space-y-6">
              <div>
                <span className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-emerald-400 font-semibold bg-emerald-950/40 border border-emerald-500/30 px-2.5 py-1 mb-3">
                  <CheckCircle2 size={12} className="text-emerald-400" />
                  Invitation Active &amp; Verified
                </span>
                <h1 className="font-serif text-3xl sm:text-4xl text-[#DAF1DE] font-normal leading-tight">
                  Welcome to the Pilot Cohort
                </h1>
                <p className="font-sans text-xs text-[#8EB69B] mt-2 leading-relaxed">
                  Your authorization code is valid. Create your account now to claim your paper trading sandbox with automated AAOIFI compliance.
                </p>
              </div>

              {/* Code Box */}
              <div className="bg-[#051F20] border border-[#235347] p-5 flex items-center justify-between">
                <div>
                  <span className="font-mono text-[10px] uppercase text-[#8EB69B] tracking-widest block mb-1">
                    Your Invite Code
                  </span>
                  <span className="font-mono text-2xl font-bold tracking-widest text-[#DAF1DE]">
                    {validation.code}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={copyCode}
                  className="border border-[#235347] bg-[#0B2B26] hover:border-[#8EB69B]/60 text-[#8EB69B] hover:text-[#DAF1DE] px-3.5 py-2 text-xs font-mono uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
                  title="Copy code to clipboard"
                >
                  {copied ? (
                    <>
                      <Check size={14} className="text-emerald-400" />
                      <span className="text-emerald-400">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy size={14} />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>

              {/* Metadata Grid */}
              <div className="grid grid-cols-2 gap-3 font-mono text-[11px]">
                <div className="bg-[#051F20]/60 border border-[#235347]/50 p-3">
                  <span className="text-[10px] text-[#8EB69B] uppercase block">Sandbox Tier</span>
                  <span className="text-[#DAF1DE] font-semibold">$100,000 Paper Capital</span>
                </div>
                <div className="bg-[#051F20]/60 border border-[#235347]/50 p-3">
                  <span className="text-[10px] text-[#8EB69B] uppercase block">Expiration</span>
                  <span className="text-[#DAF1DE]">
                    {validation.expires_at
                      ? new Date(validation.expires_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "No Expiration"}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleProceed("signup")}
                  className="w-full bg-[#DAF1DE] hover:bg-[#c2e8c8] text-[#051F20] font-semibold py-3.5 font-mono text-xs uppercase tracking-widest transition-all cursor-pointer shadow-lg shadow-[#DAF1DE]/10 flex items-center justify-center gap-2"
                >
                  <span>Claim &amp; Create Account</span>
                  <ArrowRight size={14} />
                </button>

                <div className="flex items-center justify-between pt-2 text-xs font-mono text-[#8EB69B]">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="hover:text-[#DAF1DE] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw size={12} />
                    <span>Try a different code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGuideModal(true)}
                    className="hover:text-[#DAF1DE] transition-colors underline cursor-pointer"
                  >
                    How the strategy works
                  </button>
                </div>
              </div>
            </div>
          ) : validation && !validation.valid ? (
            /* Invalid State */
            <div className="space-y-6">
              <div className="bg-rose-950/30 border border-rose-500/40 p-5 flex items-start gap-3.5">
                <XCircle size={20} className="text-rose-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <span className="font-mono text-xs uppercase tracking-widest text-rose-300 font-bold block">
                    Invite Code Rejected
                  </span>
                  <p className="text-xs text-rose-200/80 leading-relaxed">
                    {validation.reason || "The invite code entered is invalid, expired, or already claimed."}
                  </p>
                  <span className="font-mono text-[10px] text-[#8EB69B] block pt-1">
                    Tested Code: <code className="text-[#DAF1DE]">{activeCode}</code>
                  </span>
                </div>
              </div>

              {/* Re-enter Form */}
              <form onSubmit={handleLookup} className="space-y-3">
                <label className="font-mono text-[10px] uppercase text-[#8EB69B] tracking-widest block">
                  Enter Another Code
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="e.g. PILOT-XXXX"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.trim())}
                    className="bg-[#051F20] border border-[#235347] focus:border-[#8EB69B] px-4 py-3 text-sm font-mono text-[#DAF1DE] placeholder-[#8EB69B]/70 focus:outline-none flex-1 tracking-widest"
                    autoFocus
                  />
                  <button
                    type="submit"
                    disabled={!inputCode.trim()}
                    className="bg-[#DAF1DE] text-[#051F20] px-5 py-3 font-mono text-[10px] uppercase tracking-widest font-semibold hover:bg-[#c2e8c8] disabled:opacity-40 transition-all cursor-pointer"
                  >
                    Verify
                  </button>
                </div>
              </form>

              <div className="pt-2 flex items-center justify-between text-xs font-mono text-[#8EB69B]">
                <Link to="/" className="hover:text-[#DAF1DE] transition-colors">
                  ← Back to Home
                </Link>
                <Link to="/login" className="hover:text-[#DAF1DE] transition-colors underline">
                  Direct Login
                </Link>
              </div>
            </div>
          ) : (
            /* Blank Input State (/invite without code) */
            <div className="space-y-6">
              <div>
                <h1 className="font-serif text-3xl text-[#DAF1DE] font-normal leading-tight">
                  Enter Pilot Invite Code
                </h1>
                <p className="font-sans text-xs text-[#8EB69B] mt-2 leading-relaxed">
                  Shariah Algo Trader is currently accessible to invited pilot participants. Please enter your single-use code below.
                </p>
              </div>

              <form onSubmit={handleLookup} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="font-mono text-[10px] uppercase text-[#8EB69B] tracking-widest block">
                    Invite Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. O67iC0yD or PILOT-XXXX"
                    value={inputCode}
                    onChange={(e) => setInputCode(e.target.value.trim())}
                    className="w-full bg-[#051F20] border border-[#235347] focus:border-[#8EB69B] px-4 py-3.5 text-base font-mono text-[#DAF1DE] placeholder-[#8EB69B]/70 focus:outline-none tracking-widest text-center"
                    autoFocus
                  />
                </div>

                <button
                  type="submit"
                  disabled={!inputCode.trim()}
                  className="w-full bg-[#DAF1DE] text-[#051F20] py-3.5 font-mono text-xs uppercase tracking-widest font-semibold hover:bg-[#c2e8c8] disabled:opacity-40 transition-all cursor-pointer shadow-md"
                >
                  Verify Authorization
                </button>
              </form>

              <div className="pt-4 border-t border-[#235347]/50 flex items-center justify-between text-xs font-mono text-[#8EB69B]">
                <Link to="/" className="hover:text-[#DAF1DE] transition-colors">
                  ← Back to Home
                </Link>
                <button
                  type="button"
                  onClick={() => setShowGuideModal(true)}
                  className="hover:text-[#DAF1DE] transition-colors underline cursor-pointer"
                >
                  How the strategy works
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="relative z-10 py-4 px-6 text-center font-mono text-[10px] text-[#8EB69B]/85 border-t border-[#235347]/40">
        <span>© 2026 Shariah Algo Trader · Institutional Quantitative Infrastructure</span>
      </footer>

      {/* Platform Strategy Guide Modal */}
      <PlatformGuideModal
        isOpen={showGuideModal}
        onClose={() => setShowGuideModal(false)}
      />
    </div>
  );
}
