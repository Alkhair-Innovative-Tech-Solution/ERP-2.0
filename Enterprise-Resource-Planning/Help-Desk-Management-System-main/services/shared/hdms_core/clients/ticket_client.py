"""
Ticket Service client for File Service.
"""
from django.conf import settings
from . import HTTPClient


class TicketClient:
    """Client to communicate with Ticket Service."""
    
    # Use lazy loading for settings
    @property
    def BASE_URL(self):
        return settings.TICKET_SERVICE_URL
    
    _client = HTTPClient()
    
    @classmethod
    def get_ticket(cls, ticket_id: str, token: str = None):
        """Get ticket details from Ticket Service."""
        try:
            base_url = settings.TICKET_SERVICE_URL
            return cls._client.get_json(
                f'{base_url}/api/v1/tickets/{ticket_id}',
                token=token
            )
        except Exception:
            return None
    
    @classmethod
    def validate_ticket(cls, ticket_id: str, token: str = None) -> bool:
        """Validate if ticket exists in Ticket Service."""
        return cls.get_ticket(ticket_id, token) is not None
