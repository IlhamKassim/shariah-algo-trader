import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform } from "framer-motion";

/**
 * Interactive primitives for the Console design system (DESIGN.md §A).
 *
 * Motion rules for this set:
 *  - Selection indicators move with a shared layoutId so the pill travels
 *    rather than fading between positions.
 *  - Springs, not eased tweens, for anything a finger conceptually "throws".
 *  - Every animation is skipped under prefers-reduced-motion.
 */

const SPRING = { type: "spring", stiffness: 420, damping: 34, mass: 0.7 } as const;

function usePrefersReducedMotion() {
  return useSyncExternalStore(
    (notify) => {
      const mq = window.matchMedia?.("(prefers-reduced-motion: reduce)");
      mq?.addEventListener?.("change", notify);
      return () => mq?.removeEventListener?.("change", notify);
    },
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
    () => false,
  );
}

/* -------------------------------------------------------------------------- */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  idPrefix,
}: {
  options: { value: T; label: string; hint?: string }[];
  value: T;
  onChange: (v: T) => void;
  idPrefix: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <div
      role="tablist"
      className="inline-flex gap-1 p-[5px] bg-[var(--c-soft)] rounded-full relative"
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            type="button"
            title={o.hint}
            onClick={() => onChange(o.value)}
            className={`relative rounded-full text-[12.5px] px-4 py-2 whitespace-nowrap cursor-pointer transition-colors ${
              active ? "text-[var(--c-ink)] font-semibold" : "text-[var(--c-mid)] font-medium hover:text-[var(--c-ink)]"
            }`}
          >
            {active && (
              <motion.span
                layoutId={`${idPrefix}-seg`}
                transition={reduced ? { duration: 0 } : SPRING}
                className="absolute inset-0 bg-[var(--c-card)] rounded-full shadow-[0_1px_3px_rgba(20,25,35,0.14)]"
              />
            )}
            <span className="relative z-10">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  tone = "var(--c-blue)",
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  tone?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <label
      className={`flex items-start gap-3.5 ${disabled ? "opacity-55" : "cursor-pointer"} group`}
    >
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className="relative w-[42px] h-[24px] shrink-0 rounded-full mt-0.5 transition-colors duration-200 disabled:cursor-not-allowed"
        style={{ background: checked ? tone : "var(--c-line)" }}
      >
        <motion.span
          layout
          transition={reduced ? { duration: 0 } : SPRING}
          className="absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_1px_3px_rgba(20,25,35,0.3)]"
          style={{ left: checked ? 21 : 3 }}
        />
      </button>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold">{label}</span>
        {description && (
          <span className="block text-[12px] text-[var(--c-mid)] mt-0.5 leading-[1.5]">
            {description}
          </span>
        )}
      </span>
    </label>
  );
}

/* -------------------------------------------------------------------------- */

/** Range input with a value bubble that tracks the thumb. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  format,
  hint,
  disabled,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  hint?: string;
  disabled?: boolean;
}) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <div className={`min-w-0 ${disabled ? "opacity-55" : ""}`}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12.5px] font-semibold">{label}</span>
        <span className="console-display text-[19px] tabular-nums tracking-[-0.02em]">
          {format(value)}
        </span>
      </div>

      <div className="relative mt-2.5 h-6 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-[var(--c-soft)]" />
        <div
          className="absolute h-1.5 rounded-full bg-[var(--c-blue)] pointer-events-none"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          aria-label={label}
          onChange={(e) => onChange(Number(e.target.value))}
          className="relative w-full appearance-none bg-transparent cursor-pointer disabled:cursor-not-allowed
            focus:outline-none focus-visible:[&::-webkit-slider-thumb]:ring-4
            focus-visible:[&::-webkit-slider-thumb]:ring-[var(--c-blue)]/25
            focus-visible:[&::-moz-range-thumb]:ring-4 focus-visible:[&::-moz-range-thumb]:ring-[var(--c-blue)]/25
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-[18px] [&::-webkit-slider-thumb]:h-[18px]
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:shadow-[0_1px_4px_rgba(20,25,35,0.35)]
            [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-[var(--c-blue)]
            [&::-moz-range-thumb]:w-[18px] [&::-moz-range-thumb]:h-[18px] [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-[var(--c-blue)]"
        />
      </div>

      {hint && <p className="text-[11.5px] text-[var(--c-mute)] mt-1.5 leading-[1.5]">{hint}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */

/** Counts to a new value rather than snapping, so a changed figure is noticed. */
export function Ticker({
  value,
  format = (v) => String(Math.round(v)),
  className = "",
}: {
  value: number;
  format?: (v: number) => string;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const mv = useMotionValue(value);
  const spring = useSpring(mv, { stiffness: 200, damping: 26 });
  const text = useTransform(spring, (v) => format(v));

  useEffect(() => {
    mv.set(value);
  }, [value, mv]);

  if (reduced) return <span className={className}>{format(value)}</span>;
  return <motion.span className={className}>{text}</motion.span>;
}

/* -------------------------------------------------------------------------- */

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="block text-[12px] font-semibold text-[var(--c-mid)] mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-[11.5px] text-[var(--c-mute)] mt-1.5">{hint}</span>}
    </label>
  );
}

export const inputClass =
  "w-full bg-[var(--c-soft)] rounded-[14px] px-4 py-3 text-[13.5px] text-[var(--c-ink)] " +
  "placeholder:text-[var(--c-mute)] border border-transparent focus:border-[var(--c-blue)] " +
  "focus:outline-none focus:bg-[var(--c-card)] transition-colors disabled:opacity-60";

/* -------------------------------------------------------------------------- */

/**
 * Secrets reveal on press-and-hold rather than a sticky toggle: it cannot be
 * left switched on, and it takes a deliberate act to expose a credential.
 */
export function SecretField({
  label,
  value,
  onChange,
  placeholder,
  hint,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
}) {
  const [held, setHeld] = useState(false);
  const holdRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const release = () => setHeld(false);
    window.addEventListener("pointerup", release);
    window.addEventListener("blur", release);
    return () => {
      window.removeEventListener("pointerup", release);
      window.removeEventListener("blur", release);
    };
  }, []);

  return (
    <Field label={label} hint={hint}>
      <div className="relative">
        <input
          type={held ? "text" : "password"}
          value={value}
          disabled={disabled}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-[92px] font-mono tracking-tight`}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          ref={holdRef}
          type="button"
          disabled={disabled}
          onPointerDown={() => setHeld(true)}
          onPointerUp={() => setHeld(false)}
          onPointerLeave={() => setHeld(false)}
          onKeyDown={(e) => e.key === "Enter" && setHeld(true)}
          onKeyUp={() => setHeld(false)}
          aria-label={`Hold to reveal ${label}`}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[11px] font-semibold
            bg-[var(--c-card)] text-[var(--c-mid)] hover:text-[var(--c-ink)] shadow-[0_1px_2px_rgba(20,25,35,0.1)]
            cursor-pointer select-none transition-colors disabled:opacity-50"
        >
          {held ? "Showing" : "Hold to show"}
        </button>
      </div>
    </Field>
  );
}

/* -------------------------------------------------------------------------- */

/** Slides up only when there is something to save; reports the change count. */
export function SaveBar({
  dirtyCount,
  onSave,
  onReset,
  saving,
  disabled,
  disabledReason,
}: {
  dirtyCount: number;
  onSave: () => void;
  onReset: () => void;
  saving?: boolean;
  disabled?: boolean;
  disabledReason?: string;
}) {
  const reduced = usePrefersReducedMotion();
  return (
    <AnimatePresence>
      {dirtyCount > 0 && (
        <motion.div
          initial={reduced ? false : { y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { y: 80, opacity: 0 }}
          transition={reduced ? { duration: 0 } : SPRING}
          className="fixed left-1/2 -translate-x-1/2 bottom-6 z-50 w-[min(680px,calc(100vw-44px))]"
          role="status"
        >
          <div className="flex items-center gap-3 bg-[var(--c-ink)] text-white rounded-full pl-6 pr-2 py-2 shadow-[0_12px_40px_rgba(20,25,35,0.32)]">
            <span className="flex-1 min-w-0 text-[13px]">
              {disabled && disabledReason ? (
                disabledReason
              ) : (
                <>
                  <span className="tabular-nums font-semibold">{dirtyCount}</span> unsaved change
                  {dirtyCount === 1 ? "" : "s"}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={onReset}
              className="rounded-full px-4 py-2.5 text-[12.5px] font-semibold text-white/70 hover:text-white cursor-pointer transition-colors"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={onSave}
              disabled={saving || disabled}
              className="rounded-full bg-white text-[var(--c-ink)] px-5 py-2.5 text-[12.5px] font-semibold cursor-pointer hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
