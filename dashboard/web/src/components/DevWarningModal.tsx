import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check, X } from "lucide-react";


interface DevWarningModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function DevWarningModal({ isOpen, onClose }: DevWarningModalProps) {
  const [isChecked, setIsChecked] = useState(false);

  // ESC dismisses the notice too (persisted by the parent's onClose).
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleAcknowledge = () => {
    if (!isChecked) return;
    localStorage.setItem("shariah_dev_risk_acknowledged", "true");
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 animate-fadeIn select-none">
        {/* Clickable backdrop overlay */}
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/85 backdrop-blur-xl cursor-pointer"
        />

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 8 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
          className="relative z-10 w-full max-w-lg bg-[#080D0B] border border-[#16382E] shadow-[0_25px_80px_rgba(0,0,0,0.95)] overflow-hidden font-sans text-[#F0FDF4]"
        >
          {/* Subtle gold hairline */}
          <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-[#ffdca1]/50 to-transparent" />

          {/* Header Bar */}
          <div className="bg-[#060A08] border-b border-[#16382E] px-6 sm:px-8 py-5 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2.5 mb-1.5">
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#ffdca1] border border-[#ffdca1]/30 bg-[#0E1714] px-2 py-0.5">
                  Development Mode
                </span>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-widest">
                  Pre-Alpha Build
                </span>
              </div>
              <h3 className="font-serif text-2xl text-[#F0FDF4] font-normal leading-tight">
                System Development Notice
              </h3>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="border border-[#16382E] bg-[#090E0C] p-2 text-slate-400 hover:text-[#F0FDF4] hover:border-emerald-500/40 transition-colors cursor-pointer"
              title="Close notice"
            >
              <X size={16} />
            </button>
          </div>

          {/* Modal Content Body */}
          <div className="p-6 sm:p-8 space-y-5">
            {/* Core Warning Box */}
            <div className="bg-[#040705] border border-[#16382E] border-l-2 border-l-[#ffdca1] p-4 sm:p-5 space-y-2">
              <div className="flex items-center gap-2 text-xs font-mono font-semibold uppercase tracking-wider text-[#ffdca1]">
                <AlertTriangle size={14} className="text-[#ffdca1]" />
                <span>Active Testing Environment</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed font-sans">
                This platform is in active development. Algorithmic trade execution, automated compliance checks, and market data feeds are undergoing continuous testing and <strong className="text-[#F0FDF4] font-semibold">must not be assumed reliable for live capital</strong>.
              </p>
            </div>

            {/* Risk Disclosure */}
            <div className="bg-[#040705] border border-[#16382E] p-4 space-y-1.5">
              <div className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
                Financial Risk Disclosure
              </div>
              <p className="text-xs text-slate-400 leading-relaxed font-sans">
                Do NOT execute trades with real funds or rely on telemetry data for fiduciary decisions. All users must operate strictly on paper sandbox accounts.
              </p>
            </div>

            {/* Checkbox Agreement */}
            <label
              onClick={() => setIsChecked(!isChecked)}
              className="flex items-start gap-3 p-3.5 border border-[#16382E] bg-[#040705] hover:border-emerald-500/40 transition-colors cursor-pointer group select-none"
            >
              <div
                className={`w-4 h-4 border shrink-0 mt-0.5 flex items-center justify-center transition-colors ${
                  isChecked
                    ? "bg-[#DAF1DE] border-[#DAF1DE] text-[#051F20]"
                    : "border-[#1F4A3E] bg-[#090E0C] group-hover:border-emerald-400"
                }`}
              >
                {isChecked && <Check size={12} strokeWidth={3} />}
              </div>
              <span className="text-xs text-slate-300 leading-snug font-sans">
                I understand that this system is an experimental preview, and I acknowledge the sandbox testing requirements.
              </span>
            </label>

            {/* Action Button */}
            <div className="pt-2">
              <button
                type="button"
                onClick={handleAcknowledge}
                disabled={!isChecked}
                className={`w-full py-3.5 px-6 font-mono text-[11px] uppercase tracking-widest font-semibold transition-all flex items-center justify-center gap-2 ${
                  isChecked
                    ? "bg-[#DAF1DE] text-[#051F20] hover:bg-[#c2e8c8] shadow-lg shadow-[#DAF1DE]/10 cursor-pointer"
                    : "bg-[#040705] text-slate-600 border border-[#16382E] cursor-not-allowed"
                }`}
              >
                <span>Acknowledge &amp; Enter</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
