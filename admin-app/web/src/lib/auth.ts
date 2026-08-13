import { createClient, type Session, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase session bridge (SPEC-BETA-PILOT.md §5.3: "Login reuses the Supabase
 * session from shariahtrading.my — same JWT"). The admin app holds its own
 * Supabase session; the access token is what the backend's ``verify_auth``
 * accepts as a bearer token (dashboard/api/deps.py).
 *
 * Configured at build time via VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY —
 * the same contract the existing dashboard web uses.
 */

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? "";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

let client: SupabaseClient | null = null;

/** Lazily-created Supabase client; null when the build was not configured. */
export function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) return null;
  if (!client) client = createClient(supabaseUrl, supabaseAnonKey);
  return client;
}

/** Restore the persisted session on app load. */
export async function getInitialSession(): Promise<Session | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  return data.session;
}

/** Subscribe to session changes; returns an unsubscribe function. */
export function onSessionChange(cb: (session: Session | null) => void): () => void {
  const sb = getSupabase();
  if (!sb) return () => {};
  const { data } = sb.auth.onAuthStateChange((_event, session) => cb(session));
  return () => data.subscription.unsubscribe();
}

export interface SignInResult {
  session: Session | null;
  error: string | null;
}

/** Email/password sign-in against Supabase auth. */
export async function signIn(email: string, password: string): Promise<SignInResult> {
  const sb = getSupabase();
  if (!sb) {
    return {
      session: null,
      error: "Supabase client is not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.",
    };
  }
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) return { session: null, error: error.message };
  return { session: data.session, error: null };
}

export async function signOut(): Promise<void> {
  const sb = getSupabase();
  if (!sb) return;
  await sb.auth.signOut();
}
