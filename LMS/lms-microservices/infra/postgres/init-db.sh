#!/bin/sh
set -e

# CREATE DATABASE cannot run inside a DO/PL-pgSQL block, so we check for
# existence from the shell and create each database as a top-level statement.
for db in auth_db course_db admission_db notification_db certification_db content_db org_db fee_db; do
    exists=$(psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$db'" \
        --username "$POSTGRES_USER" --dbname "$POSTGRES_DB")
    if [ "$exists" != "1" ]; then
        psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
            -c "CREATE DATABASE $db;"
    fi
    psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" \
        -c "ALTER DATABASE $db OWNER TO $POSTGRES_USER;"
done
