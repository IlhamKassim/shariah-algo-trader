# Production Subdomain Architecture: Landing Page vs Trading Console #2

**Type:** Architecture / Infrastructure / Security  
**Milestone:** Production Deployment & DNS Setup  
**Status:** Backlog  
**Assignee:** @antigravity  

---

## 📖 Description
Currently, the public editorial landing page (`Landing.tsx`), the secure console sign-in gate (`Login.tsx`), and the trading dashboard (`Overview.tsx`, `Portfolio.tsx`, etc.) are bundled into a single SPA build and served under path routes (`/landing`, `/login`, `/`).

For production deployment, this issue outlines separating the public marketing website from the secure trading application using subdomain routing:
- **`shariahtrading.my`** → Public Editorial Landing Page
- **`app.shariahtrading.my`** → Secure Trading Suite Console
- **`api.shariahtrading.my`** → Python FastAPI Algo Engine Backend

---

## 🔒 Security & Performance Rationale

1. **Session & Cookie Isolation:**
   - Isolating `app.shariahtrading.my` ensures authentication tokens, Clerk sessions, and local storage data are never accessible to third-party marketing analytics scripts (Google Analytics, Meta Pixel) placed on `shariahtrading.my`.
   - Allows strict `SameSite=Strict; Domain=app.shariahtrading.my; Secure; HttpOnly` cookie policies.

2. **Independent Deployment Lifecycle:**
   - Marketing copy, SEO meta tags, and landing page redesigns on `shariahtrading.my` can be updated independently without rebuilding or redeploying the backend trading console.

3. **Optimized CDN & Caching:**
   - The landing page can be cached globally on Cloudflare/Vercel edge networks (100% static HTML/CSS performance).
   - The trading app console (`app.shariahtrading.my`) connects directly to real-time WebSocket & API data streams.

---

## 🛠️ Technical Implementation Plan

### 1. DNS & Reverse Proxy Configuration (Nginx / Cloudflare)
```nginx
# Public Landing Page
server {
    server_name shariahtrading.my www.shariahtrading.my;
    location / {
        proxy_pass http://localhost:3000/landing;
    }
}

# Secure Trading Console App
server {
    server_name app.shariahtrading.my console.shariahtrading.my;
    location / {
        proxy_pass http://localhost:3000/;
    }
}

# FastAPI Backend Engine API
server {
    server_name api.shariahtrading.my;
    location / {
        proxy_pass http://localhost:8000/;
    }
}
```

### 2. CORS Policy Update (`dashboard/api/main.py`)
Update allowed CORS origins in the FastAPI application:
```python
origins = [
    "https://shariahtrading.my",
    "https://app.shariahtrading.my",
    "https://console.shariahtrading.my",
]
```

### 3. Frontend Link Routing
Update CTA buttons on `Landing.tsx` to point to `https://app.shariahtrading.my/login` when running in production environment.

---

## ✅ Acceptance Criteria & Checklist

- [ ] Configure DNS CNAME records for `app.shariahtrading.my` and `api.shariahtrading.my`.
- [ ] Set up Nginx / Cloudflare SSL reverse proxy routing.
- [ ] Update CORS policies in `dashboard/api/main.py` for subdomain origins.
- [ ] Verify session cookies are scoped strictly to `Domain=app.shariahtrading.my`.
- [ ] Update landing page CTAs to redirect to `https://app.shariahtrading.my/login`.
