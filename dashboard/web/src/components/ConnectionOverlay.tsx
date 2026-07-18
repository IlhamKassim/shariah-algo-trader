import { useState, useEffect } from "react";
import { TrendingUp, ShieldCheck } from "lucide-react";

interface ConnectionOverlayProps {
  modeName?: string;
  onComplete: () => void;
}

const STEPS = [
  "VERIFYING SESSION CREDENTIALS...",
  "INITIALIZING MULTI-FACTOR ENGINE (SPUS TOP 20)...",
  "CONNECTING TO SECURE PORT 8000...",
  "SESSION ESTABLISHED — LAUNCHING CONSOLE...",
];

export function ConnectionOverlay({ modeName = "SECURE CONSOLE", onComplete }: ConnectionOverlayProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(15);

  useEffect(() => {
    const stepInterval = setInterval(() => {
      setStepIndex((prev) => (prev < STEPS.length - 1 ? prev + 1 : prev));
    }, 180);

    const progressInterval = setInterval(() => {
      setProgress((prev) => Math.min(prev + 20, 100));
    }, 120);

    const completeTimeout = setTimeout(() => {
      onComplete();
    }, 750);

    return () => {
      clearInterval(stepInterval);
      clearInterval(progressInterval);
      clearTimeout(completeTimeout);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-[#0C0B09] text-[#ECE5D5] flex flex-col items-center justify-center font-mono px-6 select-none animate-fadeIn">
      {/* Background subtle grid */}
      <div className="absolute inset-0 pointer-events-none opacity-5 bg-[linear-gradient(to_right,#29241B_1px,transparent_1px),linear-gradient(to_bottom,#29241B_1px,transparent_1px)] bg-[size:40px_40px]" />

      <div className="w-full max-w-[420px] flex flex-col items-center text-center space-y-6 relative z-10">
        {/* Animated Brand Logo */}
        <div className="relative">
          <div className="w-16 h-16 bg-[#D1A92E] flex items-center justify-center text-[#0C0B09] shadow-[0_0_30px_rgba(209,169,46,0.35)] animate-pulse">
            <TrendingUp size={32} strokeWidth={2.5} />
          </div>
          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#5BA97C] rounded-full flex items-center justify-center text-[#0C0B09]">
            <ShieldCheck size={12} strokeWidth={3} />
          </div>
        </div>

        {/* Brand Title */}
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[#ECE5D5] tracking-[0.2em] uppercase">
            SHARIAHTRADING
          </h2>
          <p className="text-[10px] text-[#D1A92E] tracking-widest uppercase font-semibold">
            {modeName} PORTAL
          </p>
        </div>

        {/* Progress bar container */}
        <div className="w-full bg-[#1A1813] border border-[#29241B] h-1.5 overflow-hidden p-0.5 my-2">
          <div
            className="bg-[#D1A92E] h-full transition-all duration-100 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Status Ticker Line */}
        <div className="bg-[#100E0B] border border-[#29241B] w-full p-3 font-mono text-[11px] text-[#8C8577] min-h-[46px] flex items-center justify-center">
          <span className="text-[#D1A92E] mr-2">›</span>
          <span className="text-[#ECE5D5] tracking-wider font-semibold animate-pulse">
            {STEPS[stepIndex]}
          </span>
        </div>
      </div>
    </div>
  );
}
