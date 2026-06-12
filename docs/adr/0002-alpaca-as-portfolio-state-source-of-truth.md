# Alpaca as the canonical source of Portfolio state

The bot has no local database for tracking current positions. Instead, it reads Alpaca's `/positions` endpoint at the start of every Rebalance and Compliance Check to learn what it currently holds.

The alternative — maintaining a local SQLite or Postgres record of Portfolio state — introduces a synchronisation problem: if an order is submitted to Alpaca but the local DB write fails (network error, crash mid-flight), the two records diverge and the bot can make incorrect decisions on the next run. Since Alpaca already tracks positions authoritatively, duplicating that state locally creates failure modes without adding capability. Both recurring jobs (Compliance Check and Rebalance) are stateless by design: they read from Alpaca and FMP at runtime, compute what needs to change, and submit orders. No local state is required for this pattern to work correctly.
