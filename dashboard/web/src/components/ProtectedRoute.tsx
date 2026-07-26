import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { api, setTokenProvider } from "../lib/api";
import { supabase } from "../lib/supabaseClient";
import { MfaChallengeModal } from "./auth/MfaChallengeModal";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const queryClient = useQueryClient();
  const { data: auth, isLoading: loadingAuth, isError: authError } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { isSignedIn, isLoaded } = useAuth();
  const isDemo = localStorage.getItem("shariah_demo_mode") === "true";
  const [timedOut, setTimedOut] = useState(false);
  const [showMfaChallenge, setShowMfaChallenge] = useState(false);

  // Wire Supabase session token provider
  useEffect(() => {
    if (supabase) {
      setTokenProvider(async () => {
        if (!supabase) return null;
        const { data } = await supabase.auth.getSession();
        return data.session?.access_token || null;
      });


      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        if (session) {
          queryClient.invalidateQueries({ queryKey: ["authStatus"] });
        }
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, [queryClient]);

  useEffect(() => {
    if (auth?.supabase_enabled && auth?.authenticated && auth?.mfa_required && !auth?.mfa_verified) {
      setShowMfaChallenge(true);
    } else {
      setShowMfaChallenge(false);
    }
  }, [auth]);

  const clerkPending = auth?.clerk_enabled && !isLoaded;
  const showLoading = !timedOut && (loadingAuth || clerkPending);

  useEffect(() => {
    if (!clerkPending) return;
    const timer = setTimeout(() => setTimedOut(true), 6000);
    return () => clearTimeout(timer);
  }, [clerkPending]);

  if (showLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border border-brand-gold border-t-transparent animate-spin" />
          <span className="text-xs text-muted tracking-wider">VERIFYING SESSION...</span>
        </div>
      </div>
    );
  }

  if (isDemo) {
    return <>{children}</>;
  }

  if (auth?.clerk_enabled && !timedOut) {
    if (!isSignedIn) {
      return <Navigate to="/login" replace />;
    }
  } else if (auth?.auth_enabled && !auth.authenticated && !loadingAuth && !authError) {
    return <Navigate to="/login" replace />;
  }

  return (
    <>
      <MfaChallengeModal
        isOpen={showMfaChallenge}
        onSuccess={() => {
          setShowMfaChallenge(false);
          queryClient.invalidateQueries({ queryKey: ["authStatus"] });
        }}
        onCancel={async () => {
          setShowMfaChallenge(false);
          if (supabase) await supabase.auth.signOut();
          await api.logout();
          queryClient.invalidateQueries();
        }}
      />
      {children}
    </>
  );
}

