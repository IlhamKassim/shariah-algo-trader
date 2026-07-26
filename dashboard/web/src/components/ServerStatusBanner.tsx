import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle2, RefreshCw } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function ServerStatusBanner() {
  const queryClient = useQueryClient();
  const [isOffline, setIsOffline] = useState(false);
  const [justReconnected, setJustReconnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let intervalId: any = null;

    const checkServerHealth = async () => {
      try {
        const res = await fetch("/api/auth/status", { cache: "no-store" });
        if (res.ok) {
          if (isOffline) {
            setIsOffline(false);
            setJustReconnected(true);
            queryClient.invalidateQueries();
            setTimeout(() => setJustReconnected(false), 3000);
          }
        } else if (res.status === 502 || res.status === 503 || res.status === 500) {
          setIsOffline(true);
          setRetryCount((prev) => prev + 1);
        }
      } catch {
        // Network error (server down or restarting)
        setIsOffline(true);
        setRetryCount((prev) => prev + 1);
      }
    };

    // Periodically poll server status when offline
    if (isOffline) {
      intervalId = setInterval(checkServerHealth, 2000);
    } else {
      // Background check every 15s to detect systemctl restarts
      intervalId = setInterval(checkServerHealth, 15000);
    }

    return () => clearInterval(intervalId);
  }, [isOffline, queryClient]);

  if (justReconnected) {
    return (
      <div className="fixed top-0 left-0 right-0 z-[9999] bg-emerald-950/90 border-b border-emerald-500/50 backdrop-blur-md px-4 py-2.5 shadow-2xl flex items-center justify-between text-xs font-mono text-emerald-200 animate-fadeIn">
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={15} className="text-emerald-400" />
          <span className="font-bold uppercase tracking-wide">
            ✅ Server Reconnected
          </span>
          <span className="text-emerald-300/80 hidden md:inline">
            — Backend service (shariah-trader-dashboard) is online. Dashboard updated.
          </span>
        </div>
      </div>
    );
  }

  if (!isOffline) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-gradient-to-r from-amber-950/95 via-yellow-950/95 to-amber-950/95 border-b border-amber-500/50 backdrop-blur-md px-4 py-2.5 shadow-2xl flex items-center justify-between text-xs font-mono text-amber-200 animate-fadeIn">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertTriangle size={15} className="text-amber-400 shrink-0 animate-pulse" />
        <span className="font-bold text-amber-300 uppercase tracking-wide shrink-0">
          ⚡ BACKEND RESTARTING
        </span>
        <span className="text-amber-200/80 truncate hidden md:inline">
          System service (shariah-trader-dashboard) is restarting. Reconnecting automatically...
        </span>
      </div>

      <div className="flex items-center gap-2 text-amber-300 text-[11px] shrink-0 font-semibold">
        <RefreshCw size={13} className="animate-spin text-amber-400" />
        <span>Reconnecting ({retryCount})...</span>
      </div>
    </div>
  );
}
