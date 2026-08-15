
interface AdminHeaderProps {
  title: string;
  email: string | null;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  onRefresh?: () => void;
  alertCount?: number;
}

export function AdminHeader({
  email,
  searchQuery = "",
  onSearchChange,
  onRefresh,
  alertCount = 0,
}: AdminHeaderProps) {
  const initials = email
    ? email.split("@")[0].slice(0, 2).toUpperCase()
    : "AD";

  return (
    <header className="flex justify-between items-center w-full px-8 py-3 sticky top-0 z-40 bg-[#1a1918] border-b-2 border-[#333333] select-none">
      {/* Search Bar */}
      <div className="flex items-center bg-[#0a0a0a] border-2 border-[#333333] rounded-none px-3 py-2 w-72 md:w-96 focus-within:border-[#f2f0f1] transition-none">
        <span className="material-symbols-outlined text-secondary-fixed-dim mr-2 text-[18px]">
          search
        </span>
        <input
          value={searchQuery}
          onChange={(e) => onSearchChange?.(e.target.value)}
          className="bg-transparent border-none focus:outline-none focus:ring-0 w-full text-xs font-mono text-[#f2f0f1] placeholder:text-secondary-fixed-dim placeholder:font-serif"
          placeholder="Search analytics, users, or audit logs..."
          type="text"
        />
      </div>

      {/* Quick Action Icons & Operator Tile */}
      <div className="flex items-center gap-3">
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            title="Refresh Data"
            className="text-secondary-fixed-dim hover:text-[#f2f0f1] transition-none p-2 border-2 border-transparent hover:border-[#333333] rounded-none bg-[#1a1918]"
          >
            <span className="material-symbols-outlined text-[18px]">refresh</span>
          </button>
        )}

        <div className="relative">
          <button
            type="button"
            title={`${alertCount} Live Alerts`}
            className="text-secondary-fixed-dim hover:text-[#f2f0f1] transition-none p-2 border-2 border-transparent hover:border-[#333333] rounded-none bg-[#1a1918]"
          >
            <span className="material-symbols-outlined text-[18px]">notifications</span>
            {alertCount > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-[#ba1a1a]" />
            )}
          </button>
        </div>

        <div className="w-0.5 h-6 bg-[#333333] mx-1" />

        {/* Monogram Operator Tile */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-none bg-[#242322] border-2 border-[#333333] flex items-center justify-center text-xs font-mono font-bold text-[#f2f0f1]">
            {initials}
          </div>
          {email && (
            <div className="hidden lg:block text-left">
              <p className="text-xs font-headline font-bold text-[#ffffff] uppercase tracking-wider">
                {email.split("@")[0]}
              </p>
              <p className="text-[9px] font-mono text-secondary-fixed-dim uppercase">
                ADMIN OPERATOR
              </p>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
