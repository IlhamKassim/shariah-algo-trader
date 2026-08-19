-- ==============================================================================
-- Shariah Algo Trader — Supabase Database Migration
-- Target Table: public.pilot_invites
-- Tracks single-use / multi-use pilot registration invite codes in Supabase.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.pilot_invites (
    code TEXT PRIMARY KEY,
    created_by TEXT,
    max_uses INTEGER NOT NULL DEFAULT 1,
    uses INTEGER NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pilot_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Service role full access on pilot_invites" ON public.pilot_invites;
CREATE POLICY "Service role full access on pilot_invites"
ON public.pilot_invites
FOR ALL
USING (true)
WITH CHECK (true);

COMMENT ON TABLE public.pilot_invites IS 'Pilot invite codes for gating beta tester access';
