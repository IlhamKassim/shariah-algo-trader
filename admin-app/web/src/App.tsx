import { useCallback, useEffect, useMemo, useState } from "react";
import type { Session } from "@supabase/supabase-js";

import { AdminHeader } from "./components/AdminHeader";
import { AdminSidebar, type View } from "./components/AdminSidebar";
import { OverviewView } from "./components/OverviewView";
import { CustomersView } from "./components/CustomersView";
import { SpectateView } from "./components/SpectateView";
import { InvitesView } from "./components/InvitesView";
import { ActivityTrailView } from "./components/ActivityTrailView";
import { LoginCard } from "./components/LoginCard";
import { TesterDrawer } from "./components/TesterDrawer";
import { TickerBar } from "./components/TickerBar";
import {
  ApiError,
  AdminApi,
  type AnalyticsRiskResponse,
  type Invite,
  type Tester,
} from "./lib/api";
import { getInitialSession, onSessionChange, signOut } from "./lib/auth";

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [view, setView] = useState<View>("overview");
  const [testers, setTesters] = useState<Tester[]>([]);
  const [, setInvites] = useState<Invite[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsRiskResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedTesterId, setSelectedTesterId] = useState<string | null>(null);
  const [drawerTester, setDrawerTester] = useState<Tester | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

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
      if (e.status === 403) {
        void signOut();
        setSession(null);
        setError("Access Denied: Your account does not have administrator privileges.");
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
      const [testerData, inviteData, riskData] = await Promise.all([
        api.listTesters(),
        api.listInvites(),
        api.getAnalyticsRisk().catch(() => null),
      ]);
      setTesters(testerData.testers);
      setInvites(inviteData.invites);
      if (riskData) setAnalytics(riskData);
      if (testerData.testers.length > 0 && !selectedTesterId) {
        setSelectedTesterId(testerData.testers[0].user_id);
      }
    } catch (e) {
      handleError(e);
    } finally {
      setLoading(false);
    }
  }, [api, selectedTesterId, handleError]);

  useEffect(() => {
    if (api) void refresh();
  }, [api, refresh]);

  const runAction = useCallback(
    async (tester: Tester, action: "approve" | "revoke" | "delete") => {
      if (!api) return;
      setBusyId(tester.user_id);
      setError(null);
      try {
        if (action === "approve") {
          await api.approveTester(tester.user_id);
        } else if (action === "revoke") {
          await api.revokeTester(tester.user_id);
        } else if (action === "delete") {
          await api.deleteTester(tester.user_id);
          if (selectedTesterId === tester.user_id) setSelectedTesterId(null);
          if (drawerTester?.user_id === tester.user_id) setDrawerTester(null);
        }
        await refresh();
      } catch (e) {
        handleError(e);
      } finally {
        setBusyId(null);
      }
    },
    [api, refresh, handleError, selectedTesterId, drawerTester?.user_id],
  );

  const activeTestersCount = testers.filter((t) => t.state === "active").length;

  return (
    <div className="flex h-screen max-h-screen overflow-hidden bg-[#0a0a0a] font-sans text-[#f2f0f1]">
      {!authLoading && session && (
        <AdminSidebar
          view={view}
          onViewChange={setView}
          email={session.user.email ?? null}
          onSignOut={() => void signOut()}
          onOpenInviteModal={() => setView("invites")}
        />
      )}

      <div className={`flex min-w-0 flex-1 flex-col overflow-hidden bg-[#0a0a0a] ${session ? "ml-64" : ""}`}>
        {!authLoading && session && (
          <AdminHeader
            title={view.toUpperCase()}
            email={session.user.email ?? null}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onRefresh={() => void refresh()}
            alertCount={analytics?.alerts.length ?? 0}
            alerts={analytics?.alerts ?? []}
          />
        )}

        {authLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <p className="font-mono text-xs uppercase tracking-widest text-secondary-fixed-dim">
              Validating operator credentials…
            </p>
          </div>
        ) : !session ? (
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            <LoginCard initialError={error} />
          </div>
        ) : (

          <>
            <TickerBar
              totalTesters={testers.length}
              activeTesters={activeTestersCount}
              compliancePct={analytics?.kpis.compliance_pct}
              portfolioValue={analytics?.kpis.portfolio_value_usd}
            />

            <main className="custom-scrollbar flex-1 overflow-y-auto p-8">
              <div className="mx-auto w-full max-w-[1550px]">
                {error && (
                  <div
                    role="alert"
                    className="mb-6 border-2 border-[#ba1a1a] bg-[#ba1a1a]/10 p-4 text-xs font-mono text-[#ffdad6]"
                  >
                    {error}
                  </div>
                )}

                {view === "overview" && (
                  <OverviewView
                    analytics={analytics}
                    testers={testers}
                    loading={loading}
                    onNavigateToCustomers={(uid) => {
                      if (uid) setSelectedTesterId(uid);
                      setView("customers");
                    }}
                    onRefresh={() => void refresh()}
                  />
                )}

                {view === "customers" && (
                  <CustomersView
                    testers={testers}
                    selectedTesterId={selectedTesterId}
                    onSelectTester={(t) => setSelectedTesterId(t?.user_id ?? null)}
                    onApprove={(t) => void runAction(t, "approve")}
                    onRevoke={(t) => void runAction(t, "revoke")}
                    onDelete={(t) => void runAction(t, "delete")}
                    onInspectDrawer={(t) => setDrawerTester(t)}
                    api={api}
                    busyId={busyId}
                    globalSearch={searchQuery}
                  />
                )}


                {view === "spectate" && (
                  <SpectateView api={api} email={session.user.email ?? null} />
                )}

                {view === "invites" && <InvitesView api={api} />}

                {view === "activity" && <ActivityTrailView api={api} />}
              </div>
            </main>
          </>
        )}
      </div>

      {drawerTester && api && (
        <TesterDrawer
          tester={drawerTester}
          api={api}
          onClose={() => setDrawerTester(null)}
        />
      )}
    </div>
  );
}
