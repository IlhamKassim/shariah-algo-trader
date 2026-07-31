import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Save, Key, Sliders, Shield, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Mail, Lock, Flame } from "lucide-react";
import { api } from "../lib/api";
import type { SettingsUpdateRequest } from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";
import { MfaEnrollModal } from "../components/auth/MfaEnrollModal";
import { RebalanceModal } from "../components/RebalanceModal";
import { supabase } from "../lib/supabaseClient";


export function Settings() {
  const isDemo = localStorage.getItem("shariah_demo_mode") === "true";

  const queryClient = useQueryClient();

  // Auth Status checking
  const { data: authStatus, isLoading: loadingAuth } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
  });

  // Lockscreen states
  const [unlocked, setUnlocked] = useState(false);
  const [verifyPasswordVal, setVerifyPasswordVal] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verifyVisible, setVerifyVisible] = useState(false);
  
  // Loading current settings
  const isAuthEnabled = authStatus?.password_auth_enabled ?? false;
  const isLocked = isAuthEnabled && !unlocked;

  const { data: settings, isLoading: loadingSettings, isError } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  // State values for forms
  const [keyVisible, setKeyVisible] = useState(false);
  const [liveKeyVisible, setLiveKeyVisible] = useState(false);
  const [passVisible, setPassVisible] = useState(false);
  const [googleIdVisible, setGoogleIdVisible] = useState(false);
  const [googleSecretVisible, setGoogleSecretVisible] = useState(false);
  const [showMfaEnroll, setShowMfaEnroll] = useState(false);
  const [activeTab, setActiveTab] = useState<"broker" | "strategy" | "auth">("broker");
  const [isRebalanceModalOpen, setIsRebalanceModalOpen] = useState(false);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [sendingReset, setSendingReset] = useState(false);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      });
    }
  }, []);



  // Form states (controlled inputs)
  const [formData, setFormData] = useState<Partial<SettingsUpdateRequest>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Sync loaded settings into form data on fetch
  const handleInputChange = (field: keyof SettingsUpdateRequest, value: any) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateMutation = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSuccessMsg("Settings updated successfully! In-process caches reloaded.");
      setTimeout(() => setSuccessMsg(null), 5000);
      setFormData({});
    },
    onError: (err: any) => {
      setErrorMsg(err.message || "Failed to update settings. Please try again.");
      setTimeout(() => setErrorMsg(null), 5000);
    },
  });

  if (isDemo) {
    return <Navigate to="/" replace />;
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setVerifying(true);
    setVerifyError(null);
    try {
      await api.verifyPassword(verifyPasswordVal);
      setUnlocked(true);
    } catch (err: any) {
      setVerifyError("Incorrect password. Access denied.");
    } finally {
      setVerifying(false);
    }
  };

  const isLoading = loadingAuth || loadingSettings;

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="w-8 h-8 text-brand-gold animate-spin" />
        <p className="text-sm text-faint">Retrieving configurations from server...</p>
      </div>
    );
  }



  if (isError || !settings) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
        <AlertCircle className="w-8 h-8 text-brand-red" />
        <h3 className="text-sm font-bold text-primary">Failed to Load Settings</h3>
        <p className="text-xs text-muted max-w-md">
          Ensure your backend server is active and you have permission to view configurations.
        </p>
      </div>
    );
  }

  // Helper values
  const currentTradingMode = formData.trading_mode ?? settings.trading_mode ?? "paper";
  const currentAlpacaKey = formData.alpaca_api_key ?? settings.alpaca_api_key_masked;
  const currentAlpacaSecret = formData.alpaca_api_secret ?? settings.alpaca_api_secret_masked;
  const currentAlpacaLiveKey = formData.alpaca_live_api_key ?? settings.alpaca_live_api_key_masked ?? "";
  const currentAlpacaLiveSecret = formData.alpaca_live_api_secret ?? settings.alpaca_live_api_secret_masked ?? "";
  const currentAlpacaUrl = formData.alpaca_base_url ?? settings.alpaca_base_url;

  const currentEtfSymbol = formData.etf_symbol ?? settings.etf_symbol;
  const currentTopN = formData.top_n ?? settings.top_n;
  const currentEtfSymbols = formData.etf_symbols ?? settings.etf_symbols;
  const currentSectorCap = formData.sector_cap ?? settings.sector_cap;
  const currentDriftThreshold = formData.drift_threshold ?? settings.drift_threshold;

  const currentPassword = formData.dashboard_password ?? settings.dashboard_password_masked;
  const currentGoogleId = formData.google_client_id ?? settings.google_client_id_masked;
  const currentGoogleSecret = formData.google_client_secret ?? settings.google_client_secret_masked;

  const currentGoogleRedirect = formData.google_redirect_uri ?? settings.google_redirect_uri;
  const currentGoogleEmails = formData.allowed_google_emails ?? settings.allowed_google_emails;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate({
      ...formData,
      current_password: verifyPasswordVal,
    });
  };


  const tabs = [
    { id: "broker", label: "Broker Credentials", icon: Key },
    { id: "strategy", label: "Strategy Parameters", icon: Sliders },
    { id: "auth", label: "Authentication", icon: Shield },
  ] as const;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      {/* Sidebar Navigation */}
      <div className="lg:col-span-1 flex flex-col gap-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-3 px-4 py-3 text-xs font-semibold tracking-wider uppercase border text-left transition-all duration-200 cursor-pointer ${
                isActive
                  ? "bg-sidebar border-brand-gold text-brand-gold shadow-[inset_3px_0_0_0_#d4af37]"
                  : "bg-transparent border-divider text-muted hover:text-primary hover:border-muted/30"
              }`}
            >
              <Icon size={14} className={isActive ? "text-brand-gold" : "text-faint"} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Settings Form Container */}
      <div className="lg:col-span-3 relative">
        {isLocked && (
          <div className="absolute inset-0 bg-page/30 backdrop-blur-[4px] z-10 flex flex-col items-center justify-start pt-16 px-6 text-center select-none">
            <div className="bg-sidebar border border-divider p-6 max-w-sm w-full space-y-4 shadow-2xl">
              <Shield className="w-8 h-8 text-brand-gold mx-auto" />
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Security Verification Required</h3>
              <p className="text-[11px] text-muted leading-relaxed">
                Please enter your dashboard password to view, verify, and modify your system configurations.
              </p>
              
              <form onSubmit={handleVerify} className="space-y-4 text-left">
                {verifyError && (
                  <div className="flex items-center gap-2 bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs p-3">
                    <AlertCircle size={14} />
                    <span>{verifyError}</span>
                  </div>
                )}
                
                <div className="relative">
                  <input
                    type={verifyVisible ? "text" : "password"}
                    value={verifyPasswordVal}
                    onChange={(e) => setVerifyPasswordVal(e.target.value)}
                    className="w-full bg-page border border-divider text-primary pl-3 pr-10 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                    placeholder="Enter dashboard password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setVerifyVisible(!verifyVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors cursor-pointer"
                  >
                    {verifyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                
                <button
                  type="submit"
                  disabled={verifying || !verifyPasswordVal}
                  className="w-full flex items-center justify-center gap-2 bg-brand-gold text-page hover:bg-brand-gold/90 disabled:bg-card-border disabled:text-muted disabled:border-transparent py-2 text-xs font-semibold tracking-wider uppercase transition-colors cursor-pointer"
                >
                  {verifying ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Unlock Settings"
                  )}
                </button>
              </form>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className={`space-y-6 transition-all duration-300 ${isLocked ? "blur-[5px] select-none pointer-events-none" : ""}`}>
          <Card className="border border-divider bg-sidebar">
            <CardContent className="pt-6 space-y-6">
              
              {/* ALERTS */}
              {successMsg && (
                <div className="flex items-center gap-3 bg-brand-green/10 border border-brand-green/20 text-brand-green text-xs p-4 animate-fade-in">
                  <CheckCircle2 size={16} />
                  <span>{successMsg}</span>
                </div>
              )}
              {errorMsg && (
                <div className="flex items-center gap-3 bg-brand-red/10 border border-brand-red/20 text-brand-red text-xs p-4 animate-fade-in">
                  <AlertCircle size={16} />
                  <span>{errorMsg}</span>
                </div>
              )}

              {/* BROKER & TRADING ENVIRONMENT SETTINGS */}
              {activeTab === "broker" && (
                <div className="space-y-6">
                  <div className="border-b border-divider pb-2">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Trading Environment & Broker API Setup</h3>
                    <p className="text-[10px] text-faint mt-1">
                      Manage active execution environment (Paper vs Live Real Money) and credentials.
                    </p>
                  </div>
                  
                  {/* ENVIRONMENT SELECTOR CARDS */}
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted">
                      Active Execution Mode
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        onClick={() => {
                          handleInputChange("trading_mode", "paper");
                          handleInputChange("alpaca_base_url", "https://paper-api.alpaca.markets");
                        }}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                          currentTradingMode === "paper"
                            ? "border-brand-gold bg-brand-gold/10"
                            : "border-divider bg-page hover:border-brand-gold/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Shield size={16} className="text-brand-gold" />
                          <div>
                            <div className="font-mono text-xs font-bold uppercase text-primary">Paper Trading</div>
                            <div className="text-[10px] text-muted">Simulated · Zero Financial Risk</div>
                          </div>
                        </div>
                        {currentTradingMode === "paper" && (
                          <span className="text-[10px] font-mono text-brand-gold border border-brand-gold/40 px-2 py-0.5 uppercase font-bold">
                            Active
                          </span>
                        )}
                      </div>

                      <div
                        onClick={() => {
                          handleInputChange("trading_mode", "live");
                          handleInputChange("alpaca_base_url", "https://api.alpaca.markets");
                        }}
                        className={`p-3.5 rounded-lg border transition-all cursor-pointer flex items-center justify-between ${
                          currentTradingMode === "live"
                            ? "border-rose-500 bg-rose-950/20"
                            : "border-divider bg-page hover:border-rose-500/40"
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <Flame size={16} className="text-rose-400 animate-pulse" />
                          <div>
                            <div className="font-mono text-xs font-bold uppercase text-rose-400">Live Real Money</div>
                            <div className="text-[10px] text-muted">Real Capital Execution</div>
                          </div>
                        </div>
                        {currentTradingMode === "live" && (
                          <span className="text-[10px] font-mono text-rose-400 border border-rose-500/40 px-2 py-0.5 uppercase font-bold">
                            Active Live
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PAPER CREDENTIALS */}
                  <div className="bg-[#12110E] border border-divider rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-divider/50 pb-2">
                      <div className="flex items-center gap-2">
                        <Shield size={14} className="text-brand-gold" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                          Paper Trading Credentials
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-faint">https://paper-api.alpaca.markets</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                          Paper API Key
                        </label>
                        <input
                          type="text"
                          value={currentAlpacaKey}
                          onChange={(e) => handleInputChange("alpaca_api_key", e.target.value)}
                          className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                          placeholder="PK..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1">
                          Paper Secret Key
                        </label>
                        <div className="relative">
                          <input
                            type={keyVisible ? "text" : "password"}
                            value={currentAlpacaSecret}
                            onChange={(e) => handleInputChange("alpaca_api_secret", e.target.value)}
                            className="w-full bg-page border border-divider text-primary pl-3 pr-10 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                            placeholder="Enter paper secret"
                          />
                          <button
                            type="button"
                            onClick={() => setKeyVisible(!keyVisible)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors cursor-pointer"
                          >
                            {keyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* LIVE REAL MONEY CREDENTIALS */}
                  <div className="bg-[#140D0E] border border-rose-900/30 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between border-b border-rose-900/40 pb-2">
                      <div className="flex items-center gap-2">
                        <Flame size={14} className="text-rose-400" />
                        <span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-300">
                          Live Real Money Credentials
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-rose-400/70">https://api.alpaca.markets</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-200/70 mb-1">
                          Live API Key ID
                        </label>
                        <input
                          type="text"
                          value={currentAlpacaLiveKey}
                          onChange={(e) => handleInputChange("alpaca_live_api_key", e.target.value)}
                          className="w-full bg-page border border-rose-900/40 text-primary px-3 py-2 text-xs focus:border-rose-500 focus:outline-none transition-colors"
                          placeholder="AK..."
                        />
                      </div>

                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-rose-200/70 mb-1">
                          Live Secret Key
                        </label>
                        <div className="relative">
                          <input
                            type={liveKeyVisible ? "text" : "password"}
                            value={currentAlpacaLiveSecret}
                            onChange={(e) => handleInputChange("alpaca_live_api_secret", e.target.value)}
                            className="w-full bg-page border border-rose-900/40 text-primary pl-3 pr-10 py-2 text-xs focus:border-rose-500 focus:outline-none transition-colors"
                            placeholder="Enter live secret"
                          />
                          <button
                            type="button"
                            onClick={() => setLiveKeyVisible(!liveKeyVisible)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors cursor-pointer"
                          >
                            {liveKeyVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                      Resolved Alpaca Endpoint URL
                    </label>
                    <input
                      type="text"
                      value={currentAlpacaUrl}
                      onChange={(e) => handleInputChange("alpaca_base_url", e.target.value)}
                      className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors font-mono"
                      placeholder="https://paper-api.alpaca.markets"
                    />
                  </div>
                </div>
              )}

              {/* STRATEGY SETTINGS */}
              {activeTab === "strategy" && (
                <div className="space-y-4">
                  <div className="border-b border-divider pb-2">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Automated Trading Engines</h3>
                    <p className="text-[10px] text-faint mt-1">
                      Choose which trading bot engines are authorized to run on your connected Alpaca account.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    {/* SHARIAH ALGO TRADER ACTIVE BADGE */}
                    <div className="p-4 bg-sidebar border border-brand-gold/40 rounded-lg shadow-sm">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs uppercase tracking-wider text-primary flex items-center gap-2">
                            <ShieldCheck size={16} className="text-brand-gold" />
                            <span>Long-Term Shariah Algo Trader</span>
                          </div>
                          <p className="text-[11px] text-muted mt-1 leading-relaxed">
                            Active execution engine for your account. Executes monthly factor rebalancing and Shariah compliance tracking. Maintains long-term positions overnight.
                          </p>
                        </div>
                        <span className="px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase bg-brand-gold/10 text-brand-gold border border-brand-gold/30 rounded shrink-0 ml-2">
                          Active User Strategy
                        </span>
                      </div>
                    </div>

                    {/* DAY TRADER BENCHMARK ISOLATION CARD */}
                    <div className="p-4 bg-page/60 border border-divider rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-bold text-xs uppercase tracking-wider text-muted flex items-center gap-2">
                            <Flame size={16} className="text-muted" />
                            <span>Day Trader Strategy (Benchmark Engine)</span>
                          </div>
                          <p className="text-[11px] text-faint mt-1 leading-relaxed">
                            Isolated comparison benchmark engine. Runs strictly on dedicated server credentials for performance comparison against intraday strategies. <strong>Never accesses user accounts.</strong>
                          </p>
                        </div>
                        <span className="px-2.5 py-1 text-[9px] font-bold tracking-wider uppercase bg-sidebar text-muted border border-divider rounded shrink-0 ml-2">
                          Benchmark Only
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="border-b border-divider pb-2 pt-2">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Shariah Algo Strategy Parameters</h3>
                    <p className="text-[10px] text-faint mt-1">
                      Customize portfolio limits, sector caps, and drift thresholds for factor ranking.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Primary ETF Target
                      </label>
                      <input
                        type="text"
                        value={currentEtfSymbol}
                        onChange={(e) => handleInputChange("etf_symbol", e.target.value)}
                        className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                        placeholder="SPUS"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Portfolio Size (Top N)
                      </label>
                      <input
                        type="number"
                        value={currentTopN}
                        onChange={(e) => handleInputChange("top_n", parseInt(e.target.value, 10))}
                        className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                        placeholder="20"
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Eligible Universe Source ETFs (Comma-separated)
                      </label>
                      <input
                        type="text"
                        value={currentEtfSymbols.join(", ")}
                        onChange={(e) =>
                          handleInputChange(
                            "etf_symbols",
                            e.target.value.split(",").map((s) => s.trim())
                          )
                        }
                        className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                        placeholder="SPUS, HLAL"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        GICS Sector Cap (Decimal)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        value={currentSectorCap}
                        onChange={(e) => handleInputChange("sector_cap", parseFloat(e.target.value))}
                        className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                        placeholder="0.20"
                      />
                      <span className="text-[9px] text-faint mt-1 block">0.20 represents a 20% max allocation per sector.</span>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Drift Rebalance Threshold (Decimal)
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        value={currentDriftThreshold}
                        onChange={(e) => handleInputChange("drift_threshold", parseFloat(e.target.value))}
                        className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                        placeholder="0.03"
                      />
                      <span className="text-[9px] text-faint mt-1 block">0.03 represents 3% drift triggers rebalance.</span>
                    </div>
                  </div>

                  <div className="bg-brand-gold/10 border border-brand-gold/40 rounded-lg p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mt-4">
                    <div>
                      <div className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-1.5">
                        <Flame size={14} className="text-brand-gold animate-pulse" />
                        <span>Instant Manual Rebalance Trigger</span>
                      </div>
                      <div className="text-[11px] text-muted mt-0.5">
                        Manually trigger an immediate factor-ranked rebalance to allocate cash or re-align open positions on your active trading account.
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsRebalanceModalOpen(true)}
                      className="px-4 py-2 bg-brand-gold text-slate-950 font-bold text-xs uppercase tracking-wider rounded hover:bg-brand-gold/90 transition-all cursor-pointer whitespace-nowrap shadow-md shrink-0"
                    >
                      ⚡ Execute Rebalance Now
                    </button>
                  </div>
                </div>
              )}

              {/* AUTH / ACCOUNT SECURITY SETTINGS */}
              {activeTab === "auth" && (
                <div className="space-y-6">
                  <div className="border-b border-divider pb-2">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">
                      {authStatus?.supabase_enabled || authStatus?.clerk_enabled ? "Account Security & 2FA" : "Access Security & Authentication"}
                    </h3>
                    <p className="text-[10px] text-faint mt-1">
                      {authStatus?.supabase_enabled || authStatus?.clerk_enabled
                        ? "Manage your user profile, multi-factor authentication, and security credentials."
                        : "Set console access passwords or setup Google OAuth configs for single-tenant sign-in."}
                    </p>
                  </div>

                  {authStatus?.supabase_enabled ? (
                    <div className="space-y-4">
                      {/* Authenticated Account Profile */}
                      <div className="bg-page border border-divider p-4 space-y-3">
                        <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                          <Mail size={13} className="text-brand-gold" /> Authenticated Account Profile
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                          <div>
                            <span className="text-[9px] text-faint block uppercase font-mono">User Email Address</span>
                            <span className="font-mono text-primary font-semibold">{userEmail || "Authenticated User"}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-faint block uppercase font-mono">Authentication Provider</span>
                            <span className="font-mono text-emerald-400 font-semibold flex items-center gap-1">
                              <CheckCircle2 size={12} /> Supabase Auth Engine (ES256)
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Password Reset Section */}
                      <div className="bg-page border border-divider p-4 space-y-3">
                        <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest flex items-center gap-1.5">
                          <Lock size={13} className="text-brand-gold" /> Password Management
                        </h4>
                        <p className="text-[11px] text-muted leading-relaxed">
                          Need to update your account password? Click below to receive a password reset link at your registered email address.
                        </p>
                        <button
                          type="button"
                          disabled={sendingReset || !userEmail}
                          onClick={async () => {
                            if (!supabase || !userEmail) return;
                            setSendingReset(true);
                            try {
                              const { error } = await supabase.auth.resetPasswordForEmail(userEmail, {
                                redirectTo: `${window.location.origin}/login`,
                              });
                              if (error) throw error;
                              setSuccessMsg(`Password reset link sent to ${userEmail}! Please check your email.`);
                              setTimeout(() => setSuccessMsg(null), 5000);
                            } catch (err: any) {
                              setErrorMsg(err.message || "Failed to send password reset link.");
                              setTimeout(() => setErrorMsg(null), 5000);
                            } finally {
                              setSendingReset(false);
                            }
                          }}
                          className="px-3 py-2 bg-transparent border border-brand-gold/60 text-brand-gold hover:bg-brand-gold hover:text-page text-[10px] font-bold tracking-wider uppercase transition-colors cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                          {sendingReset ? (
                            <>
                              <Loader2 size={12} className="animate-spin" />
                              Sending Reset Email...
                            </>
                          ) : (
                            "Send Password Reset Email"
                          )}
                        </button>
                      </div>

                      {/* Multi-Factor Authentication */}
                      <div className="bg-page border border-divider p-4 space-y-3">
                        <h4 className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                          <ShieldCheck size={14} /> Multi-Factor Authentication (TOTP 2FA)
                        </h4>
                        <p className="text-xs text-muted leading-relaxed">
                          Protect real-money trading and strategy configurations with 2-Factor Authentication (Google Authenticator / 1Password).
                        </p>
                        <button
                          type="button"
                          onClick={() => setShowMfaEnroll(true)}
                          className="px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/40 text-emerald-300 text-[10px] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer uppercase tracking-wider"
                        >
                          <ShieldCheck size={13} />
                          Configure / Enable TOTP MFA
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Legacy Single-Tenant Admin Auth Config (Only shown if Supabase/Clerk is not enabled) */
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                          Dashboard Sign-in Password
                        </label>
                        <div className="relative">
                          <input
                            type={passVisible ? "text" : "password"}
                            value={currentPassword}
                            onChange={(e) => handleInputChange("dashboard_password", e.target.value)}
                            className="w-full bg-page border border-divider text-primary pl-3 pr-10 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                            placeholder="Console password (optional)"
                          />
                          <button
                            type="button"
                            onClick={() => setPassVisible(!passVisible)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors cursor-pointer"
                          >
                            {passVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-divider">
                        <h4 className="text-[10px] font-bold text-primary uppercase tracking-widest mb-3">Google OAuth Configuration</h4>
                        
                        <div className="space-y-3">
                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                              Google Client ID
                            </label>
                            <div className="relative">
                              <input
                                type={googleIdVisible ? "text" : "password"}
                                value={currentGoogleId ?? ""}
                                onChange={(e) => handleInputChange("google_client_id", e.target.value || null)}
                                className="w-full bg-page border border-divider text-primary pl-3 pr-10 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                                placeholder="Enter Google Client ID"
                              />
                              <button
                                type="button"
                                onClick={() => setGoogleIdVisible(!googleIdVisible)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors cursor-pointer"
                              >
                                {googleIdVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                              Google Client Secret
                            </label>
                            <div className="relative">
                              <input
                                type={googleSecretVisible ? "text" : "password"}
                                value={currentGoogleSecret ?? ""}
                                onChange={(e) => handleInputChange("google_client_secret", e.target.value || null)}
                                className="w-full bg-page border border-divider text-primary pl-3 pr-10 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                                placeholder="Enter Google client secret token"
                              />
                              <button
                                type="button"
                                onClick={() => setGoogleSecretVisible(!googleSecretVisible)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-primary transition-colors cursor-pointer"
                              >
                                {googleSecretVisible ? <EyeOff size={14} /> : <Eye size={14} />}
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                              Google Redirect Callback URI
                            </label>
                            <input
                              type="text"
                              value={currentGoogleRedirect ?? ""}
                              onChange={(e) => handleInputChange("google_redirect_uri", e.target.value || null)}
                              className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                              placeholder="https://yourdomain.com/api/auth/google/callback"
                            />
                          </div>

                          <div>
                            <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                              Whitelisted Access Email Addresses (Comma-separated)
                            </label>
                            <input
                              type="text"
                              value={currentGoogleEmails.join(", ")}
                              onChange={(e) =>
                                handleInputChange(
                                  "allowed_google_emails",
                                  e.target.value.split(",").map((em) => em.trim())
                                )
                              }
                              className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                              placeholder="user1@gmail.com, user2@gmail.com"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SAVE BUTTON */}
              <div className="flex items-center justify-end border-t border-divider pt-4 mt-6">
                <button
                  type="submit"
                  disabled={updateMutation.isPending || Object.keys(formData).length === 0}
                  className="flex items-center gap-2 bg-brand-gold text-page hover:bg-brand-gold/90 disabled:bg-card-border disabled:text-muted disabled:border-transparent px-4 py-2 border border-brand-gold text-xs font-semibold tracking-wider uppercase transition-all select-none cursor-pointer"
                >
                  {updateMutation.isPending ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save size={13} />
                      Save Configurations
                    </>
                  )}
                </button>
              </div>

            </CardContent>
          </Card>
        </form>

        <MfaEnrollModal
          isOpen={showMfaEnroll}
          onClose={() => setShowMfaEnroll(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["authStatus"] });
          }}
        />

        <RebalanceModal
          isOpen={isRebalanceModalOpen}
          onClose={() => setIsRebalanceModalOpen(false)}
          onSuccess={() => {
            queryClient.invalidateQueries({ queryKey: ["portfolio"] });
            queryClient.invalidateQueries({ queryKey: ["account"] });
            queryClient.invalidateQueries({ queryKey: ["activity"] });
          }}
        />
      </div>
    </div>
  );
}

