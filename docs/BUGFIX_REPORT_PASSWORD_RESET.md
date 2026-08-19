# 🛠️ Bug Fix Report: Supabase Password Reset Recovery Flow

**Date:** August 9, 2026  
**Target Audience:** Hermes / Engineering Team  
**Repository:** `shariah-algo-trader`  
**Branch:** `fix/password-reset`  
**Commit:** `b1e8b8d` (`fix(auth): intercept password recovery links and route to reset-password`)

---

## 🚨 Problem Statement

When users requested a password reset email via Supabase Auth and clicked the link in their inbox, the browser opened the Shariah Trading website but **immediately redirected them to the main home dashboard (`/`)**, bypassing the Reset Password form entirely.

---

## 🔍 Technical Root Cause Analysis

The failure occurred due to a collision between **Supabase's automatic session initialization** and **the application's authenticated route guards**:

1. **Pre-emptive Session Authentication**:
   When a user clicks a Supabase recovery link, Supabase redirects the browser back to the application carrying authentication parameters (`#access_token=...&type=recovery` or `?code=...`). Upon page load, `@supabase/supabase-js` immediately extracts these credentials and establishes an active user session in `localStorage`.

2. **Route Guard Interception**:
   Because a valid session was created instantly on load:
   - `api.authStatus` reported `authenticated: true`.
   - `Login.tsx` executed its authentication check (`if (auth.authenticated) navigate("/", { replace: true })`), instantly navigating away from `/login` or `/reset-password` to `/`.
   - `ProtectedRoute.tsx` saw the user was authenticated and allowed navigation directly to `/`.

3. **Supabase Site URL Fallback Redirects**:
   If the recovery link landed on the root domain (`/`) or `/login` (either via default Supabase Site URL config or URL rewrite), the application had no top-level mechanism to catch the recovery token and keep the user on `/reset-password`.

4. **Component Listener Race Condition**:
   `ResetPassword.tsx` previously attached its `onAuthStateChange` listener inside a local `useEffect`. Because `supabase-js` emitted the `PASSWORD_RECOVERY` event during global app initialization before React mounted `ResetPassword.tsx`, the component missed the event and defaulted to showing `"Invalid or expired reset link"`.

---

## 🛡️ Architecture & Solution Design

To solve this issue permanently across all flow types (PKCE query parameters, implicit hash fragments, and direct session restoration), we implemented a **Global Password Recovery Interceptor & State Pinning Pattern**:

```
[Email Link Clicked]
        │
        ▼
[Supabase Auth Verify]
        │
        ▼
[Browser Lands on App (/ or /reset-password)]
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 1. App.tsx (Global Interceptor)                             │
│    Detects 'type=recovery' or 'PASSWORD_RECOVERY' event      │
│    Sets sessionStorage.setItem('shariah_recovery_mode', 'true') │
│    Forces redirect to /reset-password                        │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Login.tsx & ProtectedRoute.tsx (Auth Guards)              │
│    Reads 'shariah_recovery_mode' from sessionStorage          │
│    Blocks auto-redirect to '/' (Home Dashboard)              │
│    Pins routing to /reset-password                           │
└─────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. ResetPassword.tsx (Reset Form)                           │
│    Renders New Password & Confirm Password input form       │
│    Calls supabase.auth.updateUser({ password })             │
│    Clears sessionStorage ('shariah_recovery_mode')          │
│    Signs out session and redirects to /login                │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Key Code Modifications

### 1. `dashboard/web/src/App.tsx` (Global Interceptor)
Added a top-level `useEffect` in `App.tsx` that monitors all route changes and Supabase auth events. If recovery indicators exist in the URL or via auth events, it sets `shariah_recovery_mode` in `sessionStorage` and forces navigation to `/reset-password`:

```tsx
// Intercept password recovery flows globally and ensure user lands on /reset-password
useEffect(() => {
  const hash = window.location.hash || "";
  const search = window.location.search || "";
  const isRecovery =
    hash.includes("type=recovery") ||
    search.includes("type=recovery") ||
    sessionStorage.getItem("shariah_recovery_mode") === "true";

  if (isRecovery && location.pathname !== "/reset-password") {
    sessionStorage.setItem("shariah_recovery_mode", "true");
    navigate(`/reset-password${search}${hash}`, { replace: true });
    return;
  }

  if (!supabase) return;

  const { data: authListener } = supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      sessionStorage.setItem("shariah_recovery_mode", "true");
      if (window.location.pathname !== "/reset-password") {
        navigate("/reset-password", { replace: true });
      }
    }
  });

  return () => {
    authListener.subscription.unsubscribe();
  };
}, [location.pathname, navigate]);
```

### 2. `dashboard/web/src/pages/Login.tsx` & `dashboard/web/src/components/ProtectedRoute.tsx` (Route Guards)
Updated both route guards to check `shariah_recovery_mode` before executing authenticated redirects:

```tsx
// Login.tsx
useEffect(() => {
  if (auth) {
    const isRecovery =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery") ||
      sessionStorage.getItem("shariah_recovery_mode") === "true";

    if (isRecovery) {
      navigate("/reset-password", { replace: true });
      return;
    }

    if (auth.auth_enabled && auth.authenticated) {
      navigate("/", { replace: true });
    }
  }
}, [auth, navigate, clerkLoaded, isSignedIn]);
```

### 3. `dashboard/web/src/pages/ResetPassword.tsx` (Reset Form & Cleanup)
- Checks URL parameters (`#access_token=`, `?code=`, `?token_hash=`), active Supabase session (`supabase.auth.getSession()`), and `onAuthStateChange` events.
- Displays password policy validation (minimum 12 characters, 1 uppercase, 1 lowercase, 1 digit, 1 special character).
- On form submission, updates the password via `supabase.auth.updateUser({ password })`.
- Clears `shariah_recovery_mode` from `sessionStorage` upon success, signs out, and redirects to `/login`.

---

## 📊 Summary of Modified Files

| File | Type | Description |
|---|---|---|
| `dashboard/web/src/App.tsx` | Modified | Added global password recovery route interceptor |
| `dashboard/web/src/pages/Login.tsx` | Modified | Added recovery mode check to prevent auto-redirect to `/` |
| `dashboard/web/src/components/ProtectedRoute.tsx` | Modified | Redirects recovery sessions away from protected dashboard pages |
| `dashboard/web/src/pages/ResetPassword.tsx` | Modified | Supports PKCE + Implicit flows, session state, and session flag cleanup |
| `dashboard/web/src/pages/Settings.tsx` | Modified | Triggers password reset link email with `window.location.origin` |
| `.agents/AGENTS.md` | Modified | Documented password recovery route guard gotcha under Supabase Auth Notes |
| `docs/DEVELOPMENT_LOG.md` | Modified | Added Section 7 detailing Password Reset & Recovery Route Interceptor Fix |
| `tests/test_password_reset_fix.py` | New | Integration unit tests validating password reset state logic |

---

## 🚀 Verification & Testing Results

1. **Frontend Build Verification**:
   - `npm run build` executed cleanly (`0` TypeScript errors, Vite bundle output built to `dashboard/api/static/`).
2. **Backend & Service Verification**:
   - `shariah-trader-dashboard` systemd service restarted cleanly.
   - Tested `/api/auth/status` API health and verified CSP headers.
3. **Git Branch & Push**:
   - Pushed commit `b1e8b8d` to `origin/fix/password-reset`.
