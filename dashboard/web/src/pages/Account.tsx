import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { api, type SettingsResponse, type SettingsUpdateRequest } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { ConsoleShell } from "../components/ConsoleShell";
import { AccountModeModal } from "../components/AccountModeModal";
import {
  Field,
  SaveBar,
  SecretField,
  Segmented,
  Slider,
  Ticker,
  Toggle,
  inputClass,
} from "../components/console/controls";

type Tab = "Profile" | "Strategy" | "Broker" | "Security";
const TABS: Tab[] = ["Profile", "Strategy", "Broker", "Security"];

const INVESTOR_TYPES = ["Retail", "Professional", "Institutional", "Student"];
const COUNTRIES = ["Malaysia", "Singapore", "Indonesia", "Brunei", "United Kingdom", "United States", "Other"];

const money = (n: number, dp = 0) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  }).format(n);

function Card({
  title,
  sub,
  children,
  accent,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  accent?: string;
}) {
  return (
    <section className="bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] p-[22px] flex flex-col gap-5 min-w-0">
      <div className="flex items-start gap-2.5 min-w-0">
        <span
          className="w-[22px] h-[22px] shrink-0 rounded-[var(--r-chip)] block mt-0.5"
          style={{ background: accent ?? "var(--c-ink)" }}
        />
        <div className="min-w-0">
          <h2 className="text-[16px] font-semibold tracking-[-0.01em]">{title}</h2>
          {sub && <p className="text-[12.5px] text-[var(--c-mid)] mt-1 leading-[1.5]">{sub}</p>}
        </div>
      </div>
      {children}
    </section>
  );
}

/**
 * The point of this panel: strategy settings are opaque numbers until you can
 * see what the engine does with them. Everything here recomputes the real
 * selection maths from factors/scorer.py as the sliders move.
 */
function StrategyImpact({ topN, sectorCap, drift, equity }: {
  topN: number;
  sectorCap: number;
  drift: number;
  equity: number;
}) {
  // max_per_sector = max(1, int(sector_cap * top_n))  — factors/scorer.py:67
  const maxPerSector = Math.max(1, Math.floor(sectorCap * topN));
  const effectivePct = (maxPerSector / topN) * 100;
  const requestedPct = sectorCap * 100;
  // int() truncates, so the enforced cap can sit below the configured one.
  const truncated = requestedPct - effectivePct > 0.05;
  const minSectors = Math.ceil(topN / maxPerSector);
  const equalWeight = equity > 0 ? equity / topN : 0;
  const driftDollars = equalWeight * drift;

  const rows = [
    {
      k: "cap",
      label: "Max stocks per sector",
      value: <Ticker value={maxPerSector} className="console-figure text-[26px] tabular-nums" />,
      sub: truncated ? (
        <span className="text-[var(--c-amber)]">
          Enforced {effectivePct.toFixed(1)}%, not the {requestedPct.toFixed(0)}% you set — the
          engine truncates rather than rounds
        </span>
      ) : (
        `${effectivePct.toFixed(1)}% of the book, matching your setting`
      ),
    },
    {
      k: "sectors",
      label: "Sectors needed to fill",
      value: <Ticker value={minSectors} className="console-figure text-[26px] tabular-nums" />,
      sub:
        minSectors > 8
          ? "More than most screens supply — the book may end up under-filled"
          : `At least ${minSectors} distinct GICS sectors must qualify`,
    },
    {
      k: "weight",
      label: "Equal weight per position",
      value: (
        <Ticker
          value={equalWeight}
          format={(v) => money(v)}
          className="console-figure text-[26px] tabular-nums"
        />
      ),
      sub: `Sizing is inverse-volatility, capped at 2× this (${money(equalWeight * 2)})`,
    },
    {
      k: "drift",
      label: "Rebalance trigger",
      value: (
        <Ticker
          value={driftDollars}
          format={(v) => money(v)}
          className="console-figure text-[26px] tabular-nums"
        />
      ),
      sub: `A position drifting ${(drift * 100).toFixed(1)}% from target forces an early rebalance`,
    },
  ];

  return (
    <div className="bg-[var(--c-soft)] rounded-[var(--r-inset)] p-5 grid grid-cols-[repeat(auto-fit,minmax(min(200px,100%),1fr))] gap-5">
      {rows.map((r) => (
        <div key={r.k} className="min-w-0">
          <div className="text-[11px] text-[var(--c-mute)] uppercase tracking-[0.06em]">
            {r.label}
          </div>
          <div className="mt-1 tracking-[-0.02em]">{r.value}</div>
          <div className="text-[11.5px] text-[var(--c-mid)] mt-1.5 leading-[1.5]">{r.sub}</div>
        </div>
      ))}
    </div>
  );
}

export function Account() {
  const queryClient = useQueryClient();
  const isDemo = localStorage.getItem("shariah_demo_mode") === "true";

  const [tab, setTab] = useState<Tab>("Profile");
  const [draft, setDraft] = useState<Partial<SettingsUpdateRequest>>({});
  const [modeModal, setModeModal] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [toast, setToast] = useState<{ kind: "ok" | "err"; msg: string } | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });
  const { data: account } = useQuery({ queryKey: ["account"], queryFn: api.account });
  const { data: auth } = useQuery({ queryKey: ["authStatus"], queryFn: api.authStatus });
  const { data: status } = useQuery({ queryKey: ["status"], queryFn: api.status });

  const save = useMutation({
    mutationFn: api.updateSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
      setDraft({});
      setToast({ kind: "ok", msg: "Settings saved — in-process caches reloaded." });
      setTimeout(() => setToast(null), 4000);
    },
    onError: (e: Error) => {
      setToast({ kind: "err", msg: e.message || "Could not save settings." });
      setTimeout(() => setToast(null), 6000);
    },
  });

  // Draft value falls back to the saved one, so every control is controlled.
  const val = <K extends keyof SettingsResponse & keyof SettingsUpdateRequest>(
    key: K,
    fallback: NonNullable<SettingsResponse[K]>,
  ): NonNullable<SettingsResponse[K]> =>
    (draft[key] as NonNullable<SettingsResponse[K]> | undefined) ??
    (settings?.[key] as NonNullable<SettingsResponse[K]> | undefined) ??
    fallback;

  const set = (patch: Partial<SettingsUpdateRequest>) =>
    setDraft((d) => ({ ...d, ...patch }));

  const dirtyCount = Object.keys(draft).length;

  const topN = val("top_n", 20) as number;
  const sectorCap = val("sector_cap", 0.2) as number;
  const drift = val("drift_threshold", 0.03) as number;
  const equity = account?.portfolio_value ?? 0;

  const mode: "paper" | "live" =
    (status?.trading_mode as "paper" | "live") ??
    (settings?.trading_mode as "paper" | "live") ??
    "paper";

  const fullName = useMemo(() => {
    const f = (val("first_name", "") as string) || "";
    const l = (val("last_name", "") as string) || "";
    return [f, l].filter(Boolean).join(" ") || "Unnamed operator";
  }, [draft, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ConsoleShell
      breadcrumb="Account"
      aside={
        <Segmented
          idPrefix="account-tabs"
          value={tab}
          onChange={setTab}
          options={TABS.map((t) => ({ value: t, label: t }))}
        />
      }
    >
      <div className="bg-[var(--c-sheet)] rounded-t-[var(--r-sheet)] p-[26px] flex flex-col gap-[22px] min-h-[70vh] pb-24">
        {isDemo && (
          <div className="bg-[rgba(240,190,67,0.16)] text-[#8A6D0F] rounded-[var(--r-inset)] px-5 py-3.5 text-[12.5px] leading-[1.55]">
            <strong className="font-semibold">Demo mode.</strong> These are sample values and
            nothing here reaches a broker. Saving is disabled.
          </div>
        )}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="flex flex-col gap-[22px]"
          >
            {isLoading ? (
              <p className="text-[13px] text-[var(--c-mid)] py-16 text-center">
                Retrieving configuration…
              </p>
            ) : tab === "Profile" ? (
              <>
                <Card title="Operator" sub="How you appear across the console." accent="var(--c-blue)">
                  <div className="flex items-center gap-4">
                    <span className="w-14 h-14 shrink-0 rounded-full bg-gradient-to-br from-[#2563EB] to-[#7C5CFC] text-white flex items-center justify-center text-[18px] font-bold">
                      {fullName.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0">
                      <div className="console-display text-[24px] tracking-[-0.005em] truncate">
                        {fullName}
                      </div>
                      <div className="text-[12.5px] text-[var(--c-mid)]">
                        @{(val("quant_handle", "") as string) || "unset"} ·{" "}
                        {val("country", "Malaysia") as string}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(220px,100%),1fr))] gap-4">
                    <Field label="First name">
                      <input
                        className={inputClass}
                        value={val("first_name", "") as string}
                        onChange={(e) => set({ first_name: e.target.value })}
                      />
                    </Field>
                    <Field label="Last name">
                      <input
                        className={inputClass}
                        value={val("last_name", "") as string}
                        onChange={(e) => set({ last_name: e.target.value })}
                      />
                    </Field>
                    <Field label="Handle" hint="Shown on shared reports.">
                      <input
                        className={inputClass}
                        value={val("quant_handle", "") as string}
                        onChange={(e) => set({ quant_handle: e.target.value })}
                      />
                    </Field>
                    <Field label="Country">
                      <select
                        className={inputClass}
                        value={val("country", "Malaysia") as string}
                        onChange={(e) => set({ country: e.target.value })}
                      >
                        {COUNTRIES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Investor type">
                      <select
                        className={inputClass}
                        value={val("investor_type", "Retail") as string}
                        onChange={(e) => set({ investor_type: e.target.value })}
                      >
                        {INVESTOR_TYPES.map((c) => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                  </div>
                </Card>
              </>
            ) : tab === "Strategy" ? (
              <>
                <Card
                  title="Portfolio construction"
                  sub="Drag a value and the panel below recomputes what the engine would actually do with it."
                  accent="var(--c-blue)"
                >
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-6">
                    <Slider
                      label="Portfolio size (top N)"
                      value={topN}
                      min={5}
                      max={40}
                      step={1}
                      onChange={(v) => set({ top_n: v })}
                      format={(v) => `${v} stocks`}
                      hint="How many of the highest-scoring eligible stocks to hold."
                    />
                    <Slider
                      label="Sector cap"
                      value={sectorCap}
                      min={0.05}
                      max={1}
                      step={0.05}
                      onChange={(v) => set({ sector_cap: Number(v.toFixed(2)) })}
                      format={(v) => `${(v * 100).toFixed(0)}%`}
                      hint="Ceiling on any one GICS sector, applied as a stock count."
                    />
                    <Slider
                      label="Drift threshold"
                      value={drift}
                      min={0.005}
                      max={0.15}
                      step={0.005}
                      onChange={(v) => set({ drift_threshold: Number(v.toFixed(3)) })}
                      format={(v) => `${(v * 100).toFixed(1)}%`}
                      hint="How far a position may drift before an early rebalance fires."
                    />
                  </div>

                  <StrategyImpact
                    topN={topN}
                    sectorCap={sectorCap}
                    drift={drift}
                    equity={equity}
                  />
                </Card>

                <Card title="Eligible Universe" sub="Which ETF holdings define the Shariah screen." accent="var(--c-green)">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(240px,100%),1fr))] gap-4">
                    <Field label="Primary ETF">
                      <input
                        className={inputClass}
                        value={val("etf_symbol", "SPUS") as string}
                        onChange={(e) => set({ etf_symbol: e.target.value.toUpperCase() })}
                      />
                    </Field>
                    <Field
                      label="Combined universe"
                      hint="Comma-separated. Holdings are merged, so a wider list means a wider screen."
                    >
                      <input
                        className={inputClass}
                        value={(val("etf_symbols", ["SPUS"]) as string[]).join(", ")}
                        onChange={(e) =>
                          set({
                            etf_symbols: e.target.value
                              .split(",")
                              .map((s) => s.trim().toUpperCase())
                              .filter(Boolean),
                          })
                        }
                      />
                    </Field>
                  </div>
                </Card>

                <Card title="Engines" sub="Which automated strategies are permitted to trade." accent="var(--c-violet)">
                  <div className="flex flex-col gap-4">
                    <Toggle
                      label="Shariah Algo"
                      description="Long-only, no leverage, monthly rebalance into the top N by Factor Score."
                      checked={val("shariah_trader_enabled", true) as boolean}
                      onChange={(v) => set({ shariah_trader_enabled: v })}
                      tone="var(--c-green)"
                    />
                    <Toggle
                      label="Day Trader benchmark"
                      description="Unrestricted Gap & Go bot. Not Shariah-screened — it exists only as a comparison."
                      checked={val("day_trader_enabled", false) as boolean}
                      onChange={(v) => set({ day_trader_enabled: v })}
                      tone="var(--c-violet)"
                    />
                  </div>
                </Card>
              </>
            ) : tab === "Broker" ? (
              <>
                <Card
                  title="Trading environment"
                  sub="Paper trades are simulated. Live trades move real money."
                  accent={mode === "live" ? "var(--c-red)" : "var(--c-amber)"}
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="min-w-0">
                      <div
                        className="console-display text-[26px] tracking-[-0.005em]"
                        style={{ color: mode === "live" ? "var(--c-red)" : "var(--c-ink)" }}
                      >
                        {mode === "live" ? "Live — real money" : "Paper — simulated"}
                      </div>
                      <div className="text-[12.5px] text-[var(--c-mid)] mt-1">
                        {status?.broker_url ?? settings?.alpaca_base_url}
                      </div>
                    </div>
                    {/* Deliberately not a toggle: switching to live keeps its
                        confirmation dialog rather than becoming a one-click flip. */}
                    <button
                      type="button"
                      onClick={() => setModeModal(true)}
                      disabled={isDemo}
                      className="rounded-[var(--r-btn)] bg-[var(--c-ink)] text-white text-[12.5px] font-semibold px-5 py-3 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      Switch environment…
                    </button>
                  </div>
                </Card>

                <Card title="Alpaca credentials" sub="Stored server-side and returned masked. Leave blank to keep the existing value." accent="var(--c-ink)">
                  <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
                    <SecretField
                      label="API key"
                      value={(draft.alpaca_api_key as string) ?? ""}
                      onChange={(v) => set({ alpaca_api_key: v })}
                      placeholder={settings?.alpaca_api_key_masked || "Not configured"}
                      disabled={isDemo}
                    />
                    <SecretField
                      label="API secret"
                      value={(draft.alpaca_api_secret as string) ?? ""}
                      onChange={(v) => set({ alpaca_api_secret: v })}
                      placeholder={settings?.alpaca_api_secret_masked || "Not configured"}
                      disabled={isDemo}
                    />
                  </div>
                  <Field label="Broker base URL" hint="Paper and live use different hosts.">
                    <input
                      className={inputClass}
                      value={val("alpaca_base_url", "") as string}
                      onChange={(e) => set({ alpaca_base_url: e.target.value })}
                      disabled={isDemo}
                    />
                  </Field>
                </Card>
              </>
            ) : (
              <>
              {auth?.user_email && (
                <Card
                  title="Password"
                  sub="Change the password for your account sign-in."
                  accent="var(--c-amber)"
                >
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <p className="text-[12.5px] text-[var(--c-mid)] leading-[1.55] min-w-0">
                      We email a reset link to <strong>{auth.user_email}</strong>. The link opens
                      the reset page, where you set a new password.
                    </p>
                    <button
                      type="button"
                      disabled={sendingReset || isDemo || !supabase}
                      onClick={async () => {
                        if (!supabase || !auth.user_email) return;
                        setSendingReset(true);
                        try {
                          const { error } = await supabase.auth.resetPasswordForEmail(
                            auth.user_email,
                            { redirectTo: `${window.location.origin}/reset-password` },
                          );
                          if (error) throw error;
                          setToast({
                            kind: "ok",
                            msg: `Reset link sent to ${auth.user_email}.`,
                          });
                        } catch (err) {
                          setToast({
                            kind: "err",
                            msg: (err as Error).message || "Could not send the reset link.",
                          });
                        } finally {
                          setSendingReset(false);
                          setTimeout(() => setToast(null), 5000);
                        }
                      }}
                      className="shrink-0 rounded-[var(--r-btn)] bg-[var(--c-ink)] text-white text-[12.5px] font-semibold px-5 py-3 cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                      {sendingReset ? "Sending…" : "Email reset link"}
                    </button>
                  </div>
                </Card>
              )}
              <Card title="Console access" sub="Credentials for signing in to this dashboard." accent="var(--c-red)">
                <SecretField
                  label="Dashboard password"
                  value={(draft.dashboard_password as string) ?? ""}
                  onChange={(v) => set({ dashboard_password: v })}
                  placeholder={settings?.dashboard_password_masked || "Not set"}
                  hint="Leave blank to keep the current password."
                  disabled={isDemo}
                />
                <div className="grid grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-4">
                  <SecretField
                    label="Google client ID"
                    value={(draft.google_client_id as string) ?? ""}
                    onChange={(v) => set({ google_client_id: v })}
                    placeholder={settings?.google_client_id_masked || "Not configured"}
                    disabled={isDemo}
                  />
                  <SecretField
                    label="Google client secret"
                    value={(draft.google_client_secret as string) ?? ""}
                    onChange={(v) => set({ google_client_secret: v })}
                    placeholder={settings?.google_client_secret_masked || "Not configured"}
                    disabled={isDemo}
                  />
                </div>
                <Field
                  label="Allowed Google accounts"
                  hint="Comma-separated. Only these addresses may sign in via Google."
                >
                  <input
                    className={inputClass}
                    value={(val("allowed_google_emails", []) as string[]).join(", ")}
                    onChange={(e) =>
                      set({
                        allowed_google_emails: e.target.value
                          .split(",")
                          .map((s) => s.trim())
                          .filter(Boolean),
                      })
                    }
                    disabled={isDemo}
                  />
                </Field>
              </Card>
              </>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-[var(--r-btn)] px-5 py-3 text-[13px] font-semibold shadow-[var(--sh-card)]"
            style={{
              background: toast.kind === "ok" ? "var(--c-green)" : "var(--c-red)",
              color: "#fff",
            }}
            role="status"
          >
            {toast.msg}
          </motion.div>
        )}
      </AnimatePresence>

      <SaveBar
        dirtyCount={dirtyCount}
        saving={save.isPending}
        disabled={isDemo}
        disabledReason="Demo mode — changes are not saved"
        onReset={() => setDraft({})}
        onSave={() => save.mutate(draft)}
      />

      <AccountModeModal
        isOpen={modeModal}
        onClose={() => setModeModal(false)}
        currentMode={mode}
      />
    </ConsoleShell>
  );
}
