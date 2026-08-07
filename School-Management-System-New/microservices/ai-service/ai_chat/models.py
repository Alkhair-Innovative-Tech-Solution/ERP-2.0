import uuid
from django.db import models


class Conversation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    # Phase C13: found live, not anticipated by the phase's own "no model
    # changes needed" premise — a central-auth actor's identity (user.id)
    # and tenant (tenant_id) are UUIDs, and these two columns are
    # IntegerFields with no null=True. Passing a UUID string into
    # Django's IntegerField raises ValueError before the query even
    # reaches the DB — every central-auth chat request would crash
    # outright, not just resolve claims incorrectly. Made nullable
    # (additive, backward-compatible — every legacy call site still
    # always supplies both, so existing rows/behavior are unchanged) and
    # paired with new nullable central_user_id/central_org_id columns for
    # the central-auth path. See ai_chat/views.py's _conversation_lookup_kwargs.
    user_id = models.IntegerField(db_index=True, null=True, blank=True)
    org_id = models.IntegerField(db_index=True, null=True, blank=True)
    central_user_id = models.UUIDField(db_index=True, null=True, blank=True)
    central_org_id = models.UUIDField(db_index=True, null=True, blank=True)
    title = models.CharField(max_length=200, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-updated_at"]
        indexes = [
            models.Index(fields=["org_id", "user_id", "-updated_at"]),
            models.Index(fields=["central_org_id", "central_user_id", "-updated_at"]),
        ]


class ConversationMessage(models.Model):
    ROLE_CHOICES = [("user", "User"), ("assistant", "Assistant")]
    conversation = models.ForeignKey(Conversation, on_delete=models.CASCADE, related_name="messages")
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]
