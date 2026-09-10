# ADR-0011: Close public registration

- **Status:** Accepted
- **Date:** 2026-09-10
- **Related:** ADR-0006 (multi-tenant platform transition — this reverses its
  self-service onboarding assumption)

## Context

The business is moving away from operating a platform that lets users run the
trading engine themselves, toward publishing Shariah universe and factor data.
Self-service account creation no longer serves a purpose, and every new account
created in the meantime is a user who will need migrating or offboarding later.

Registration was fully open. `dashboard/web/src/pages/Login.tsx` called
`supabase.auth.signUp()` directly from the browser. The pilot invite system
(`pilot_invites`, `Invite.tsx`) gated nothing — an invite code was *claimed
after* the account already existed, so anyone could reach the signup form and
create an account without a code.

## Decision

- New config flag `signups_enabled`, from `SIGNUPS_ENABLED`, **defaulting to
  `false`**. Only `true`/`1`/`yes` reopen it.
- `/api/auth/status` reports `signups_enabled` on every auth backend (none,
  password, Supabase, Clerk). A config object lacking the attribute is treated
  as closed.
- `Login.tsx` hides the sign-up toggle, forces sign-in mode when registration is
  closed — including for `/login?mode=signup` links — and rejects a signup
  submission before it reaches Supabase.
- `Invite.tsx` replaces "Claim & Create Account" with a notice that existing
  accounts can still sign in and attach the code.
- The frontend treats *absent or still-loading* auth status as closed, so a slow
  or failed status call cannot briefly expose a signup form.

## Consequences

- **This is not enforcement on its own, and must not be treated as such.**
  Supabase's `/auth/v1/signup` endpoint is reachable directly with the anon key,
  which ships in the browser bundle. Anyone who reads the JS can still create an
  account. The application-level flag stops the product from *offering*
  registration; it does not stop the API from accepting it.
- **Required follow-up in the hosted consoles** — without these, registration is
  only hidden, not closed:
  - Supabase → Authentication → Sign In / Providers → disable "Allow new users
    to sign up".
  - Clerk → Configure → Restrictions → set sign-up mode to restricted, if Clerk
    is the active backend for the environment.
- Existing users are unaffected: sign-in, MFA and invite claiming all still
  work.
- The waitlist endpoint (`/api/public/waitlist`) is deliberately untouched. It
  collects email addresses and creates no accounts, so it remains useful for the
  new direction.
- Reversible with `SIGNUPS_ENABLED=true` plus re-enabling signups in the
  console.
