def rank_by_factor_score(
    momentum_scores: dict[str, float],
    quality_scores: dict[str, float],
    top_n: int,
) -> list[str]:
    """Rank the Eligible Universe by composite Factor Score and return the top-N.

    Factor Score = 0.5 × Momentum z-score + 0.5 × Quality z-score.

    Tickers absent from either factor dict are excluded — incomplete factor data
    is not sufficient basis for a Portfolio allocation decision.

    Ties are broken by Python's stable sort (insertion order); behaviour is
    deterministic for identical inputs within a run.
    """
    common = momentum_scores.keys() & quality_scores.keys()
    scores = {
        ticker: 0.5 * momentum_scores[ticker] + 0.5 * quality_scores[ticker]
        for ticker in common
    }
    ranked = sorted(scores, key=lambda t: scores[t], reverse=True)
    return ranked[:top_n]
