import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TrendingUp, Lock, Eye, EyeOff, ShieldAlert, ArrowLeft } from "lucide-react";
import { api } from "../lib/api";
import { SignIn, useAuth } from "@clerk/react";
import { ConnectionOverlay } from "../components/ConnectionOverlay";

export function Login() {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionMode, setConnectionMode] = useState("SECURE PORT 8000");
  const [pendingTarget, setPendingTarget] = useState<"demo" | "auth" | null>(null);
  const [isNavigatingToLanding, setIsNavigatingToLanding] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();

  const { data: auth, isLoading } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
    refetchOnWindowFocus: false,
  });

  const { isSignedIn, isLoaded: clerkLoaded } = useAuth();

  // Redirect to home if already authenticated
  useEffect(() => {
    if (auth) {
      if (auth.clerk_enabled) {
        if (clerkLoaded && isSignedIn) {
          navigate("/", { replace: true });
        }
      } else if (auth.auth_enabled && auth.authenticated) {
        navigate("/", { replace: true });
      }
    }
  }, [auth, navigate, clerkLoaded, isSignedIn]);

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
      <div className="min-h-screen bg-[#0C0B09] flex items-center justify-center font-mono text-[#ECE5D5]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border border-[#D1A92E] border-t-transparent animate-spin" />
          <span className="text-xs text-[#8C8577] tracking-wider uppercase">LOADING SECURE INSTANCE...</span>
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
      setConnectionMode("SECURE PORT 8000");
      setPendingTarget("auth");
      setIsConnecting(true);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError("Invalid credentials. Access Denied.");
      } else {
        setError("An unexpected authentication error occurred.");
      }
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = () => {
    window.location.href = "/api/auth/google/login";
  };

  const handleDemoLogin = () => {
    setConnectionMode("DEMO CONSOLE");
    setPendingTarget("demo");
    setIsConnecting(true);
  };

  const handleNavigateToLanding = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    setIsNavigatingToLanding(true);
    setTimeout(() => {
      navigate("/landing");
    }, 220);
  };

  const handleCompleteConnection = async () => {
    if (pendingTarget === "demo") {
      localStorage.setItem("shariah_demo_mode", "true");
    }
    await queryClient.invalidateQueries();
    window.scrollTo(0, 0);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-[#0C0B09] text-[#ECE5D5] flex flex-col items-center justify-center px-4 font-mono select-none relative overflow-hidden animate-fadeIn">
      {/* Top Page Transition Loader Bar */}
      {isNavigatingToLanding && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-[#29241B] overflow-hidden">
          <div className="h-full bg-[#D1A92E] w-full transition-all duration-200 ease-out animate-pulse" />
        </div>
      )}

      {isConnecting && (
        <ConnectionOverlay
          modeName={connectionMode}
          onComplete={handleCompleteConnection}
        />
      )}
      {/* Top navigation back link */}
      <div className="absolute top-6 left-6 z-20">
        <button
          onClick={handleNavigateToLanding}
          className="inline-flex items-center gap-2 text-[11px] text-[#8C8577] hover:text-[#D1A92E] transition-colors tracking-wider uppercase cursor-pointer"
        >
          <ArrowLeft size={14} /> Back to ShariahTrading.my
        </button>
      </div>

      {/* Decorative background grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-5">
        <div
          className="w-full h-full bg-[linear-gradient(to_right,#29241B_1px,transparent_1px),linear-gradient(to_bottom,#29241B_1px,transparent_1px)]"
          style={{ backgroundSize: "40px 40px" }}
        />
      </div>

      <div className="w-full max-w-[400px] z-10 py-12">
        {/* Brand Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-12 h-12 flex items-center justify-center bg-[#D1A92E] hover:rotate-12 transition-transform duration-300 shadow-md">
            <TrendingUp size={22} className="text-[#0C0B09]" strokeWidth={2.5} />
          </div>
          <h1 className="text-[15px] font-bold text-[#ECE5D5] tracking-[0.15em] uppercase mt-4 text-center">
            SHARIAHTRADING
          </h1>
          <p className="text-[9px] text-[#D1A92E] tracking-[0.08em] uppercase mt-1">
            Secure Portfolio Console
          </p>
        </div>

        {/* Login Box */}
        <div className="bg-[#0C0B09] border border-[#29241B] shadow-[0_4px_30px_rgba(0,0,0,0.5)] hover:border-[#D1A92E]/20 transition-colors duration-500 rounded-none overflow-hidden">
          {/* Header Row */}
          <div className="bg-[#100E0B] border-b border-[#29241B] px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-[#D1A92E]/60" />
              <span className="text-[10px] font-bold text-[#8C8577] tracking-wider">SYSTEM SIGN IN</span>
            </div>
            <span className="text-[9px] text-[#4C4739] font-semibold tracking-wider uppercase border border-[#29241B] px-1.5 py-0.5">
              SECURE PORT 8000
            </span>
          </div>

          <div className="p-6 space-y-5">
            {/* Error Feedback Message */}
            {error && !auth?.clerk_enabled && (
              <div className="bg-[#1A1211] border border-[#D16A5B]/30 p-3 flex items-start gap-2.5">
                <ShieldAlert size={14} className="text-[#D16A5B] shrink-0 mt-0.5" />
                <div className="flex-1 text-[10px] font-semibold text-[#D16A5B] uppercase tracking-wider leading-relaxed">
                  {error}
                </div>
              </div>
            )}

            {auth?.clerk_enabled ? (
              <div className="flex justify-center min-h-[340px] items-center relative w-full">
                {!clerkLoaded && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#0C0B09] z-20">
                    <div className="w-6 h-6 border border-[#D1A92E] border-t-transparent animate-spin" />
                    <span className="text-[9px] text-[#8C8577] tracking-wider font-mono">INITIALIZING SECURE PORTAL...</span>
                  </div>
                )}
                <div className={`w-full transition-opacity duration-300 ${clerkLoaded ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                  <SignIn
                    appearance={{
                      variables: {
                        colorPrimary: "#D1A92E",
                        colorBackground: "#0C0B09",
                        colorForeground: "#ECE5D5",
                        colorMutedForeground: "#8C8577",
                        colorInput: "#12100D",
                        colorInputForeground: "#ECE5D5",
                        colorBorder: "#4C4739",
                        fontFamily: '"IBM Plex Mono", monospace',
                        borderRadius: "0px",
                      },
                      elements: {
                        rootBox: "w-full flex justify-center m-0 max-w-full",
                        cardBox: "w-full shadow-none border-0 m-0 max-w-full bg-transparent",
                        card: "border-0 shadow-none bg-transparent w-full p-0 py-4 m-0",
                        main: "w-full m-0 p-0",
                        headerTitle: "tracking-wider uppercase font-bold text-[14px] text-[#ECE5D5]",
                        socialButtonsBlockButton: "border border-[#4C4739] rounded-none bg-[#1A1813] hover:bg-[#25221A] text-[#ECE5D5] transition-colors w-full flex justify-center items-center",
                        formButtonPrimary: "bg-[#D1A92E] hover:bg-[#D1A92E]/80 text-[#0C0B09] rounded-none font-bold uppercase tracking-wider text-[11px] py-3 cursor-pointer w-full",
                        formFieldInput: "bg-[#12100D] border border-[#4C4739] text-[#ECE5D5] rounded-none w-full",
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <>
                {/* Google OAuth Login Button */}
                {auth?.google_auth_enabled && (
                  <button
                    type="button"
                    onClick={handleGoogleLogin}
                    className="w-full bg-[#1A1813] hover:bg-[#25221A] text-[#D1A92E] font-bold text-[10px] tracking-[0.12em] uppercase py-3 border border-[#29241B] hover:border-[#D1A92E]/40 transition-all duration-300 flex items-center justify-center gap-2.5 cursor-pointer shadow-sm"
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
                    <div className="border-t border-[#29241B] w-full" />
                    <span className="absolute bg-[#0C0B09] px-3.5 text-[8px] text-[#4C4739] font-bold tracking-widest uppercase">
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
                        className="text-[10px] font-semibold text-[#8C8577] uppercase tracking-[0.08em] flex items-center gap-1.5"
                      >
                        <Lock size={11} className="text-[#D1A92E]" /> Enter Console Key
                      </label>
                      <div className="relative">
                        <input
                          id="password"
                          type={showPassword ? "text" : "password"}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="••••••••••••"
                          className="w-full bg-[#12100D] border border-[#29241B] text-[12px] px-3.5 py-2.5 focus:outline-none focus:border-[#D1A92E]/60 focus:ring-1 focus:ring-[#D1A92E]/20 text-[#ECE5D5] transition-all rounded-none placeholder:text-[#4C4739] font-sans tracking-widest"
                          disabled={isSubmitting}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#4C4739] hover:text-[#8C8577] transition-colors focus:outline-none"
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
                      className="w-full bg-[#D1A92E] text-[#0C0B09] font-bold text-[11px] tracking-[0.12em] uppercase py-3 border border-[#D1A92E] hover:bg-transparent hover:text-[#D1A92E] transition-colors duration-300 select-none flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {isSubmitting ? (
                        <>
                          <div className="w-3.5 h-3.5 border border-[#0C0B09] border-t-transparent animate-spin shrink-0" />
                          AUTHENTICATING...
                        </>
                      ) : (
                        "INITIATE CONNECTION"
                      )}
                    </button>
                  </form>
                )}
              </>
            )}

            <div className="relative flex items-center justify-center py-1">
              <div className="border-t border-[#29241B] w-full" />
            </div>

            <button
              type="button"
              onClick={handleDemoLogin}
              className="w-full bg-transparent hover:bg-[#D1A92E]/5 text-[#8C8577] hover:text-[#D1A92E] font-bold text-[10px] tracking-[0.12em] uppercase py-3 border border-[#29241B] hover:border-[#D1A92E]/30 transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer"
            >
              NEW HERE? EXPLORE DEMO CONSOLE
            </button>
          </div>
        </div>

        {/* Footer Notes */}
        <div className="mt-6 flex flex-col items-center gap-1 text-[9px] text-[#4C4739] tracking-wider text-center uppercase font-mono">
          <span>Long-only · No leverage · Halal Screener Console</span>
          <span>ESTABLISHED 2026 SHARIAHTRADING</span>
        </div>
      </div>
    </div>
  );
}
