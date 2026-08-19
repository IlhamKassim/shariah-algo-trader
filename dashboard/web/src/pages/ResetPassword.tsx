import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, ShieldAlert, ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "../lib/supabaseClient";

/**
 * Recovery landing page for the password-reset email link.
 *
 * Handles both Implicit Flow (#access_token=...&type=recovery)
 * and PKCE Flow (?code=... or ?type=recovery or ?token_hash=...).
 *
 * Supabase-js processes the link parameters on page load and establishes a recovery session.
 * This component checks URL parameters, existing session, and auth state changes
 * to reliably activate recovery mode.
 */
export function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const navigate = useNavigate();

  const validatePassword = useCallback((value: string): string | null => {
    if (value.length < 12) {
      return "Password policy violation: Minimum 12 characters required.";
    }
    if (!/[A-Z]/.test(value)) {
      return "Password policy violation: Must contain at least 1 uppercase letter (A-Z).";
    }
    if (!/[a-z]/.test(value)) {
      return "Password policy violation: Must contain at least 1 lowercase letter (a-z).";
    }
    if (!/[0-9]/.test(value)) {
      return "Password policy violation: Must contain at least 1 numeric digit (0-9).";
    }
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(value)) {
      return "Password policy violation: Must contain at least 1 special character (!@#$%^&*...).";
    }
    return null;
  }, []);

  useEffect(() => {
    let isMounted = true;

    const checkStatus = async () => {
      const hash = window.location.hash || "";
      const search = window.location.search || "";

      // 1. Detect recovery markers in URL hash or search params
      const hasRecoveryParam =
        hash.includes("type=recovery") ||
        hash.includes("access_token=") ||
        search.includes("type=recovery") ||
        search.includes("code=") ||
        search.includes("token_hash=");

      if (hasRecoveryParam && isMounted) {
        setIsRecoveryMode(true);
        sessionStorage.setItem("shariah_recovery_mode", "true");
      }

      // 2. Check for active Supabase session (established via reset link)
      if (supabase) {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user && isMounted) {
            setIsRecoveryMode(true);
            sessionStorage.setItem("shariah_recovery_mode", "true");
          }
        } catch {
          // ignore session fetch error
        }
      }

      if (isMounted) {
        setIsChecking(false);
      }
    };

    checkStatus();

    // 3. Listen for authoritative auth state change events
    if (!supabase) {
      if (isMounted) setIsChecking(false);
      return;
    }

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION"))
      ) {
        if (isMounted) {
          setIsRecoveryMode(true);
          sessionStorage.setItem("shariah_recovery_mode", "true");
          setIsChecking(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supabase) {
      setError("Authentication system is not configured. Contact the administrator.");
      return;
    }
    const trimmed = password.trim();
    const policyError = validatePassword(trimmed);
    if (policyError) {
      setError(policyError);
      return;
    }
    if (trimmed !== confirmPassword.trim()) {
      setError("Passwords do not match.");
      return;
    }

    setError(null);
    setSuccessMsg(null);
    setIsSubmitting(true);

    try {
      const { error: updateErr } = await supabase.auth.updateUser({
        password: trimmed,
      });
      if (updateErr) throw updateErr;

      setSuccessMsg("✅ Password updated successfully! Please sign in with your new password.");
      sessionStorage.removeItem("shariah_recovery_mode");
      await supabase.auth.signOut();
      setTimeout(() => navigate("/login"), 1500);
    } catch (err: any) {
      setError(err?.message || "Failed to update password. The reset link may be expired — request a new one.");
      setIsSubmitting(false);
    }
  };

  if (isChecking) {
    return (
      <div className="min-h-screen bg-[#051F20] text-[#DAF1DE] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-[#8EB69B] border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-[#8EB69B] tracking-wider uppercase">Verifying Reset Link...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#051F20] text-[#DAF1DE] flex flex-col items-center justify-center p-6 font-sans relative overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(circle at 50% 40%, rgba(142, 182, 155, 0.12), transparent 60%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md">
        <button
          type="button"
          onClick={() => navigate("/login")}
          className="inline-flex items-center gap-2 text-xs text-[#8EB69B] hover:text-[#DAF1DE] transition-colors tracking-wide cursor-pointer bg-[#0B2B26]/60 hover:bg-[#163832] px-3.5 py-1.5 rounded-full border border-[#235347]/60 mb-8"
        >
          <ArrowLeft size={14} /> Back to Login
        </button>

        <div className="bg-[#0B2B26]/70 backdrop-blur-md border border-[#235347]/60 rounded-2xl p-8 shadow-xl shadow-black/30">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-[#235347] flex items-center justify-center text-[#DAF1DE]">
              <KeyRound size={16} />
            </div>
            <h1 className="text-xl font-serif text-[#DAF1DE]">Reset Password</h1>
          </div>

          {successMsg ? (
            <div className="bg-[#0B2B26] border border-[#235347] p-3.5 rounded-xl text-xs text-[#DAF1DE] font-medium">
              {successMsg}
            </div>
          ) : isRecoveryMode ? (
            <>
              <p className="text-sm text-[#8EB69B] mt-1 mb-6">
                Choose a new password for your account.
              </p>

              {error && (
                <div className="bg-rose-950/40 border border-rose-500/30 p-3.5 rounded-xl flex items-start gap-3 mb-4">
                  <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 text-xs text-rose-300 font-medium leading-relaxed">
                    {error}
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="new-password" className="text-xs font-semibold text-[#8EB69B]">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="new-password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter new password"
                      className="w-full bg-[#0B2B26] border border-[#235347] focus:border-[#8EB69B] text-sm px-4 py-3 pr-10 rounded-xl text-[#DAF1DE] placeholder-[#8EB69B]/40 focus:outline-none transition-all"
                      disabled={isSubmitting}
                      autoFocus
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8EB69B] hover:text-[#DAF1DE] transition-colors focus:outline-none cursor-pointer"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-xs text-[#8EB69B]/70 mt-1">
                    Must be at least 12 characters with 1 uppercase, 1 lowercase, 1 digit and 1 special character.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirm-password" className="text-xs font-semibold text-[#8EB69B]">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="confirm-password"
                      type={showConfirm ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className="w-full bg-[#0B2B26] border border-[#235347] focus:border-[#8EB69B] text-sm px-4 py-3 pr-10 rounded-xl text-[#DAF1DE] placeholder-[#8EB69B]/40 focus:outline-none transition-all"
                      disabled={isSubmitting}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm(!showConfirm)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#8EB69B] hover:text-[#DAF1DE] transition-colors focus:outline-none cursor-pointer"
                    >
                      {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-[#DAF1DE] hover:bg-[#c2e8c8] text-[#051F20] font-semibold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-[#DAF1DE]/10 cursor-pointer disabled:opacity-50 mt-2"
                >
                  {isSubmitting ? "Updating Password..." : "Update Password"}
                </button>
              </form>
            </>
          ) : (
            <div className="bg-rose-950/40 border border-rose-500/30 p-4 rounded-xl text-xs text-rose-300 font-medium leading-relaxed">
              Invalid or expired reset link — request a new one from Settings
              or the login page.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

