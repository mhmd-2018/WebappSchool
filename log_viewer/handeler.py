import logging
import threading

class DatabaseLogHandler(logging.Handler):
    """Handler that writes logs directly into the database via Django ORM."""

    def emit(self, record):
        level = record.levelname
        logger_name = record.name
        message = record.getMessage()
        # Django DB connections are thread-local, so writing from a fresh
        # thread gets its own autocommit connection instead of participating
        # in whatever transaction.atomic() block the calling code is inside.
        # Without this, a log written during a transaction that later rolls
        # back (e.g. django-import-export's dry-run preview, which always
        # runs inside an atomic block) would silently disappear along with it.
        threading.Thread(
            target=self._write, args=(level, logger_name, message), daemon=True
        ).start()

    def _write(self, level, logger_name, message):
        try:
            # Imported lazily: LOGGING is configured before the app registry
            # is ready, so importing the model at module load time would fail.
            from .models import LogEntry

            LogEntry.objects.create(level=level, logger_name=logger_name, message=message)
        except Exception:
            # Prevent logging errors from crashing the application
            # (e.g., if the DB is down or during migrations)
            pass