import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { InvitesView } from "./components/InvitesView";
import { LoginCard } from "./components/LoginCard";
import { NavBar, type View } from "./components/NavBar";
import { TesterDrawer } from "./components/TesterDrawer";
import { TestersView } from "./components/TestersView";
import { ApiError, AdminApi, type Tester } from "./lib/api";
import { getInitialSession, onSessionChange, signOut } from "./lib/auth";

/**
 * Admin app shell (SPEC-BETA-PILOT.md §5.3): top nav only, dark Quantix Glass
 * V2 theme (page #08090E + ambient glow — matches dashboard/web App.tsx:460).
 * Three views — Testers (list + detail drawer) and Invites — plus a minimal
 * sign-in card when there is no Supabase session.
 */
export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>("testers");
  const [testers, setTesters] = useState<Tester[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Tester | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getInitialSession().then((s) => {
      if (!cancelled) {
        setSession(s);
        setAuthLoading(false);
      }
    });
    const unsubscribe = onSessionChange((s) => setSession(s));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  const api = useMemo(
    () => (session ? new AdminApi(() => session.access_token) : null),
    [session],
  );

  const handleError = useCallback((e: unknown) => {
    if (e instanceof ApiError) {
      if (e.status === 401) {
        void signOut();
        setSession(null);
        return;
      }
      setError(e.detail);
    } else {
      setError("Unexpected error — check that the admin API is running on :8002.");
    }
  }, []);

  const refresh = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.listTesters();
      setTesters(data.testers);
      setSelected((current) => {
        if (!current) return null;
        return data.testers.find((t) => t.user_id === current.user_id) ?? null;
      });
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [api, handleError]);

  useEffect(() => {
    if (api) void refresh();
  }, [api, refresh]);

  const runAction = useCallback(
    async (tester: Tester, action: "approve" | "revoke") => {
      if (!api) return;
      setBusyId(tester.user_id);
      setError(null);
      try {
        if (action === "approve") await api.approveTester(tester.user_id);
        else await api.revokeTester(tester.user_id);
        await refresh();
      } catch (e) {
        handleError(e);
      } finally {
        setBusyId(null);
      }
    },
    [api, refresh, handleError],
  );

  return (
    <div className="flex min-h-screen flex-col bg-glass-page text-primary">
      <NavBar
        email={session?.user.email ?? null}
        view={view}
        onViewChange={setView}
        onSignOut={() => void signOut()}
      />

      <div className="flex-1 bg-ambient-violet">
        <main className="mx-auto max-w-6xl px-6 py-8">
          {authLoading ? (
            <p className="py-16 text-center text-sm text-muted">Checking session…</p>
          ) : !session ? (
            <LoginCard />
          ) : view === "testers" ? (
            <TestersView
              testers={testers}
              loading={loading}
              error={error}
              busyId={busyId}
              api={api}
              onApprove={(t) => void runAction(t, "approve")}
              onRevoke={(t) => void runAction(t, "revoke")}
              onSelect={setSelected}
            />
          ) : (
            <InvitesView api={api} />
          )}
        </main>
      </div>

      {selected && api && (
        <TesterDrawer tester={selected} api={api} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
