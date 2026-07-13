import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

interface ProtectedRouteProps {
  children: ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { data: auth, isLoading } = useQuery({
    queryKey: ["authStatus"],
    queryFn: api.authStatus,
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-page flex items-center justify-center font-mono">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border border-brand-gold border-t-transparent animate-spin" />
          <span className="text-xs text-muted tracking-wider">VERIFYING SESSION...</span>
        </div>
      </div>
    );
  }

  if (auth?.auth_enabled && !auth.authenticated) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
