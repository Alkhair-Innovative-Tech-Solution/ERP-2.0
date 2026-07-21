#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
until pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"; do
  sleep 1
done

# Recreate user password with MD5 encryption
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    -- Set password encryption to MD5
    ALTER SYSTEM SET password_encryption = 'md5';
    
    -- Reload configuration
    SELECT pg_reload_conf();
    
    -- Recreate user with MD5 password
    ALTER USER "$POSTGRES_USER" WITH PASSWORD '$POSTGRES_PASSWORD';
EOSQL

echo "Password encryption set to MD5 and user password updated"


