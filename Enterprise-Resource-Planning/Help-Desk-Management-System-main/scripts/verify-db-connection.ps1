# Database Connection Verification Script (PowerShell)
# Tests PostgreSQL connection through PgBouncer

$ErrorActionPreference = "Stop"

Write-Host "=== Database Connection Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if PgBouncer container is running
Write-Host "1. Testing PgBouncer connection..."
try {
    $pgbouncerStatus = docker-compose exec -T pgbouncer pg_isready -h localhost -p 6432 -U hdms_user -d hdms_db 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PgBouncer is accessible" -ForegroundColor Green
    } else {
        Write-Host "✗ PgBouncer connection failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ PgBouncer connection failed: $_" -ForegroundColor Red
    exit 1
}

# Test database connection via psql
Write-Host "2. Testing database query through PgBouncer..."
try {
    $dbPassword = $env:POSTGRES_PASSWORD
    if (-not $dbPassword) {
        $dbPassword = "hdms_pwd"
    }
    
    $queryResult = docker-compose exec -T pgbouncer psql -h localhost -p 6432 -U hdms_user -d hdms_db -c "SELECT version();" 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ Database query successful" -ForegroundColor Green
    } else {
        Write-Host "✗ Database query failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Database query failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All database connection tests passed!" -ForegroundColor Green

