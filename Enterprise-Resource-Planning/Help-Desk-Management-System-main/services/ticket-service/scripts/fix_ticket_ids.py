"""
Data migration to generate ticket_id for existing non-draft tickets.

Run this manually: python manage.py shell < scripts/fix_ticket_ids.py
"""
from django.utils import timezone
from apps.tickets.models.ticket import Ticket

def fix_ticket_ids():
    """Generate ticket_id for all non-draft tickets that don't have one."""
    year = timezone.now().year
    
    # Get tickets without ticket_id that are not drafts
    tickets = Ticket.objects.filter(ticket_id__isnull=True).exclude(status='draft').order_by('created_at')
    
    if not tickets.exists():
        print("No tickets need fixing.")
        return
    
    # Get the last used number
    last_ticket = Ticket.objects.filter(
        ticket_id__startswith=f'HD-{year}-'
    ).order_by('-ticket_id').first()
    
    if last_ticket and last_ticket.ticket_id:
        next_num = int(last_ticket.ticket_id.split('-')[-1]) + 1
    else:
        next_num = 1
    
    # Update each ticket
    count = 0
    for ticket in tickets:
        ticket.ticket_id = f'HD-{year}-{str(next_num).zfill(4)}'
        ticket.save(update_fields=['ticket_id'])
        print(f"Updated: {ticket.id} -> {ticket.ticket_id}")
        next_num += 1
        count += 1
    
    print(f"\nFixed {count} tickets.")

# Run it
fix_ticket_ids()
