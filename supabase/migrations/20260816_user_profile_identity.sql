-- ==============================================================================
-- Shariah Algo Trader — User Profile & Identity Schema Alignment
-- Target Table: public.user_settings
-- Adds user identity metadata collected during onboarding
-- ==============================================================================

ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS first_name TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS last_name TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS quant_handle TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS country TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS investor_type TEXT;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS paper_capital NUMERIC(12, 2) DEFAULT 100000.00;
ALTER TABLE public.user_settings ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

-- Comment columns for documentation
COMMENT ON COLUMN public.user_settings.first_name IS 'User first name';
COMMENT ON COLUMN public.user_settings.last_name IS 'User last name';
COMMENT ON COLUMN public.user_settings.quant_handle IS 'User quant handle or terminal alias';
COMMENT ON COLUMN public.user_settings.country IS 'Country or tax jurisdiction';
COMMENT ON COLUMN public.user_settings.investor_type IS 'Investor classification (individual, accredited, family_office, researcher)';
COMMENT ON COLUMN public.user_settings.paper_capital IS 'Allocated paper trading capital';
COMMENT ON COLUMN public.user_settings.onboarding_completed_at IS 'Timestamp when onboarding setup was completed';
