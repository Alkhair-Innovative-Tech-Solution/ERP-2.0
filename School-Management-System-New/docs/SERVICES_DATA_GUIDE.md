# Services Data Guide
> Har service mein kya kya dikhta / manage hota hai — quick reference

---

## 1. AUTH-SERVICE — Port 8001
**Admin:** `localhost:8001/sms-admin/`
**Zimmedari:** Login, JWT tokens, users, organizations, permissions

| Entity | Kya hai |
|---|---|
| **User** | System ke sare users (superadmin, admin, org_admin, principal, coordinator, teacher, student). `is_deleted`, `is_active`, `role`, `campus`, `organization` fields. |
| **Organization** | School/NGO organizations. `code_prefix`, `code_pattern`, `max_users`, `max_students`, `max_campuses`, `is_active`. |
| **SubscriptionPlan** | Organization ke subscription packages. `max_users`, `max_students`, `base_price`, `price_per_student`. |
| **RolePermission** | Role-wise granular permissions (40+ permissions). Per organization toggle. |
| **PasswordChangeOTP** | Login OTP records. |
| **GlobalCounter** | Employee code / student ID sequence counters. |

**Key APIs:**
- `POST /api/auth/login/` — login, JWT milta hai
- `GET /api/users/` — all users list
- `POST /api/internal/create-user/` — internal: doosri services se user banao
- `POST /api/internal/delete-user/` — internal: user + data delete karo

---

## 2. ORG-SERVICE — Port 8002
**Zimmedari:** Organization creation aur org-admin onboarding

| Entity | Kya hai |
|---|---|
| **Organization** | Org create/edit/delete (superadmin karta hai) |
| **User** | Org admin users |
| **SubscriptionPlan** | Plan assign karna to org |

> Note: Org-service auth-service ka mirror hai — org management ke waqt dono sync hote hain via `internal/sync-org/` API.

---

## 3. CAMPUS-SERVICE — Port 8003
**Admin:** `localhost:8003/sms-admin/`
**Zimmedari:** Campuses, levels, grades, classrooms structure

| Entity | Kya hai |
|---|---|
| **Campus** | School campuses. `campus_name`, `campus_code`, `shift_available` (morning/afternoon/both), `address`, `organization`. |
| **Level** | Academic levels (e.g. Pre-Primary, Primary, Secondary). `name`, `code`, `shift`, `campus`. |
| **Grade** | Classes within a level (e.g. Class 1, Class 2). `name`, `level`, `campus`. |
| **ClassRoom** | Sections within a grade (e.g. 1-A, 1-B). `grade`, `section`, `shift`, `capacity`, `class_teacher`, `code`. |

**Key APIs:**
- `GET /api/campuses/` — campus list (role-filtered: principal sirf apna campus dekhta hai)
- `GET /api/levels/` — levels list (campus filter)
- `GET /api/grades/` — grades list (level filter)
- `GET /api/classrooms/` — classroom list (grade/level filter)

---

## 4. STAFF-SERVICE — Port 8004
**Admin:** `localhost:8004/sms-admin/`
**Zimmedari:** Principal, Teacher, Coordinator profiles aur user creation

### Principal
| Field | Detail |
|---|---|
| `full_name`, `email`, `contact_number` | Basic info |
| `campus` | Assigned campus |
| `employee_code` | Auto-generated (e.g. KPS-0001) |
| `joining_date`, `cnic`, `dob`, `gender` | HR fields |
| `education_level`, `institution_name` | Qualification |
| `is_deleted` | Soft delete flag |

### Teacher
| Field | Detail |
|---|---|
| `full_name`, `email`, `contact_number` | Basic info |
| `current_campus` | Assigned campus |
| `employee_code` | Auto-generated |
| `shift` | morning / afternoon / both |
| `current_subjects` | Subjects taught |
| `assigned_classroom` | Primary classroom |
| `assigned_classrooms` | Multiple classrooms (M2M) |
| `is_class_teacher` | Class teacher flag |
| `assigned_coordinators` | Linked coordinators (M2M) |
| `total_experience_years` | Experience |
| `is_currently_active` | Active flag |

### Coordinator
| Field | Detail |
|---|---|
| `full_name`, `email`, `contact_number` | Basic info |
| `campus` | Assigned campus |
| `employee_code` | Auto-generated |
| `shift` | morning / afternoon / both |
| `level` | Single level (when shift != both) |
| `assigned_levels` | Multiple levels (when shift = both, M2M) |
| `can_assign_class_teachers` | Permission flag |
| `is_currently_active` | Active flag |
| `is_deleted` | Soft delete flag |

**Key APIs:**
- `GET /api/principals/` — principal list
- `GET /api/teachers/` — teacher list
- `GET /api/coordinators/` — coordinator list
- `POST /api/internal/delete-user/` — internal: user + staff profiles delete

**User Creation:** Jab bhi principal/teacher/coordinator save hota hai, `UserCreationService` automatically:
1. Staff-service `users_user` mein user banata hai
2. Auth-service `internal/create-user/` call karta hai
3. Credentials email bhejta hai

---

## 5. STUDENT-SERVICE — Port 8005
**Admin:** `localhost:8005/sms-admin/`
**Zimmedari:** Students, behaviour records, exit/transfer records

### Student
| Field | Detail |
|---|---|
| `full_name`, `email`, `contact_number` | Basic info |
| `student_id` | Auto-generated (e.g. KPS-26-00001) |
| `campus`, `organization` | Assignment |
| `classroom` | Current class |
| `enrollment_year`, `enrollment_date` | Enrollment info |
| `shift` | morning / afternoon |
| `dob`, `gender`, `religion` | Personal info |
| `father_name`, `father_cnic`, `mother_name` | Guardian info |
| `permanent_address`, `current_address` | Addresses |
| `is_zakat_eligible`, `house_ownership` | Socioeconomic info |
| `is_deleted` | Soft delete flag |

### StudentBehaviourRecord
| Field | Detail |
|---|---|
| `student` | FK to Student |
| `date`, `type` | Behaviour type (positive/negative/neutral) |
| `description`, `action_taken` | Details |
| `reported_by` | Staff user |

### MonthlyBehaviourRecord
Monthly summary per student.

### ExitRecord (student_status app)
| Field | Detail |
|---|---|
| `student` | FK to Student |
| `exit_date`, `exit_reason` | Why/when left |
| `destination_school` | Where transferred |

**Key APIs:**
- `GET /api/students/` — student list (role-filtered)
- `GET /api/students/campus_stats/` — campus-wise student count stats
- `GET /api/behaviour/` — behaviour records
- `POST /api/internal/delete-user/` — internal: user + student profile delete

---

## 6. ATTENDANCE-SERVICE — Port 8006
**Admin:** `localhost:8006/sms-admin/`
**Zimmedari:** Student aur staff attendance, holidays, biometric devices

### Attendance (Student)
| Field | Detail |
|---|---|
| `classroom` | Which class |
| `date` | Attendance date |
| `status` | draft / submitted / under_review / approved |
| `submitted_by`, `approved_by` | Workflow tracking |

### StudentAttendance
Individual student records (per Attendance batch):
`student`, `status` (present/absent/late/leave), `remarks`

### StaffAttendance
| Field | Detail |
|---|---|
| `user` | Staff member |
| `date`, `check_in`, `check_out` | Time tracking |
| `status` | present/absent/late/half_day |
| `source` | manual / biometric |

### Holiday
`name`, `date`, `campus`, `organization` — campus-wise holidays

### ZKTecoDevice
Biometric attendance device: `ip_address`, `port`, `campus`, `device_name`

### ZKTecoEmployeeMapping
Maps staff user to biometric device user ID.

### AuditLog
All major actions tracked: `feature`, `action`, `entity_type`, `entity_id`, `user`, `changes`, `reason`

**Key APIs:**
- `GET /api/attendance/class/{id}/students/` — classroom attendance
- `POST /api/attendance/` — mark attendance
- `GET /api/attendance/holidays/` — holiday list
- `GET /api/staff-attendance/` — staff attendance records

---

## 7. RESULT-SERVICE — Port 8007
**Zimmedari:** Exam results, retest scheduling

### Result (Monthly)
`student`, `classroom`, `month`, `year`, `subjects_data` (JSON), `status`

### MidTermResult / FinalTermResult
`student`, `classroom`, `term`, `year`, `subjects_data`, `total_marks`, `obtained_marks`, `percentage`, `grade`, `status`

### SubjectMark
Individual subject marks per result.

### RetestSchedule
`student`, `subject`, `exam_type`, `scheduled_date`, `campus`

### RetestResult
Result of a retest attempt.

### SchoolSettings
`passing_percentage`, `grading_scheme` (JSON), `campus`

**Status flow:** draft → pending_approval → approved

---

## 8. TIMETABLE-SERVICE — Port 8008
**Zimmedari:** Subjects, class timetables, teacher timetables, student transfers

### Subject
`name`, `code`, `campus`, `level`, `grade`

### ClassTimeTable
`classroom`, `day`, `period`, `subject`, `teacher`, `start_time`, `end_time`

### TeacherTimeTable
`teacher`, `day`, `period`, `classroom`, `subject`

### ShiftTiming
`campus`, `shift`, `start_time`, `end_time`, `period_count`, `break_time`

### Transfers App

| Model | Kya hai |
|---|---|
| **TransferRequest** | Base transfer request (student ya teacher) |
| **ClassTransfer** | Student ka ek class se doosri class mein transfer |
| **ShiftTransfer** | Morning ↔ Afternoon shift change |
| **CampusTransfer** | Student ka ek campus se doosri |
| **GradeSkipTransfer** | Student ka grade skip (e.g. Class 2 → Class 4) |
| **TransferApproval** | Approval workflow record |
| **IDHistory** | Student ID change history |

---

## 9. FEES-SERVICE — Port 8009
**Zimmedari:** Fee structure, invoices, payments, bank accounts

### FeeType
`name`, `description`, `campus` — (e.g. Tuition Fee, Exam Fee)

### FeeStructure
`fee_type`, `grade`, `amount`, `frequency` (monthly/quarterly/annual), `campus`

### StudentFee
Generated fee record per student: `student`, `fee_structure`, `due_date`, `amount`, `status` (pending/paid/overdue/waived)

### Payment / PaymentTransaction
`student_fee`, `amount_paid`, `payment_date`, `payment_method`, `bank_account`, `transaction_id`

### BankAccount
`bank_name`, `account_number`, `account_title`, `campus`

---

## 10. NOTIFICATION-SERVICE — Port 8011
**Zimmedari:** System-wide notifications

### Notification
| Field | Detail |
|---|---|
| `recipient` | User who receives it |
| `actor` | Who triggered it |
| `verb` | Action description |
| `data` | Extra JSON data |
| `unread` | Read/unread flag |
| `created_at` | Timestamp |

---

## 11. SUPPORT-SERVICE — Port 8012
**Zimmedari:** Complaints, requests, custom form templates

### FormTemplate
JSON-schema based dynamic forms: `name`, `schema` (JSON), `category`, `campus`

### RequestComplaint
`title`, `description`, `category`, `status` (open/in_progress/resolved/closed), `submitted_by`, `assigned_to`, `campus`

### RequestComment
Comments/replies on a complaint thread.

### RequestStatusHistory
Status change audit trail.

---

## Cross-Service Data Flow

```
Auth-Service  ←──── JWT tokens ────→  All Services
     │
     │ internal/create-user/
     │ internal/delete-user/
     ↓
Staff-Service ──────────────────────→  Teacher/Coordinator/Principal profiles
     │                                  + users_user copy
     │
Campus-Service ─────────────────────→  Campus/Level/Grade/Classroom
     │
     │ sync_master_data (on startup)
     ↓
Student-Service, Attendance-Service, Timetable-Service, Result-Service
(each service copies Campus/Level/Grade/Classroom into its own DB)
```

## Employee Code Format

| Role | Format | Example |
|---|---|---|
| Super Admin | `S-YY-XXXX` | S-26-0001 |
| Admin | `A-YY-XXXX` | A-26-0001 |
| Org Admin | `OA-YY-XXXX` | OA-26-0001 |
| Staff (default) | `CampusCode-Shift-YY-Role-XXXX` | C01-M-26-T-0042 |
| Staff (org prefix) | `Prefix-XXXX` (pattern-based) | KPS-0001 |

**Org Code Patterns:**
- `PREFIX_YY_ROLE_SEQ4` → `KPS-26-T-0001`
- `PREFIX_YYYY_SEQ4` → `KPS-2026-0001`
- `PREFIX_ROLE_SEQ4` → `KPS-T-0001`
- `PREFIX_SEQ4` → `KPS-0001`
- `PREFIX_YYYY_ROLE_SEQ5_SLASH` → `KPS/2026/T/00001`

## Roles & Access

| Role | Campus Access | What they see |
|---|---|---|
| `superadmin` | All | Everything across all orgs |
| `admin` | All (own org) | All data within organization |
| `org_admin` | All campuses in org | Org-wide management |
| `principal` | Own campus only | Campus-specific data |
| `coordinator` | Own campus | Assigned level's teachers & students |
| `teacher` | Own campus | Own classes & students |
| `student` | Own campus | Own profile & results |
