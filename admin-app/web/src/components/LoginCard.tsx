import { useState, type FormEvent } from "react";
import { signIn } from "../lib/auth";

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

  const inputClasses =
    "w-full bg-[#0a0a0a] border-2 border-[#333333] px-3 py-2.5 text-xs font-mono text-[#ffffff] outline-none focus:border-[#ffffff] placeholder:text-secondary-fixed-dim rounded-none";

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-6 py-16">
      <div className="bg-[#1a1918] border-2 border-[#333333] p-8 space-y-6">
        {/* Brand header */}
        <div className="flex items-center gap-3 select-none border-b-2 border-[#333333] pb-4">
          <div className="w-10 h-10 bg-[#3366cc] border-2 border-[#333333] flex items-center justify-center text-lg font-headline font-bold text-white">
            S
          </div>
          <div>
            <h1 className="text-lg font-headline font-bold text-[#ffffff] uppercase tracking-wider">
              ShariahAdmin
            </h1>
            <p className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-widest">
              Trading Portal · Paper Only
            </p>
          </div>
        </div>

        <div>
          <h2 className="text-xl font-headline font-bold text-[#ffffff] uppercase tracking-wider">
            Operator Sign In
          </h2>
          <p className="text-xs font-mono text-secondary-fixed-dim mt-1">
            Administrative access to the algorithmic trading console.
          </p>
        </div>

        <form onSubmit={submit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-widest text-secondary-fixed-dim"
            >
              Operator Email
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClasses}
              placeholder="admin@shariahtrading.my"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-[10px] font-mono font-bold uppercase tracking-widest text-secondary-fixed-dim"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={inputClasses}
            />
          </div>

          {error && (
            <div
              role="alert"
              className="border-2 border-[#ba1a1a] bg-[#ba1a1a]/10 p-3 text-xs font-mono text-[#ffdad6]"
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full bg-[#f2f0f1] text-[#0a0a0a] border-2 border-[#f2f0f1] py-3 text-xs font-label font-bold uppercase tracking-widest hover:bg-[#d1d1d1] transition-none disabled:opacity-50"
          >
            {busy ? "Authenticating…" : "Authenticate Session"}
          </button>
        </form>
      </div>
    </div>
  );
}
