import { useState } from "react";
import { Link } from "react-router-dom";
import { Rocket, Key, Sliders, ShieldCheck, ArrowRight, Sparkles, CheckCircle2, Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

export function OnboardingTutorial() {
  const queryClient = useQueryClient();
  const [loadingDemo, setLoadingDemo] = useState(false);

  const handleUseDemo = async () => {
    setLoadingDemo(true);
    try {
      localStorage.setItem("shariah_demo_mode", "true");
      queryClient.clear();
      await queryClient.invalidateQueries();
      window.location.reload();
    } catch (err) {
      console.error("Failed to activate demo mode:", err);
      setLoadingDemo(false);
    }
  };

  return (
    <div className="relative overflow-hidden bg-sidebar border border-brand-gold/30 p-6 md:p-8 space-y-6 shadow-2xl transition-all duration-300">
      {/* Background Subtle Accent */}
      <div className="absolute -right-16 -top-16 w-64 h-64 bg-brand-gold/5 rounded-full blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-divider pb-5">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 px-2.5 py-1 bg-brand-gold/10 border border-brand-gold/30 text-brand-gold text-[10px] font-bold uppercase tracking-wider">
            <Rocket size={12} /> Getting Started Guide
          </div>
          <h2 className="text-lg font-bold text-primary tracking-wide">
            Welcome to Your Shariah Algo Trading Console
          </h2>
          <p className="text-xs text-muted max-w-xl leading-relaxed">
            Your account is ready! Complete these 3 quick steps to start automated Shariah-compliant portfolio execution.
          </p>
        </div>

        <button
          onClick={handleUseDemo}
          disabled={loadingDemo}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-gold text-page hover:bg-brand-gold/90 text-xs font-bold tracking-wider uppercase transition-colors shrink-0 cursor-pointer disabled:opacity-50"
        >
          {loadingDemo ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              Connecting Demo...
            </>
          ) : (
            <>
              <Sparkles size={14} />
              Try Demo Paper Account
            </>
          )}
        </button>
      </div>

      {/* 3 Step Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Step 1 */}
        <div className="bg-page/60 border border-divider p-4 space-y-3 relative group hover:border-brand-gold/40 transition-colors">
          <div className="w-8 h-8 rounded bg-brand-gold/10 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-bold text-xs">
            1
          </div>
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Key size={14} className="text-brand-gold" /> Connect Broker API
            </h4>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              Enter your Alpaca Paper or Live API keys in Settings to execute trades under your own account.
            </p>
          </div>
        </div>

        {/* Step 2 */}
        <div className="bg-page/60 border border-divider p-4 space-y-3 relative group hover:border-brand-gold/40 transition-colors">
          <div className="w-8 h-8 rounded bg-brand-gold/10 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-bold text-xs">
            2
          </div>
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <Sliders size={14} className="text-brand-gold" /> Define Strategy Rules
            </h4>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              Customize sector caps (20%), target universe size (Top 20), and rebalancing drift thresholds.
            </p>
          </div>
        </div>

        {/* Step 3 */}
        <div className="bg-page/60 border border-divider p-4 space-y-3 relative group hover:border-brand-gold/40 transition-colors">
          <div className="w-8 h-8 rounded bg-brand-gold/10 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-bold text-xs">
            3
          </div>
          <div>
            <h4 className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck size={14} className="text-brand-gold" /> AAOIFI Compliance
            </h4>
            <p className="text-[11px] text-muted mt-1.5 leading-relaxed">
              Automated financial debt-ratio screening (&lt;33% interest debt) runs before every order.
            </p>
          </div>
        </div>
      </div>

      {/* Bottom Callout */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <CheckCircle2 size={14} className="text-brand-green" />
          <span>Zero setup fee · Encrypted AES-256 keys · Instant trading</span>
        </div>

        <Link
          to="/app/settings"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-brand-gold hover:text-brand-gold/80 transition-colors uppercase tracking-wider"
        >
          Configure Settings <ArrowRight size={14} />
        </Link>
      </div>
    </div>
  );
}
