"""
Ticket Service client for File Service.
"""
from django.conf import settings
from clients import HTTPClient


class TicketClient:
    """Client to communicate with Ticket Service."""
    
    BASE_URL = settings.TICKET_SERVICE_URL
    _client = HTTPClient()
    
    @classmethod
    def get_ticket(cls, ticket_id: str, token: str = None):
        """Get ticket details from Ticket Service."""
        try:
            return cls._client.get_json(
                f'{cls.BASE_URL}/api/v1/tickets/{ticket_id}',
                token=token
            )
        except Exception:
            return None
    
    @classmethod
    def validate_ticket(cls, ticket_id: str, token: str = None) -> bool:
        """Validate if ticket exists in Ticket Service."""
        return cls.get_ticket(ticket_id, token) is not None
