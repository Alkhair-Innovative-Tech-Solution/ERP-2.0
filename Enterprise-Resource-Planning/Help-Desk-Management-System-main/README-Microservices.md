# HDMS Microservices - Quick Start Guide

## **Prerequisites**
- Docker and Docker Compose installed
- Git

## **Quick Start**

### **1. Clone Repository**
```bash
git clone <repository-url>
cd HDMS
```

### **2. Start All Services**
```bash
docker-compose up
```

This will start:
- PostgreSQL database
- Redis
- User Service (port 8001)
- Ticket Service (port 8002)
- Communication Service (port 8003, WebSocket 8004)
- File Service (port 8005)
- Frontend Service (port 3000)
- Nginx API Gateway (port 80)
- Celery Worker

### **3. Access Services**
- **Frontend:** http://localhost
- **API Gateway:** http://localhost/api/v1/
- **WebSocket:** ws://localhost/ws/

### **4. Stop Services**
```bash
docker-compose down
```

## **Development Mode**

For hot reload and development:
```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

## **Service URLs (Internal)**
- User Service: http://user-service:8001
- Ticket Service: http://ticket-service:8002
- Communication Service: http://communication-service:8003
- File Service: http://file-service:8005

## **Database Migrations**

Run migrations for each service:
```bash
# User Service
docker-compose exec user-service python manage.py migrate

# Ticket Service
docker-compose exec ticket-service python manage.py migrate

# Communication Service
docker-compose exec communication-service python manage.py migrate

# File Service
docker-compose exec file-service python manage.py migrate
```

## **View Logs**
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f user-service
```

## **Documentation**
- [Microservices Architecture](12-Microservices-Architecture.md)
- [Database Migration Strategy](13-Database-Migration-Strategy.md)
- [Technical Architecture](03-Technical-Architecture.md)


