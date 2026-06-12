# Daily compliance check with immediate forced exit on universe departure

SPUS rebalances quarterly, which means a stock can become non-compliant and be dropped from the Eligible Universe at any point between the bot's monthly Rebalances. We decided to run a Compliance Check every trading day rather than only at Rebalance time, and to sell any Portfolio stock that is no longer in the Eligible Universe on the same day the departure is detected — regardless of Factor Score or scheduled cadence.

The alternative was to check compliance only at the monthly Rebalance, which would mean holding a non-compliant stock for up to 30 days. Given that Shariah compliance is the core constraint of the system, that window was unacceptable. The daily check costs one FMP API call per day; the immediate sell is a plain market order — the operational cost of daily checking is negligible compared to the compliance risk of not doing it.
