
export type View = "overview" | "customers" | "spectate" | "invites" | "activity";

interface AdminSidebarProps {
  view: View;
  onViewChange: (view: View) => void;
  email: string | null;
  onSignOut: () => void;
  onOpenInviteModal?: () => void;
}

const NAV_ITEMS: { key: View; label: string; icon: string }[] = [
  { key: "overview", label: "Overview", icon: "dashboard" },
  { key: "customers", label: "Customers", icon: "group" },
  { key: "spectate", label: "Spectate", icon: "monitor_heart" },
  { key: "invites", label: "Invites", icon: "mark_email_read" },
  { key: "activity", label: "Activity", icon: "history" },
];

export function AdminSidebar({
  view,
  onViewChange,
  email,
  onSignOut,
  onOpenInviteModal,
}: AdminSidebarProps) {
  return (
    <aside className="fixed left-0 top-0 h-full flex flex-col p-4 bg-[#1a1918] border-r-2 border-[#333333] w-64 z-50 rounded-none select-none">
      {/* Brand Header */}
      <div className="mb-8 px-2 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#3366cc] flex items-center justify-center border-2 border-[#333333] text-white font-headline font-bold text-lg">
          S
        </div>
        <div>
          <h1 className="text-lg font-headline font-bold text-[#f2f0f1] tracking-wide">
            ShariahAdmin
          </h1>
          <p className="text-[10px] font-label font-bold text-secondary-fixed-dim uppercase tracking-widest">
            Trading Portal
          </p>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 space-y-1.5" aria-label="Admin Navigation">
        {NAV_ITEMS.map((item) => {
          const isActive = view === item.key;
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onViewChange(item.key)}
              aria-current={isActive ? "page" : undefined}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-2 transition-none rounded-none text-xs font-label font-bold uppercase tracking-wider ${
                isActive
                  ? "bg-[#242322] text-[#f2f0f1] border-[#333333]"
                  : "text-secondary-fixed-dim border-transparent hover:text-[#f2f0f1] hover:bg-[#242322] hover:border-[#333333]"
              }`}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer / Quick Actions */}
      <div className="mt-auto space-y-4">
        {onOpenInviteModal && (
          <button
            type="button"
            onClick={onOpenInviteModal}
            className="w-full bg-[#333333] text-[#f2f0f1] text-xs font-label py-2.5 border-2 border-[#555555] rounded-none hover:bg-[#444444] transition-none font-bold uppercase tracking-widest flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined text-[16px]">person_add</span>
            Invite Member
          </button>
        )}

        <div className="border-t-2 border-[#333333] pt-4 space-y-2">
          <div className="px-2">
            {email && (
              <div className="truncate font-mono text-[10px] text-secondary-fixed-dim uppercase tracking-wider" title={email}>
                {email}
              </div>
            )}
            <div className="mt-1 flex items-center gap-1.5 text-[10px] font-mono text-[#10b981] uppercase tracking-wider">
              <span className="h-1.5 w-1.5 rounded-full bg-[#10b981]" />
              <span>Paper Only (G5)</span>
            </div>
          </div>

          {email && (
            <button
              type="button"
              onClick={onSignOut}
              className="w-full flex items-center gap-2.5 px-2 py-2 text-secondary-fixed-dim hover:text-rose-400 transition-none text-xs font-label font-bold uppercase tracking-wider border-2 border-transparent hover:border-[#333333] rounded-none"
            >
              <span className="material-symbols-outlined text-[18px]">logout</span>
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
