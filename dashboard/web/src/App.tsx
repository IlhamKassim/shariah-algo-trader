import { useState, useEffect, lazy, Suspense } from "react";
import { Route, Routes, useLocation } from "react-router-dom";
import { Landing } from "./pages/Landing";
import { RiskDisclosure } from "./pages/RiskDisclosure";
import { PlatformGuideModal } from "./components/PlatformGuideModal";
import { ServerStatusBanner } from "./components/ServerStatusBanner";

// Clerk (~360KB) and every authenticated route are code-split out of the
// initial bundle so the public marketing page (Landing) never waits on the
// auth SDK to paint. Loaded on first navigation to a non-public route.
const AuthenticatedApp = lazy(() => import("./AuthenticatedApp"));

function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
    const mainEl = document.querySelector("main");
    if (mainEl) {
      mainEl.scrollTop = 0;
    }
  }, [pathname]);

  return null;
}

/**
 * Shown while the authenticated bundle loads. It is the first frame of the
 * Console, so it wears the Console system (DESIGN.md §A) rather than the
 * retired obsidian palette — otherwise the app flashes gold-on-black before
 * settling into a light dashboard.
 */
function AuthLoadingFallback() {
  return (
    <div className="console-root min-h-screen bg-[var(--c-page)] flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4">
        <span className="w-[26px] h-[26px] flex items-center justify-center">
          <span className="w-[15px] h-[15px] bg-[var(--c-ink)] rounded-[4px] rotate-45 block motion-safe:animate-pulse" />
        </span>
        <span className="text-[13px] text-[var(--c-mute)]">Loading your console…</span>
      </div>
    </div>
  );
}

export default function App() {
  const [showGuideModal, setShowGuideModal] = useState(false);

  return (
    <>
      <ServerStatusBanner />
      <PlatformGuideModal isOpen={showGuideModal} onClose={() => setShowGuideModal(false)} />
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<Landing onOpenGuide={() => setShowGuideModal(true)} />} />
        <Route path="/risk-disclosure" element={<RiskDisclosure />} />
        <Route
          path="/*"
          element={
            <Suspense fallback={<AuthLoadingFallback />}>
              <AuthenticatedApp />
            </Suspense>
          }
        />
      </Routes>
    </>
  );
}
