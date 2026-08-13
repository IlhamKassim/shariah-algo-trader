export type View = "testers" | "invites";

interface NavBarProps {
  email: string | null;
  view: View;
  onViewChange: (view: View) => void;
  onSignOut: () => void;
}

const NAV_LINKS: { key: View; label: string }[] = [
  { key: "testers", label: "Testers" },
  { key: "invites", label: "Invites" },
];

/**
 * Dashboard-style top header (Quantix Glass V2): dark bg #0B0D14, indigo app
 * mark, Instrument Serif wordmark, gold PILOT pill, mono small-caps nav tabs.
 * Dark-only — the app matches the dashboard, so the old light-theme toggle is
 * gone (dashboard/web/src/App.tsx:194-214 for the reference pattern).
 */
export function NavBar({ email, view, onViewChange, onSignOut }: NavBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-glass-sidebar px-6">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 min-w-0 select-none">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-600 text-white">
              <span className="font-mono text-sm font-bold">S</span>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="font-serif text-[16px] leading-none text-primary">Shariah Admin</span>
                <span className="rounded-full border border-brand-gold/40 bg-brand-gold/10 px-2 py-0.5 font-mono text-[9px] font-bold uppercase tracking-[0.08em] text-brand-gold">
                  Pilot
                </span>
              </div>
              <span className="mt-1 whitespace-nowrap text-[9px] font-medium tracking-[0.03em] text-muted">
                Beta tester console
              </span>
            </div>
          </div>
          {email && (
            <nav className="hidden items-center gap-1 sm:flex" aria-label="Admin views">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.key}
                  type="button"
                  onClick={() => onViewChange(link.key)}
                  className={`rounded-lg px-3 py-1.5 text-[11px] font-mono font-semibold uppercase tracking-[0.08em] transition ${
                    view === link.key
                      ? "border border-brand-gold/40 bg-brand-gold/10 text-brand-gold"
                      : "border border-transparent text-muted hover:bg-white/5 hover:text-primary"
                  }`}
                >
                  {link.label}
                </button>
              ))}
            </nav>
          )}
        </div>
        <div className="flex items-center gap-4">
          {email && (
            <>
              <span className="hidden max-w-[220px] truncate font-mono text-[11px] text-muted md:block" title={email}>
                {email}
              </span>
              <button
                type="button"
                onClick={onSignOut}
                className="flex items-center gap-1.5 border border-divider px-2.5 py-1 text-[10px] font-mono font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:border-brand-red/30 hover:text-brand-red"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
