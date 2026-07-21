# Al Khair IT Institute - Learning Management System

A comprehensive Learning Management System built with microservices architecture using Django (Backend) and Next.js (Frontend). This system manages the complete student lifecycle from admission to certification.

## 📋 Table of Contents

- [System Overview](#system-overview)
- [Architecture](#architecture)
- [Services](#services)
- [Getting Started](#getting-started)
- [Student Registration Flow](#student-registration-flow)
- [Admin Operations](#admin-operations)
- [Development](#development)
- [API Documentation](#api-documentation)

---

## 🎯 System Overview

The AIT-LMS is a complete educational platform that handles:

- **Student Admission**: Registration with entrance test or direct admission
- **Course Management**: Batches, Specializations, and Courses with multiple levels
- **Learning Management**: Assignments, Attendance, Scheduled Classes
- **Certification**: Automated certificate generation
- **Notifications**: Broadcast and targeted messaging
- **Content Delivery**: Course materials and resources

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     FRONTEND LAYER                          │
├─────────────────────────────────────────────────────────────┤
│  ait_fe (Port 3000)          │  lms_fe (Port 3001)         │
│  - Public Website             │  - Student/Teacher Dashboard│
│  - Course Catalog             │  - Course Content           │
│  - Registration               │  - Assignments              │
│  - Entrance Test              │  - Attendance               │
└──────────────┬────────────────┴──────────────┬──────────────┘
               │                               │
               └───────────┬───────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│              API GATEWAY (Port 8000)                        │
│  - Single entry point for all services                     │
│  - Request routing and load balancing                      │
└──────────────┬──────────────────────────────────────────────┘
               │
    ┌──────────┼──────────┬──────────┬──────────┬──────────┐
    │          │          │          │          │          │
┌───▼───┐  ┌──▼───┐  ┌───▼───┐  ┌──▼───┐  ┌───▼───┐  ┌───▼───┐
│ Auth  │  │Course│  │Admiss-│  │Notif │  │ Cert  │  │Content│
│Service│  │Service│  │ion    │  │Service│  │Service│  │Service│
│:8001  │  │:8002 │  │Service│  │:8004 │  │:8005  │  │:8006  │
│       │  │      │  │:8003  │  │      │  │       │  │       │
└───┬───┘  └──┬───┘  └───┬───┘  └──┬───┘  └───┬───┘  └───┬───┘
    │         │          │         │          │          │
    └─────────┴──────────┴─────────┴──────────┴──────────┘
                           │
                    ┌──────▼──────┐
                    │  PostgreSQL │
                    │  Database   │
                    └─────────────┘
```

---

## 🔧 Services

### 1. **Auth Service** (Port 8001)
**Purpose**: User authentication and authorization

**Features**:
- JWT-based authentication
- Role-based access control (Student, Teacher, Coordinator, Admin)
- User profile management
- Password reset functionality
- Receipt code verification for student registration

**Key Endpoints**:
- `POST /api/auth/login` - User login
- `POST /api/auth/students/verify-receipt-code/` - Verify deposit and create LMS account
- `GET /api/auth/me/` - Get current user profile
- `GET /api/auth/users/` - List all users (admin)

### 2. **Course Service** (Port 8002)
**Purpose**: Course and academic management

**Features**:
- Batch and Specialization management
- Course creation with levels (Beginner, Advanced)
- Student enrollment
- Assignment creation and submission
- Attendance tracking
- Scheduled classes management

**Key Endpoints**:
- `GET /api/courses/batches/all` - List all batches
- `GET /api/courses/specialization/all` - List specializations
- `GET /api/courses/course/all` - List all courses
- `POST /api/courses/enrollments/` - Enroll student
- `GET /api/courses/scheduled-classes/` - Get class schedule
- `POST /api/courses/attendance/mark/` - Mark attendance

### 3. **Admission Service** (Port 8003)
**Purpose**: Student admission and entrance testing

**Features**:
- Lead generation and tracking
- Entrance test management
- Test question and option management
- Automatic test evaluation
- Direct admission support (courses without tests)
- Resume registration for returning students

**Key Endpoints**:
- `POST /api/admission/lead/` - Create admission lead
- `GET /api/admission/entrance-test/{lead_id}/` - Get test questions
- `POST /api/admission/entrance-test/{lead_id}/submit/` - Submit test
- `POST /api/admission/lead/lookup/` - Resume registration by email
- `POST /api/admission/check-requirement/` - Check if test is required

### 4. **Notification Service** (Port 8004)
**Purpose**: Communication and notifications

**Features**:
- Broadcast notifications to all users
- Role-based notifications (Students, Teachers, etc.)
- Course-specific notifications
- Individual user notifications
- Read/unread status tracking

**Key Endpoints**:
- `POST /api/notifications/broadcasts/` - Create broadcast
- `GET /api/notifications/deliveries/` - Get user notifications
- `POST /api/notifications/deliveries/{id}/mark_read/` - Mark as read

### 5. **Certification Service** (Port 8005)
**Purpose**: Certificate generation and management

**Features**:
- Automated certificate generation
- Template-based certificate design
- Certificate verification
- Certificate history tracking

**Key Endpoints**:
- `POST /api/certifications/` - Generate certificate
- `GET /api/certifications/{id}/` - Get certificate details
- `GET /api/certifications/verify/{code}/` - Verify certificate

### 6. **Content Service** (Port 8006)
**Purpose**: Course content delivery

**Features**:
- Course material upload
- File management
- Content organization by course

**Key Endpoints**:
- `POST /api/content/` - Upload content
- `GET /api/content/?course_id={id}` - Get course content
- `DELETE /api/content/{id}/` - Delete content

---

## 🚀 Getting Started

### Prerequisites

- **Python 3.11+**
- **Node.js 18+**
- **PostgreSQL 14+**
- **Git**

### Installation Steps

#### 1. Clone the Repository

```bash
git clone <repository-url>
cd AIT-LMS
```

#### 2. Backend Setup (Microservices)

```bash
cd lms-microservices
```

**For each service** (auth, course, admission, notification, certification, content):

```bash
cd services/auth-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

**Create `.env` file** in each service directory:

```env
SECRET_KEY=your-secret-key-here
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
DATABASE_URL=postgresql://user:password@localhost:5432/ait_lms
JWT_SECRET_KEY=your-jwt-secret
```

**Run migrations**:

```bash
python manage.py migrate
```

**Create superuser** (for admin access):

```bash
python manage.py createsuperuser
```

**Start the service**:

```bash
python manage.py runserver 8001  # Port varies per service
```

Repeat for all services with their respective ports:
- Auth: 8001
- Course: 8002
- Admission: 8003
- Notification: 8004
- Certification: 8005
- Content: 8006

#### 3. Frontend Setup

**Public Website (ait_fe)**:

```bash
cd ait_fe
npm install
npm run dev  # Runs on port 3000
```

**LMS Dashboard (lms_fe)**:

```bash
cd lms_fe
npm install
npm run dev  # Runs on port 3001
```

#### 4. Access the System

- **Public Website**: http://localhost:3000
- **LMS Dashboard**: http://localhost:3001
- **Admin Panels**:
  - Auth: http://localhost:8001/admin
  - Course: http://localhost:8002/admin
  - Admission: http://localhost:8003/admin

---

## 📝 Student Registration Flow

### Option 1: Registration with Entrance Test

1. **Student visits**: http://localhost:3000/register
2. **Fills basic info**: Name, Email, Phone, Course Selection
3. **System creates lead** and redirects to entrance test
4. **Student takes test**: Multiple choice questions (10 minutes)
5. **Test auto-evaluated**: Pass/Fail based on passing marks
6. **If passed**: Student receives instructions to pay deposit
7. **Student pays deposit** at office and receives **Receipt Code**
8. **Student enters Receipt Code** on registration page
9. **System verifies code** and creates LMS account
10. **Student redirected** to LMS Dashboard (port 3001)

### Option 2: Direct Admission (No Test Required)

1. **Student visits**: http://localhost:3000/register
2. **Fills basic info**: Name, Email, Phone, Course Selection
3. **System detects** no test required for selected course
4. **Directly shows** payment instructions and receipt code form
5. **Student pays deposit** and enters Receipt Code
6. **Account created** and redirected to LMS

### Resume Registration Feature

If student leaves after passing test:

1. Click **"Already passed the test? Resume Registration"**
2. Enter registered email
3. System finds their lead and jumps to receipt code entry
4. Complete registration without retaking test

---

## 👨‍💼 Admin Operations

### Managing Courses

1. **Login to Course Service Admin**: http://localhost:8002/admin
2. **Create Batch**: e.g., "Batch 1", "Batch 2"
3. **Create Specialization**: e.g., "AI & Robotics", link to batch
4. **Create Courses**: 
   - Select specialization
   - Set level (Beginner or Advanced)
   - Set duration (months)
   - Upload course image

### Managing Entrance Tests

1. **Login to Admission Service Admin**: http://localhost:8003/admin
2. **Create Test**:
   - Link to course
   - Set passing marks
   - Set duration (minutes)
   - Mark as "Required" or not
3. **Add Questions**:
   - Write question text
   - Add 4 options
   - Mark correct option
   - Set difficulty and marks

### Managing Receipt Codes

1. **Login to Auth Service Admin**: http://localhost:8001/admin
2. **Go to Receipt Codes**
3. **Create new code**:
   - Enter unique code (e.g., "AIT2024001")
   - Set amount
   - Link to course (optional)
   - Mark as active
4. **Give code to student** after payment verification

### Managing Enrollments

1. **Login to LMS Dashboard**: http://localhost:3001
2. **Admin → Enrollments**
3. **View/Edit/Delete** student enrollments
4. **Manually enroll** students if needed

---

## 💻 Development

### Project Structure

```
AIT-LMS/
├── lms-microservices/
│   ├── services/
│   │   ├── auth-service/
│   │   ├── course-service/
│   │   ├── admission-service/
│   │   ├── notification-service/
│   │   ├── certification-service/
│   │   └── content-service/
│   └── api-gateway/
├── ait_fe/                    # Public website (Next.js)
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── courses/
│   │   │   ├── register/
│   │   │   └── test/
│   │   └── api/
│   └── components/
└── lms_fe/                    # LMS Dashboard (Next.js)
    ├── app/
    │   └── (dashboard)/
    │       ├── admin/
    │       ├── student/
    │       └── teacher/
    └── lib/
```

### Running All Services

**Backend** (Run each in separate terminal):

```bash
# Terminal 1 - Auth Service
cd lms-microservices/services/auth-service
python manage.py runserver 8001

# Terminal 2 - Course Service
cd lms-microservices/services/course-service
python manage.py runserver 8002

# Terminal 3 - Admission Service
cd lms-microservices/services/admission-service
python manage.py runserver 8003

# Terminal 4 - Notification Service
cd lms-microservices/services/notification-service
python manage.py runserver 8004

# Terminal 5 - Certification Service
cd lms-microservices/services/certification-service
python manage.py runserver 8005

# Terminal 6 - Content Service
cd lms-microservices/services/content-service
python manage.py runserver 8006
```

**Frontend**:

```bash
# Terminal 7 - Public Website
cd ait_fe
npm run dev

# Terminal 8 - LMS Dashboard
cd lms_fe
npm run dev
```

### Common Commands

**Create migrations**:
```bash
python manage.py makemigrations
```

**Apply migrations**:
```bash
python manage.py migrate
```

**Create admin user**:
```bash
python manage.py createsuperuser
```

**Collect static files**:
```bash
python manage.py collectstatic
```

**Run tests**:
```bash
pytest
```

---

## 📚 API Documentation

### Authentication

All protected endpoints require JWT token in header:

```bash
Authorization: Bearer <your-token>
```

### Example: Complete Registration Flow

**Step 1: Create Lead**

```bash
curl -X POST http://localhost:8003/api/admission/lead/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "1234567890",
    "course_id": "course-uuid-here"
  }'
```

**Step 2: Get Test Questions**

```bash
curl http://localhost:8003/api/admission/entrance-test/{lead_id}/
```

**Step 3: Submit Test**

```bash
curl -X POST http://localhost:8003/api/admission/entrance-test/{lead_id}/submit/ \
  -H "Content-Type: application/json" \
  -d '{
    "question_attempts": [
      {
        "question_id": "q1-uuid",
        "selected_option": "option-uuid",
        "is_correct": true
      }
    ]
  }'
```

**Step 4: Verify Receipt and Create Account**

```bash
curl -X POST http://localhost:8001/api/auth/students/verify-receipt-code/ \
  -H "Content-Type: application/json" \
  -d '{
    "receipt_code": "AIT2024001",
    "email": "john@example.com",
    "full_name": "John Doe",
    "phone": "1234567890",
    "cnic": "1234567890123",
    "password": "SecurePass123",
    "date_of_birth": "2000-01-01"
  }'
```

---

## 🔐 Security Features

- JWT-based authentication
- Role-based access control
- Password hashing with Django's built-in system
- Receipt code verification for enrollment
- CORS configuration for frontend access
- Environment-based secret management

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Check PostgreSQL is running
sudo systemctl status postgresql

# Reset database
python manage.py flush
python manage.py migrate
```

### Port Already in Use

```bash
# Find process using port
lsof -i :8001  # On Mac/Linux
netstat -ano | findstr :8001  # On Windows

# Kill process
kill -9 <PID>
```

### Frontend Build Errors

```bash
# Clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

---

## 📄 License

[Your License Here]

## 👥 Contributors

- [Your Team Members]

## 📞 Support

For issues and questions:
- Email: support@alkhairitinstitute.com
- GitHub Issues: [Repository Issues]

---

**Last Updated**: January 2026
