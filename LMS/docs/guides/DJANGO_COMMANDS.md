# Django Management Commands - Quick Reference

## Creating Superusers

### Auth Service
```bash
docker exec -it auth-service python manage.py createsuperuser
```

### Notification Service
```bash
docker exec -it notification-service python manage.py createsuperuser
```

### Course Service 
```bash
docker exec -it course-service python manage.py createsuperuser
```

### Certification Service
```bash
docker exec -it certification-service python manage.py createsuperuser
```

### Admission Service
```bash
docker exec -it admission-service python manage.py createsuperuser
```


### Content Service
```bash
docker exec -it content-service python manage.py createsuperuser
```
## Database Migrations

### Run Migrations
```bash
# For a specific service
docker exec <service-name> python manage.py migrate

# Examples:
docker exec auth-service python manage.py migrate
docker exec course-service python manage.py migrate
```

### Create Migrations
```bash
docker exec <service-name> python manage.py makemigrations
```

### Show Migration Status
```bash
docker exec <service-name> python manage.py showmigrations
```

## Shell Access

### Django Shell
```bash
docker exec -it <service-name> python manage.py shell
```

### Database Shell
```bash
docker exec -it <service-name> python manage.py dbshell
```

## Other Useful Commands

### Collect Static Files
```bash
docker exec <service-name> python manage.py collectstatic --noinput
```

### Clear Cache
```bash
docker exec <service-name> python manage.py clear_cache
```

### Check for Issues
```bash
docker exec <service-name> python manage.py check
```

## Container Management

### Restart a Service
```bash
docker-compose restart <service-name>
```

### Rebuild a Service
```bash
docker-compose up -d --build <service-name>
```

### View Logs
```bash
docker logs <service-name>
docker logs <service-name> --tail 100
docker logs <service-name> -f  # Follow logs
```

### Execute Commands in Container
```bash
docker exec -it <service-name> bash
docker exec <service-name> <command>
```

## Service Names
- `auth-service`
- `course-service`
- `notification-service`
- `certification-service`
- `api-gateway`


## Data Seed Pipeline (CSV-based from Google Sheets)

Follow these steps in **exactly this order** to fully re-populate the LMS with data from CSV files exported from the master Google Sheet.

### Prerequisites

1. **Export CSVs from Google Sheets** (File → Download → Comma Separated Values (.csv)):
   - `Specializations and TimeTable` tab → save as `timetable.csv`
   - `Students` tab → save as `students.csv`
2. **Place CSVs in `scripts/data/`**

```bash
# Seed branches (run once, or when new branches are added)
docker exec auth-service python manage.py seed_branches

# Seed role permissions (run once)
docker exec auth-service python manage.py seed_role_permissions
```

### Seed Pipeline

```bash
# Step 0 — Copy CSV files into containers
docker cp scripts/data/timetable.csv auth-service:/app/seed_data/timetable.csv
docker cp scripts/data/timetable.csv course-service:/app/seed_data/timetable.csv
docker cp scripts/data/students.csv auth-service:/app/seed_data/students.csv

# Step 1 — Create teacher User accounts from timetable.csv
# Reads: Teacher + Ass. Teacher columns
# Creates: User(role='teacher') + Teacher profile + saves teacher_mapping.json
docker exec auth-service python seed_data/seed_teachers_from_sheet.py

# Step 2 — Build academic structure from timetable.csv
# Reads: Specialization, Code, Section, Days, Time, Durration, Description, Course Status, etc.
# Creates: Specialization → Course → ScheduledClass hierarchy
#   Populates Course fields: duration, description, admission_status from CSV
# Exports: course_mapping.json, section_mapping.json
docker exec course-service python seed_data/import_academic_structure.py

# Step 3 — (UNIFIED) Seed students AND leads from students.csv
# Students (DP=Y/YES/WAIVER + batch):
#   → Creates/updates User(role='student') + Student + GuardianInfo + ResidentialInfo + AcademicRecord
#   → Creates ReceiptCode with prefix p-{ID} (paid) or w-{ID} (waiver)
# Leads (no DP / DP=N / no batch):
#   → Creates User(role='lead', password='StudentAiT') if real email provided
#   → Creates EntranceLead via admission-service API
#   → No receipt code (no deposit)
# Exports: master_enrollment_mapping.json, enrollment_mapping.json
docker exec auth-service python seed_data/seed_from_master_sheet.py

# Step 4 — Ingest enrollments into course-service
# Reads master_enrollment_mapping.json → creates CourseRegistrationHistory + StudentDeposit
docker exec course-service python seed_data/ingest_enrollments.py
```

### Automated Pipeline (Recommended)

```bash
# One command does everything: copy CSVs → seed → ingest → verify
bash scripts/seed_all.sh
```

### Seed Output Files
| File | Created By | Consumed By |
|------|-----------|-------------|
| `teacher_mapping.json` | Step 1 (auth) | Step 2 (course) |
| `course_mapping.json` | Step 2 (course) | Step 3 (auth) |
| `section_mapping.json` | Step 2 (course) | (course internal) |
| `master_enrollment_mapping.json` | Step 3 (auth) | Step 4 (course) |
| `enrollment_mapping.json` | Step 3 (auth) | (legacy lead bridge) |

### Classification Logic (Step 3)

For each row in students.csv:

| DP Value | Has Batch? | Classification | Creates |
|----------|-----------|---------------|---------|
| `Y` / `YES` | Yes | **Student (paid)** | User(student) + Student + ReceiptCode `p-{ID}` |
| `WAIVER` / `W` | Yes | **Student (waiver)** | User(student) + Student + ReceiptCode `w-{ID}`, `is_waived=True` |
| (anything else) | No | **Lead** | User(lead) if real email + EntranceLead |

### Data Source Architecture

- `google_sheets_util.py` (in each service's `seed_data/`) — provides `read_csv_data(filepath)` to read local CSVs, plus `get_sheet_data()` for live API fallback
- Override CSV path via environment variables: `TIMETABLE_CSV`, `STUDENTS_CSV`
- `scripts/data_utils.py` — consolidated source-of-truth utility on the host