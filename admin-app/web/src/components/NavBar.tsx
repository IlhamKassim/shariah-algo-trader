const PRODUCT_NAME = "Shariah Admin";

export type View = "testers" | "invites";

interface NavBarProps {
  email: string | null;
  dark: boolean;
  view: View;
  onViewChange: (view: View) => void;
  onToggleDark: () => void;
  onSignOut: () => void;
}

const NAV_LINKS: { key: View; label: string }[] = [
  { key: "testers", label: "Testers" },
  { key: "invites", label: "Invites" },
];

/** Top nav only (no sidebar — SPEC §5.3): product, admin email, dark toggle. */
export function NavBar({ email, dark, view, onViewChange, onToggleDark, onSignOut }: NavBarProps) {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
              S
            </span>
            <span className="text-sm font-semibold tracking-tight">{PRODUCT_NAME}</span>
          </div>
          {email && (
            <nav className="flex items-center gap-1">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.key}
                  type="button"
                  onClick={() => onViewChange(link.key)}
                  className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                    view === link.key
                      ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-100"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
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
              <span className="hidden text-sm text-slate-500 sm:inline dark:text-slate-400">{email}</span>
              <button
                type="button"
                onClick={onSignOut}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Sign out
              </button>
            </>
          )}
          <button
            type="button"
            onClick={onToggleDark}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            {dark ? "Light" : "Dark"}
          </button>
        </div>
      </div>
    </header>
  );
}
