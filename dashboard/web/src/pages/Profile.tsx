import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ShieldCheck,
  Sliders,
  CheckCircle2,
  Save,
  ArrowUpRight,
  Layers,
  KeyRound,
  Info,
  UserCheck,
} from "lucide-react";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type SettingsResponse } from "../lib/api";
import { UserAvatar } from "../components/UserAvatar";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/Card";
import { supabase } from "../lib/supabaseClient";

const COUNTRIES = [
  "Malaysia",
  "United States",
  "United Kingdom",
  "Singapore",
  "Saudi Arabia",
  "United Arab Emirates",
  "Indonesia",
  "Canada",
  "Australia",
  "Germany",
  "Turkey",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Other",
];

const INVESTOR_TYPES = [
  {
    id: "individual",
    label: "Individual Trader",
    desc: "Personal portfolio, automated halal rebalancing",
  },
  {
    id: "accredited",
    label: "Accredited / HNW",
    desc: "Qualified private wealth, multi-factor allocation",
  },
  {
    id: "family_office",
    label: "Family Office / Fund",
    desc: "Institutional multi-tenant Shariah asset deployment",
  },
  {
    id: "researcher",
    label: "Quantitative Researcher",
    desc: "Academic backtesting, strategy validation & paper node",
  },
];

export function Profile() {
  const queryClient = useQueryClient();

  const { data: settings } = useQuery<SettingsResponse>({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const { data: auth } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [quantHandle, setQuantHandle] = useState("");
  const [country, setCountry] = useState("Malaysia");
  const [investorType, setInvestorType] = useState("individual");
  const [userEmail, setUserEmail] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      if (settings.first_name) setFirstName(settings.first_name);
      if (settings.last_name) setLastName(settings.last_name);
      if (settings.quant_handle) setQuantHandle(settings.quant_handle);
      if (settings.country) setCountry(settings.country);
      if (settings.investor_type) setInvestorType(settings.investor_type);
    }
  }, [settings]);

  useEffect(() => {
    if (auth?.user_email) {
      setUserEmail(auth.user_email);
    } else if (supabase) {
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user?.email) {
          setUserEmail(data.user.email);
        }
      });
    }
  }, [auth]);

  const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Quant Operator";
  const displayHandle = quantHandle.startsWith("@") ? quantHandle : quantHandle ? `@${quantHandle}` : "@pilot";

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      await api.updateSettings({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        quant_handle: displayHandle.trim(),
        country: country,
        investor_type: investorType,
        trading_mode: "paper",
        onboarding_completed_at: settings?.onboarding_completed_at || new Date().toISOString(),
      });

      await queryClient.invalidateQueries({ queryKey: ["settings"] });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err: any) {
      setSaveError(err.message || "Failed to update profile identity");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Operator ID Banner Card */}
      <Card className="border border-divider">
        <div className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <UserAvatar className="w-14 h-14 text-base border border-brand-gold/60" />
            <div className="space-y-1">
              <div className="flex items-center gap-3">
                <h2 className="text-lg font-bold text-primary tracking-tight">{fullName}</h2>
                <span className="font-mono text-xs text-brand-gold font-bold">{displayHandle}</span>
                <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 border border-brand-green/40 text-brand-green bg-brand-green/10">
                  Pilot Verified
                </span>
              </div>
              <p className="text-xs font-mono text-muted flex items-center gap-2">
                <span>{userEmail || "pilot@shariahtrading.my"}</span>
                <span>·</span>
                <span>{country}</span>
                <span>·</span>
                <span className="uppercase text-primary">{investorType.replace("_", " ")}</span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto">
            <Link
              to="/app"
              className="px-4 py-2 border border-divider hover:border-brand-gold/40 text-muted hover:text-brand-gold text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>Console Overview</span>
              <ArrowUpRight size={13} />
            </Link>
            <Link
              to="/app/settings"
              className="px-4 py-2 border border-divider hover:border-primary text-muted hover:text-primary text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Sliders size={13} />
              <span>Broker Keys</span>
            </Link>
          </div>
        </div>

        {/* Fact Matrix Grid */}
        <div className="border-t border-divider grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-divider bg-card">
          <div className="p-4">
            <span className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] block">
              Shariah Standard
            </span>
            <div className="font-mono text-xs text-brand-green font-bold flex items-center gap-1.5 mt-1">
              <ShieldCheck size={13} />
              <span>AAOIFI No. 21 (100% Halal)</span>
            </div>
          </div>

          <div className="p-4">
            <span className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] block">
              Target Universe
            </span>
            <div className="font-mono text-xs text-primary font-bold flex items-center gap-1.5 mt-1">
              <Layers size={13} />
              <span>SPUS S&P Halal Top 20</span>
            </div>
          </div>

          <div className="p-4">
            <span className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] block">
              Alpaca Paper Key
            </span>
            <div className="font-mono text-xs text-brand-gold font-bold flex items-center gap-1.5 mt-1 truncate">
              <KeyRound size={13} className="shrink-0" />
              <span>{settings?.alpaca_api_key_masked || "Connected"}</span>
            </div>
          </div>

          <div className="p-4">
            <span className="text-[10px] font-semibold text-section uppercase tracking-[0.09em] block">
              Admin Spectate
            </span>
            <div className="font-mono text-xs text-brand-blue font-bold flex items-center gap-1.5 mt-1">
              <UserCheck size={13} />
              <span>Synchronized</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Main Form & Architecture Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Form (2 cols) */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border border-divider">
            <CardHeader className="flex items-center justify-between">
              <CardTitle>Quant Identity Profile</CardTitle>
              <span className="text-[10px] font-mono text-muted uppercase">Terminal Settings</span>
            </CardHeader>

            <CardContent>
              {saveSuccess && (
                <div className="mb-5 p-3 border border-brand-green/40 bg-brand-green/10 text-brand-green text-xs font-mono flex items-center gap-2">
                  <CheckCircle2 size={14} className="shrink-0" />
                  <span>Profile updated and synced with cloud database.</span>
                </div>
              )}

              {saveError && (
                <div className="mb-5 p-3 border border-brand-red/40 bg-brand-red/10 text-brand-red text-xs font-mono flex items-center gap-2">
                  <Info size={14} className="shrink-0" />
                  <span>{saveError}</span>
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-6">
                {/* First and Last Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1.5">
                      First Name
                    </label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="e.g. John"
                      className="w-full bg-transparent border border-divider px-3 py-2 text-xs font-mono text-primary focus:border-brand-gold focus:outline-none rounded-none placeholder:text-faint"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1.5">
                      Last Name
                    </label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="e.g. Cena"
                      className="w-full bg-transparent border border-divider px-3 py-2 text-xs font-mono text-primary focus:border-brand-gold focus:outline-none rounded-none placeholder:text-faint"
                      required
                    />
                  </div>
                </div>

                {/* Handle and Jurisdiction */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1.5">
                      Quant Handle / Alias
                    </label>
                    <input
                      type="text"
                      value={quantHandle}
                      onChange={(e) => setQuantHandle(e.target.value)}
                      placeholder="@john_trader"
                      className="w-full bg-transparent border border-divider px-3 py-2 text-xs font-mono text-brand-gold font-bold focus:border-brand-gold focus:outline-none rounded-none placeholder:text-faint"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-1.5">
                      Country / Jurisdiction
                    </label>
                    <select
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      className="w-full bg-page border border-divider px-3 py-2 text-xs font-mono text-primary focus:border-brand-gold focus:outline-none rounded-none cursor-pointer"
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c} value={c} className="bg-page text-primary">
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Investor Classification Persona */}
                <div>
                  <label className="text-[10px] font-mono text-muted uppercase tracking-wider block mb-2">
                    Account Classification Persona
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {INVESTOR_TYPES.map((type) => {
                      const active = investorType === type.id;
                      return (
                        <div
                          key={type.id}
                          onClick={() => setInvestorType(type.id)}
                          className={`p-3.5 border cursor-pointer select-none transition-colors ${
                            active
                              ? "border-brand-gold bg-brand-gold/5 text-primary"
                              : "border-divider bg-page/40 text-muted hover:border-muted hover:text-primary"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-1">
                            <span className="font-semibold text-xs text-primary">{type.label}</span>
                            <span
                              className={`w-3.5 h-3.5 border flex items-center justify-center ${
                                active ? "border-brand-gold bg-brand-gold text-page" : "border-divider"
                              }`}
                            >
                              {active && <span className="w-1.5 h-1.5 bg-page" />}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted leading-relaxed">{type.desc}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Submit Action */}
                <div className="pt-4 border-t border-divider flex justify-end">
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-6 py-2.5 bg-brand-gold text-page font-bold text-xs uppercase tracking-wider hover:bg-brand-gold/90 transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <Save size={14} />
                    <span>{saving ? "Saving Changes…" : "Save Profile"}</span>
                  </button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Node Details & Shariah Mandate (1 col) */}
        <div className="space-y-6">
          <Card className="border border-divider">
            <CardHeader>
              <CardTitle>Execution & Broker Node</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-xs font-mono">
              <p className="text-muted leading-relaxed font-sans text-xs">
                Execution node configured strictly with Alpaca Paper API. All automated rebalances execute in accordance with the Shariah mandate.
              </p>

              <div className="space-y-2">
                <div className="p-2.5 border border-divider flex justify-between items-center">
                  <span className="text-muted uppercase text-[10px]">Broker Endpoint:</span>
                  <span className="text-primary font-semibold">Alpaca Paper API</span>
                </div>
                <div className="p-2.5 border border-divider flex justify-between items-center">
                  <span className="text-muted uppercase text-[10px]">Active Key:</span>
                  <span className="text-brand-gold font-semibold">{settings?.alpaca_api_key_masked || "Configured"}</span>
                </div>
                <div className="p-2.5 border border-divider flex justify-between items-center">
                  <span className="text-muted uppercase text-[10px]">Trading Mode:</span>
                  <span className="text-brand-green font-semibold uppercase">PAPER ONLY</span>
                </div>
                <div className="p-2.5 border border-divider flex justify-between items-center">
                  <span className="text-muted uppercase text-[10px]">Rebalance Engine:</span>
                  <span className="text-brand-green font-semibold">Active · Daily EOD</span>
                </div>
              </div>

              <Link
                to="/app/settings"
                className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 border border-divider hover:border-brand-gold/40 text-muted hover:text-brand-gold text-xs font-semibold uppercase tracking-wider transition-colors cursor-pointer"
              >
                <KeyRound size={13} />
                <span>Update Broker API Keys</span>
              </Link>
            </CardContent>
          </Card>

          <Card className="border border-divider">
            <CardHeader>
              <CardTitle>Shariah Standard No. 21</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-xs">
              <p className="text-muted leading-relaxed">
                The Shariah Algo Trader platform strictly abides by the <strong>Accounting and Auditing Organization for Islamic Financial Institutions (AAOIFI)</strong> Standard No. 21 rules:
              </p>
              <ul className="space-y-2 text-muted list-disc list-inside font-mono text-[11px]">
                <li>Zero Interest (Riba) &amp; Margin Borrowing</li>
                <li>Zero Short Selling (Qimar / Gharar)</li>
                <li>100% Cash-Backed Spot Equity Ownership</li>
                <li>Debt-to-Market-Cap Ratio &lt; 33% Verified</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
