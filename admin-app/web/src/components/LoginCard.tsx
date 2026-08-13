import { useState, type FormEvent } from "react";

import { signIn } from "../lib/auth";

/**
 * Sign-in glass card centered on the dark page (Quantix Glass V2 — matches
 * dashboard/web GlassCard pattern + dashboard-style inputs, OverviewV2.tsx).
 * Session changes are picked up by App's onSessionChange subscription.
 */
export function LoginCard() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await signIn(email.trim(), password);
    if (signInError) setError(signInError);
    setBusy(false);
  };

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-sm flex-col justify-center px-6 py-16">
      <div className="glass-panel rounded-2xl p-8">
        <h1 className="text-lg font-semibold tracking-tight text-primary">Sign in</h1>
        <p className="mt-1 text-sm text-muted">Admin access to the beta tester pilot.</p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-primary shadow-sm outline-none transition placeholder:text-faint focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1 block text-[11px] font-medium uppercase tracking-[0.08em] text-muted">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-primary shadow-sm outline-none transition placeholder:text-faint focus:border-brand-gold focus:ring-1 focus:ring-brand-gold/30"
            />
          </div>
          {error && (
            <p role="alert" className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg bg-brand-gold px-3 py-2 text-sm font-semibold text-page transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
