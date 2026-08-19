import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useDocumentMeta } from "../hooks/useDocumentMeta";

export function RiskDisclosure() {
  useDocumentMeta({
    title: "Risk Disclosure · ShariahTrading",
    description:
      "Risk disclosure for ShariahTrading: paper vs. live trading, no investment advice, and the limits of the Shariah Screen.",
  });

  return (
    <div className="min-h-screen bg-[#051F20] text-[#DAF1DE] font-sans">
      <div className="max-w-3xl mx-auto px-6 sm:px-12 py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-xs text-[#8EB69B] hover:text-[#DAF1DE] transition-colors mb-12"
        >
          <ArrowLeft size={14} /> Back to ShariahTrading
        </Link>

        <h1 className="font-serif text-[40px] sm:text-[48px] mb-10 leading-tight font-normal text-[#DAF1DE]">
          Risk Disclosure
        </h1>

        <div className="space-y-8 text-[#8EB69B] font-sans text-base leading-relaxed">
          <p>
            <strong className="text-[#DAF1DE]">This is not investment advice.</strong> ShariahTrading is a
            personal, educational algorithmic trading project. Nothing on this site is a recommendation to
            buy, sell, or hold any security.
          </p>

          <p>
            <strong className="text-[#DAF1DE]">Trading involves risk of loss.</strong> All trading — paper
            or live — carries the risk of losing money, including all of the capital allocated to it. Past
            performance shown on this site does not predict future results.
          </p>

          <p>
            <strong className="text-[#DAF1DE]">Two account modes exist: Paper and Live.</strong> Paper
            accounts use simulated capital and carry no financial risk. Live accounts execute real trades
            with real money on a real Alpaca brokerage account. If you enable Live mode, orders placed by
            the automated strategy use your actual funds.
          </p>

          <p>
            <strong className="text-[#DAF1DE]">The strategy is long-only with no leverage.</strong>{" "}
            Positions are unleveraged spot equity only — no margin, options, futures, or derivatives. This
            limits (but does not eliminate) downside: a position can still lose some or all of its value.
          </p>

          <p>
            <strong className="text-[#DAF1DE]">The Shariah Screen is not independently certified.</strong>{" "}
            The screening logic in this project is the developer's own methodology, applied on top of a
            pre-screened ETF universe. It has not been reviewed or certified by a Shariah board or
            standards body. Do not treat it as a religious ruling or certified-compliant product.
          </p>

          <p>
            <strong className="text-[#DAF1DE]">The platform is under active development.</strong> Parts of
            the system — trade execution, screening, ranking, and market data — are still being tested and
            may not operate reliably at all times. Use of Live mode is at your own risk.
          </p>

          <p>
            <strong className="text-[#DAF1DE]">Market data may be delayed or imperfect.</strong> Pricing
            and fundamentals data come from third-party providers and may contain delays, gaps, or errors.
          </p>

          <p className="pt-2 border-t border-[#235347]/60">
            By using Live mode, you accept these risks and confirm you are trading with capital you can
            afford to lose.
          </p>
        </div>
      </div>
    </div>
  );
}
