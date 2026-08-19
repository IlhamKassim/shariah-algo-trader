import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, EyeOff, ShieldAlert, ArrowLeft } from "lucide-react";

import { api } from "../lib/api";
import { SignIn, useAuth } from "@clerk/react";
import { ConnectionOverlay } from "../components/ConnectionOverlay";
import { supabase } from "../lib/supabaseClient";

export function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [supabaseSuccessMsg, setSupabaseSuccessMsg] = useState<string | null>(null);
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

  const handleSupabaseAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError("Email and password are required.");
      return;
    }

    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setError("Please enter a valid email address (e.g. user@example.com).");
      return;
    }

    if (isSignUpMode) {
      const trimmedPass = password.trim();
      if (trimmedPass.length < 12) {
        setError("Password policy violation: Minimum 12 characters required.");
        return;
      }
      if (!/[A-Z]/.test(trimmedPass)) {
        setError("Password policy violation: Must contain at least 1 uppercase letter (A-Z).");
        return;
      }
      if (!/[a-z]/.test(trimmedPass)) {
        setError("Password policy violation: Must contain at least 1 lowercase letter (a-z).");
        return;
      }
      if (!/[0-9]/.test(trimmedPass)) {
        setError("Password policy violation: Must contain at least 1 numeric digit (0-9).");
        return;
      }
      if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(trimmedPass)) {
        setError("Password policy violation: Must contain at least 1 special character (!@#$%^&*...).");
        return;
      }
    }

    setError(null);
    setSupabaseSuccessMsg(null);
    setIsSubmitting(true);


    try {
      if (!supabase) throw new Error("Supabase client is not configured.");

      if (isSignUpMode) {
        let signupResult: any;
        try {
          const result = await supabase.auth.signUp({
            email: email.trim(),
            password: password.trim(),
          });
          signupResult = result;
        } catch (networkErr: any) {
          // Catch network-level errors (e.g., rate limit causes "Load failed" in Safari)
          const networkMsg = networkErr?.message || "";
          if (networkMsg.toLowerCase().includes("load failed") || networkMsg.toLowerCase().includes("failed to fetch") || networkMsg.toLowerCase().includes("network")) {
            setError(
              "Signup request was blocked — this is usually Supabase's email rate limit (max 3 emails/hour).\n\n" +
              "To fix: Go to Supabase Dashboard → Authentication → Providers → Email → turn OFF 'Confirm email'.\n" +
              "Or go to Authentication → Users → Add User to create your account directly."
            );
            setIsSubmitting(false);
            return;
          }
          throw networkErr;
        }

        const { data, error: sbError } = signupResult;

        if (sbError) {
          // Handle rate limit from Supabase API response
          const errMsg = sbError.message || "";
          const errCode = (sbError as any).code || "";
          if (
            errCode === "over_email_send_rate_limit" ||
            errMsg.includes("rate limit") ||
            errMsg.includes("429") ||
            sbError.status === 429
          ) {
            setError(
              "Supabase email rate limit reached (max 3 emails/hour on free plan).\n\n" +
              "Quick fix: In Supabase Dashboard → Authentication → Providers → Email → turn OFF 'Confirm email'.\n" +
              "Or go to Authentication → Users → Add User to create your account directly."
            );
            setIsSubmitting(false);
            return;
          }
          throw sbError;
        }

        if (data?.session) {
          // User is logged in immediately
          setConnectionMode("SECURE CONSOLE");
          setPendingTarget("auth");
          setIsConnecting(true);
        } else if (data?.user && !data?.session) {
          if (data.user.identities && data.user.identities.length === 0) {
            setError(
              "An account with this email already exists. Click 'Already have an account? Sign in' to log in instead."
            );
            setIsSignUpMode(false);
          } else {
            setSupabaseSuccessMsg(
              "✅ Account created! Check your email for a confirmation link, then sign in below."
            );
          }
          setIsSubmitting(false);
        } else {
          setError("Registration failed. Please try again.");
          setIsSubmitting(false);
        }
      } else {
        const { error: sbError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password: password.trim(),
        });
        if (sbError) throw sbError;

        setConnectionMode("SECURE CONSOLE");
        setPendingTarget("auth");
        setIsConnecting(true);
      }
    } catch (err: any) {
      const msg = err.message || "";
      if (msg.toLowerCase().includes("load failed") || msg.toLowerCase().includes("failed to fetch")) {
        setError(
          "Network request failed. Please check your internet connection and try again."
        );
      } else if (msg.includes("Invalid login credentials")) {
        setError("Invalid email or password. If you haven't registered yet, click 'Need an account? Register here'.");
      } else if (msg.includes("rate limit") || msg.includes("429") || msg.includes("over_email_send_rate_limit")) {
        setError(
          "Rate limit reached. Please wait a few minutes before trying again."
        );
      } else if (msg.includes("Email not confirmed")) {
        setError("Email not confirmed yet. Please check your inbox for the confirmation link.");
      } else if (msg.includes("Supabase client is not configured")) {
        setError("Authentication system is not configured. Contact the administrator.");
      } else {
        setError(msg || "Authentication failed. Please check your details and try again.");
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
    } else {
      localStorage.removeItem("shariah_demo_mode");
      if (supabase) {
        try {
          const { data } = await supabase.auth.getSession();
          if (data.session?.access_token) {
            queryClient.setQueryData(["authStatus"], {
              authenticated: true,
              auth_enabled: true,
              supabase_enabled: true,
              user_id: data.session.user.id,
              user_email: data.session.user.email,
            });
          }
        } catch {
          // ignore session fetch error
        }
      }
    }
    await queryClient.invalidateQueries();
    window.scrollTo(0, 0);
    navigate("/app");
  };

  return (
    <div className="min-h-screen bg-[#070709] text-white flex flex-col lg:flex-row font-sans select-none relative overflow-hidden animate-fadeIn">
      {/* Top Page Transition Loader Bar */}
      {isNavigatingToLanding && (
        <div className="fixed top-0 left-0 right-0 z-[100] h-1 bg-neutral-900 overflow-hidden">
          <div className="h-full bg-emerald-500 w-full transition-all duration-200 ease-out animate-pulse" />
        </div>
      )}

      {isConnecting && (
        <ConnectionOverlay
          modeName={connectionMode}
          onComplete={handleCompleteConnection}
        />
      )}

      {/* LEFT COLUMN: Emerald Mesh Visual & Onboarding Progress */}
      <div className="hidden lg:flex lg:w-1/2 min-h-screen relative bg-gradient-to-br from-[#051F20] via-[#0B2B26] to-[#163832] p-12 lg:p-16 flex-col justify-between overflow-hidden border-r border-[#235347]/40">
        {/* Background Ambient Radial Glow */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle at 40% 40%, rgba(142, 182, 155, 0.18), transparent 60%), radial-gradient(circle at 80% 80%, rgba(35, 83, 71, 0.25), transparent 50%)",
          }}
        />

        {/* Header / Back Link */}
        <div className="relative z-10">
          <button
            onClick={handleNavigateToLanding}
            className="inline-flex items-center gap-2 text-xs text-[#8EB69B] hover:text-[#DAF1DE] transition-colors tracking-wide cursor-pointer bg-[#0B2B26]/60 hover:bg-[#163832] px-3.5 py-1.5 rounded-full border border-[#235347]/60 backdrop-blur-md"
          >
            <ArrowLeft size={14} /> Back to ShariahTrading
          </button>
        </div>

        {/* Center Content */}
        <div className="relative z-10 max-w-md my-auto py-12">
          <h1 className="text-4xl lg:text-5xl font-serif text-[#DAF1DE] leading-tight font-normal">
            {isSignUpMode ? "Get Started with Us" : "Welcome Back"}
          </h1>
          <p className="text-base text-[#8EB69B] mt-3 font-normal leading-relaxed">
            {isSignUpMode
              ? "Complete these easy steps to register your account."
              : "Access your institutional Shariah algorithmic trading console."}
          </p>
        </div>

        {/* Bottom Step Cards */}
        <div className="relative z-10 grid grid-cols-3 gap-3.5 pt-6">
          {/* Step 1 Card */}
          <div
            className={`p-4 rounded-2xl transition-all duration-300 flex flex-col justify-between min-h-[110px] ${
              isSignUpMode
                ? "bg-[#DAF1DE] text-[#051F20] shadow-xl shadow-[#051F20]/50 border border-[#DAF1DE]"
                : "bg-[#163832]/60 backdrop-blur-md border border-[#235347]/60 text-[#DAF1DE]"
            }`}
          >
            <div
              className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                isSignUpMode ? "bg-[#051F20] text-[#DAF1DE]" : "bg-[#235347]/60 text-[#DAF1DE]"
              }`}
            >
              1
            </div>
            <span className="text-xs font-bold leading-snug mt-3">
              {isSignUpMode ? "Sign up your account" : "Sign in to account"}
            </span>
          </div>

          {/* Step 2 Card */}
          <div className="p-4 rounded-2xl bg-[#163832]/60 backdrop-blur-md border border-[#235347]/60 text-[#8EB69B] flex flex-col justify-between min-h-[110px]">
            <div className="w-7 h-7 rounded-full bg-[#235347]/60 flex items-center justify-center text-xs font-bold text-[#DAF1DE]">
              2
            </div>
            <span className="text-xs font-medium leading-snug mt-3">
              Set up your workspace
            </span>
          </div>

          {/* Step 3 Card */}
          <div className="p-4 rounded-2xl bg-[#163832]/60 backdrop-blur-md border border-[#235347]/60 text-[#8EB69B] flex flex-col justify-between min-h-[110px]">
            <div className="w-7 h-7 rounded-full bg-[#235347]/60 flex items-center justify-center text-xs font-bold text-[#DAF1DE]">
              3
            </div>
            <span className="text-xs font-medium leading-snug mt-3">
              Set up your profile
            </span>
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Form & Auth Controls */}
      <div className="w-full lg:w-1/2 min-h-screen bg-[#051F20] flex flex-col justify-between p-6 sm:p-12 lg:p-16 z-10">
        {/* Mobile Header Link */}
        <div className="flex lg:hidden justify-between items-center mb-6">
          <button
            onClick={handleNavigateToLanding}
            className="inline-flex items-center gap-2 text-xs text-[#8EB69B] hover:text-[#DAF1DE] transition-colors"
          >
            <ArrowLeft size={14} /> Back
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#235347] rounded-md flex items-center justify-center text-[#DAF1DE] font-bold text-xs">
              S
            </div>
            <span className="font-bold text-xs tracking-wider text-[#DAF1DE] uppercase">ShariahTrading</span>
          </div>
        </div>

        <div className="w-full max-w-md mx-auto my-auto space-y-7">
          {/* Header Title */}
          <div>
            <h2 className="text-3xl sm:text-4xl font-serif font-normal text-[#DAF1DE]">
              {isSignUpMode ? "Sign Up Account" : "Log In Account"}
            </h2>
            <p className="text-sm text-[#8EB69B] mt-1.5 font-normal">
              {isSignUpMode
                ? "Enter your personal data to create your account."
                : "Enter your credentials to access your trading console."}
            </p>
          </div>

          {/* OAuth Buttons (Google & GitHub) */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="bg-[#0B2B26] hover:bg-[#163832] border border-[#235347] hover:border-[#8EB69B]/40 text-[#DAF1DE] rounded-xl py-3 px-4 flex items-center justify-center gap-2.5 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.27v3.13C3.25 21.3 7.31 24 12 24z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.28 14.27a7.25 7.25 0 0 1 0-4.54V6.6H1.27a11.97 11.97 0 0 0 0 10.8l4.01-3.13z"
                />
                <path
                  fill="#EA4335"
                  d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.25 2.7 1.27 6.6l4.01 3.13c.95-2.83 3.6-4.98 6.72-4.98z"
                />
              </svg>
              <span>Google</span>
            </button>

            <button
              type="button"
              onClick={handleGoogleLogin}
              className="bg-[#0B2B26] hover:bg-[#163832] border border-[#235347] hover:border-[#8EB69B]/40 text-[#DAF1DE] rounded-xl py-3 px-4 flex items-center justify-center gap-2.5 text-xs font-semibold transition-all cursor-pointer shadow-sm"
            >
              <svg className="w-4 h-4 fill-[#DAF1DE] shrink-0" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span>Github</span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative flex items-center justify-center my-4">
            <div className="w-full border-t border-[#235347]/50" />
            <span className="bg-[#051F20] px-3.5 text-xs text-[#8EB69B] font-medium uppercase tracking-wider">
              Or
            </span>
          </div>

          {/* Error / Success Feedback Banners */}
          {error && !auth?.clerk_enabled && (
            <div className="bg-rose-950/40 border border-rose-500/30 p-3.5 rounded-xl flex items-start gap-3">
              <ShieldAlert size={16} className="text-rose-400 shrink-0 mt-0.5" />
              <div className="flex-1 text-xs text-rose-300 font-medium leading-relaxed whitespace-pre-line">
                {error}
              </div>
            </div>
          )}

          {supabaseSuccessMsg && (
            <div className="bg-[#0B2B26] border border-[#235347] p-3.5 rounded-xl text-xs text-[#DAF1DE] font-medium">
              {supabaseSuccessMsg}
            </div>
          )}

          {/* Main Auth Form */}
          {auth?.supabase_enabled ? (
            <form onSubmit={handleSupabaseAuth} className="space-y-4">
              {isSignUpMode && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#8EB69B]">
                      First Name
                    </label>
                    <input
                      type="text"
                      placeholder="eg. John"
                      className="w-full bg-[#0B2B26] border border-[#235347] focus:border-[#8EB69B] text-sm px-4 py-3 rounded-xl text-[#DAF1DE] placeholder-[#8EB69B]/40 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-[#8EB69B]">
                      Last Name
                    </label>
                    <input
                      type="text"
                      placeholder="eg. Francisco"
                      className="w-full bg-[#0B2B26] border border-[#235347] focus:border-[#8EB69B] text-sm px-4 py-3 rounded-xl text-[#DAF1DE] placeholder-[#8EB69B]/40 focus:outline-none transition-all"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label
                  htmlFor="email"
                  className="text-xs font-semibold text-[#8EB69B]"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="eg. johnfrans@gmail.com"
                  className="w-full bg-[#0B2B26] border border-[#235347] focus:border-[#8EB69B] text-sm px-4 py-3 rounded-xl text-[#DAF1DE] placeholder-[#8EB69B]/40 focus:outline-none transition-all"
                  disabled={isSubmitting}
                  autoFocus
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-[#8EB69B]"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-[#0B2B26] border border-[#235347] focus:border-[#8EB69B] text-sm px-4 py-3 pr-10 rounded-xl text-[#DAF1DE] placeholder-[#8EB69B]/40 focus:outline-none transition-all"
                    disabled={isSubmitting}
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
                {isSignUpMode && (
                  <p className="text-xs text-[#8EB69B]/70 mt-1">
                    Must be at least 8 characters.
                  </p>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#DAF1DE] hover:bg-[#c2e8c8] text-[#051F20] font-semibold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-[#DAF1DE]/10 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmitting
                  ? isSignUpMode
                    ? "Creating Account..."
                    : "Signing In..."
                  : isSignUpMode
                  ? "Sign Up"
                  : "Log In"}
              </button>
            </form>
          ) : auth?.clerk_enabled ? (
            <div className="flex justify-center min-h-[300px] items-center relative w-full">
              {!clerkLoaded && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#051F20] z-20">
                  <div className="w-6 h-6 border-2 border-[#8EB69B] border-t-transparent rounded-full animate-spin" />
                  <span className="text-xs text-[#8EB69B]">
                    Initializing Portal...
                  </span>
                </div>
              )}
              <div
                className={`w-full transition-opacity duration-300 ${
                  clerkLoaded ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
              >
                <SignIn
                  appearance={{
                    variables: {
                      colorPrimary: "#235347",
                      colorBackground: "#051F20",
                      colorForeground: "#DAF1DE",
                      colorMutedForeground: "#8EB69B",
                      colorInput: "#0B2B26",
                      colorInputForeground: "#DAF1DE",
                      colorBorder: "#235347",
                      borderRadius: "12px",
                    },
                    elements: {
                      rootBox: "w-full flex justify-center m-0 max-w-full",
                      cardBox:
                        "w-full shadow-none border-0 m-0 max-w-full bg-transparent",
                      card: "border-0 shadow-none bg-transparent w-full p-0 py-2 m-0",
                      main: "w-full m-0 p-0",
                      socialButtonsBlockButton:
                        "border border-[#235347] rounded-xl bg-[#0B2B26] hover:bg-[#163832] text-[#DAF1DE] transition-colors w-full flex justify-center items-center py-3",
                      formButtonPrimary:
                        "bg-[#DAF1DE] hover:bg-[#c2e8c8] text-[#051F20] rounded-xl font-semibold text-sm py-3.5 cursor-pointer w-full shadow-md",
                      formFieldInput:
                        "bg-[#0B2B26] border border-[#235347] text-[#DAF1DE] rounded-xl w-full py-3",
                    },
                  }}
                />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <label
                  htmlFor="password"
                  className="text-xs font-semibold text-[#8EB69B]"
                >
                  Password / Console Key
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your console key"
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
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-[#DAF1DE] hover:bg-[#c2e8c8] text-[#051F20] font-semibold text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-[#DAF1DE]/10 cursor-pointer disabled:opacity-50 mt-2"
              >
                {isSubmitting ? "Authenticating..." : "Initiate Connection"}
              </button>
            </form>
          )}

          {/* Demo Console Access Button */}
          <button
            type="button"
            onClick={handleDemoLogin}
            className="w-full bg-[#0B2B26]/60 hover:bg-[#163832] border border-[#235347] text-[#8EB69B] hover:text-[#DAF1DE] font-medium text-xs py-3 rounded-xl transition-all cursor-pointer flex items-center justify-center gap-2 mt-4"
          >
            Explore Demo Console Without Signup
          </button>

          {/* Mode Switcher */}
          <div className="text-center pt-2">
            <span className="text-xs text-[#8EB69B]">
              {isSignUpMode
                ? "Already have an account? "
                : "Don't have an account? "}
            </span>
            <button
              type="button"
              onClick={() => {
                setIsSignUpMode(!isSignUpMode);
                setError(null);
                setSupabaseSuccessMsg(null);
              }}
              className="text-xs font-semibold text-[#DAF1DE] hover:underline cursor-pointer"
            >
              {isSignUpMode ? "Log in" : "Sign up"}
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-[#8EB69B]/60 font-normal">
          <span>Long-only · No leverage · Shariah Screener Console</span>
        </div>
      </div>
    </div>
  );
}
