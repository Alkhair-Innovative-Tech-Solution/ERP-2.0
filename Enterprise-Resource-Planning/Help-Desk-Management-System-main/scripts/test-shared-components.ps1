#!/usr/bin/env pwsh
# Test script for shared core components
# Tests BaseModel and HTTPClient imports in all Django services

Write-Host "Testing Shared Core Components..." -ForegroundColor Cyan
Write-Host ""

$services = @("user-service", "ticket-service", "communication-service", "file-service")
$allPassed = $true

foreach ($service in $services) {
    Write-Host "Testing $service..." -ForegroundColor Yellow
    
    # Test BaseModel import
    $basemodelTest = docker-compose exec -T $service python manage.py shell -c "from models import BaseModel; print('BaseModel:', BaseModel.__name__)" 2>&1
    if ($LASTEXITCODE -eq 0 -and $basemodelTest -match "BaseModel") {
        Write-Host "  ✓ BaseModel import successful" -ForegroundColor Green
    } else {
        Write-Host "  ✗ BaseModel import failed" -ForegroundColor Red
        Write-Host "    $basemodelTest" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Test HTTPClient import
    $clientTest = docker-compose exec -T $service python manage.py shell -c "from clients import HTTPClient; print('HTTPClient:', HTTPClient.__name__)" 2>&1
    if ($LASTEXITCODE -eq 0 -and $clientTest -match "HTTPClient") {
        Write-Host "  ✓ HTTPClient import successful" -ForegroundColor Green
    } else {
        Write-Host "  ✗ HTTPClient import failed" -ForegroundColor Red
        Write-Host "    $clientTest" -ForegroundColor Red
        $allPassed = $false
    }
    
    # Test logging config import
    $loggingTest = docker-compose exec -T $service python manage.py shell -c "from logging_config import get_logging_config; config = get_logging_config(); print('Logging config keys:', len(config.keys()))" 2>&1
    if ($LASTEXITCODE -eq 0 -and $loggingTest -match "Logging config keys") {
        Write-Host "  ✓ Logging config import successful" -ForegroundColor Green
    } else {
        Write-Host "  ✗ Logging config import failed" -ForegroundColor Red
        Write-Host "    $loggingTest" -ForegroundColor Red
        $allPassed = $false
    }
    
    Write-Host ""
}

if ($allPassed) {
    Write-Host "All tests passed! ✓" -ForegroundColor Green
    exit 0
} else {
    Write-Host "Some tests failed! ✗" -ForegroundColor Red
    exit 1
}

