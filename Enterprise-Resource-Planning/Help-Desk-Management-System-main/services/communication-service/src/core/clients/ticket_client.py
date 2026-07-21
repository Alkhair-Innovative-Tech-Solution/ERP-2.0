"""
Ticket Service client for Communication Service.
"""
# Remove module-level settings import
from clients import HTTPClient


class TicketClient:
    """Client to communicate with Ticket Service."""
    
    _client = None
    
    @classmethod
    def _get_client(cls):
        """Get HTTP client instance (lazy initialization)."""
        if cls._client is None:
            cls._client = HTTPClient()
        return cls._client
    
    @classmethod
    def _get_base_url(cls):
        """Get base URL from settings (lazy access)."""
        # Import settings only when method is called, not at module level
        from django.conf import settings
        return settings.TICKET_SERVICE_URL
    
    @classmethod
    def get_ticket(cls, ticket_id: str, token: str = None):
        """Get ticket details from Ticket Service."""
        try:
            return cls._get_client().get_json(
                f'{cls._get_base_url()}/api/v1/tickets/{ticket_id}',
                token=token
            )
        except Exception as e:
            # Handle ConnectionError, Timeout, and other exceptions gracefully
            # Service not ready yet, return None instead of crashing
            return None
    
    @classmethod
    def validate_ticket(cls, ticket_id: str, token: str = None) -> bool:
        """Validate if ticket exists in Ticket Service."""
        return cls.get_ticket(ticket_id, token) is not None
