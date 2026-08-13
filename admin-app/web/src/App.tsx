import { useEffect, useState } from "react";

const PRODUCT_NAME = "Shariah Admin";
const THEME_KEY = "shariah-admin-theme";

/**
 * Placeholder admin shell implementing the clean-SaaS tokens of
 * SPEC-BETA-PILOT.md section 5.3: Inter/system sans, light default with a
 * dark-mode toggle (class strategy), white cards with 1px slate-200 borders,
 * shadow-sm, rounded-xl, single indigo-600 accent. Real views (Testers
 * table, detail drawer, Invites) land in Phase 4.
 */
export default function App() {
  const [dark, setDark] = useState<boolean>(
    () => localStorage.getItem(THEME_KEY) === "dark",
  );

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  }, [dark]);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-sm font-semibold text-white">
              S
            </span>
            <span className="text-sm font-semibold tracking-tight">{PRODUCT_NAME}</span>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-slate-500 dark:text-slate-400">
              aqilnazri9@gmail.com
            </span>
            <button
              type="button"
              onClick={() => setDark((value) => !value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              {dark ? "Light" : "Dark"}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-xl font-semibold tracking-tight">Testers</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Beta pilot tester lifecycle — scaffold placeholder.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <span className="text-sm font-medium">All testers</span>
            <button
              type="button"
              className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white shadow-sm transition hover:bg-indigo-500"
            >
              Issue invite
            </button>
          </div>
          <div className="px-5 py-16 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No testers yet. Invites and approvals arrive in Phase 4.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
