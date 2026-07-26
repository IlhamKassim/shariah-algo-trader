-- ==============================================================================
-- Shariah Algo Trader — Supabase Database Migration
-- Target Table: public.user_settings
-- Row Level Security (RLS): Enabled for authenticated users (auth.uid() = user_id)
-- ==============================================================================

-- 1. Create public.user_settings table linked to auth.users
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id                          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    alpaca_api_key_encrypted          TEXT,
    alpaca_api_secret_encrypted       TEXT,
    alpaca_live_api_key_encrypted     TEXT,
    alpaca_live_api_secret_encrypted  TEXT,
    trading_mode                     TEXT DEFAULT 'paper',
    alpaca_base_url                   TEXT DEFAULT 'https://paper-api.alpaca.markets',
    etf_symbol                        TEXT DEFAULT 'SPUS',
    top_n                             INTEGER DEFAULT 20,
    sector_cap                        NUMERIC(5, 4) DEFAULT 0.2000,
    drift_threshold                   NUMERIC(5, 4) DEFAULT 0.0300,
    created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Comment table and columns for Supabase Schema Docs
COMMENT ON TABLE public.user_settings IS 'Per-user encrypted trading credentials and strategy parameters';
COMMENT ON COLUMN public.user_settings.user_id IS 'References auth.users.id (Supabase Auth UID)';
COMMENT ON COLUMN public.user_settings.alpaca_api_key_encrypted IS 'AES-256 encrypted Alpaca API key';
COMMENT ON COLUMN public.user_settings.alpaca_api_secret_encrypted IS 'AES-256 encrypted Alpaca API secret';

-- 3. Enable Row Level Security (RLS)
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies
-- Allow users to SELECT only their own user_settings record
CREATE POLICY "Users can view their own settings"
    ON public.user_settings
    FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- Allow users to INSERT their own user_settings record
CREATE POLICY "Users can insert their own settings"
    ON public.user_settings
    FOR INSERT
    TO authenticated
    WITH CHECK (auth.uid() = user_id);

-- Allow users to UPDATE their own user_settings record
CREATE POLICY "Users can update their own settings"
    ON public.user_settings
    FOR UPDATE
    TO authenticated
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Allow users to DELETE their own user_settings record
CREATE POLICY "Users can delete their own settings"
    ON public.user_settings
    FOR DELETE
    TO authenticated
    USING (auth.uid() = user_id);

-- 5. Automatic updated_at trigger function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_user_settings_updated_at ON public.user_settings;
CREATE TRIGGER set_user_settings_updated_at
    BEFORE UPDATE ON public.user_settings
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_updated_at();

-- 6. Optional: Auto-create user_settings row on user signup (Trigger)
CREATE OR REPLACE FUNCTION public.handle_new_user_settings()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_settings (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created_settings ON auth.users;
CREATE TRIGGER on_auth_user_created_settings
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_settings();
