import {
  BookOpen,
  ShieldCheck,
  TrendingUp,
  Scale,
  Coins,
  ArrowRight,
  Info,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";

export function Learn() {
  return (
    <div className="space-y-8 pb-12">
      {/* Introduction Hero Card */}
      <Card className="border border-brand-gold/30 bg-card-hover/20">
        <CardContent className="p-6 md:p-8 flex flex-col md:flex-row gap-6 items-start">
          <div className="p-4 bg-brand-gold/10 text-brand-gold border border-brand-gold/20 shrink-0">
            <BookOpen size={32} />
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="amber">Educational Guide</Badge>
              <span className="text-[10px] font-mono text-faint">System Architecture</span>
            </div>
            <h2 className="text-lg font-bold text-primary tracking-wide">
              Understanding Systematic Multi-Factor &amp; Compliance-Driven Investing
            </h2>
            <p className="text-xs text-muted leading-relaxed max-w-4xl">
              Unlike traditional active trading where humans make emotional decisions, or complex machine learning models which act as "black boxes," this trading bot runs on a **systematic, rule-based quantitative framework**. By scoring stock traits (factors) and enforcing strict daily Shariah screens, it seeks to capture persistent market premiums transparently.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* The Core Factors Grid */}
      <div className="space-y-4">
        <div className="border-b border-divider pb-3">
          <h3 className="text-xs font-semibold text-section uppercase tracking-[0.09em]">
            The 4-Factor Scoring Model
          </h3>
          <p className="text-[11px] text-faint mt-0.5">
            How the bot scores and selects the top-20 stocks from the Shariah-eligible universe.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Momentum Factor */}
          <Card className="border border-divider hover:border-brand-gold/20 transition-all flex flex-col">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 bg-brand-blue/10 text-brand-blue border border-brand-blue/15">
                <TrendingUp size={18} />
              </div>
              <div>
                <CardTitle className="text-xs font-bold text-primary">Momentum</CardTitle>
                <span className="text-[9px] font-mono text-brand-blue">Weight: 25%</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted leading-relaxed mb-4">
                Measures the persistent upward trend of a stock. The bot computes the 12-month return performance minus the short-term 1-month reversal to capture sustainable trends.
              </p>
              <div className="bg-card-hover p-2.5 border border-divider font-mono text-[9px] text-muted">
                Formula: R_12m - R_1m
              </div>
            </CardContent>
          </Card>

          {/* Quality Factor */}
          <Card className="border border-divider hover:border-brand-gold/20 transition-all flex flex-col">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 bg-brand-green/10 text-brand-green border border-brand-green/15">
                <ShieldCheck size={18} />
              </div>
              <div>
                <CardTitle className="text-xs font-bold text-primary">Quality</CardTitle>
                <span className="text-[9px] font-mono text-brand-green">Weight: 25%</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted leading-relaxed mb-4">
                Identifies robust, cash-generating businesses. The bot screens for high Return on Equity (ROE), stable profit margins, and conservative leverage ratios.
              </p>
              <div className="bg-card-hover p-2.5 border border-divider font-mono text-[9px] text-muted">
                Formula: ROE + Profit Stability - Debt Ratio
              </div>
            </CardContent>
          </Card>

          {/* Low Volatility Factor */}
          <Card className="border border-divider hover:border-brand-gold/20 transition-all flex flex-col">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 bg-brand-gold/10 text-brand-gold border border-brand-gold/15">
                <Scale size={18} />
              </div>
              <div>
                <CardTitle className="text-xs font-bold text-primary">Low Volatility</CardTitle>
                <span className="text-[9px] font-mono text-brand-gold">Weight: 25%</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted leading-relaxed mb-4">
                Favors stable price trends. It calculates standard deviation profiles of daily stock returns, allocating heavier weights to stocks with lower price volatility.
              </p>
              <div className="bg-card-hover p-2.5 border border-divider font-mono text-[9px] text-muted">
                Formula: Inv_Vol / Sum(Inv_Vols)
              </div>
            </CardContent>
          </Card>

          {/* Value Factor */}
          <Card className="border border-divider hover:border-brand-gold/20 transition-all flex flex-col">
            <CardHeader className="flex flex-row items-center gap-3">
              <div className="p-2 bg-indigo-500/10 text-indigo-400 border border-indigo-500/15">
                <Coins size={18} />
              </div>
              <div>
                <CardTitle className="text-xs font-bold text-primary">Value</CardTitle>
                <span className="text-[9px] font-mono text-indigo-400">Weight: 25%</span>
              </div>
            </CardHeader>
            <CardContent className="p-5 flex-1 flex flex-col justify-between">
              <p className="text-xs text-muted leading-relaxed mb-4">
                Identifies stocks trading below their fundamental worth. Compares valuation multiples like Price-to-Earnings (P/E) and Price-to-Book (P/B) against peers.
              </p>
              <div className="bg-card-hover p-2.5 border border-divider font-mono text-[9px] text-muted">
                Formula: Z_Score(E/P) + Z_Score(B/P)
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Strategy Workflows: Shariah Algo vs Day Trader */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shariah Algo Lifecycle */}
        <Card className="border border-divider">
          <CardHeader>
            <CardTitle>Shariah Algo Bot Lifecycle</CardTitle>
            <p className="text-[10px] text-faint normal-case tracking-normal mt-0.5">
              Rules-based long-term halal investing cycle
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">Shariah Universe Boundary</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Loads compliant constituents from specialized ETFs (e.g. SPUS). Only stocks vetted under AAOIFI interest and business guidelines are considered.
                  </p>
                </div>
              </div>
              
              <div className="pl-2.5 py-1 border-l border-divider/60 ml-2.5"><ArrowRight size={10} className="text-faint rotate-90" /></div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">Factor Calculations</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Computes individual factor values for all compliant stocks, standardizes them into Z-scores, and sums them up into a composite factor score.
                  </p>
                </div>
              </div>

              <div className="pl-2.5 py-1 border-l border-divider/60 ml-2.5"><ArrowRight size={10} className="text-faint rotate-90" /></div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">Monthly Rebalancing</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Executed on the first trading day of each month. Selects the top-20 ranked stocks (subject to a sector cap to avoid over-exposure) and executes portfolio allocation.
                  </p>
                </div>
              </div>

              <div className="pl-2.5 py-1 border-l border-divider/60 ml-2.5"><ArrowRight size={10} className="text-faint rotate-90" /></div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-brand-gold/15 border border-brand-gold/30 text-brand-gold flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">Daily Compliance Screen</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Fires daily at market open (9:30 AM ET). Screens positions immediately; if any held stock becomes non-compliant, it triggers an immediate compliance exit trade.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Day Trader Lifecycle */}
        <Card className="border border-divider">
          <CardHeader>
            <CardTitle>Day Trader (Benchmark Strategy)</CardTitle>
            <p className="text-[10px] text-faint normal-case tracking-normal mt-0.5">
              Intraday momentum-driven breakout cycle
            </p>
          </CardHeader>
          <CardContent className="p-5 space-y-4">
            <div className="space-y-3">
              {/* Step 1 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-muted/20 border border-card-border text-muted flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  1
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">Opening Gap Scan</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Scans a liquid stock watchlist at 9:31 AM ET to identify stocks gapping up or down relative to their prior close, indicating strong pre-market catalyst news.
                  </p>
                </div>
              </div>
              
              <div className="pl-2.5 py-1 border-l border-divider/60 ml-2.5"><ArrowRight size={10} className="text-faint rotate-90" /></div>

              {/* Step 2 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-muted/20 border border-card-border text-muted flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  2
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">Opening Range Setup</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Monitors the high and low prices established in the first few minutes (Opening Range Bar). This boundary serves as a trigger point for breakout entry.
                  </p>
                </div>
              </div>

              <div className="pl-2.5 py-1 border-l border-divider/60 ml-2.5"><ArrowRight size={10} className="text-faint rotate-90" /></div>

              {/* Step 3 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-muted/20 border border-card-border text-muted flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  3
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">Intraday Breakout Execution</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Enters trades when price breaks above the opening range on high relative volume. Monitors active trailing stops and profit targets in real-time.
                  </p>
                </div>
              </div>

              <div className="pl-2.5 py-1 border-l border-divider/60 ml-2.5"><ArrowRight size={10} className="text-faint rotate-90" /></div>

              {/* Step 4 */}
              <div className="flex gap-3">
                <div className="w-5 h-5 rounded-full bg-muted/20 border border-card-border text-muted flex items-center justify-center font-mono text-[10px] shrink-0 mt-0.5">
                  4
                </div>
                <div>
                  <h4 className="text-xs font-semibold text-primary">End of Day Liquidation</h4>
                  <p className="text-[11px] text-muted mt-0.5 leading-relaxed">
                    Liquidates all remaining open positions before 4:00 PM ET. Zero positions are carried overnight, completely eliminating overnight price risk.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Info Warning Banner */}
      <Card className="border border-brand-red/20 bg-brand-red/5">
        <CardContent className="p-4 flex gap-3 items-center">
          <div className="text-brand-red shrink-0">
            <Info size={16} />
          </div>
          <p className="text-[10px] font-mono text-muted leading-relaxed">
            Note: All calculations, scoring models, and compliance checks are executed programmatically based on the configured cron cycles. Rebalancing and compliance audits only occur during standard market hours (9:30 AM - 4:00 PM ET) to ensure optimal liquidity and minimize market slippage.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
