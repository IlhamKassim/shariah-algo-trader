import { useEffect, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

/**
 * Trading environment switch, on the Console design system (DESIGN.md §A).
 *
 * Switching to live money is irreversible in the sense that matters — the next
 * rebalance spends real capital — so per §A5 rule 4 the confirmation step is
 * deliberate: live requires an explicit acknowledgement, not just a selection.
 */

interface AccountModeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: "paper" | "live";
}

const MODES = {
  paper: {
    label: "Paper",
    blurb: "Simulated orders against Alpaca's paper endpoint. No real capital moves.",
    endpoint: "paper-api.alpaca.markets",
    accent: "var(--c-blue)",
  },
  live: {
    label: "Live",
    blurb: "Real orders on your live Alpaca brokerage account, with real capital.",
    endpoint: "api.alpaca.markets",
    accent: "var(--c-red)",
  },
} as const;

function ModeOption({
  mode,
  selected,
  current,
  onSelect,
}: {
  mode: "paper" | "live";
  selected: boolean;
  current: boolean;
  onSelect: () => void;
}) {
  const m = MODES[mode];
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className="text-left min-w-0 rounded-[var(--r-inset)] border p-4 transition-colors cursor-pointer"
      style={{
        borderColor: selected ? m.accent : "var(--c-line)",
        background: selected ? "var(--c-soft)" : "var(--c-card)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="w-[9px] h-[9px] shrink-0 rounded-full block"
            style={{ background: selected ? m.accent : "var(--c-line)" }}
          />
          <span className="text-[13.5px] font-semibold tracking-[-0.01em]">{m.label}</span>
        </div>
        {current && (
          <span className="text-[11px] text-[var(--c-mute)] whitespace-nowrap">Current</span>
        )}
      </div>
      <p className="text-[12.5px] text-[var(--c-mid)] leading-[1.5] mt-2">{m.blurb}</p>
      <div className="text-[11.5px] text-[var(--c-mute)] mt-2.5 truncate">{m.endpoint}</div>
    </button>
  );
}

export function AccountModeModal({ isOpen, onClose, currentMode }: AccountModeModalProps) {
  const [selectedMode, setSelectedMode] = useState<"paper" | "live">(currentMode);
  const [acknowledged, setAcknowledged] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const queryClient = useQueryClient();

  // Reopening must not inherit a stale selection or a spent acknowledgement.
  useEffect(() => {
    if (isOpen) {
      setSelectedMode(currentMode);
      setAcknowledged(false);
      setErrorMsg(null);
    }
  }, [isOpen, currentMode]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const goingLive = selectedMode === "live";
  const unchanged = currentMode === selectedMode;
  const blocked = unchanged || isSubmitting || (goingLive && !acknowledged);

  const handleConfirmSwitch = async () => {
    try {
      setIsSubmitting(true);
      setErrorMsg(null);
      await api.switchTradingMode(selectedMode, goingLive);
      await queryClient.invalidateQueries();
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Failed to switch trading environment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="console-root fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            className="absolute inset-0 bg-[rgba(16,17,20,0.45)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.15 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Trading environment"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : 0.18, ease: "easeOut" }}
            className="relative w-full max-w-[520px] max-h-[90vh] overflow-y-auto bg-[var(--c-card)] border border-[var(--c-line)] rounded-[var(--r-card)] shadow-[var(--sh-pop)] p-5 sm:p-[22px] flex flex-col gap-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-[16px] font-semibold tracking-[-0.01em]">
                  Trading environment
                </h2>
                <p className="text-[12.5px] text-[var(--c-mid)] leading-[1.5] mt-1">
                  Chooses which Alpaca account the engine sends orders to.
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="shrink-0 text-[var(--c-mute)] hover:text-[var(--c-ink)] transition-colors cursor-pointer text-[15px] leading-none p-1"
              >
                ✕
              </button>
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="rounded-[var(--r-inset)] border px-4 py-3 text-[12.5px] leading-[1.5]"
                style={{
                  borderColor: "var(--c-red)",
                  background: "var(--c-soft)",
                  color: "var(--c-red)",
                }}
              >
                {errorMsg}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["paper", "live"] as const).map((m) => (
                <ModeOption
                  key={m}
                  mode={m}
                  selected={selectedMode === m}
                  current={currentMode === m}
                  onSelect={() => setSelectedMode(m)}
                />
              ))}
            </div>

            {/* Switching accounts starts a new NAV series, because the
                performance store is keyed per broker account (ADR-0010). Saying
                so here is cheaper than a reader mistaking a reset for a loss. */}
            {!unchanged && (
              <p className="text-[12px] text-[var(--c-mute)] leading-[1.5]">
                The performance curve tracks each brokerage account separately, so
                switching starts a fresh history. The {MODES[currentMode].label.toLowerCase()}{" "}
                account's record is kept and returns if you switch back.
              </p>
            )}

            {goingLive && !unchanged && (
              <label
                className="flex gap-3 items-start rounded-[var(--r-inset)] border p-4 cursor-pointer"
                style={{ borderColor: "var(--c-red)", background: "var(--c-soft)" }}
              >
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-0.5 shrink-0 accent-[var(--c-red)] w-4 h-4 cursor-pointer"
                />
                <span className="text-[12.5px] text-[var(--c-mid)] leading-[1.5]">
                  I understand the next rebalance will place{" "}
                  <span className="font-semibold text-[var(--c-ink)]">real orders with real money</span>{" "}
                  on my live Alpaca account. Live API keys must already be configured.
                </span>
              </label>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-0.5">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--r-btn)] px-4 py-2.5 text-[12.5px] font-medium text-[var(--c-mid)] hover:text-[var(--c-ink)] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmSwitch}
                disabled={blocked}
                className="rounded-[var(--r-btn)] px-5 py-2.5 text-[12.5px] font-semibold text-white transition-opacity cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: goingLive ? "var(--c-red)" : "var(--c-ink)" }}
              >
                {isSubmitting
                  ? "Switching…"
                  : unchanged
                    ? `Already on ${MODES[selectedMode].label.toLowerCase()}`
                    : `Switch to ${MODES[selectedMode].label.toLowerCase()}`}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
