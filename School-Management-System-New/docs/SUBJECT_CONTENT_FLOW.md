# Subject & Content Management — Complete Workflow

> **Sequence:** Coordinator → Admin assigns subjects to teachers → Teacher creates content & assignments → Student views content & submits assignments

---

## Actors & Roles

| Role | Kya karta hai |
|---|---|
| `org_admin` / `principal` | Subjects banata hai, teachers ko assign karta hai |
| `coordinator` | Timetable banata hai (timetable-service), jis se subjects + teachers link hote hain |
| `teacher` | Apni assigned subjects ka content aur assignments banata hai |
| `student` | Content dekhta hai, assignments submit karta hai |

---

## Step-by-Step Flow

### Phase 1 — Coordinator: Timetable Setup

**Service:** `timetable-service` (Port 8009)  
**Frontend:** `/admin/coordinator/time-table`

Coordinator timetable mein yeh set karta hai:
- Classroom (e.g. Grade 7-A)
- Subject (e.g. Mathematics)
- Teacher (e.g. Mr. Ahmad)
- Day + Time slot

```
ClassTimeTable
  ├── classroom_id  → Grade 7-A
  ├── subject       → Mathematics
  ├── teacher_id    → Mr. Ahmad
  ├── day           → Monday
  ├── start_time    → 08:00
  └── end_time      → 08:45
```

> Timetable se yeh clear hota hai: **kaun si class mein kaun sa subject kaun teacher padhata hai.**

---

### Phase 2 — Admin: Subject-Teacher Assignment

**Service:** `subject-service` (Port 8012)  
**Frontend:** `/admin/subjects/teacher-assign`  
**API:** `POST /api/subjects/subject-teacher-assignments/`

Admin ya coordinator timetable dekh ke subject-service mein formal assignment karta hai:

```json
{
  "subject": 3,
  "teacher_id": 12,
  "teacher_name": "Mr. Ahmad",
  "classroom_id": 7,
  "classroom_label": "Grade 7-A",
  "academic_year": "2025-2026",
  "is_active": true
}
```

**Kyun yeh step alag hai timetable se?**

Timetable schedule batata hai (kab, kahan). Subject assignment batata hai (permanently koun sa teacher, koun sa subject padhata hai). Ye subject-service mein store hota hai taake teacher apni subjects dekh sake aur content bana sake.

---

### Phase 3 — Admin: Subject Create Karo

**Service:** `subject-service`  
**Frontend:** `/admin/subjects`  
**API:** `GET/POST /api/subjects/subjects/`

Subjects school level par create hoti hain:

```
Subject
  ├── name          → "Mathematics"
  ├── subject_code  → "MATH-7"
  ├── grade_id      → 7  (Grade 7)
  ├── campus_id     → 2
  └── organization  → (auto from JWT)
```

**Subject banane ke baad usse teacher ko assign karo (Phase 2).**

---

### Phase 4 — Teacher: My Subjects Dekho

**Service:** `subject-service`  
**Frontend:** `/teacher/subjects`  
**API:** `GET /api/subjects/my-subjects/`

Subject-service teacher ka `user.id` JWT se nikalta hai aur sirf uski assigned subjects return karta hai:

```python
assignments = SubjectTeacherAssignment.objects.filter(
    teacher_id=user.id, is_active=True
)
```

Teacher yahan dekhta hai: Mathematics (Grade 7-A), Science (Grade 8-B), etc.

---

### Phase 5 — Teacher: Content Banao

**Service:** `content-service` (Port 8013)  
**Frontend:** `/teacher/subjects/[id]/content`

Content 3-level hierarchy mein hota hai:

```
Subject  (subject-service mein stored)
  └── Module  (content-service)          ← e.g. "Chapter 1: Algebra"
        └── Lesson  (content-service)    ← e.g. "Lesson 1.1: Variables"
              └── ContentItem            ← Actual content
                    ├── type: "video"    → YouTube link / upload
                    ├── type: "pdf"      → PDF file
                    └── type: "text"     → Rich text / notes
```

**APIs:**
```
POST /api/content/modules/       → Module banao
POST /api/content/lessons/       → Lesson banao (module ke andar)
POST /api/content/items/         → Item upload karo (lesson ke andar)
```

---

### Phase 6 — Teacher: Assignment Banao

**Service:** `subject-service`  
**Frontend:** `/teacher/assignments/create`  
**API:** `POST /api/assignments/`

```json
{
  "title": "Chapter 1 Homework",
  "subject": 3,
  "classroom_id": 7,
  "due_date": "2026-05-30",
  "instructions": "Solve Q1 to Q10 from textbook",
  "max_marks": 20
}
```

---

### Phase 7 — Teacher: Submissions Grade Karo

**Frontend:** `/teacher/assignments/[id]`  
**API:**
```
GET  /api/assignments/{id}/submissions/              → Saari submissions dekho
POST /api/assignments/{id}/submissions/{sub_id}/grade/  → Grade do
```

```json
{
  "marks_obtained": 18,
  "feedback": "Good work, neat solution"
}
```

---

### Phase 8 — Student: My Subjects Dekho

**Frontend:** `/student/subjects`  
**API:** `GET /api/subjects/my-subjects/?classroom_id=7`

Subject-service student ke `classroom_id` se filter karta hai:

```python
assignments = SubjectTeacherAssignment.objects.filter(
    classroom_id=classroom_id, is_active=True
)
```

Student sirf wo subjects dekhta hai jo uski class mein assign hain.

---

### Phase 9 — Student: Content Dekho

**Frontend:** `/student/subjects/[id]`  
**API:** `GET /api/content/modules/?subject_id=3`

Student modules → lessons → items dekh sakta hai.  
Video play hoti hai, PDF open hoti hai, text padha ja sakta hai.

---

### Phase 10 — Student: Assignment Submit Karo

**Frontend:** `/student/assignments/[id]`  
**API:** `POST /api/assignments/{id}/submit/`

```json
{
  "submission_text": "My answer is...",
  "file_url": "/media/submissions/hw1.pdf"
}
```

---

## Data Flow Summary

```
JWT Token
  ├── user_id
  ├── role          → "teacher" / "student" / "coordinator"
  ├── org_id        → School ka ID (multi-tenancy)
  └── campus_id     → Campus ka ID

Har queryset automatically filter hota hai:
  .filter(organization=request.org_id)
```

---

## API Quick Reference

| Action | Method | URL | Role |
|---|---|---|---|
| All subjects list | GET | `/api/subjects/subjects/` | admin |
| Create subject | POST | `/api/subjects/subjects/` | admin |
| My subjects | GET | `/api/subjects/my-subjects/` | teacher/student |
| Assign teacher | POST | `/api/subjects/subject-teacher-assignments/` | admin |
| All assignments | GET | `/api/assignments/` | teacher/student |
| Create assignment | POST | `/api/assignments/` | teacher |
| Submit assignment | POST | `/api/assignments/{id}/submit/` | student |
| Grade submission | POST | `/api/assignments/{id}/submissions/{sub}/grade/` | teacher |
| Create module | POST | `/api/content/modules/` | teacher |
| Create lesson | POST | `/api/content/lessons/` | teacher |
| Create content item | POST | `/api/content/items/` | teacher |

---

## Services Used

```
┌─────────────────────────────────────────────────────┐
│                     Frontend                        │
│              (Next.js :3000 via nginx)              │
└──────────┬───────────────┬──────────────────────────┘
           │               │
    ┌──────▼──────┐  ┌──────▼──────┐
    │   subject-  │  │  content-   │
    │   service   │  │   service   │
    │  Port 8012  │  │  Port 8013  │
    │             │  │             │
    │ - subjects  │  │ - modules   │
    │ - assign-   │  │ - lessons   │
    │   ments     │  │ - items     │
    └──────┬──────┘  └──────┬──────┘
           │                │
    ┌──────▼────────────────▼──────┐
    │         PostgreSQL DBs       │
    │  subject_db  |  content_db   │
    └──────────────────────────────┘
```

---

## Correct Sequence (Ek Baar)

```
1. Admin/Coordinator → Timetable banao     (timetable-service)
2. Admin             → Subjects banao      (subject-service)
3. Admin             → Teacher assign karo  (subject-service)
       ↓
4. Teacher           → Content banao       (content-service)
5. Teacher           → Assignments banao   (subject-service)
       ↓
6. Student           → Content dekho       (content-service)
7. Student           → Assignment submit   (subject-service)
       ↓
8. Teacher           → Grade karo          (subject-service)
```
