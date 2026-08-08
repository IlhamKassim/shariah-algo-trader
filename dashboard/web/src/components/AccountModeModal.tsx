import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, Flame, AlertOctagon, CheckCircle2, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

interface AccountModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: "paper" | "live";
}

export function AccountModeModal({
  isOpen,
  onClose,
  currentMode,
}: AccountModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<"paper" | "live">(currentMode);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const queryClient = useQueryClient();

  if (!isOpen) return null;

  const handleConfirmSwitch = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.switchTradingMode(selectedMode, selectedMode === "live");
      await queryClient.invalidateQueries();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to switch trading environment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative w-full max-w-lg bg-[#0E0D0B] border border-divider rounded-xl shadow-2xl overflow-hidden font-sans text-primary"
        >
          {/* Header */}
          <div className="border-b border-divider px-6 py-4 flex items-center justify-between bg-[#141310]">
            <div className="flex items-center gap-3">
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center border ${
                  selectedMode === "live"
                    ? "bg-rose-500/10 border-rose-500/30 text-rose-400"
                    : "bg-brand-gold/10 border-brand-gold/30 text-brand-gold"
                }`}
              >
                {selectedMode === "live" ? (
                  <Flame size={20} className="animate-pulse" />
                ) : (
                  <Shield size={20} />
                )}
              </div>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-primary">
                  TRADING ENVIRONMENT SELECTOR
                </h3>
                <p className="text-[11px] text-muted font-mono">
                  Switch between Simulated Paper and Real Money execution
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-muted hover:text-primary transition-colors p-1 rounded-md hover:bg-white/5 cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-6 space-y-5">
            {errorMsg && (
              <div className="p-3 bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs rounded">
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              {/* Paper Trading Card */}
              <div
                onClick={() => setSelectedMode("paper")}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-3 ${
                  selectedMode === "paper"
                    ? "border-brand-gold bg-brand-gold/5 shadow-[0_0_20px_rgba(209,169,46,0.1)]"
                    : "border-divider bg-[#12110E] hover:border-brand-gold/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Shield size={16} className="text-brand-gold" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-primary">
                      Paper Account
                    </span>
                  </div>
                  {selectedMode === "paper" && (
                    <CheckCircle2 size={16} className="text-brand-gold" />
                  )}
                </div>

                <p className="text-[11px] text-muted leading-relaxed font-sans">
                  Zero-risk simulated paper environment using Alpaca Paper API. Ideal for testing Shariah factor strategies.
                </p>

                <div className="pt-2 border-t border-divider/50 flex items-center justify-between text-[10px] font-mono text-faint">
                  <span>ENDPOINT:</span>
                  <span className="text-brand-gold">paper-api.alpaca</span>
                </div>
              </div>

              {/* Live Real Money Card */}
              <div
                onClick={() => setSelectedMode("live")}
                className={`p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col justify-between space-y-3 ${
                  selectedMode === "live"
                    ? "border-rose-500 bg-rose-950/20 shadow-[0_0_20px_rgba(244,63,94,0.15)]"
                    : "border-divider bg-[#12110E] hover:border-rose-500/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Flame size={16} className="text-rose-400 animate-pulse" />
                    <span className="font-mono text-xs font-bold uppercase tracking-wider text-rose-400">
                      Real Money
                    </span>
                  </div>
                  {selectedMode === "live" && (
                    <CheckCircle2 size={16} className="text-rose-400" />
                  )}
                </div>

                <p className="text-[11px] text-muted leading-relaxed font-sans">
                  Live real-money market execution connected directly to your institutional Alpaca Live Brokerage Account.
                </p>

                <div className="pt-2 border-t border-divider/50 flex items-center justify-between text-[10px] font-mono text-faint">
                  <span>ENDPOINT:</span>
                  <span className="text-rose-400">api.alpaca.markets</span>
                </div>
              </div>
            </div>

            {/* Live Mode Safety Warning */}
            {selectedMode === "live" && (
              <div className="bg-rose-950/30 border border-rose-500/40 rounded-lg p-3.5 space-y-2">
                <div className="flex items-center gap-2 text-rose-300 font-mono text-xs font-bold uppercase tracking-wider">
                  <AlertOctagon size={16} className="text-rose-400" />
                  <span>Real Money Risk Disclosure</span>
                </div>
                <p className="text-xs text-rose-200/80 leading-relaxed font-sans">
                  Switching to Live Real Money Mode means rebalances and trade orders will execute with real capital on your live Alpaca brokerage account. Ensure your Live API keys are configured in Settings.
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2.5 text-xs font-mono text-muted hover:text-primary transition-colors cursor-pointer uppercase tracking-wider"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmSwitch}
                disabled={isSubmitting || currentMode === selectedMode}
                className={`px-6 py-2.5 font-mono text-[11px] font-bold uppercase tracking-widest rounded transition-all cursor-pointer flex items-center gap-2 ${
                  currentMode === selectedMode
                    ? "bg-[#1f1d19] text-[#666] border border-divider cursor-not-allowed"
                    : selectedMode === "live"
                    ? "bg-rose-500 text-white hover:bg-rose-600 shadow-[0_0_15px_rgba(244,63,94,0.4)]"
                    : "bg-brand-gold text-page hover:bg-brand-gold/90 shadow-[0_0_15px_rgba(209,169,46,0.3)]"
                }`}
              >
                {isSubmitting ? (
                  <span>Switching...</span>
                ) : currentMode === selectedMode ? (
                  <span>Currently Active</span>
                ) : (
                  <span>Switch to {selectedMode === "live" ? "Live Real Money" : "Paper Account"}</span>
                )}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
