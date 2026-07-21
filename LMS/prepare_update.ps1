# Server Update Package Preparation Script
# This creates a minimal update package for existing deployment

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AIT-LMS Server Update Package" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create update directory
$updateDir = "D:\AIT-LMS-UPDATE"
Write-Host "[1/4] Creating update directory..." -ForegroundColor Yellow
if (Test-Path $updateDir) {
    Remove-Item -Path $updateDir -Recurse -Force
}
New-Item -ItemType Directory -Path $updateDir | Out-Null
Write-Host "Done: Update directory created" -ForegroundColor Green
Write-Host ""

# Copy updated backend services
Write-Host "[2/4] Copying updated backend services..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$updateDir\lms-microservices" -Force | Out-Null

# Copy only essential backend files (excluding databases and volumes)
Copy-Item -Path "D:\AIT-LMS\lms-microservices\api-gateway" -Destination "$updateDir\lms-microservices\api-gateway" -Recurse -Force
Copy-Item -Path "D:\AIT-LMS\lms-microservices\services" -Destination "$updateDir\lms-microservices\services" -Recurse -Force
Copy-Item -Path "D:\AIT-LMS\lms-microservices\shared" -Destination "$updateDir\lms-microservices\shared" -Recurse -Force
Copy-Item -Path "D:\AIT-LMS\lms-microservices\docker-compose.yml" -Destination "$updateDir\lms-microservices\docker-compose.yml" -Force

Write-Host "Done: Backend services copied" -ForegroundColor Green
Write-Host ""

# Copy updated frontend
Write-Host "[3/4] Copying updated frontend..." -ForegroundColor Yellow
$frontendDest = "$updateDir\ait_fe"
New-Item -ItemType Directory -Path $frontendDest -Force | Out-Null

Copy-Item -Path "D:\AIT-LMS\ait_fe\*" -Destination $frontendDest -Recurse -Force -Exclude @('node_modules','.next','out')

Write-Host "Done: Frontend files copied" -ForegroundColor Green
Write-Host ""

# Create update instructions
Write-Host "[4/4] Creating update instructions..." -ForegroundColor Yellow
$updateInstructions = @"
# AIT-LMS Server Update Guide

## IMPORTANT: Backup First!
Before updating, create a backup of your database:

``````bash
# Backup databases
docker exec postgres-course pg_dump -U lms_user course_db > backup_course_$(date +%Y%m%d).sql
docker exec postgres-auth pg_dump -U lms_user auth_db > backup_auth_$(date +%Y%m%d).sql
docker exec postgres-admission pg_dump -U lms_user admission_db > backup_admission_$(date +%Y%m%d).sql
``````

## Update Steps

### 1. Upload Update Package
Upload AIT-LMS-UPDATE.zip to your server:
``````bash
# On server
cd /home/your-user/
# Upload the zip file here using FileZilla/SCP
``````

### 2. Extract Update Package
``````bash
unzip AIT-LMS-UPDATE.zip
cd AIT-LMS-UPDATE
``````

### 3. Stop Running Services
``````bash
cd /home/your-user/ait-lms/lms-microservices
docker compose down
``````

**Note:** This will stop all services but preserve your database data!

### 4. Copy Updated Files
``````bash
# Backup current deployment (optional)
cd /home/your-user/
cp -r ait-lms ait-lms-backup-$(date +%Y%m%d)

# Copy updated backend services
cp -r AIT-LMS-UPDATE/lms-microservices/api-gateway /home/your-user/ait-lms/lms-microservices/
cp -r AIT-LMS-UPDATE/lms-microservices/services /home/your-user/ait-lms/lms-microservices/
cp -r AIT-LMS-UPDATE/lms-microservices/shared /home/your-user/ait-lms/lms-microservices/
cp AIT-LMS-UPDATE/lms-microservices/docker-compose.yml /home/your-user/ait-lms/lms-microservices/

# Copy updated frontend
cp -r AIT-LMS-UPDATE/ait_fe/* /home/your-user/ait-lms/ait_fe/
``````

### 5. Rebuild and Restart Services
``````bash
cd /home/your-user/ait-lms/lms-microservices

# Rebuild images with new code
docker compose build --no-cache

# Start services
docker compose up -d

# Check status
docker compose ps
``````

### 6. Run Database Migrations (if needed)
``````bash
# Run migrations for updated services
docker exec course-service python manage.py migrate
docker exec auth-service python manage.py migrate
docker exec admission-service python manage.py migrate
docker exec notification-service python manage.py migrate
docker exec certification-service python manage.py migrate
docker exec content-service python manage.py migrate
``````

### 7. Verify Update
``````bash
# Check logs
docker compose logs -f

# Test frontend
curl http://localhost:3000

# Test API
curl http://localhost:8000/health
``````

## Rollback (if needed)
If something goes wrong:

``````bash
# Stop services
cd /home/your-user/ait-lms/lms-microservices
docker compose down

# Restore backup
cd /home/your-user/
rm -rf ait-lms
mv ait-lms-backup-YYYYMMDD ait-lms

# Restart
cd ait-lms/lms-microservices
docker compose up -d
``````

## Quick Update Commands (All in One)
``````bash
# Stop services
cd /home/your-user/ait-lms/lms-microservices && docker compose down

# Update files
cd /home/your-user && \
cp -r AIT-LMS-UPDATE/lms-microservices/api-gateway ait-lms/lms-microservices/ && \
cp -r AIT-LMS-UPDATE/lms-microservices/services ait-lms/lms-microservices/ && \
cp -r AIT-LMS-UPDATE/lms-microservices/shared ait-lms/lms-microservices/ && \
cp AIT-LMS-UPDATE/lms-microservices/docker-compose.yml ait-lms/lms-microservices/ && \
cp -r AIT-LMS-UPDATE/ait_fe/* ait-lms/ait_fe/

# Rebuild and restart
cd /home/your-user/ait-lms/lms-microservices && \
docker compose build --no-cache && \
docker compose up -d

# Run migrations
docker exec course-service python manage.py migrate && \
docker exec auth-service python manage.py migrate && \
docker exec admission-service python manage.py migrate

# Check status
docker compose ps && docker compose logs --tail=50
``````

## Troubleshooting

### Services not starting
``````bash
# Check logs
docker compose logs service-name

# Restart specific service
docker compose restart service-name
``````

### Database connection issues
``````bash
# Check database containers
docker ps | grep postgres

# Restart databases
docker compose restart postgres-course postgres-auth
``````

### Port conflicts
``````bash
# Check what's using ports
netstat -tulpn | grep :3000
netstat -tulpn | grep :8000

# Kill processes if needed
kill -9 PID
``````

## Support
- Check logs: ``docker compose logs -f``
- Verify environment variables in ``.env`` file
- Ensure all ports are available
- Database data is preserved in Docker volumes
"@

Set-Content -Path "$updateDir\UPDATE_INSTRUCTIONS.md" -Value $updateInstructions
Write-Host "Done: Update instructions created" -ForegroundColor Green
Write-Host ""

# Create update archive
Write-Host "[5/5] Creating update archive..." -ForegroundColor Yellow
$archivePath = "D:\AIT-LMS-UPDATE.zip"
if (Test-Path $archivePath) {
    Remove-Item -Path $archivePath -Force
}

Compress-Archive -Path "$updateDir\*" -DestinationPath $archivePath -CompressionLevel Optimal
$archiveSize = [math]::Round((Get-Item $archivePath).Length / 1MB, 2)
Write-Host "Done: Update archive created ($archiveSize MB)" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Update Package Ready!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Update Package Location:" -ForegroundColor Yellow
Write-Host "  $archivePath" -ForegroundColor White
Write-Host ""
Write-Host "Package Size: $archiveSize MB" -ForegroundColor Gray
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Upload AIT-LMS-UPDATE.zip to your server" -ForegroundColor White
Write-Host "  2. Follow UPDATE_INSTRUCTIONS.md" -ForegroundColor White
Write-Host "  3. Backup databases before updating!" -ForegroundColor Red
Write-Host ""
Write-Host "Quick Update Command (on server):" -ForegroundColor Yellow
Write-Host "  cd /home/your-user/ait-lms/lms-microservices && docker compose down && \" -ForegroundColor Gray
Write-Host "  cd /home/your-user && cp -r AIT-LMS-UPDATE/* ait-lms/ && \" -ForegroundColor Gray
Write-Host "  cd ait-lms/lms-microservices && docker compose build --no-cache && \" -ForegroundColor Gray
Write-Host "  docker compose up -d" -ForegroundColor Gray
Write-Host ""

Set-Location "D:\AIT-LMS"
