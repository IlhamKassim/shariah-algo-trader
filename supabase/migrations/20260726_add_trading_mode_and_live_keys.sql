-- ==============================================================================
-- Shariah Algo Trader — Supabase Database Migration
-- Adds trading_mode and live Alpaca credentials to public.user_settings
-- ==============================================================================

-- 1. Add trading_mode column (default 'paper')
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS trading_mode TEXT DEFAULT 'paper';

-- 2. Add alpaca_live_api_key_encrypted column
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS alpaca_live_api_key_encrypted TEXT;

-- 3. Add alpaca_live_api_secret_encrypted column
ALTER TABLE public.user_settings 
ADD COLUMN IF NOT EXISTS alpaca_live_api_secret_encrypted TEXT;

-- 4. Comment new columns for Supabase Schema Docs
COMMENT ON COLUMN public.user_settings.trading_mode IS 'Active execution mode: paper (simulated) or live (real money)';
COMMENT ON COLUMN public.user_settings.alpaca_live_api_key_encrypted IS 'AES-256 encrypted Live Alpaca API key ID';
COMMENT ON COLUMN public.user_settings.alpaca_live_api_secret_encrypted IS 'AES-256 encrypted Live Alpaca API secret key';
