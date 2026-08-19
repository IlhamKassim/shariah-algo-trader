-- ==============================================================================
-- Shariah Algo Trader — Supabase Database Migration
-- Target Table: public.user_settings
-- Closes finding F4: the dashboard syncs shariah_trader_enabled,
-- day_trader_enabled and risk_acknowledged_at on every settings save, but the
-- cloud table only had columns up to trading_mode + live keys, so PostgREST
-- rejected every sync with PGRST204 ("column not found in schema cache").
-- Additive only: ADD COLUMN IF NOT EXISTS, safe to re-run.
-- HUMAN DEPLOY STEP: apply to the cloud project (qriwgmxjrocdazqzlpsr) via the
-- Supabase dashboard SQL editor or a migration runner; never from tests.
-- ==============================================================================

-- 1. Add shariah_trader_enabled (matches local SQLite INTEGER 0/1)
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS shariah_trader_enabled BOOLEAN DEFAULT TRUE;

-- 2. Add day_trader_enabled
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS day_trader_enabled BOOLEAN DEFAULT FALSE;

-- 3. Add risk_acknowledged_at (ISO-8601 UTC timestamp, local SQLite stores TEXT)
ALTER TABLE public.user_settings
ADD COLUMN IF NOT EXISTS risk_acknowledged_at TIMESTAMPTZ;

-- 4. Comment new columns for Supabase Schema Docs
COMMENT ON COLUMN public.user_settings.shariah_trader_enabled IS 'Whether the long-term Shariah rebalance engine is enabled for this user';
COMMENT ON COLUMN public.user_settings.day_trader_enabled IS 'Whether the day-trader engine is enabled for this user';
COMMENT ON COLUMN public.user_settings.risk_acknowledged_at IS 'Timestamp of the real-money risk acknowledgment (UTC ISO-8601)';
