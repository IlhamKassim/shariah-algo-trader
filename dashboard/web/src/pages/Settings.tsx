import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, Save, Key, Sliders, Shield, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";
import type { SettingsUpdateRequest } from "../lib/api";
import { Card, CardContent } from "../components/ui/Card";

export function Settings() {
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
  const [passVisible, setPassVisible] = useState(false);
  const [googleSecretVisible, setGoogleSecretVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<"broker" | "strategy" | "auth">("broker");

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
  const currentAlpacaKey = formData.alpaca_api_key ?? settings.alpaca_api_key;
  const currentAlpacaSecret = formData.alpaca_api_secret ?? settings.alpaca_api_secret_masked;
  const currentAlpacaUrl = formData.alpaca_base_url ?? settings.alpaca_base_url;

  const currentEtfSymbol = formData.etf_symbol ?? settings.etf_symbol;
  const currentTopN = formData.top_n ?? settings.top_n;
  const currentEtfSymbols = formData.etf_symbols ?? settings.etf_symbols;
  const currentSectorCap = formData.sector_cap ?? settings.sector_cap;
  const currentDriftThreshold = formData.drift_threshold ?? settings.drift_threshold;

  const currentPassword = formData.dashboard_password ?? settings.dashboard_password_masked;
  const currentGoogleId = formData.google_client_id ?? settings.google_client_id;
  const currentGoogleSecret = formData.google_client_secret ?? settings.google_client_secret_masked;
  const currentGoogleRedirect = formData.google_redirect_uri ?? settings.google_redirect_uri;
  const currentGoogleEmails = formData.allowed_google_emails ?? settings.allowed_google_emails;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
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

              {/* BROKER SETTINGS */}
              {activeTab === "broker" && (
                <div className="space-y-4">
                  <div className="border-b border-divider pb-2">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Alpaca Broker API Setup</h3>
                    <p className="text-[10px] text-faint mt-1">
                      Configure credentials for execution. Make sure transfers are disabled on these keys.
                    </p>
                  </div>
                  
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Alpaca API Key ID
                      </label>
                      <input
                        type="text"
                        value={currentAlpacaKey}
                        onChange={(e) => handleInputChange("alpaca_api_key", e.target.value)}
                        className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                        placeholder="Enter Alpaca API Key"
                      />
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Alpaca Secret Key
                      </label>
                      <div className="relative">
                        <input
                          type={keyVisible ? "text" : "password"}
                          value={currentAlpacaSecret}
                          onChange={(e) => handleInputChange("alpaca_api_secret", e.target.value)}
                          className="w-full bg-page border border-divider text-primary pl-3 pr-10 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                          placeholder="Enter secret key payload"
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

                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-muted mb-1.5">
                        Alpaca Base URL
                      </label>
                      <input
                        type="text"
                        value={currentAlpacaUrl}
                        onChange={(e) => handleInputChange("alpaca_base_url", e.target.value)}
                        className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                        placeholder="https://paper-api.alpaca.markets"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* STRATEGY SETTINGS */}
              {activeTab === "strategy" && (
                <div className="space-y-4">
                  <div className="border-b border-divider pb-2">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Shariah Algo Strategy Settings</h3>
                    <p className="text-[10px] text-faint mt-1">
                      Customize portfolio limits, sector caps, and drift thresholds.
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
                </div>
              )}

              {/* AUTH SETTINGS */}
              {activeTab === "auth" && (
                <div className="space-y-4">
                  <div className="border-b border-divider pb-2">
                    <h3 className="text-xs font-bold text-primary uppercase tracking-wider">Access Security & Authentication</h3>
                    <p className="text-[10px] text-faint mt-1">
                      Set console access passwords or setup Google OAuth configs for multi-tenant sign-in.
                    </p>
                  </div>

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
                          <input
                            type="text"
                            value={currentGoogleId ?? ""}
                            onChange={(e) => handleInputChange("google_client_id", e.target.value || null)}
                            className="w-full bg-page border border-divider text-primary px-3 py-2 text-xs focus:border-brand-gold focus:outline-none transition-colors"
                            placeholder="Enter Google Client ID"
                          />
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
      </div>
    </div>
  );
}
