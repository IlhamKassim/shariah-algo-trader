import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Lock, Eye, EyeOff, ShieldAlert } from "lucide-react";
import { api } from "../lib/api";

export function Login() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: auth, isLoading } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
    refetchOnWindowFocus: false,
  });

  // Redirect to home if already authenticated
  useEffect(() => {
    if (auth && (!auth.auth_enabled || auth.authenticated)) {
      navigate("/", { replace: true });
    }
  }, [auth, navigate]);

  // Read URL query errors
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const err = params.get("error");
    if (err) {
      if (err === "unauthorized_email") {
        setError("Access Denied: Google account is not whitelisted.");
      } else if (err === "token_exchange_failed") {
        setError("Google authentication token exchange failed.");
      } else if (err === "profile_fetch_failed") {
        setError("Failed to fetch Google profile information.");
      } else if (err === "email_not_provided") {
        setError("Google account did not provide a valid email address.");
      } else if (err === "google_auth_not_configured") {
        setError("Google OAuth is not configured on the server.");
      } else {
        setError(`Authentication error: ${err}`);
      }
    }
  }, [location]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center font-mono text-primary">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border border-brand-gold border-t-transparent animate-spin" />
          <span className="text-xs text-muted tracking-wider">LOADING SECURE INSTANCE...</span>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      setError("Password cannot be blank.");
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      await api.login(password);
      // Invalidate the auth status to trigger a refetch
      await queryClient.invalidateQueries({ queryKey: ["authStatus"] });
      navigate("/", { replace: true });
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("Invalid credentials. Access Denied.");
      } else {
        setError("An unexpected authentication error occurred.");
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    // Redirect the browser directly to the FastAPI google login route
    window.location.href = "/api/auth/google/login";
  };

  return (
    <div className="min-h-screen bg-page flex flex-col items-center justify-center px-4 font-mono select-none">
      {/* Decorative background grids/details */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        <div 
          className="w-full h-full bg-[linear-gradient(to_right,#29241B_1px,transparent_1px),linear-gradient(to_bottom,#29241B_1px,transparent_1px)]"
          style={{ backgroundSize: "40px 40px" }}
        />
      </div>

      <div className="w-full max-w-[400px] z-10">
        {/* Brand/System Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center bg-brand-gold hover:rotate-12 transition-transform duration-300 shadow-md">
            <TrendingUp size={22} className="text-page" strokeWidth={2.5} />
          </div>
          <h1 className="text-[14px] font-bold text-primary tracking-[0.15em] uppercase mt-4 text-center">
            SHARIAH ALGO TRADER
          </h1>
          <p className="text-[9px] text-brand-gold tracking-[0.08em] uppercase mt-1">
            Secure Portfolio Console
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-card border border-divider shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:border-brand-gold/20 transition-colors duration-500 rounded-none overflow-hidden">
          {/* Header Row */}
          <div className="bg-[#100E0B] border-b border-divider px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-brand-gold/60" />
              <span className="text-[10px] font-bold text-muted tracking-wider">SYSTEM SIGN IN</span>
            </div>
            <span className="text-[9px] text-faint font-semibold tracking-wider uppercase border border-divider px-1.5 py-0.5">
              SECURE PORT 8000
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Feedback Message */}
            {error && (
              <div className="bg-[#1A1211] border border-brand-red/30 p-3 flex items-start gap-2.5">
                <ShieldAlert size={14} className="text-brand-red shrink-0 mt-0.5" />
                <div className="flex-1 text-[10px] font-semibold text-brand-red uppercase tracking-wider leading-relaxed">
                  {error}
                </div>
              </div>
            )}

            {/* Google OAuth Login Button */}
            {auth?.google_auth_enabled && (
              <button
                type="button"
                onClick={handleGoogleLogin}
                className="w-full bg-[#1A1813] hover:bg-[#25221A] text-brand-gold font-bold text-[10px] tracking-[0.12em] uppercase py-3 border border-divider hover:border-brand-gold/40 transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.527a5.99 5.99 0 0 1 5.991-6c1.554 0 2.96.593 4.025 1.564l3.199-3.199C19.24 3.01 16.78 1.927 13.99 1.927a9.99 9.99 0 0 0-9.99 10a9.99 9.99 0 0 0 9.99 10c5.56 0 9.873-3.9 9.873-10a8.7 8.7 0 0 0-.153-1.642H12.24z" />
                </svg>
                SIGN IN WITH GOOGLE CONSOLE
              </button>
            )}

            {/* Divider if both are enabled */}
            {auth?.google_auth_enabled && auth?.password_auth_enabled && (
              <div className="relative flex items-center justify-center py-2">
                <div className="border-t border-divider w-full"></div>
                <span className="absolute bg-[#0C0B09] px-3.5 text-[8px] text-faint font-bold tracking-widest uppercase">
                  OR
                </span>
              </div>
            )}

            {/* Password Login Form */}
            {auth?.password_auth_enabled && (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Input Group */}
                <div className="space-y-2">
                  <label 
                    htmlFor="password" 
                    className="text-[10px] font-semibold text-muted uppercase tracking-[0.08em] flex items-center gap-1.5"
                  >
                    <Lock size={11} className="text-brand-gold" /> Enter Console Key
                  </label>
                  <div className="relative">
                    <input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#12100D] border border-divider text-[12px] px-3.5 py-2.5 focus:outline-none focus:border-brand-gold/60 focus:ring-1 focus:ring-brand-gold/20 text-primary transition-all rounded-none placeholder:text-faint font-sans tracking-widest"
                      disabled={isSubmitting}
                      autoFocus
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-faint hover:text-muted transition-colors focus:outline-none"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-brand-gold text-page font-bold text-[11px] tracking-[0.12em] uppercase py-3 border border-brand-gold hover:bg-transparent hover:text-brand-gold transition-colors duration-300 select-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <div className="w-3.5 h-3.5 border border-page border-t-transparent animate-spin shrink-0" />
                      AUTHENTICATING...
                    </>
                  ) : (
                    "INITIATE CONNECTION"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        {/* Footer Notes */}
        <div className="mt-6 flex flex-col items-center gap-1 text-[9px] text-faint tracking-wider text-center uppercase">
          <span>Long-only · No leverage · Halal Screener Console</span>
          <span>ESTABLISHED 2026 SHARIAH-ALGO-TRADER</span>
        </div>
      </div>
    </div>
  );
}

