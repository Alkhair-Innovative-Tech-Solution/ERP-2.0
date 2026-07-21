"""
Utility functions for Chat app.
"""
from .models import ChatMessage


def format_mentions(mentions: list) -> str:
    """Format mentions for display."""
    return ", ".join([f"@{user_id}" for user_id in mentions]) if mentions else ""


