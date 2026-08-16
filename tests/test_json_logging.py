"""Tests for the JSON logging setup in shariah_algo_trader.main.

Every log record must be emitted as exactly one JSON object per line:
    {"timestamp": <ISO8601>, "level": ..., "logger": ..., "message": ...}
with an "exception" field present only when exc_info is set.
"""
import io
import json
import logging
import sys
from datetime import datetime

from shariah_algo_trader.main import JsonFormatter, _setup_json_logging


def _make_record(msg="hello", level=logging.INFO, name="test.logger", exc_info=None, args=()):
    return logging.LogRecord(
        name=name,
        level=level,
        pathname=__file__,
        lineno=1,
        msg=msg,
        args=args,
        exc_info=exc_info,
    )


class TestJsonFormatter:
    def test_format_returns_single_valid_json_line(self):
        formatted = JsonFormatter().format(_make_record())
        payload = json.loads(formatted)
        assert set(payload) == {"timestamp", "level", "logger", "message"}
        assert "\n" not in formatted

    def test_timestamp_is_iso8601_and_timezone_aware(self):
        payload = json.loads(JsonFormatter().format(_make_record()))
        parsed = datetime.fromisoformat(payload["timestamp"])
        assert parsed.tzinfo is not None

    def test_level_and_logger_fields_match_record(self):
        record = _make_record(level=logging.WARNING, name="apscheduler.scheduler")
        payload = json.loads(JsonFormatter().format(record))
        assert payload["level"] == "WARNING"
        assert payload["logger"] == "apscheduler.scheduler"

    def test_message_is_getMessage_result(self):
        record = _make_record(msg="value=%s count=%d", args=("x", 3))
        payload = json.loads(JsonFormatter().format(record))
        assert payload["message"] == "value=x count=3"

    def test_exception_field_present_with_traceback_when_exc_info_set(self):
        record = _make_record(msg="boom happened", exc_info=_current_exc_info())
        payload = json.loads(JsonFormatter().format(record))
        assert "exception" in payload
        assert "ValueError: boom" in payload["exception"]
        assert "Traceback" in payload["exception"]

    def test_no_exception_field_when_exc_info_absent(self):
        payload = json.loads(JsonFormatter().format(_make_record()))
        assert "exception" not in payload


class TestRootLoggerWiring:
    def test_root_logger_level_is_info(self):
        assert logging.getLogger().level == logging.INFO

    def test_root_logger_has_json_stream_handler(self):
        # pytest's live-logging plugin injects its own null handler into root;
        # the service's own handler is the StreamHandler(JsonFormatter) from
        # _setup_json_logging — that is what journald sees in production.
        root = logging.getLogger()
        json_handlers = [h for h in root.handlers if isinstance(h.formatter, JsonFormatter)]
        assert json_handlers, "root logger has no JSON handler"
        assert isinstance(json_handlers[0], logging.StreamHandler)

    def test_end_to_end_emit_is_one_valid_json_line(self):
        stream = logging.StreamHandler(io.StringIO())
        stream.setFormatter(JsonFormatter())
        logger = logging.getLogger("test.json.endtoend")
        logger.handlers = [stream]
        logger.propagate = False
        logger.setLevel(logging.INFO)
        logger.info("end to end %s", "works")
        line = stream.stream.getvalue().strip()
        payload = json.loads(line)
        assert payload["logger"] == "test.json.endtoend"
        assert payload["message"] == "end to end works"
        assert payload["level"] == "INFO"


def _current_exc_info():
    try:
        raise ValueError("boom")
    except ValueError:
        return sys.exc_info()
