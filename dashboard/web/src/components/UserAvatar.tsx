import { useState, useEffect } from "react";
import { useUser } from "@clerk/react";
import { supabase } from "../lib/supabaseClient";

interface UserAvatarProps {
  className?: string;
}

export function getInitials(nameOrEmail?: string | null): string {
  if (!nameOrEmail) return "US";

  // Clean string
  const str = nameOrEmail.trim();

  // If it's an email (contains @)
  if (str.includes("@")) {
    const handle = str.split("@")[0];
    const parts = handle.split(/[\._\-+]/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return handle.slice(0, 2).toUpperCase();
  }

  // If it's a full name
  const words = str.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }
  return str.slice(0, 2).toUpperCase();
}

export function UserAvatar({ className = "" }: UserAvatarProps) {
  const isDemo = localStorage.getItem("shariah_demo_mode") === "true";

  // Clerk auth user
  const { user: clerkUser, isLoaded: clerkLoaded } = useUser();

  // Supabase auth user
  const [sbUser, setSbUser] = useState<any>(null);

  useEffect(() => {
    if (supabase) {
      // Get initial user
      supabase.auth.getUser().then(({ data }) => {
        if (data?.user) {
          setSbUser(data.user);
        }
      });

      // Subscribe to auth state changes
      const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
        setSbUser(session?.user ?? null);
      });

      return () => {
        authListener.subscription.unsubscribe();
      };
    }
  }, []);

  if (isDemo) {
    return (
      <div
        className={`w-7 h-7 rounded-full bg-brand-blue/20 border border-brand-blue text-brand-blue flex items-center justify-center text-[10px] font-mono font-bold tracking-wider select-none shrink-0 ${className}`}
        title="Demo User Console"
      >
        DM
      </div>
    );
  }

  // Resolve profile picture URL if available
  const avatarUrl =
    (clerkLoaded && clerkUser?.imageUrl) ||
    sbUser?.user_metadata?.avatar_url ||
    sbUser?.user_metadata?.picture;

  // Resolve display name / email
  const displayName =
    (clerkLoaded && (clerkUser?.fullName || clerkUser?.primaryEmailAddress?.emailAddress)) ||
    sbUser?.user_metadata?.full_name ||
    sbUser?.user_metadata?.name ||
    sbUser?.email ||
    "User";

  const initials = getInitials(displayName);

  if (avatarUrl) {
    return (
      <div className={`w-7 h-7 rounded-full overflow-hidden shrink-0 border border-brand-gold/60 ${className}`}>
        <img
          src={avatarUrl}
          alt={displayName}
          className="w-full h-full object-cover"
          onError={(e) => {
            // Fallback to text initials if image fails to load
            (e.target as HTMLElement).style.display = "none";
          }}
        />
      </div>
    );
  }

  return (
    <div
      className={`w-7 h-7 rounded-full bg-card-border text-primary border border-brand-gold/50 flex items-center justify-center text-[11px] font-mono font-bold tracking-wider transition-all select-none shrink-0 hover:border-brand-gold hover:scale-105 ${className}`}
      title={displayName}
    >
      {initials}
    </div>
  );
}
