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

function AuthLoadingFallback() {
  return (
    <div className="min-h-screen bg-page flex items-center justify-center font-mono">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border border-brand-gold border-t-transparent animate-spin" />
        <span className="text-xs text-muted tracking-wider">LOADING...</span>
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
