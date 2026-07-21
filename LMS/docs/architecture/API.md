# LMS API Documentation

## Base URLs

- **API Gateway**: `http://localhost:8000`
- **Auth Service**: `http://localhost:8001`
- **Course Service**: `http://localhost:8002`

## Authentication

All authenticated endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <access_token>
```

## API Versioning

- **v1**: `/api/v1/` - Current stable version
- **Legacy**: `/api/` - Backward compatibility (deprecated)

## Auth Service Endpoints

### POST /api/v1/auth/register/
Register a new student.

**Request Body:**
```json
{
  "username": "student1",
  "email": "student1@example.com",
  "password": "TestPass123!",
  "first_name": "John",
  "last_name": "Doe"
}
```

**Response (201):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "username": "student1",
    "email": "student1@example.com",
    "first_name": "John",
    "last_name": "Doe",
    "role": "STUDENT"
  }
}
```

### POST /api/v1/auth/login/
Login with username/email and password.

**Request Body:**
```json
{
  "username": "student1",
  "password": "TestPass123!"
}
```

**Response (200):**
```json
{
  "access_token": "eyJ...",
  "refresh_token": "eyJ...",
  "token_type": "Bearer",
  "user": {
    "id": 1,
    "username": "student1",
    "email": "student1@example.com",
    "role": "STUDENT"
  }
}
```

### GET /api/v1/auth/user/
Get current authenticated user.

**Headers:**
```
Authorization: Bearer <token>
```

**Response (200):**
```json
{
  "id": 1,
  "username": "student1",
  "email": "student1@example.com",
  "first_name": "John",
  "last_name": "Doe",
  "role": "STUDENT"
}
```

### POST /api/v1/auth/coordinator/users/
Create a new user (Coordinator/Admin only).

**Request Body:**
```json
{
  "username": "teacher1",
  "email": "teacher1@example.com",
  "password": "TestPass123!",
  "first_name": "Jane",
  "last_name": "Smith",
  "role": "TEACHER",
  "department": "Computer Science",
  "designation": "Professor"
}
```

**Roles:** `STUDENT`, `TEACHER`, `COORDINATOR`, `ADMIN`

## Course Service Endpoints

### GET /api/v1/courses/courses/
Get all courses (paginated).

**Query Parameters:**
- `page`: Page number (default: 1)
- `instructor_id`: Filter by instructor
- `category`: Filter by category
- `level`: Filter by level

**Response (200):**
```json
{
  "count": 10,
  "next": null,
  "previous": null,
  "results": [
    {
      "id": "uuid",
      "course_code": "CS101",
      "title": "Introduction to CS",
      "description": "...",
      "category": "tech",
      "level": "BEGINNER"
    }
  ]
}
```

### POST /api/v1/courses/enrollments/
Enroll in a course.

**Request Body:**
```json
{
  "course": "course-uuid"
}
```

**Response (201):**
```json
{
  "id": "uuid",
  "course": {...},
  "student_id": 1,
  "is_active": true,
  "completion_status": "IN_PROGRESS"
}
```

### GET /api/v1/courses/enrollments/?student_id=1
Get enrollments for a student.

## Notification Service Endpoints

### GET /api/v1/notifications/broadcasts/
List notification broadcasts (requires admin/coordinator/teacher token).

**Response (200):**
```json
[
  {
    "id": "uuid",
    "title": "Midterm Reminder",
    "message": "Midterm exam scheduled for Friday.",
    "audience_type": "COURSE",
    "target_role": "STUDENT",
    "course_id": "course-uuid",
    "delivery_count": 30,
    "created_at": "2025-01-01T10:00:00Z"
  }
]
```

### POST /api/v1/notifications/broadcasts/
Create a new broadcast.

**Request Body:**
```json
{
  "title": "Class cancelled",
  "message": "Today's 10am class is cancelled.",
  "audience_type": "CLASS",
  "target_role": "STUDENT",
  "scheduled_class_id": "class-uuid"
}
```

### GET /api/v1/notifications/deliveries/
List deliveries for the authenticated user (teacher/student/admin).

### POST /api/v1/notifications/deliveries/{id}/mark_read/
Mark an individual delivery as read/unread.

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message",
  "status_code": 400,
  "errors": {
    "field_name": ["Error detail"]
  }
}
```

### Status Codes

- `200` - Success
- `201` - Created
- `400` - Bad Request
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Not Found
- `409` - Conflict
- `500` - Internal Server Error
- `503` - Service Unavailable

## Health Checks

### GET /health/
Check service health.

**Response (200):**
```json
{
  "status": "healthy",
  "service": "auth-service",
  "version": "1.0.0",
  "checks": {
    "database": "healthy",
    "cache": "healthy"
  }
}
```


