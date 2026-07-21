"""
Utility functions for File app.
"""
import os
from pathlib import Path
from .models import Attachment


def get_file_extension(filename: str) -> str:
    """Get file extension from filename."""
    return Path(filename).suffix.lower().lstrip('.')


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024.0:
            return f"{size_bytes:.2f} {unit}"
        size_bytes /= 1024.0
    return f"{size_bytes:.2f} TB"


