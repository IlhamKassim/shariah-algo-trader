from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class UniverseCache:
    computing: bool = False
    last_computed_at: datetime | None = None
    stocks: list[dict] = field(default_factory=list)


_cache = UniverseCache()


def get_universe_cache() -> UniverseCache:
    return _cache
