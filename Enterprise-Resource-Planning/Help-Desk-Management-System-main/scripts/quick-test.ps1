# Quick Test Script - Check Infrastructure Status
Write-Host "=== Quick Infrastructure Test ===" -ForegroundColor Cyan
Write-Host ""

# Check containers
Write-Host "1. Checking container status..." -ForegroundColor Yellow
$containers = docker ps -a --filter "name=hdms" --format "{{.Names}}|{{.Status}}"
foreach ($line in $containers) {
    $parts = $line -split '\|'
    $name = $parts[0]
    $status = $parts[1]
    if ($status -match "Up|Running") {
        Write-Host "  ✓ $name : $status" -ForegroundColor Green
    } else {
        Write-Host "  ✗ $name : $status" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "2. Testing Redis (no password)..." -ForegroundColor Yellow
$redisTest = docker-compose exec -T redis redis-cli ping 2>&1
if ($redisTest -match "PONG") {
    Write-Host "  ✓ Redis accessible (no password)" -ForegroundColor Green
} elseif ($redisTest -match "NOAUTH") {
    Write-Host "  ⚠ Redis requires password" -ForegroundColor Yellow
    Write-Host "  → Solution: Set REDIS_PASSWORD='' in .env or restart Redis container" -ForegroundColor Cyan
} else {
    Write-Host "  ✗ Redis connection failed: $redisTest" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Testing PgBouncer..." -ForegroundColor Yellow
$pgbouncerTest = docker-compose exec -T pgbouncer pg_isready -h localhost -p 6432 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host "  ✓ PgBouncer accessible" -ForegroundColor Green
} else {
    Write-Host "  ✗ PgBouncer not accessible" -ForegroundColor Red
    Write-Host "  → Solution: docker-compose up -d pgbouncer" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "4. Testing PostgreSQL..." -ForegroundColor Yellow
$pgTest = docker-compose exec -T postgres psql -U hdms_user -d hdms_db -c "SELECT 1;" 2>&1 | Select-String -Pattern "1 row"
if ($pgTest) {
    Write-Host "  ✓ PostgreSQL accessible" -ForegroundColor Green
} else {
    Write-Host "  ✗ PostgreSQL connection failed" -ForegroundColor Red
}

Write-Host ""

