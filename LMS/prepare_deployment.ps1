# Production Deployment Preparation Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "AIT-LMS Production Deployment Preparation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Create deployment directory
$deploymentDir = "D:\AIT-LMS-DEPLOYMENT"
Write-Host "[1/5] Creating deployment directory..." -ForegroundColor Yellow
if (Test-Path $deploymentDir) {
    Remove-Item -Path $deploymentDir -Recurse -Force
}
New-Item -ItemType Directory -Path $deploymentDir | Out-Null
Write-Host "Done: Deployment directory created" -ForegroundColor Green
Write-Host ""

# Step 2: Copy backend services
Write-Host "[2/5] Copying backend microservices..." -ForegroundColor Yellow
New-Item -ItemType Directory -Path "$deploymentDir\lms-microservices" -Force | Out-Null

Copy-Item -Path "D:\AIT-LMS\lms-microservices\api-gateway" -Destination "$deploymentDir\lms-microservices\api-gateway" -Recurse -Force
Copy-Item -Path "D:\AIT-LMS\lms-microservices\services" -Destination "$deploymentDir\lms-microservices\services" -Recurse -Force
Copy-Item -Path "D:\AIT-LMS\lms-microservices\shared" -Destination "$deploymentDir\lms-microservices\shared" -Recurse -Force
# Copy the ROOT docker-compose.yml (single postgres-main for all services)
Copy-Item -Path "D:\AIT-LMS\docker-compose.yml" -Destination "$deploymentDir\docker-compose.yml" -Force
Copy-Item -Path "D:\AIT-LMS\docker-compose.prod.yml" -Destination "$deploymentDir\docker-compose.prod.yml" -Force
Copy-Item -Path "D:\AIT-LMS\.env" -Destination "$deploymentDir\.env" -Force
Copy-Item -Path "D:\AIT-LMS\nginx" -Destination "$deploymentDir\nginx" -Recurse -Force
Copy-Item -Path "D:\AIT-LMS\lms-microservices\infra" -Destination "$deploymentDir\lms-microservices\infra" -Recurse -Force

Write-Host "Done: Backend services copied" -ForegroundColor Green
Write-Host ""

# Step 3: Copy frontend (using Docker build)
Write-Host "[3/5] Copying frontend files..." -ForegroundColor Yellow
$frontendDest = "$deploymentDir\ait_fe"
New-Item -ItemType Directory -Path $frontendDest -Force | Out-Null

Copy-Item -Path "D:\AIT-LMS\ait_fe\*" -Destination $frontendDest -Recurse -Force -Exclude @('node_modules','.next','out')

Write-Host "Done: Frontend files copied" -ForegroundColor Green
Write-Host ""

# Step 4: Create deployment documentation
Write-Host "[4/5] Creating deployment documentation..." -ForegroundColor Yellow
$readmeContent = @"
# AIT-LMS Production Deployment Guide

## Prerequisites
- Docker & Docker Compose installed on server
- Ports available: 3000 (Frontend), 8000 (API Gateway), 8001-8006 (Services), 5432-5440 (Databases)

## Deployment Steps

### 1. Upload Files to Server
Upload the entire deployment folder to your server using FileZilla/MobaXterm:
- Connect to your server via SFTP
- Upload to: /home/your-user/ait-lms/

### 2. Set Environment Variables
``````bash
cd /home/your-user/ait-lms
nano .env
``````

Update the following:
- NEXT_PUBLIC_API_URL=https://ait.iak.ngo (production domain)
- JWT_SECRET_KEY=your-production-secret-key
- Database passwords (if needed)

### 3. Start Services (run from ROOT, not lms-microservices/)
``````bash
cd /home/your-user/ait-lms

# Build and start all services
docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Check status
docker compose ps

# View logs
docker compose logs -f
``````

### 4. Access Application (via nginx on port 80)
- AIT Website: http://ait.iak.ngo (or your-server-ip → nginx → ait-frontend)
- LMS Admin: http://lms.iak.ngo (or your-server-ip → nginx → lms-frontend)
- API: http://your-server-ip:8000 (api-gateway directly)

## Troubleshooting

### Check Service Health
``````bash
docker compose ps
docker compose logs service-name
``````

### Restart Services
``````bash
docker compose restart service-name
# or restart all
docker compose restart
``````

### Database Migrations
``````bash
docker exec course-service python manage.py migrate
docker exec auth-service python manage.py migrate
``````

## Backup & Restore

### Backup Database
``````bash
docker exec postgres-main pg_dump -U lms_user course_db > backup_course.sql
docker exec postgres-main pg_dump -U lms_user auth_db > backup_auth.sql
docker exec postgres-main pg_dump -U lms_user admission_db > backup_admission.sql
``````

### Restore Database
``````bash
cat backup_course.sql | docker exec -i postgres-main psql -U lms_user course_db
``````

## Support
For issues, check logs and ensure all environment variables are correctly set.
"@

Set-Content -Path "$deploymentDir\DEPLOYMENT_GUIDE.md" -Value $readmeContent
Write-Host "Done: Deployment documentation created" -ForegroundColor Green
Write-Host ""

# Step 5: Create archive
Write-Host "[5/5] Creating deployment archive..." -ForegroundColor Yellow
$archivePath = "D:\AIT-LMS-DEPLOYMENT.zip"
if (Test-Path $archivePath) {
    Remove-Item -Path $archivePath -Force
}

Compress-Archive -Path "$deploymentDir\*" -DestinationPath $archivePath -CompressionLevel Optimal
$archiveSize = [math]::Round((Get-Item $archivePath).Length / 1MB, 2)
Write-Host "Done: Deployment archive created ($archiveSize MB)" -ForegroundColor Green
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Deployment Preparation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Deployment Package Location:" -ForegroundColor Yellow
Write-Host "  $archivePath" -ForegroundColor White
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Upload AIT-LMS-DEPLOYMENT.zip to your server" -ForegroundColor White
Write-Host "  2. Extract the archive" -ForegroundColor White
Write-Host "  3. Run: docker compose up -d --build" -ForegroundColor White
Write-Host "  4. Follow DEPLOYMENT_GUIDE.md for details" -ForegroundColor White
Write-Host ""

Set-Location "D:\AIT-LMS"
