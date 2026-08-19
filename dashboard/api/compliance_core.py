"""Shared compliance computation for the dashboard and the admin app.

Extracted from ``dashboard/api/routers/compliance.py`` so the per-tester
compliance view (admin A5, SPEC-BETA-PILOT.md section 5.2) reuses the exact
same logic as the tester-facing ``GET /api/compliance`` — DRY, single source
of truth for "what counts as a violation" (a held symbol outside the eligible
universe).
"""


def compute_compliance(
    held_symbols: set[str] | list[str],
    eligible_symbols: set[str] | list[str],
    universe_size: int | None = None,
    last_checked: str | None = None,
) -> dict:
    """Compute portfolio compliance from held positions and the eligible universe.

    A position is a violation when its symbol is not in the eligible universe.
    When the eligible universe is empty the result is ``compliant=True`` (we
    cannot determine violations — the router's existing "can't determine"
    semantics). ``universe_size`` defaults to ``len(eligible_symbols)``.

    Returns a dict shaped like :class:`dashboard.api.models.ComplianceResponse`:
    ``{"compliant", "violations", "held_count", "universe_size", "last_checked"}``.
    """
    held = set(held_symbols)
    eligible = set(eligible_symbols)
    if universe_size is None:
        universe_size = len(eligible)

    # Empty eligible universe => cannot determine violations => compliant
    # (the router's existing "can't determine" semantics).
    if not eligible:
        return {
            "compliant": True,
            "violations": [],
            "held_count": len(held),
            "universe_size": universe_size,
            "last_checked": last_checked,
        }

    violations = sorted(held - eligible)
    return {
        "compliant": len(violations) == 0,
        "violations": violations,
        "held_count": len(held),
        "universe_size": universe_size,
        "last_checked": last_checked,
    }
