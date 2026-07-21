# Comprehensive Connection Verification Script (PowerShell)
# Tests all connections: PostgreSQL, PgBouncer, Redis cache, Redis Channels, Redis Celery

$ErrorActionPreference = "Stop"

Write-Host "=== Comprehensive Connection Verification ===" -ForegroundColor Cyan
Write-Host ""

$failed = 0

# Load environment variables from .env if it exists
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
            $key = $matches[1].Trim()
            $value = $matches[2].Trim()
            [Environment]::SetEnvironmentVariable($key, $value, "Process")
        }
    }
}

$POSTGRES_USER = if ($env:POSTGRES_USER) { $env:POSTGRES_USER } else { "hdms_user" }
$POSTGRES_PASSWORD = if ($env:POSTGRES_PASSWORD) { $env:POSTGRES_PASSWORD } else { "hdms_pwd" }
$POSTGRES_DB = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "hdms_db" }
$REDIS_PASSWORD = $env:REDIS_PASSWORD

# 1. PostgreSQL Connection (via PgBouncer)
Write-Host "1. Testing PostgreSQL connection through PgBouncer..." -ForegroundColor Yellow
try {
    $result = docker-compose exec -T postgres pg_isready -h pgbouncer -p 6432 -U $POSTGRES_USER -d $POSTGRES_DB 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✓ PostgreSQL connection OK" -ForegroundColor Green
    } else {
        Write-Host "✗ PostgreSQL connection FAILED" -ForegroundColor Red
        $failed = 1
    }
} catch {
    Write-Host "✗ PostgreSQL connection FAILED: $_" -ForegroundColor Red
    $failed = 1
}

# 2. Redis Cache Connection (database 0)
Write-Host "2. Testing Redis cache connection (database 0)..." -ForegroundColor Yellow
try {
    if ($REDIS_PASSWORD) {
        $result = docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning -n 0 ping 2>&1 | Out-String
    } else {
        $result = docker-compose exec -T redis redis-cli -n 0 ping 2>&1 | Out-String
    }
    if ($LASTEXITCODE -eq 0 -and $result -match "PONG") {
        Write-Host "✓ Redis cache connection OK" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis cache connection FAILED" -ForegroundColor Red
        $failed = 1
    }
} catch {
    Write-Host "✗ Redis cache connection FAILED: $_" -ForegroundColor Red
    $failed = 1
}

# 3. Redis Channels Connection (database 1)
Write-Host "3. Testing Redis Channels connection (database 1)..." -ForegroundColor Yellow
try {
    if ($REDIS_PASSWORD) {
        $result = docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning -n 1 ping 2>&1 | Out-String
    } else {
        $result = docker-compose exec -T redis redis-cli -n 1 ping 2>&1 | Out-String
    }
    if ($LASTEXITCODE -eq 0 -and $result -match "PONG") {
        Write-Host "✓ Redis Channels connection OK" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis Channels connection FAILED" -ForegroundColor Red
        $failed = 1
    }
} catch {
    Write-Host "✗ Redis Channels connection FAILED: $_" -ForegroundColor Red
    $failed = 1
}

# 4. Redis Celery Broker Connection (database 2)
Write-Host "4. Testing Redis Celery broker connection (database 2)..." -ForegroundColor Yellow
try {
    if ($REDIS_PASSWORD) {
        $result = docker-compose exec -T redis redis-cli -a "$REDIS_PASSWORD" --no-auth-warning -n 2 ping 2>&1 | Out-String
    } else {
        $result = docker-compose exec -T redis redis-cli -n 2 ping 2>&1 | Out-String
    }
    if ($LASTEXITCODE -eq 0 -and $result -match "PONG") {
        Write-Host "✓ Redis Celery broker connection OK" -ForegroundColor Green
    } else {
        Write-Host "✗ Redis Celery broker connection FAILED" -ForegroundColor Red
        $failed = 1
    }
} catch {
    Write-Host "✗ Redis Celery broker connection FAILED: $_" -ForegroundColor Red
    $failed = 1
}

Write-Host ""
if ($failed -eq 0) {
    Write-Host "=== All connection tests passed! ===" -ForegroundColor Green
    exit 0
} else {
    Write-Host "=== Some connection tests failed! ===" -ForegroundColor Red
    exit 1
}
