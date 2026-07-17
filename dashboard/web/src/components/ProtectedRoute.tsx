import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@clerk/clerk-react";
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
  const showLoading = loadingAuth || (auth?.clerk_enabled && !isLoaded);

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

  if (auth?.clerk_enabled) {
    if (!isSignedIn) {
      return <Navigate to="/login" replace />;
    }
  } else if (auth?.auth_enabled && !auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
