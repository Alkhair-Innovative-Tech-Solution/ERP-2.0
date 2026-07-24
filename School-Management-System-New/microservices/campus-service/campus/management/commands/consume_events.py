import logging
from django.core.management.base import BaseCommand
from ams_shared.events.consumer import start_consumer

logger = logging.getLogger(__name__)

QUEUE_NAME = "campus-service.org-events"
ROUTING_KEYS = ["org.created", "org.updated"]


def handle_event(routing_key, payload):
    from users.models import Organization
    org_id = payload.get('id')
    if not org_id:
        logger.warning("Received %s with no id, skipping", routing_key)
        return

    fields = {
        'name': payload.get('name', f'Org-{org_id}'),
        'max_users': payload.get('max_users', 50),
        'max_students': payload.get('max_students', 1000),
        'max_campuses': payload.get('max_campuses', 3),
        'is_active': payload.get('is_active', True),
    }
    if payload.get('code_prefix'):
        fields['code_prefix'] = payload['code_prefix']
    if payload.get('code_pattern'):
        fields['code_pattern'] = payload['code_pattern']

    org, created = Organization.all_objects.get_or_create(id=org_id, defaults=fields)
    if not created:
        for k, v in fields.items():
            setattr(org, k, v)
        org.save(update_fields=list(fields.keys()))
        logger.info("Updated org %s from %s", org_id, routing_key)
    else:
        logger.info("Created org %s from %s", org_id, routing_key)


class Command(BaseCommand):
    help = "Consume RabbitMQ org events and sync organization data"

    def handle(self, *args, **options):
        self.stdout.write("Starting campus-service event consumer...")
        start_consumer(ROUTING_KEYS, handle_event, QUEUE_NAME)
