from django.db import models

class LogEntry(models.Model):
    LEVEL_CHOICES = [
        ('DEBUG', 'DEBUG'), ('INFO', 'INFO'),
        ('WARNING', 'WARNING'), ('ERROR', 'ERROR'),
        ('CRITICAL', 'CRITICAL'),
    ]
    
    # ORM fields
    level = models.CharField(max_length=10, choices=LEVEL_CHOICES)
    logger_name = models.CharField(max_length=255)
    message = models.TextField()
    # Timestamp automatically set by ORM
    created_at = models.DateTimeField(auto_now_add=True) 

    class Meta:
        ordering = ['-created_at']  # Newest first

    def __str__(self):
        return f"[{self.level}] {self.logger_name}: {self.message[:50]}"