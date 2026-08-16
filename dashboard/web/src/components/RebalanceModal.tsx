import { useState, useEffect, useRef } from "react";
import { Shield, CheckCircle2, AlertCircle, X, ArrowRight, RefreshCw, BarChart2, Loader2, Clock, Layers } from "lucide-react";
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
  { key: "universe",   label: "Fetching Shariah Universe",       hint: "Downloading SPUS + HLAL ETF holdings" },
  { key: "momentum",   label: "Computing Momentum Factor",        hint: "12-1 month return z-scores across ~200 tickers" },
  { key: "quality",    label: "Computing Quality Factor",         hint: "ROE, margins & AAOIFI debt screen (<33% debt)" },
  { key: "volatility", label: "Computing Volatility & Value",     hint: "Annualised volatility + FCF yield scores" },
  { key: "ranking",    label: "Ranking by Composite Score",       hint: "Top-N selection + 20% sector cap applied" },
  { key: "orders",     label: "Submitting Orders to Alpaca",      hint: "Cash-capped fractional market orders" },
  { key: "done",       label: "Finalising & Recording Audit Log", hint: "Writing audit trail and updating state" },
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
            msg: "Rebalance timed out after 10 minutes. Check Activity Log for status.",
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
              msg: st.message || "Rebalance orders executed and submitted to Alpaca.",
              stocks: firstResult?.target_stocks || [],
              elapsed: st.elapsed_seconds,
            });
            if (onSuccess) onSuccess();
          } else if (st.status === "failed") {
            setPolling(false);
            setSubmitting(false);
            setResult({
              success: false,
              msg: st.error || st.message || "Rebalance execution failed.",
              elapsed: st.elapsed_seconds,
            });
          } else if (st.status === "idle") {
            setPolling(false);
            setSubmitting(false);
            setResult({
              success: false,
              msg: "The server state was re-initialized during execution. Please check the Activity Log.",
            });
          } else if (st.status === "running") {
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
  }, [polling, isOpen, onSuccess]);

  if (!isOpen) return null;

  const handleExecute = async () => {
    setSubmitting(true);
    setResult(null);
    setCurrentStep({ key: "universe", number: 1, message: "Initiating quantitative factor model..." });
    try {
      const res = await api.runManualRebalance();
      if (res.status === "running") {
        setPolling(true);
      } else {
        setSubmitting(false);
        const firstResult = res.results?.[0];
        setResult({
          success: true,
          msg: res.message || "Rebalance submitted successfully.",
          stocks: firstResult?.target_stocks || [],
        });
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setSubmitting(false);
      setResult({ success: false, msg: err.message || "Failed to trigger rebalance." });
    }
  };

  const activeStepIndex = currentStep
    ? STEPS.findIndex((s) => s.key === currentStep.key)
    : -1;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#0C0B09] border border-divider shadow-2xl rounded-none text-primary font-sans overflow-hidden">
        
        {/* Subtle hairline gold top accent */}
        <div className="h-[2px] w-full bg-brand-gold" />

        {/* Close Button */}
        <button
          onClick={onClose}
          disabled={submitting}
          className="absolute top-4 right-4 text-muted hover:text-primary transition-colors p-1.5 border border-transparent hover:border-divider cursor-pointer z-10 disabled:opacity-30"
        >
          <X size={16} />
        </button>

        <div className="p-6 sm:p-8 space-y-6">
          
          {/* Eyebrow Header Badge */}
          <div className="flex items-center justify-between pb-2 border-b border-divider">
            <span className="font-mono text-[10px] uppercase tracking-widest text-brand-gold flex items-center gap-2">
              <span className="w-1.5 h-1.5 bg-brand-gold animate-pulse" />
              Factor Engine Trigger
            </span>
            <span className="font-mono text-[10px] text-muted uppercase">
              Paper Sandbox
            </span>
          </div>

          {/* Modal Header */}
          <div>
            <h2 className="font-serif text-2xl sm:text-3xl text-primary font-normal leading-tight tracking-wide">
              Execute Portfolio Rebalance
            </h2>
            <p className="text-xs text-muted mt-2 leading-relaxed">
              Triggers quantitative multi-factor ranking (Momentum, Quality, Low Volatility, Value) across the Shariah-screened universe (<code className="font-mono text-brand-gold">SPUS</code> / <code className="font-mono text-brand-gold">HLAL</code>) to re-align position weights.
            </p>
          </div>

          {/* ─── LIVE PROGRESS TRACKER ─── */}
          {submitting && !result && (
            <div className="border border-brand-gold/30 bg-[#12110E] p-4 space-y-3 animate-fadeIn">
              {/* Header bar with elapsed time */}
              <div className="flex items-center justify-between pb-2.5 border-b border-divider">
                <div className="flex items-center gap-2 text-xs font-mono font-bold text-brand-gold uppercase tracking-wider">
                  <Loader2 size={13} className="animate-spin" />
                  <span>Computing Factor Model...</span>
                </div>
                <div className="flex items-center gap-1.5 text-xs font-mono text-muted">
                  <Clock size={12} />
                  <span>{formatElapsed(elapsed)}</span>
                </div>
              </div>

              {/* Step-by-step tracker */}
              <div className="space-y-2.5 pt-1">
                {STEPS.map((step, idx) => {
                  const isActive = idx === activeStepIndex;
                  const isDone = idx < activeStepIndex;
                  const isPending = idx > activeStepIndex;

                  return (
                    <div key={step.key} className={`flex items-start gap-3 transition-opacity duration-300 ${isPending ? "opacity-35" : "opacity-100"}`}>
                      {/* Status marker */}
                      <div className="mt-0.5 shrink-0">
                        {isDone ? (
                          <CheckCircle2 size={14} className="text-brand-green" />
                        ) : isActive ? (
                          <Loader2 size={14} className="text-brand-gold animate-spin" />
                        ) : (
                          <div className="w-3.5 h-3.5 border border-divider" />
                        )}
                      </div>

                      {/* Step details */}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs font-mono leading-tight ${
                          isDone ? "text-brand-green font-bold" : isActive ? "text-primary font-bold" : "text-muted"
                        }`}>
                          {step.label}
                        </div>
                        {(isActive || isDone) && (
                          <div className="text-[10px] font-sans text-muted mt-0.5 leading-tight">{step.hint}</div>
                        )}
                      </div>

                      {/* Timing badge for active step */}
                      {isActive && elapsed > 0 && (
                        <div className="shrink-0 text-[10px] font-mono text-brand-gold border border-brand-gold/40 px-1.5 py-0.5">
                          {formatElapsed(elapsed)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Progress bar */}
              <div className="h-1 bg-page border border-divider mt-2">
                <div
                  className="h-full bg-brand-gold transition-all duration-700"
                  style={{ width: `${activeStepIndex < 0 ? 5 : Math.round(((activeStepIndex + 0.5) / STEPS.length) * 100)}%` }}
                />
              </div>

              <p className="text-[10px] text-faint font-mono leading-relaxed pt-1">
                Quality factor calculates AAOIFI debt ratios from financial statements (~200 stocks). First run takes 2–4 min; subsequent runs complete in &lt;30s using cache.
              </p>
            </div>
          )}

          {/* ─── RESULT ALERT ─── */}
          {result && (
            <div
              className={`p-4 border text-xs font-mono space-y-3 animate-fadeIn ${
                result.success
                  ? "bg-brand-green/10 border-brand-green/40 text-brand-green"
                  : "bg-brand-red/10 border-brand-red/40 text-brand-red"
              }`}
            >
              <div className="flex items-start gap-2.5">
                {result.success ? (
                  <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle size={16} className="shrink-0 mt-0.5" />
                )}
                <div>
                  <div className="font-bold uppercase tracking-wider">
                    {result.success ? "Rebalance Orders Executed" : "Rebalance Execution Error"}
                  </div>
                  <div className="text-[11px] opacity-90 mt-1">{result.msg}</div>
                  {result.elapsed !== undefined && (
                    <div className="text-[10px] opacity-70 mt-1 flex items-center gap-1">
                      <Clock size={10} /> Completed in {formatElapsed(result.elapsed)}
                    </div>
                  )}
                </div>
              </div>

              {result.stocks && result.stocks.length > 0 && (
                <div className="pt-2.5 border-t border-brand-green/20">
                  <div className="text-[10px] uppercase font-bold text-brand-green tracking-wider mb-1.5">
                    Target Portfolio Allocation ({result.stocks.length} equities):
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {result.stocks.map((sym) => (
                      <span key={sym} className="px-2 py-0.5 bg-sidebar border border-brand-green/40 text-[10px] font-bold text-primary font-mono">
                        {sym}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ─── PRE-RUN INFO MATRIX (idle state) ─── */}
          {!result && !submitting && (
            <div className="space-y-4">
              {accountData && (
                <div className="border border-divider grid grid-cols-2 divide-x divide-divider bg-[#141210]">
                  <div className="p-3.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                      Portfolio Equity
                    </span>
                    <span className="text-sm font-mono font-bold text-primary mt-1 block">
                      {formatCurrency(accountData.portfolio_value)}
                    </span>
                  </div>
                  <div className="p-3.5">
                    <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                      Available Cash
                    </span>
                    <span className="text-sm font-mono font-bold text-brand-gold mt-1 block">
                      {formatCurrency(accountData.cash)}
                    </span>
                  </div>
                </div>
              )}

              {/* Execution Matrix */}
              <div className="space-y-1.5">
                <span className="text-[10px] font-mono uppercase tracking-wider text-muted block">
                  Factor Model & Constraints
                </span>
                <div className="border border-divider grid grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-divider bg-[#141210] text-xs">
                  <div className="p-3 space-y-1">
                    <div className="font-mono text-xs font-bold text-primary flex items-center gap-1.5">
                      <BarChart2 size={13} className="text-brand-gold shrink-0" />
                      <span>Top 20 Factor Ranked</span>
                    </div>
                    <p className="text-[10px] text-muted">Composite Z-Score</p>
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-mono text-xs font-bold text-primary flex items-center gap-1.5">
                      <RefreshCw size={13} className="text-brand-green shrink-0" />
                      <span>Inverse Volatility</span>
                    </div>
                    <p className="text-[10px] text-muted">Risk Parity Weights</p>
                  </div>
                </div>
                <div className="border border-divider border-t-0 grid grid-cols-2 divide-y sm:divide-y-0 sm:divide-x divide-divider bg-[#141210] text-xs">
                  <div className="p-3 space-y-1">
                    <div className="font-mono text-xs font-bold text-primary flex items-center gap-1.5">
                      <Layers size={13} className="text-brand-blue shrink-0" />
                      <span>20% Sector Cap</span>
                    </div>
                    <p className="text-[10px] text-muted">GICS Diversification</p>
                  </div>
                  <div className="p-3 space-y-1">
                    <div className="font-mono text-xs font-bold text-brand-green flex items-center gap-1.5">
                      <Shield size={13} className="text-brand-green shrink-0" />
                      <span>AAOIFI Compliant</span>
                    </div>
                    <p className="text-[10px] text-muted">Debt-to-Market-Cap &lt; 33%</p>
                  </div>
                </div>
              </div>

              {/* Duration Notice */}
              <div className="p-3 bg-[#12110E] border border-divider flex items-start gap-2.5 text-xs text-muted font-sans">
                <Clock size={14} className="text-brand-gold shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Initial run takes <strong className="text-primary font-mono">2–4 minutes</strong> to compute fundamental financial statements for ~200 equities. Subsequent runs complete in <strong className="text-primary font-mono">&lt;30s</strong> using the 12-hour cache.
                </span>
              </div>
            </div>
          )}

          {/* Modal Action Footer */}
          <div className="pt-4 border-t border-divider flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-5 py-2.5 border border-divider hover:border-muted text-muted hover:text-primary font-mono text-xs uppercase tracking-widest rounded-none transition-colors cursor-pointer disabled:opacity-40"
            >
              {result ? "Close" : "Cancel"}
            </button>

            {!result && (
              <button
                type="button"
                onClick={handleExecute}
                disabled={submitting}
                className="px-6 py-2.5 bg-brand-gold hover:bg-brand-gold/90 text-page font-bold font-mono text-xs uppercase tracking-widest rounded-none transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                {submitting ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Calculating &amp; Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Confirm &amp; Execute Rebalance</span>
                    <ArrowRight size={13} />
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
