from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class UniverseCache:
    computing: bool = False
    last_computed_at: datetime | None = None
    stocks: list[dict] = field(default_factory=list)
    raw_universe: set[str] = field(default_factory=set)


_cache = UniverseCache()


def get_universe_cache() -> UniverseCache:
    return _cache
