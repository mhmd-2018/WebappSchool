import logging

class DatabaseLogHandler(logging.Handler):
    """Handler that writes logs directly into the database via Django ORM."""

    def emit(self, record):
        try:
            # Imported lazily: LOGGING is configured before the app registry
            # is ready, so importing the model at module load time would fail.
            from .models import LogEntry

            # THE ORM WAY: Creates a database record (INSERT)
            LogEntry.objects.create(
                level=record.levelname,
                logger_name=record.name,
                message=record.getMessage(),
            )
        except Exception:
            # Prevent logging errors from crashing the application 
            # (e.g., if the DB is down or during migrations)
            pass