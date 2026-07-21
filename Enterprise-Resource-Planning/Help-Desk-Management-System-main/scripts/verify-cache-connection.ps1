# Redis Cache Connection Verification Script (PowerShell)
# Tests Redis cache connectivity and operations

$ErrorActionPreference = "Stop"

Write-Host "=== Redis Cache Connection Verification ===" -ForegroundColor Cyan
Write-Host ""

# Get Redis password from environment or docker-compose
$redisPassword = $env:REDIS_PASSWORD
if (-not $redisPassword) {
    # Try to get from docker-compose config
    $composeConfig = docker-compose config 2>&1 | ConvertFrom-Json -ErrorAction SilentlyContinue
    if ($composeConfig -and $composeConfig.services.redis.environment.REDIS_PASSWORD) {
        $redisPassword = $composeConfig.services.redis.environment.REDIS_PASSWORD
    }
}

# Check if Redis is accessible
Write-Host "1. Testing Redis connection (database 0)..."
try {
    if ($redisPassword) {
        $pingResult = docker-compose exec -T redis redis-cli -a $redisPassword -n 0 ping 2>&1
    } else {
        $pingResult = docker-compose exec -T redis redis-cli -n 0 ping 2>&1
    }
    
    if ($pingResult -match "PONG") {
        if ($redisPassword) {
            Write-Host "✓ Redis is accessible with authentication" -ForegroundColor Green
        } else {
            Write-Host "✓ Redis is accessible" -ForegroundColor Green
        }
    } else {
        Write-Host "✗ Redis connection failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Redis connection failed: $_" -ForegroundColor Red
    exit 1
}

# Test cache operations
Write-Host "2. Testing cache operations..."
try {
    if ($redisPassword) {
        docker-compose exec -T redis redis-cli -a $redisPassword -n 0 SET test_key "test_value" | Out-Null
        $value = docker-compose exec -T redis redis-cli -a $redisPassword -n 0 GET test_key
    } else {
        docker-compose exec -T redis redis-cli -n 0 SET test_key "test_value" | Out-Null
        $value = docker-compose exec -T redis redis-cli -n 0 GET test_key
    }
    
    $value = $value.Trim()
    
    if ($value -eq "test_value") {
        Write-Host "✓ Cache read/write operations successful" -ForegroundColor Green
        # Cleanup
        if ($redisPassword) {
            docker-compose exec -T redis redis-cli -a $redisPassword -n 0 DEL test_key | Out-Null
        } else {
            docker-compose exec -T redis redis-cli -n 0 DEL test_key | Out-Null
        }
    } else {
        Write-Host "✗ Cache operations failed (expected 'test_value', got '$value')" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Cache operations failed: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "All cache connection tests passed!" -ForegroundColor Green

