# LMS Microservices Architecture

## Overview

This is a microservices-based Learning Management System (LMS) built with Django and Next.js. The system follows a profile-first architecture where profiles auto-create users.

## System Architecture

```
┌─────────────────┐
│   Frontend      │
│  (Next.js)      │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  API Gateway    │
│   (FastAPI)     │
└────────┬────────┘
         │
    ┌────┴────┬──────────┬──────────────┐
    ▼         ▼          ▼              ▼
┌────────┐ ┌────────┐ ┌──────────┐  ┌──────────┐
│  Auth  │ │ Course │ │Notification│ │Certification│
│Service │ │Service │ │  Service  │  │  Service   │
└────────┘ └────────┘ └──────────┘  └──────────┘
    │         │
    ▼         ▼
┌────────┐ ┌────────┐
│Postgres│ │Postgres│
│ (Auth) │ │(Course)│
└────────┘ └────────┘
```

## Services

### Auth Service (Port 8001)
- **Purpose**: User authentication and profile management
- **Database**: PostgreSQL (auth_db)
- **Key Features**:
  - JWT token generation
  - Profile-first architecture (StudentProfile, TeacherProfile, CoordinatorProfile, AdminProfile)
  - User registration and login
  - Role-based access control

### Course Service (Port 8002)
- **Purpose**: Course and enrollment management
- **Database**: PostgreSQL (course_db)
- **Key Features**:
  - Course CRUD operations
  - Student enrollment
  - Assignment management
  - Attendance tracking
  - Scheduled classes

### Notification Service (Port 8003)
- **Purpose**: Notification management
- **Database**: PostgreSQL (notification_db)
- **Key Features**:
  - Broadcast-first model (`NotificationBroadcast`) plus fan-out deliveries (`NotificationDelivery`)
  - Supports global, role-based, course-specific, class-specific, and custom audiences
  - Integrates with auth-service for user resolution and course-service for enrollments/classes
  - REST APIs exposed via the API Gateway (`/api/notifications/...`)
  - JWT-protected endpoints with per-user delivery feeds and read-tracking

### Certification Service (Port 8004)
- **Purpose**: Certificate generation and management
- **Database**: PostgreSQL (certification_db)

## API Gateway (Port 8000)
- **Purpose**: Single entry point for all services
- **Technology**: FastAPI
- **Features**:
  - Request routing
  - JWT validation
  - Rate limiting
  - CORS handling

## Database Architecture

### Profile-First Architecture
- Profiles (StudentProfile, TeacherProfile, etc.) are created first
- Django signals automatically create User objects
- User.role is dynamically determined from linked profile

### Service Databases
Each service has its own PostgreSQL database:
- `auth_db` - User and profile data
- `course_db` - Courses, enrollments, assignments
- `notification_db` - Notifications
- `certification_db` - Certificates

## Communication Patterns

### Inter-Service Communication
- HTTP REST APIs
- ServiceClient wrapper with retry logic
- Circuit breaker pattern (planned)

### Authentication Flow
1. User logs in via Auth Service
2. Auth Service returns JWT token
3. Frontend includes token in Authorization header
4. API Gateway validates token
5. Services receive validated user info

## Technology Stack

### Backend
- Django 5.0.6
- Django REST Framework 3.14.0
- PostgreSQL 15
- Redis (caching)
- RabbitMQ (message queue)

### Frontend
- Next.js 14
- TypeScript
- Tailwind CSS
- React Hook Form

### Infrastructure
- Docker & Docker Compose
- Nginx (planned)
- Kubernetes (planned)

## Security

- JWT-based authentication
- Environment variable configuration
- Input validation
- SQL injection prevention (Django ORM)
- CORS configuration
- Rate limiting (planned)

## Deployment

Services are containerized using Docker and orchestrated with Docker Compose. Each service runs in its own container with:
- Health check endpoints
- Logging to files
- Environment-based configuration

## Development Guidelines

1. **Service Layer Pattern**: Business logic in services, not views
2. **Error Handling**: Use custom exceptions and global handlers
3. **Logging**: Use structured logging with correlation IDs
4. **Testing**: Unit tests for services, integration tests for views
5. **API Versioning**: Use `/api/v1/` prefix for new APIs


