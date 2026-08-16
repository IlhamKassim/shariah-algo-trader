import React, { useState, useMemo, useEffect } from "react";
import type { AdminApi, CustomerProfile, Tester, TesterState } from "../lib/api";

interface CustomersViewProps {
  testers: Tester[];
  selectedTesterId: string | null;
  onSelectTester: (tester: Tester | null) => void;
  onApprove: (tester: Tester) => void;
  onRevoke: (tester: Tester) => void;
  onInspectDrawer: (tester: Tester) => void;
  api: AdminApi | null;
  busyId: string | null;
  globalSearch?: string;
}

export function CustomersView({
  testers,
  selectedTesterId,
  onSelectTester,
  onApprove,
  onRevoke,
  onInspectDrawer,
  api,
  busyId,
  globalSearch = "",
}: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState(globalSearch);
  const [stateFilter, setStateFilter] = useState<"ALL" | TesterState>("ALL");
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  useEffect(() => {
    if (globalSearch) {
      setSearchQuery(globalSearch);
    }
  }, [globalSearch]);

  const selectedTester = useMemo(() => {
    if (!selectedTesterId) return testers[0] ?? null;
    return testers.find((t) => t.user_id === selectedTesterId) ?? testers[0] ?? null;
  }, [testers, selectedTesterId]);

  // Fetch full customer profile when selected tester changes
  useEffect(() => {
    if (!selectedTester || !api) {
      setProfile(null);
      return;
    }
    let cancelled = false;
    setLoadingProfile(true);
    api
      .getCustomerProfile(selectedTester.user_id)
      .then((p) => {
        if (!cancelled) {
          setProfile(p);
          setLoadingProfile(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadingProfile(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTester?.user_id, api]);

  // Filtered testers
  const filteredTesters = useMemo(() => {
    return testers.filter((t) => {
      const matchesState = stateFilter === "ALL" || t.state === stateFilter;
      const q = searchQuery.toLowerCase().trim();
      const fullName = `${t.first_name ?? ""} ${t.last_name ?? ""}`.toLowerCase();
      const matchesQuery =
        !q ||
        t.email.toLowerCase().includes(q) ||
        t.user_id.toLowerCase().includes(q) ||
        fullName.includes(q) ||
        (t.quant_handle && t.quant_handle.toLowerCase().includes(q)) ||
        (t.country && t.country.toLowerCase().includes(q)) ||
        (t.investor_type && t.investor_type.toLowerCase().includes(q)) ||
        (t.invite_code && t.invite_code.toLowerCase().includes(q));
      return matchesState && matchesQuery;
    });
  }, [testers, stateFilter, searchQuery]);

  const initials = selectedTester
    ? selectedTester.first_name && selectedTester.last_name
      ? (selectedTester.first_name[0] + selectedTester.last_name[0]).toUpperCase()
      : selectedTester.email.split("@")[0].slice(0, 2).toUpperCase()
    : "—";

  const custId = selectedTester
    ? selectedTester.user_id.replace(/-/g, "").slice(0, 8).toUpperCase()
    : "—";

  const displayName = selectedTester
    ? selectedTester.first_name || selectedTester.last_name
      ? `${selectedTester.first_name ?? ""} ${selectedTester.last_name ?? ""}`.trim()
      : selectedTester.email.split("@")[0]
    : "—";

  const quantHandle = selectedTester?.quant_handle ?? (profile?.quant_handle ?? null);
  const country = selectedTester?.country ?? (profile?.country ?? null);
  const investorType = selectedTester?.investor_type ?? (profile?.investor_type ?? null);
  const paperCapital = selectedTester?.paper_capital ?? (profile?.paper_capital ?? 100000.0);


  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Title */}
      <div className="flex justify-between items-end border-b-2 border-[#333333] pb-4">
        <div>
          <h2 className="text-3xl font-headline font-bold text-[#ffffff] uppercase tracking-wider">
            Customer CRM Directory
          </h2>
          <p className="text-xs font-body text-secondary-fixed-dim mt-1 font-bold uppercase tracking-widest">
            Beta-tester profiles, Shariah compliance status, and engine controls
          </p>
        </div>
      </div>

      {/* Two Column CRM Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: Selected Customer Profile Panel (4 cols) */}
        <div className="lg:col-span-4 bg-[#1a1918] border-2 border-[#333333] p-6 flex flex-col justify-between space-y-6">
          {selectedTester ? (
            <>
              {/* Profile Header */}
              <div className="space-y-4">
                <div className="flex items-center gap-3 border-b-2 border-[#333333] pb-4">
                  <div className="w-12 h-12 bg-[#242322] border-2 border-[#333333] flex items-center justify-center text-lg font-mono font-bold text-[#ffffff] shrink-0">
                    {initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-headline font-bold text-[#ffffff] truncate uppercase">
                        {displayName}
                      </h3>
                      {quantHandle && (
                        <span className="text-xs font-mono text-[#10b981] font-bold">
                          {quantHandle}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-mono text-secondary-fixed-dim truncate">
                      {selectedTester.email}
                    </p>
                    <div className="flex items-center gap-2 mt-1 font-mono text-[10px] text-secondary-fixed-dim">
                      <span>CUST_ID: <strong className="text-[#3366cc]">{custId}</strong></span>
                      {country && (
                        <>
                          <span>·</span>
                          <span className="text-[#f9e37a] uppercase">{country}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Profile Key-Value Grid */}
                <div className="data-grid grid-cols-2 text-xs">
                  <div>
                    <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                      INVESTOR PERSONA
                    </div>
                    <div className="font-mono font-bold text-[#ffffff] uppercase mt-0.5 truncate">
                      {investorType ? investorType.replace("_", " ") : selectedTester.role}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                      KEYS STATUS
                    </div>
                    <div className="font-mono font-bold mt-0.5">
                      {selectedTester.has_paper_keys ? (
                        <span className="text-[#10b981]">● VERIFIED</span>
                      ) : (
                        <span className="text-[#f59e0b]">KEYS MISSING</span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                      SHARIAH SCORE
                    </div>
                    <div className="font-mono font-bold text-[#10b981] mt-0.5">
                      {profile?.compliance?.status === "ok" ? "100.0%" : "N/A"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                      TRADING MODE
                    </div>
                    <div className="font-mono font-bold text-[#f9e37a] uppercase mt-0.5">
                      {selectedTester.trading_mode} ONLY
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                      PAPER CAPITAL
                    </div>
                    <div className="font-mono font-bold text-[#ffffff] uppercase mt-0.5">
                      ${Number(paperCapital).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] font-mono text-secondary-fixed-dim uppercase tracking-wider">
                      STATE
                    </div>
                    <div className="font-mono font-bold uppercase mt-0.5">
                      <span
                        className={`px-1.5 py-0.5 text-[9px] border border-[#333333] ${
                          selectedTester.state === "active"
                            ? "text-[#10b981] bg-[#242322]"
                            : selectedTester.state === "pending"
                            ? "text-[#f59e0b] bg-[#0a0a0a]"
                            : "text-[#ba1a1a] bg-[#0a0a0a]"
                        }`}
                      >
                        {selectedTester.state}
                      </span>
                    </div>
                  </div>
                </div>


                {/* Portfolio & Preferences Snapshot */}
                <div className="bg-[#242322] border-2 border-[#333333] p-3 space-y-2 text-xs font-mono">
                  <div className="flex justify-between items-baseline">
                    <span className="text-secondary-fixed-dim uppercase text-[10px]">
                      PAPER EQUITY:
                    </span>
                    <span className="font-bold text-[#ffffff] text-sm">
                      {loadingProfile
                        ? "Loading…"
                        : profile?.portfolio?.status === "ok"
                        ? `$${Number(profile.portfolio.equity).toLocaleString("en-US", { minimumFractionDigits: 2 })}`
                        : profile?.portfolio?.status === "no_keys"
                        ? "No Keys"
                        : "Offline"}
                    </span>
                  </div>
                  <div className="flex justify-between items-baseline border-t border-[#333333] pt-1.5 text-[11px]">
                    <span className="text-secondary-fixed-dim uppercase text-[10px]">
                      STRATEGY TARGET:
                    </span>
                    <span className="text-[#f2f0f1]">
                      {profile?.prefs?.etf_symbol ?? "SPUS"} TOP {profile?.prefs?.top_n ?? 20}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="space-y-2 pt-4 border-t-2 border-[#333333]">
                {selectedTester.state === "pending" && (
                  <button
                    type="button"
                    onClick={() => onApprove(selectedTester)}
                    disabled={busyId === selectedTester.user_id}
                    className="w-full py-2.5 bg-[#10b981] text-[#0a0a0a] text-xs font-label font-bold uppercase tracking-widest border-2 border-[#10b981] hover:bg-[#059669] transition-none disabled:opacity-50"
                  >
                    {busyId === selectedTester.user_id ? "Approving…" : "Approve Customer"}
                  </button>
                )}

                {selectedTester.state === "active" && (
                  <button
                    type="button"
                    onClick={() => onRevoke(selectedTester)}
                    disabled={busyId === selectedTester.user_id}
                    className="w-full py-2.5 bg-[#ba1a1a] text-[#ffffff] text-xs font-label font-bold uppercase tracking-widest border-2 border-[#ba1a1a] hover:bg-[#991b1b] transition-none disabled:opacity-50"
                  >
                    {busyId === selectedTester.user_id ? "Revoking…" : "Revoke Access"}
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => onInspectDrawer(selectedTester)}
                  className="w-full py-2.5 bg-[#242322] text-[#f2f0f1] text-xs font-label font-bold uppercase tracking-widest border-2 border-[#333333] hover:bg-[#333333] transition-none flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-[16px]">visibility</span>
                  Deep-Dive Portfolio &amp; Logs
                </button>
              </div>
            </>
          ) : (
            <div className="p-8 text-center text-xs font-mono text-secondary-fixed-dim">
              No customer selected.
            </div>
          )}
        </div>

        {/* Right: Customer Directory Data Table (8 cols) */}
        <div className="lg:col-span-8 bg-[#1a1918] border-2 border-[#333333] p-6 space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <div className="flex items-center bg-[#0a0a0a] border-2 border-[#333333] px-3 py-1.5 flex-1 focus-within:border-[#f2f0f1]">
              <span className="material-symbols-outlined text-secondary-fixed-dim mr-2 text-[18px]">
                search
              </span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-transparent border-none focus:outline-none w-full text-xs font-mono text-[#f2f0f1] placeholder:text-secondary-fixed-dim"
                placeholder="Search customers by email, user_id, or invite code…"
                type="text"
              />
            </div>

            <div className="flex bg-[#0a0a0a] border-2 border-[#333333]">
              {(["ALL", "active", "pending", "revoked"] as const).map((st) => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setStateFilter(st)}
                  className={`px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider border-r-2 border-[#333333] last:border-r-0 transition-none ${
                    stateFilter === st
                      ? "bg-[#f2f0f1] text-[#0a0a0a]"
                      : "text-secondary-fixed-dim hover:bg-[#333333]"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          {/* Data Grid Table */}
          <div className="data-grid grid-cols-5 border-2 border-[#333333]">
            {/* Header */}
            <div className="data-grid-header">Cust ID</div>
            <div className="data-grid-header">Trader / Email</div>
            <div className="data-grid-header text-right">Jurisdiction</div>
            <div className="data-grid-header text-center">Keys</div>
            <div className="data-grid-header text-center">Status</div>

            {/* Rows */}
            {filteredTesters.length === 0 ? (
              <div className="col-span-5 p-8 text-center text-xs font-mono text-secondary-fixed-dim">
                No matching customers found.
              </div>
            ) : (
              filteredTesters.map((t) => {
                const isSelected = selectedTester?.user_id === t.user_id;
                const rowCustId = t.user_id.replace(/-/g, "").slice(0, 8).toUpperCase();
                const rowName = t.first_name || t.last_name ? `${t.first_name ?? ""} ${t.last_name ?? ""}`.trim() : null;
                return (
                  <React.Fragment key={t.user_id}>
                    <div
                      onClick={() => onSelectTester(t)}
                      className={`text-xs font-mono font-bold cursor-pointer truncate ${
                        isSelected
                          ? "bg-[#242322] text-[#3366cc] border-l-2 border-[#3366cc]"
                          : "bg-[#1a1918] text-[#ffffff] hover:bg-[#242322]"
                      }`}
                    >
                      {rowCustId}
                    </div>
                    <div
                      onClick={() => onSelectTester(t)}
                      className={`text-xs font-mono cursor-pointer truncate ${
                        isSelected ? "bg-[#242322] text-[#ffffff]" : "bg-[#1a1918] text-[#f2f0f1]"
                      }`}
                    >
                      {rowName ? (
                        <div className="flex flex-col min-w-0">
                          <span className="font-bold text-[#ffffff] truncate">
                            {rowName}{" "}
                            {t.quant_handle && <span className="text-[#10b981] font-normal text-[10px]">{t.quant_handle}</span>}
                          </span>
                          <span className="text-[10px] text-secondary-fixed-dim truncate">{t.email}</span>
                        </div>
                      ) : (
                        <span>{t.email}</span>
                      )}
                    </div>
                    <div
                      onClick={() => onSelectTester(t)}
                      className={`text-xs font-mono text-right uppercase ${
                        isSelected ? "bg-[#242322] text-[#ffffff]" : "bg-[#1a1918] text-secondary-fixed-dim"
                      }`}
                    >
                      {t.country ? (
                        <span className="text-[#f9e37a] font-bold">{t.country}</span>
                      ) : (
                        <span>{t.role}</span>
                      )}
                    </div>
                    <div
                      onClick={() => onSelectTester(t)}
                      className={`text-xs font-mono text-center cursor-pointer ${
                        isSelected ? "bg-[#242322]" : "bg-[#1a1918]"
                      }`}
                    >
                      {t.has_paper_keys ? (
                        <span className="text-[#10b981] font-bold">YES</span>
                      ) : (
                        <span className="text-secondary-fixed-dim">NO</span>
                      )}
                    </div>
                    <div
                      onClick={() => onSelectTester(t)}
                      className={`text-center cursor-pointer ${
                        isSelected ? "bg-[#242322]" : "bg-[#1a1918]"
                      }`}
                    >
                      <span
                        className={`px-2 py-0.5 border border-[#333333] text-[9px] font-bold uppercase tracking-wider ${
                          t.state === "active"
                            ? "bg-[#0a0a0a] text-[#10b981]"
                            : t.state === "pending"
                            ? "bg-[#0a0a0a] text-[#f59e0b]"
                            : "bg-[#0a0a0a] text-[#ba1a1a]"
                        }`}
                      >
                        {t.state}
                      </span>
                    </div>
                  </React.Fragment>
                );
              })
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
