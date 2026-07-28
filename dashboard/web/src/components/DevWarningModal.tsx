import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, Check, X, Info } from "lucide-react";

interface DevWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DevWarningModal({ isOpen, onClose }: DevWarningModalProps) {
  const [isChecked, setIsChecked] = useState(false);

  if (!isOpen) return null;

  const handleAcknowledge = () => {
    if (!isChecked) return;
    localStorage.setItem("shariah_dev_risk_acknowledged", "true");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn select-none">
        {/* Background ambient radial glow */}
        <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-950/20 via-transparent to-transparent" />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 10 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative w-full max-w-lg bg-[#0C0C0C] border border-amber-500/40 rounded-xl shadow-[0_0_50px_rgba(217,119,6,0.15)] overflow-hidden font-sans text-white"
        >
          {/* Header Banner */}
          <div className="bg-gradient-to-r from-amber-950/80 via-yellow-950/60 to-amber-950/80 border-b border-amber-500/30 px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                <AlertTriangle size={20} className="animate-pulse" />
              </div>
              <div>
                <h3 className="font-mono text-xs uppercase tracking-[0.2em] font-bold text-amber-400">
                  DEVELOPMENT MODE NOTICE
                </h3>
                <p className="text-[11px] text-amber-200/70 font-mono">
                  Pre-Alpha Experimental Build
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="text-[#a39d96] hover:text-white transition-colors p-1 rounded-md hover:bg-white/5 cursor-pointer"
              title="Close notice"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Content Body */}
          <div className="p-6 space-y-5">
            {/* Core Warning Box */}
            <div className="bg-[#14120E] border border-amber-900/40 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-3">
                <ShieldAlert size={20} className="text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1.5 text-xs text-[#d4ceca]">
                  <p className="font-semibold text-amber-200 leading-snug">
                    Notice: Platform in Active Development ("Nothing properly works yet")
                  </p>
                  <p className="leading-relaxed text-[#b5aeb7] font-sans">
                    We are currently in active development mode. Algorithmic trade execution, compliance filtering, quantitative ranking engines, and market feeds are undergoing testing and <strong className="text-amber-300 font-semibold">are not operating properly or reliably</strong> at this time.
                  </p>
                </div>
              </div>
            </div>

            {/* Risk Acknowledgement Details */}
            <div className="space-y-2 text-xs text-[#a39d96] leading-relaxed">
              <div className="flex items-center gap-2 text-white font-mono text-[11px] uppercase tracking-wider font-semibold">
                <Info size={14} className="text-amber-400" />
                <span>Financial Risk Disclosure</span>
              </div>
              <p>
                Do NOT execute trades with live capital or rely on data from this website for actual financial decisions. By proceeding, you acknowledge that you are using an experimental test environment and assume all risks.
              </p>
            </div>

            {/* Checkbox Opt-in */}
            <label
              onClick={() => setIsChecked(!isChecked)}
              className="flex items-start gap-3 p-3.5 rounded-lg border border-[#2a2824] bg-[#11100E] hover:border-amber-500/40 transition-all cursor-pointer group"
            >
              <div
                className={`w-5 h-5 rounded border shrink-0 mt-0.5 flex items-center justify-center transition-all ${
                  isChecked
                    ? "bg-amber-400 border-amber-400 text-black"
                    : "border-[#444] bg-black/40 group-hover:border-amber-400/60"
                }`}
              >
                {isChecked && <Check size={14} strokeWidth={3} />}
              </div>
              <span className="text-xs text-[#d4ceca] leading-snug font-sans">
                I understand that this site is in active development mode, features may not work properly, and I acknowledge and accept all risks.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                onClick={handleAcknowledge}
                disabled={!isChecked}
                className={`w-full py-3 px-6 font-mono text-[11px] font-bold uppercase tracking-widest rounded transition-all flex items-center justify-center gap-2 cursor-pointer ${
                  isChecked
                    ? "bg-amber-400 text-black shadow-[0_0_20px_rgba(245,158,11,0.3)] hover:bg-amber-300"
                    : "bg-[#1f1d19] text-[#666] border border-[#2a2824] cursor-not-allowed"
                }`}
              >
                <span>Acknowledge & Proceed</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
