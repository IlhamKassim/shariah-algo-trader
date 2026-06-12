import numpy as np


def z_scores(raw: dict[str, float]) -> dict[str, float]:
    """Z-score a dict of raw scores. Returns {ticker: z_score}.

    Returns all zeros if std is 0 (single-ticker universe or all identical scores).
    """
    if not raw:
        return {}
    values = np.array(list(raw.values()), dtype=float)
    std = values.std()
    if std == 0:
        return {t: 0.0 for t in raw}
    zs = (values - values.mean()) / std
    return dict(zip(raw.keys(), zs.tolist()))
