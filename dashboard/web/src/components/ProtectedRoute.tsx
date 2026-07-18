import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/react";
import { api } from "../lib/api";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: auth, isLoading: loadingAuth } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
    retry: false,
    refetchOnWindowFocus: false,
  });

  const { isSignedIn, isLoaded } = useAuth();
  const isDemo = localStorage.getItem("shariah_demo_mode") === "true";
  const [timedOut, setTimedOut] = useState(false);

  const clerkPending = auth?.clerk_enabled && !isLoaded;
  const showLoading = !timedOut && (loadingAuth || clerkPending);

  // If Clerk never loads after 6 seconds (wrong key, network issue), stop spinning
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

  // If timed out or clerk not enabled, fall through to normal auth check
  if (auth?.clerk_enabled && !timedOut) {
    if (!isSignedIn) {
      return <Navigate to="/login" replace />;
    }
  } else if (auth?.auth_enabled && !auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
