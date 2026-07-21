# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- PostgreSQL 15+ (if not using Docker)
- Redis (if not using Docker)
- Python 3.11+ (for local development)

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd lms-microservices
```

### 2. Configure Environment Variables

Create `.env` files for each service (see `.env.example` files):

**Auth Service** (`services/auth-service/.env`):
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,api-gateway
JWT_SECRET_KEY=your-jwt-secret-key-here
DB_NAME=auth_db
DB_USER=lms_user
DB_PASSWORD=lms_password
DB_HOST=postgres-auth
DB_PORT=5432
REDIS_URL=redis://redis:6379/1
```

**Course Service** (`services/course-service/.env`):
```env
SECRET_KEY=your-secret-key-here
DEBUG=False
ALLOWED_HOSTS=localhost,127.0.0.1,api-gateway
JWT_SECRET_KEY=your-jwt-secret-key-here
DB_NAME=course_db
DB_USER=lms_user
DB_PASSWORD=lms_password
DB_HOST=postgres-course
DB_PORT=5432
AUTH_SERVICE_URL=http://auth-service:8001
REDIS_URL=redis://redis:6379/2
```

### 3. Start Services

```bash
docker compose up -d
```

This will start:
- All PostgreSQL databases
- Redis
- RabbitMQ
- API Gateway
- Auth Service
- Course Service
- Notification Service
- Certification Service

### 4. Run Migrations

```bash
# Auth Service
docker compose exec auth-service python manage.py migrate

# Course Service
docker compose exec course-service python manage.py migrate

# Other services...
```

### 5. Create Superuser (Optional)

```bash
docker compose exec auth-service python manage.py createsuperuser
```

## Development Setup

### 1. Install Dependencies

```bash
# Auth Service
cd services/auth-service
pip install -r requirements.txt
pip install -r requirements-dev.txt

# Course Service
cd services/course-service
pip install -r requirements.txt
pip install -r requirements-dev.txt
```

### 2. Run Tests

```bash
# Auth Service
cd services/auth-service
pytest

# Course Service
cd services/course-service
pytest
```

### 3. Run Services Locally

```bash
# Auth Service
cd services/auth-service
python manage.py runserver 8001

# Course Service
cd services/course-service
python manage.py runserver 8002
```

## Production Deployment

### 1. Security Checklist

- [ ] Change all default secrets
- [ ] Set `DEBUG=False`
- [ ] Configure `ALLOWED_HOSTS` properly
- [ ] Use HTTPS
- [ ] Set up proper CORS origins
- [ ] Configure database backups
- [ ] Set up monitoring and logging

### 2. Docker Production Build

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### 3. Database Backups

Set up automated backups for all PostgreSQL databases:

```bash
# Example backup script
pg_dump -h postgres-auth -U lms_user auth_db > backup_$(date +%Y%m%d).sql
```

### 4. Monitoring

- Set up health check monitoring
- Configure log aggregation
- Set up error tracking (Sentry, etc.)
- Monitor service metrics

## Troubleshooting

### Services Not Starting

1. Check logs: `docker compose logs <service-name>`
2. Verify environment variables
3. Check database connectivity
4. Verify ports are not in use

### Database Connection Issues

1. Verify database is running: `docker compose ps`
2. Check connection string in environment variables
3. Verify network connectivity between services

### Migration Issues

1. Check migration files: `python manage.py showmigrations`
2. Reset if needed: `python manage.py migrate --fake-initial`
3. Check for conflicting migrations

## Scaling

### Horizontal Scaling

Services can be scaled horizontally:

```bash
docker compose up -d --scale auth-service=3 --scale course-service=2
```

### Load Balancing

Use a load balancer (Nginx, HAProxy) in front of services for production.

## Maintenance

### Log Rotation

Logs are automatically rotated (10MB files, 5 backups) by the logging configuration.

### Database Maintenance

Regular maintenance tasks:
- Vacuum databases
- Analyze tables
- Check for long-running queries
- Monitor database size


