"""
WebSocket consumer for chat.
"""
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from apps.chat.models import ChatMessage, TicketParticipant


class ChatConsumer(AsyncWebsocketConsumer):
    """WebSocket consumer for ticket chat."""
    
    async def connect(self):
        """
        Handle WebSocket connection.
        Authentication is handled by JWTAuthMiddleware.
        """
        self.ticket_id = self.scope['url_route']['kwargs']['ticket_id']
        self.room_group_name = f'chat_{self.ticket_id}'
        
        # Check if middleware validated token
        if not self.scope.get('token_validated'):
            print(f"❌ WebSocket rejected: Token not validated by middleware")
            await self.close()
            return
        
        self.user = self.scope.get('user')
        
        if not self.user:
            print(f"❌ WebSocket rejected: No user object in scope")
            await self.close()
            return
        
        self.user_id = str(self.user.id)
        
        # Join room group
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        print(f"✅ WebSocket accepted for ticket {self.ticket_id}, user {self.user_id}")
        
        # Add participant
        await self.add_participant()

    
    async def disconnect(self, close_code):
        """Handle WebSocket disconnection."""
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )
    
    async def receive(self, text_data):
        """Receive message from WebSocket."""
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            print(f"⚠️ Invalid JSON received: {text_data}")
            return

        message = data.get('message')
        mentions = data.get('mentions', [])
        
        # Validate message content (Ignore null or empty messages)
        if not message or not str(message).strip():
            print(f"⚠️ Ignoring empty/null message from user {self.user_id}")
            return
            
        # Save message to database
        chat_message = await self.save_message(message, mentions)
        
        # Broadcast message to room group
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': {
                    'id': str(chat_message.id),
                    'ticket_id': str(chat_message.ticket_id),
                    'sender_id': str(chat_message.sender_id),
                    'sender_name': f"{self.user.first_name} {self.user.last_name}".strip() or self.user.employee_code,
                    'sender_role': self.user.role,
                    'employee_code': self.user.employee_code,
                    'message': chat_message.message,
                    'mentions': chat_message.mentions,
                    'created_at': chat_message.created_at.isoformat(),
                }
            }
        )
    
    async def chat_message(self, event):
        """Receive message from room group."""
        message = event['message']
        
        # Send message to WebSocket
        await self.send(text_data=json.dumps({
            'type': 'message',
            'data': message
        }))
    
    
    @database_sync_to_async
    def save_message(self, message, mentions):
        """Save chat message to database."""
        return ChatMessage.objects.create(
            ticket_id=self.ticket_id,
            sender_id=self.user_id,
            message=message,
            mentions=mentions or []
        )
    
    @database_sync_to_async
    def add_participant(self):
        """Add user as ticket participant."""
        TicketParticipant.objects.get_or_create(
            ticket_id=self.ticket_id,
            user_id=self.user_id
        )


