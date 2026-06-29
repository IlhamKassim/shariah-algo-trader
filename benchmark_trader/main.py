import logging

from benchmark_trader.config import BenchmarkConfig
from benchmark_trader.data.watchlist import get_watchlist
from benchmark_trader.scheduling.scheduler import start

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)

logger = logging.getLogger(__name__)


def main() -> None:
    cfg = BenchmarkConfig()
    watchlist = get_watchlist()
    logger.info("Benchmark trader starting — Gap and Go, %d stocks", len(watchlist))
    start(cfg, watchlist)


if __name__ == "__main__":
    main()
