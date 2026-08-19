"""Standalone admin app for the beta-tester pilot (SPEC-BETA-PILOT.md §5).

Third application — own process, own port (127.0.0.1:8002), own unit, own
clean-SaaS UI. Reuses the trader repo's JWT/auth code by importing
``dashboard.api.deps`` (verify_auth + is_admin) — never copied.
"""
