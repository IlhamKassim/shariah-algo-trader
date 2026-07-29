import { useState, useEffect, useRef } from "react";
import { Zap, Shield, CheckCircle2, AlertCircle, X, ArrowRight, RefreshCw, BarChart2, Loader2, Clock } from "lucide-react";
import { api } from "../lib/api";
import { formatCurrency } from "../lib/utils";

interface RebalanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  accountData?: {
    portfolio_value: number;
    cash: number;
    trading_mode?: string;
  };
}

// Mirrors the step order in rebalance.py _REBALANCE_STEPS
const STEPS = [
  { key: "universe",   label: "Fetching Shariah universe",       hint: "Downloading SPUS + HLAL ETF holdings" },
  { key: "momentum",   label: "Computing Momentum Factor",        hint: "12-1 month return z-scores across ~200 tickers" },
  { key: "quality",    label: "Computing Quality Factor",         hint: "ROE, margins & AAOIFI debt screen — takes ~2–4 min" },
  { key: "volatility", label: "Computing Volatility & Value",     hint: "Annualised volatility + FCF yield scores" },
  { key: "ranking",    label: "Ranking by composite score",       hint: "Top-N selection + sector caps applied" },
  { key: "orders",     label: "Submitting orders to Alpaca",      hint: "Fractional market orders for each position" },
  { key: "done",       label: "Finalising & recording audit log", hint: "Writing audit trail and notifying systems" },
];

function useElapsedTimer(running: boolean) {
  const [elapsed, setElapsed] = useState(0);
  const startRef = useRef<number>(0);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (running) {
      startRef.current = Date.now();
      setElapsed(0);
      timerRef.current = setInterval(() => {
        setElapsed(Math.round((Date.now() - startRef.current) / 1000));
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [running]);

  return elapsed;
}

function formatElapsed(sec: number) {
  if (sec < 60) return `${sec}s`;
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
}

export function RebalanceModal({ isOpen, onClose, onSuccess, accountData }: RebalanceModalProps) {
  const [submitting, setSubmitting] = useState(false);
  const [polling, setPolling] = useState(false);
  const [currentStep, setCurrentStep] = useState<{ key: string; number: number; message: string } | null>(null);
  const [result, setResult] = useState<{ success: boolean; msg: string; stocks?: string[]; elapsed?: number } | null>(null);
  const pollingStartRef = useRef<number>(0);
  const elapsed = useElapsedTimer(polling);

  useEffect(() => {
    let timer: any = null;
    const POLLING_TIMEOUT_MS = 10 * 60 * 1000;

    if (polling && isOpen) {
      pollingStartRef.current = Date.now();
      timer = setInterval(async () => {
        if (Date.now() - pollingStartRef.current > POLLING_TIMEOUT_MS) {
          clearInterval(timer);
          setPolling(false);
          setSubmitting(false);
          setResult({
            success: false,
            msg: "Rebalance timed out after 10 minutes. The job may still be running — check Activity Log for results.",
          });
          return;
        }
        try {
          const st = await api.getRebalanceStatus();
          if (st.status === "completed") {
            setPolling(false);
            setSubmitting(false);
            const firstResult = st.results?.[0];
            setResult({
              success: true,
              msg: st.message || "Rebalance orders submitted to Alpaca!",
              stocks: firstResult?.target_stocks || [],
              elapsed: st.elapsed_seconds,
            });
            if (onSuccess) onSuccess();
          } else if (st.status === "failed") {
            setPolling(false);
            setSubmitting(false);
            setResult({
              success: false,
              msg: st.error || st.message || "Rebalance background task failed",
              elapsed: st.elapsed_seconds,
            });
          } else if (st.status === "idle") {
            setPolling(false);
            setSubmitting(false);
            setResult({
              success: false,
              msg: "The server restarted while the rebalance was running. Please check the Activity Log to see if orders were placed, then re-run if needed.",
            });
          } else if (st.status === "running") {
            // Update step tracker from backend progress
            if (st.step_key) {
              setCurrentStep({
                key: st.step_key,
                number: st.step_number ?? 1,
                message: st.message ?? "",
              });
            }
          }
        } catch {
          // ignore transient polling errors
        }
      }, 1500);
    }

    return () => { if (timer) clearInterval(timer); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [polling, isOpen, onSuccess]);

  if (!isOpen) return null;

  const isLive = accountData?.trading_mode === "live";

  const handleExecute = async () => {
    setSubmitting(true);
    setResult(null);
    setCurrentStep({ key: "universe", number: 1, message: "Initiating quantitative model..." });
    try {
      const res = await api.runManualRebalance();
      if (res.status === "running") {
        setPolling(true);
      } else {
        setSubmitting(false);
        const firstResult = res.results?.[0];
        setResult({
          success: true,
          msg: res.message || "Rebalance submitted successfully",
          stocks: firstResult?.target_stocks || [],
        });
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setSubmitting(false);
      setResult({ success: false, msg: err.message || "Failed to trigger rebalance" });
    }
  };

  const activeStepIndex = currentStep
    ? STEPS.findIndex((s) => s.key === currentStep.key)
    : -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0E0F12] border border-divider/80 rounded-2xl shadow-2xl overflow-hidden text-foreground">

        {/* Glow accent header */}
        <div className={`h-1.5 w-full ${isLive ? "bg-gradient-to-r from-rose-500 via-red-500 to-amber-500" : "bg-gradient-to-r from-brand-gold via-amber-400 to-emerald-400"}`} />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-muted hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-white/5 cursor-pointer z-10 disabled:opacity-30"
        >
          <X size={18} />
        </button>

        <div className="p-6 space-y-5">
          {/* Environment Header Badge */}
          <div className="flex items-center gap-2">
            {isLive ? (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] font-mono font-semibold uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                Live Capital Execution
              </div>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-[11px] font-mono font-semibold uppercase tracking-wider">
                <Shield size={12} />
                Paper Trading Simulation
              </div>
            )}
          </div>

          {/* Modal Title */}
          <div>
            <h2 className="text-lg font-bold tracking-tight text-foreground flex items-center gap-2">
              <Zap className="text-brand-gold" size={20} />
              Execute Portfolio Rebalance
            </h2>
            <p className="text-xs text-muted mt-1 leading-relaxed">
              Triggers quantitative multi-factor ranking (Momentum, Quality, Low Volatility, Value) across the Shariah-compliant universe (<code className="font-mono text-brand-gold">SPUS</code> / <code className="font-mono text-brand-gold">HLAL</code>) to re-align position weights.
            </p>
          </div>

          {/* ─── LIVE PROGRESS TRACKER ─── */}
          {submitting && !result && (
            <div className="rounded-xl border border-brand-gold/25 bg-brand-gold/5 overflow-hidden animate-fadeIn">
              {/* Header bar with elapsed time */}
              <div className="px-4 py-2.5 border-b border-brand-gold/15 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[11px] font-mono font-semibold text-brand-gold">
                  <Loader2 size={13} className="animate-spin" />
                  Running Quantitative Model...
                </div>
                <div className="flex items-center gap-1 text-[11px] font-mono text-muted">
                  <Clock size={11} />
                  <span>{formatElapsed(elapsed)}</span>
                </div>
              </div>

              {/* Step-by-step tracker */}
              <div className="px-4 py-3 space-y-2">
                {STEPS.map((step, idx) => {
                  const isActive = idx === activeStepIndex;
                  const isDone = idx < activeStepIndex;
                  const isPending = idx > activeStepIndex;

                  return (
                    <div key={step.key} className={`flex items-start gap-3 py-1.5 transition-opacity duration-300 ${isPending ? "opacity-35" : "opacity-100"}`}>
                      {/* Status icon */}
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 size={15} className="text-emerald-400" />
                        ) : isActive ? (
                          <Loader2 size={15} className="text-brand-gold animate-spin" />
                        ) : (
                          <div className="w-[15px] h-[15px] rounded-full border border-white/20" />
                        )}
                      </div>

                      {/* Step label + hint */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-[12px] font-semibold leading-tight ${
                          isDone ? "text-emerald-300" : isActive ? "text-foreground" : "text-muted"
                        }`}>
                          {step.label}
                        </div>
                        {(isActive || isDone) && (
                          <div className="text-[10px] text-muted mt-0.5 leading-tight">{step.hint}</div>
                        )}
                      </div>

                      {/* Timing badge for active step */}
                      {isActive && elapsed > 0 && (
                        <div className="shrink-0 text-[10px] font-mono text-brand-gold/70 bg-brand-gold/10 px-1.5 py-0.5 rounded">
                          {formatElapsed(elapsed)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Animated progress bar */}
              <div className="h-0.5 bg-black/40">
                <div
                  className="h-full bg-gradient-to-r from-brand-gold to-emerald-400 transition-all duration-700"
                  style={{ width: `${activeStepIndex < 0 ? 5 : Math.round(((activeStepIndex + 0.5) / STEPS.length) * 100)}%` }}
                />
              </div>

              <p className="px-4 py-2 text-[10px] text-muted/70 font-mono">
                Quality factor fetches ~200 tickers from Yahoo Finance — typically takes 2–4 min on first run, near-instant on subsequent runs (12h cache).
              </p>
            </div>
          )}

          {/* ─── RESULT ALERT ─── */}
          {result && (
            <div
              className={`p-4 rounded-xl border text-xs font-mono space-y-2 animate-fadeIn ${
                result.success
                  ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                  : "bg-rose-950/40 border-rose-500/40 text-rose-300"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {result.success ? (
                  <CheckCircle2 size={18} className="text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={18} className="text-rose-400 shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold">{result.success ? "Rebalance Orders Submitted!" : "Rebalance Error"}</div>
                  <div className="text-[11px] opacity-90 mt-0.5">{result.msg}</div>
                  {result.elapsed !== undefined && (
                    <div className="text-[10px] opacity-60 mt-1 flex items-center gap-1">
                      <Clock size={10} /> Completed in {formatElapsed(result.elapsed)}
                    </div>
                  )}
                </div>
              </div>

              {result.stocks && result.stocks.length > 0 && (
                <div className="pt-2 border-t border-emerald-500/20">
                  <div className="text-[10px] uppercase font-bold text-emerald-400/80 mb-1">Target Portfolio ({result.stocks.length} stocks):</div>
                  <div className="flex flex-wrap gap-1">
                    {result.stocks.map((sym) => (
                      <span key={sym} className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-200">
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── PRE-RUN INFO (idle state) ─── */}
          {!result && !submitting && (
            <>
              {accountData && (
                <div className="grid grid-cols-2 gap-3 bg-page/60 border border-divider/60 rounded-xl p-3.5 text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted font-bold block">Portfolio Equity</span>
                    <span className="text-sm font-bold font-mono text-foreground mt-0.5 block">
                      {formatCurrency(accountData.portfolio_value)}
                    </span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-muted font-bold block">Available Cash</span>
                    <span className="text-sm font-bold font-mono text-brand-gold mt-0.5 block">
                      {formatCurrency(accountData.cash)}
                    </span>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted block">Execution Strategy Model</span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 rounded-lg bg-sidebar border border-divider/50 flex items-center gap-2">
                    <BarChart2 size={14} className="text-brand-gold shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Top 20 Factor Ranked</div>
                      <div className="text-[10px] text-faint">Composite Z-Score</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-sidebar border border-divider/50 flex items-center gap-2">
                    <RefreshCw size={14} className="text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">Inverse Volatility</div>
                      <div className="text-[10px] text-faint">Risk Parity Weights</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-sidebar border border-divider/50 flex items-center gap-2">
                    <Shield size={14} className="text-sky-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">20% Sector Cap</div>
                      <div className="text-[10px] text-faint">GICS Diversification</div>
                    </div>
                  </div>
                  <div className="p-2.5 rounded-lg bg-sidebar border border-divider/50 flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-brand-gold shrink-0" />
                    <div>
                      <div className="font-semibold text-foreground">AAOIFI Compliant</div>
                      <div className="text-[10px] text-faint">Debt Screen &lt; 33%</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Estimated duration hint */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/3 border border-white/8 text-[11px] text-muted">
                <Clock size={13} className="text-brand-gold/70 shrink-0" />
                <span>First run takes <strong className="text-foreground">2–4 minutes</strong> (fetching fundamentals for ~200 stocks). Subsequent runs complete in <strong className="text-foreground">under 30 seconds</strong> using the 12-hour cache.</span>
              </div>
            </>
          )}

          {/* Modal Action Footer */}
          <div className="pt-4 border-t border-divider/60 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2.5 text-xs font-semibold text-muted hover:text-foreground transition-colors rounded-xl hover:bg-white/5 cursor-pointer disabled:opacity-40"
            >
              {result ? "Close" : "Cancel"}
            </button>

            {!result && (
              <button
                type="button"
                onClick={handleExecute}
                disabled={submitting}
                className={`px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg transition-all cursor-pointer disabled:opacity-50 ${
                  isLive
                    ? "bg-rose-500 text-white hover:bg-rose-600 shadow-rose-500/20"
                    : "bg-brand-gold text-slate-950 hover:bg-brand-gold/90 shadow-brand-gold/20"
                }`}
              >
                {submitting ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Calculating & Submitting...
                  </>
                ) : (
                  <>
                    <span>Confirm & Execute Rebalance</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
