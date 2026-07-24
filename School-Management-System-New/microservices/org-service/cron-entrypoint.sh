#!/bin/sh
# Cron runner for org-service scheduled tasks.
# Runs as a separate container using the same org-service image.

set -e

# Wait for DB
until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
    echo "[cron] Waiting for DB..."
    sleep 2
done

echo "[cron] DB ready. Starting scheduler loop."

LAST_INVOICE_DATE=""

while true; do
    NOW_HOUR=$(date -u +"%H")
    NOW_DATE=$(date -u +"%Y-%m-%d")

    # Mark overdue — every hour
    echo "[cron] Running mark_overdue_invoices..."
    python manage.py mark_overdue_invoices || echo "[cron] mark_overdue_invoices failed"

    # Generate recurring invoices — once per day at 00:xx UTC
    if [ "$NOW_HOUR" = "00" ] && [ "$NOW_DATE" != "$LAST_INVOICE_DATE" ]; then
        echo "[cron] Running generate_recurring_invoices..."
        python manage.py generate_recurring_invoices || echo "[cron] generate_recurring_invoices failed"
        LAST_INVOICE_DATE="$NOW_DATE"
    fi

    # Sleep 1 hour before next check
    sleep 3600
done
