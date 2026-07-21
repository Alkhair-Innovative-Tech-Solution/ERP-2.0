#!/bin/sh
set -e

# Defaults
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
PGBOUNCER_POOL_SIZE=${PGBOUNCER_POOL_SIZE:-25}

# Generate userlist.txt (MD5 format: "user" "md5(password + user)")
if [ -n "$POSTGRES_USER" ] && [ -n "$POSTGRES_PASSWORD" ]; then
    MD5_PASS=$(echo -n "${POSTGRES_PASSWORD}${POSTGRES_USER}" | md5sum | cut -d ' ' -f 1)
    echo "\"$POSTGRES_USER\" \"md5$MD5_PASS\"" > /tmp/userlist.txt
else
    echo "Error: POSTGRES_USER and POSTGRES_PASSWORD must be set."
    exit 1
fi

# Generate pgbouncer.ini
cat <<EOF > /tmp/pgbouncer.ini
[databases]
${POSTGRES_DB} = host=${DB_HOST} port=${DB_PORT} dbname=${POSTGRES_DB} user=${POSTGRES_USER} password=${POSTGRES_PASSWORD}

[pgbouncer]
pool_mode = transaction
max_client_conn = 100
default_pool_size = ${PGBOUNCER_POOL_SIZE}
listen_port = 6432
listen_addr = 0.0.0.0
auth_type = md5
auth_file = /tmp/userlist.txt
admin_users = postgres
stats_users = postgres
logfile = /var/log/pgbouncer/pgbouncer.log
pidfile = /tmp/pgbouncer.pid
ignore_startup_parameters = extra_float_digits
EOF

# Cleanup PID
if [ -f /tmp/pgbouncer.pid ]; then
    rm -f /tmp/pgbouncer.pid
fi

# Run PgBouncer
exec /opt/pgbouncer/pgbouncer /tmp/pgbouncer.ini
