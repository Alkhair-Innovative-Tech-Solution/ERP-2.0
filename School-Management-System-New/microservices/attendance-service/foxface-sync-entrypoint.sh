#!/bin/sh
# Continuous FoxFace sync runner. Uses the attendance-service image but only
# polls the FoxFace platform — it does NOT serve HTTP.
#
#   - every FOXFACE_POLL_SECONDS (default 30s): pull user logs -> StaffAttendance
#   - every ~2 min: refresh device online/offline status
#
# Logs flow into attendance within ~poll-interval of the punch (device->platform
# itself is only a few seconds).

set -e

POLL="${FOXFACE_POLL_SECONDS:-30}"

until pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER"; do
    echo "[foxface-sync] Waiting for DB..."
    sleep 2
done

echo "[foxface-sync] DB ready. Polling every ${POLL}s."

i=0
while true; do
    # Attendance logs — every cycle. --days 1 covers today + overnight; upsert is idempotent.
    python manage.py sync_foxface_logs --days 1 || echo "[foxface-sync] sync_foxface_logs failed"

    # Device live status — every ~2 minutes (every 4th cycle at 30s).
    if [ $((i % 4)) -eq 0 ]; then
        python manage.py sync_foxface_device_status || echo "[foxface-sync] status sync failed"
    fi

    i=$((i + 1))
    sleep "$POLL"
done
