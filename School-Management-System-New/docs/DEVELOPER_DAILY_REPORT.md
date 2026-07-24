# Developer Daily Report — Newton AMS (SMS)
**Developer:** Rahat Ali Sheikh
**Project:** Newton Academic Management System (AMS)
**Period:** 16 May 2026 – 30 June 2026
**Stack:** Django Microservices · Next.js 14 · PostgreSQL · Docker

---

## 16 May 2026 — Saturday | 🚫 No Work — Weekend

---

## 17 May 2026 — Sunday | 🚫 No Work — Weekend

---

## 18 May 2026 — Monday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments:

**1. Diagnosed and resolved `ams_subject` container crash — `ModuleNotFoundError: phonenumber_field`**
- Root cause: `"students"` app was listed in `INSTALLED_APPS` of `subject_service/settings.py`; the `students/models.py` imports `phonenumber_field` which is not installed in the subject-service container
- Fix: Removed `"students"` from `INSTALLED_APPS` in `/SMS/microservices/subject-service/subject_service/settings.py`
- Reference: Compared against `campus-service` settings which correctly excludes the students app
- Also removed `COPY microservices/student-service/students/ /app/students/` line from subject-service `Dockerfile`

**2. Diagnosed and resolved `ams_content` container crash — same `phonenumber_field` error**
- Applied identical fix to `/SMS/microservices/content-service/content_service/settings.py`
- Removed students COPY from `/SMS/microservices/content-service/Dockerfile`

**3. Resolved second crash — `ModuleNotFoundError: No module named 'notifications'`**
- Root cause: `coordinator/signals.py` in both services imports `from notifications.services import create_notification`; the `notifications` module was not copied into the containers
- Fix: Added `COPY microservices/staff-service/notifications/ /app/notifications/` to both Dockerfiles
- Note: The `staff-service` notifications module has a stub implementation (`def create_notification(...): pass`) — safe to copy

**4. Resolved third crash — `NodeNotFoundError` on teachers migration**
- Root cause: `teachers.0005_teachersubjectassignment` migration depends on `('timetable', ...)` app which is not installed in subject/content services
- Fix: Added `COPY microservices/campus-service/teachers_campus_migrations/ /app/teachers_campus_migrations/` to both Dockerfiles
- Added `MIGRATION_MODULES = {"teachers": "teachers_campus_migrations"}` to both settings files
- This redirects the `teachers` app to use only migrations 0001–0004 (no timetable dependency) — same pattern as `campus-service`

**5. Resolved fourth crash — `InconsistentMigrationHistory` on admin tables**
- Root cause: Stale migration history from previous runs with different `AUTH_USER_MODEL`; `admin.0001_initial` was recorded as applied before `users.0001_initial`
- Fix: Dropped and recreated both PostgreSQL schemas:
  ```sql
  DROP SCHEMA public CASCADE;
  CREATE SCHEMA public;
  ```
  Then restarted both services to trigger fresh migrations
- Both `ams_subject` and `ams_content` containers now running stably

### Blockers & Challenges:
- Four cascading errors discovered sequentially — each fix exposed the next crash, requiring multiple container restart/log cycles
- The `notifications` module dependency was hidden in `coordinator/signals.py` (not obvious from INSTALLED_APPS)
- Migration history inconsistency required full schema drop — risk of data loss (acceptable since dev environment, no production data)
- Campus-service was the only correct reference showing the right COPY + MIGRATION_MODULES pattern — had to reverse-engineer it

### Future Plans:
- Verify all other microservices follow the correct Dockerfile COPY pattern
- Write a Dockerfile linting checklist to prevent recurrence
- Begin work on subject/content service API integration testing

---

## 19 May 2026 — Tuesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments:

**1. Fixed 404 error on `/teacher` root route (breadcrumb navigation issue)**
- Root cause: Next.js breadcrumb auto-generates parent links from pathname segments; `/teacher/subjects` generates a breadcrumb link to `/teacher` which had no corresponding `page.tsx`
- Fix: Created `/SMS/frontend/src/app/teacher/page.tsx` — a redirect component that sends users to `/teacher/subjects` using `router.replace()`
- Pattern used:
  ```tsx
  "use client"
  export default function TeacherRoot() {
    const router = useRouter()
    useEffect(() => { router.replace("/teacher/subjects") }, [router])
    return null
  }
  ```

**2. Fixed 404 on `/student` root route**
- Same pattern — created `/SMS/frontend/src/app/student/page.tsx` redirecting to `/student/dashboard`

**3. Fixed 404 on `/teacher/subjects/[id]` dynamic route**
- Created `/SMS/frontend/src/app/teacher/subjects/[id]/page.tsx` which redirects to `/teacher/subjects/[id]/content`
- Uses `useParams<{ id: string }>()` to extract the dynamic segment

**4. Created complete workflow documentation — `SUBJECT_CONTENT_FLOW.md`**
- Documented the full 10-step workflow from coordinator timetable setup through student assignment submission
- Covers: Coordinator sets up subjects → assigns in timetable → admin imports to subject-service → teacher creates content/assignments → students submit
- Includes API endpoints for each step, service-to-service data flow, and database tables involved
- Saved to `/SMS/docs/SUBJECT_CONTENT_FLOW.md`

### Blockers & Challenges:
- Next.js breadcrumb behavior generates links automatically from path segments — requires a page at every level to avoid 404s
- No standard way to disable specific breadcrumb links in the existing component — redirect pages are the cleanest workaround
- Documenting the two separate Subject systems (timetable-service Subject model vs subject-service Subject model) required careful analysis of both services' models.py

### Future Plans:
- Analyze why teacher "My Subjects" page shows 0 subjects despite coordinator timetable assignments
- Investigate the data flow gap between timetable-service and subject-service

---

## 20 May 2026 — Wednesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments:

**1. Implemented Drag-to-Fill feature on Coordinator Timetable (Google Sheets style)**
- Feature: User clicks and drags the small white square handle on a filled timetable cell to auto-fill adjacent empty cells with the same subject assignment
- Added `useRef` and `useCallback` to timetable page imports
- New state variables: `isDragging` (boolean), `dragHighlightKeys` (Set of cell keys being highlighted)
- New refs:
  - `isDraggingRef` — mirrors isDragging for use inside global `mouseup` handler (avoids stale closure)
  - `dragDataRef` — stores the subject/teacher/classroom being dragged
  - `dragHighlightRef` — Map from cellKey → `{ day, daySlot }` for all highlighted cells
- Cell key format: `"${day}|||${baseName}"` (day + slot name, unique per grid cell)

**2. Drag Handle UI**
- Added a small white square `<div>` in the bottom-right corner of every filled timetable cell
- Classes: `absolute bottom-1 right-1 w-3 h-3 bg-white rounded-sm cursor-crosshair opacity-0 group-hover:opacity-100`
- Only visible on hover via `group-hover` — matches Google Sheets behavior

**3. Cell highlight preview during drag**
- Empty cells in the drag path show the subject name + "Will assign" text with blue highlight
- Highlight updates live as mouse moves via `handleCellMouseEnter`

**4. Batch assignment creation on mouse release**
- `handleMouseUp` (useCallback) fires on global `document` mouseup event
- Calls `Promise.all([...])` to create all highlighted cells simultaneously via `createClassTimetable` API
- Clears all drag state refs and React state after completion
- Shows single toast: `"${count} periods assigned"` on success

**5. TypeScript fix in timetable page**
- `Argument of type 'boolean | undefined' is not assignable to 'boolean'`
- Fix: Changed `isBreak` to `!!isBreak` in the `handleCellMouseEnter` call

### Blockers & Challenges:
- Global `mouseup` handler requires `useRef` for `isDraggingRef` — using React state directly in a `document.addEventListener` callback causes stale closure where the handler always sees the initial state value
- Promise.all order of operations: had to handle the case where drag ends on the same cell it started (no cells highlighted = no API calls)
- Cell key collision risk if two periods have same slot name on same day — mitigated by using `|||` separator which cannot appear in normal names

### Future Plans:
- Test drag-to-fill across all browsers
- Address teacher "0 subjects" issue — build Import from Timetable feature

---

## 21 May 2026 — Thursday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments:

**1. Root cause analysis — Teacher "My Subjects" shows 0 subjects**
- Discovered that two separate Subject systems exist in the architecture:
  - `timetable-service` → `timetable_subject` table → used for timetable dropdown (5 subjects existed)
  - `subject-service` → `subjects_subject` table → used for teacher content/assignments (was empty)
- The coordinator assigns subjects to timetable slots in `timetable-service` — this does NOT automatically sync to `subject-service`
- Teachers see subjects from `subject-service` → hence 0 subjects despite timetable being fully set up

**2. Designed and implemented "Import from Timetable" feature on `/admin/subjects/teacher-assign` page**
- `openSyncPreview()` function:
  1. Fetches all ClassTimetable entries from `/api/timetable/class-timetable/?page_size=500`
  2. Deduplicates by `${subjectName}__${teacherId}__${classroomId}` key
  3. Compares against existing `subject-service` assignments
  4. Shows modal preview with "Will create" (green) vs "Already exists" (greyed) items

- `executeSync()` function:
  1. Creates missing subjects in subject-service via `POST /api/subjects/`
  2. Creates `SubjectTeacherAssignment` for each new item via `POST /api/subject-teacher-assignments/`
  3. Reports count: `"X assignments sync ho gayi!"` on success

**3. Fixed `handleAssign()` in teacher-assign page**
- Bug: was sending `subject_id` as field name in the payload
- Fix: Changed to `subject` (the actual FK field name the serializer expects)

**4. Added `SyncItem` TypeScript interface**
- `{ subject_name, teacher_id, teacher_name, classroom_id, classroom_label, alreadyExists }`

**5. Added academic year selector to sync preview modal**
- Dropdown allows selecting `2024-25`, `2025-26`, `2026-27` for the sync batch

### Blockers & Challenges:
- Two separate Subject models in two different microservices is a fundamental architectural complexity — no automatic sync exists
- Timetable API returns `teacher` as either an object or a plain ID depending on endpoint — required `typeof` check: `typeof e.teacher === "object" ? e.teacher?.id : e.teacher`
- Classroom label reconstruction: `grade + section` strings had to be assembled from timetable entry fields since no single `classroom_label` field exists

### Future Plans:
- Test Import from Timetable end-to-end in staging
- Clean up extra/redundant pages from the codebase
- Fix navigation scoping per role

---

## 22 May 2026 — Friday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments:

**1. Deleted extra/redundant frontend pages**
- Removed stale pages that were no longer reachable or were replaced by newer implementations
- Cleared `.next` build cache (`rm -rf SMS/frontend/.next`) to remove stale type references to deleted pages

**2. Fixed Subjects navigation — restricted to Coordinator only**
- In `navigation.ts`: Updated `admin_subjects` nav item `show` function:
  - Before: `role === "coordinator" || role === "org_admin" || role === "principal"`
  - After: `role === "coordinator"` only
- Removed `"admin_subjects"` from `principalOrder` array in navigation.ts
- Removed `"admin_subjects"` from `orgAdminOrder` array in navigation.ts
- Removed old `"subjects"` nav item (key: `"subjects"`, href: `/admin/coordinator/subject-assign`) — now replaced by `admin_subjects`
- Updated `coordinatorOrder`: replaced `"subjects"` with `"admin_subjects"`

**3. Removed old subject-assign route from features.ts**
- Removed `"subjects"` from `subject_assignment.navItems`
- Removed `"/admin/coordinator/subject-assign"` from `subject_assignment.routes`

**4. Attempted Shift Timings move from Timetable to Academic Structure accordion (principal sidebar)**
- Added `shift_timings: "Academic Structure"` to `CATEGORY_MAP` in `admin-sidebar.tsx`
- Bug discovered: the entry was placed BEFORE `...FEATURE_CATEGORY_MAP` spread, so the auto-generated map from features.ts (which maps `shift_timings` to "Timetable") overrides the explicit entry
- Issue left for next session to fix

### Blockers & Challenges:
- `CATEGORY_MAP` spread ordering: JavaScript object spread overwrites earlier keys with later ones — the `...FEATURE_CATEGORY_MAP` spread must come BEFORE explicit overrides, not after
- `.next` cache retained references to deleted page.js files, causing TypeScript errors until cache was cleared
- Principal's `timetable` nav item needed to stay removed — verified `principalOrder` no longer contains `"timetable"` key, only `"shift_timings"` (which is being moved)

### Future Plans:
- Fix the CATEGORY_MAP spread ordering bug so `shift_timings` maps correctly to Academic Structure
- Rename accordion categories for clarity
- Begin navigation consolidation

---

## 23 May 2026 — Saturday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments:

**1. Fixed Shift Timings category override bug in admin-sidebar.tsx**
- Root cause: `shift_timings: "Academic Structure"` was placed BEFORE `...FEATURE_CATEGORY_MAP` spread; features.ts auto-generates `shift_timings → "Timetable Management"` which overwrote the explicit entry
- Fix: Moved the override AFTER the spread so it takes precedence:
  ```ts
  const CATEGORY_MAP = {
    ...FEATURE_CATEGORY_MAP,        // auto-generated from features.ts
    shift_timings: "Academic Structure",  // override — placed AFTER spread
  }
  ```
- Result: Principal sidebar now shows Shift Timings under Academic Structure; Timetable accordion disappears entirely for principal (no items left)

**2. Renamed accordion categories**
- `"Timetable"` → `"Timetable Management"` (in `features.ts` label + `CATEGORY_ICONS` key)
- `"Transfers"` → `"Transfer Management"` (in `features.ts` label + `CATEGORY_ICONS` key)
- Updated `CATEGORY_ICONS` map to match new keys

**3. Cleared all subject and timetable data from databases**
- User requested full data reset to start fresh
- Verified row counts across all affected tables first
- Executed ordered DELETE in timetable_db (to respect FK constraints):
  ```sql
  DELETE FROM timetable_teachertimetable;   -- 30 rows
  DELETE FROM teachers_teachersubjectassignment;  -- 0 rows
  DELETE FROM timetable_classtimetable;     -- 323 rows
  DELETE FROM timetable_subject;            -- 5 rows
  ```
- subject_db and content_db were already empty for subject-related tables

**4. Restored old "Add Subject" modal UI with preset subject list**
- Updated `/admin/subjects/page.tsx` to use timetable-service API (`/api/timetable/subjects/`) instead of subject-service API
- Implemented modal matching the original production UI screenshot:
  - Text input + "+" button for custom subject names (Enter key also triggers add)
  - Scrollable preset list of 23 common subjects: English, Mathematics, Urdu, Science, Social Studies, Islamiat, Geography, History, Computer Science, Art, Physics, Chemistry, Biology, Economics, Accounting, Civics, Pakistan Studies, Arabic, Physical Education, General Knowledge, Environmental Studies, Sindhi, Pashto
  - Selected subject shown with blue checkmark chip + X button to clear
  - "Select from your list..." custom dropdown for already-created subjects
  - "Assign to Level" custom styled dropdown (not native `<select>`) with blue highlight
  - Cancel + "Create Subject" buttons at footer

**5. Updated admin/subjects page to use correct microservice**
- Campus ID auto-read from `getStoredUserProfile()` (same pattern as timetable page)
- Levels fetched from `/api/levels/` filtered by campusId
- Create via `createSubject()` → `POST /api/timetable/subjects/`
- Edit via `updateSubject()` → `PATCH /api/timetable/subjects/{id}/`
- Subjects created here now immediately appear in timetable dropdown

**6. Removed Teacher dropdown from Class Timetable assignment dialog**
- Reason: Class timetable should assign Subject only; Teacher assignment is done separately via Teacher Timetable view to avoid conflicts
- Removed the `timetableType === 'class'` branch Teacher `<Select>` component from dialog
- Updated save payload: `teacher: null` always for class timetable entries (field is `null=True, blank=True` in model — safe)
- Teacher Timetable view header selector (for choosing which teacher's grid to view) was correctly left in place

**7. Merged "Subject Assignment" nav accordion into "Timetable / Subjects"**
- Renamed timetable feature label: `"Timetable Management"` → `"Timetable / Subjects"`
- Moved `admin_subjects`, `teacher_subjects`, `teacher_assignments_nav` from `subject_assignment.navItems` to `timetable.navItems`
- Cleared `subject_assignment.navItems` to `[]` (routes kept for access control)
- Removed explicit `admin_subjects`, `teacher_subjects`, `teacher_assignments_nav` entries from CATEGORY_MAP (now auto-generated via FEATURE_CATEGORY_MAP)
- Removed `"Subject Assignment"` from CATEGORY_ICONS (no longer a category)
- Updated CATEGORY_ICONS: `"Timetable Management"` key → `"Timetable / Subjects"` key (CalendarDays icon)
- Result: One unified accordion "Timetable / Subjects" contains all timetable and subject management links

### Blockers & Challenges:
- Two microservice Subject models required careful API routing: timetable-service for the "master" subject list (dropdown source), subject-service for content/assignment scope — these must stay separate
- The `code` field in timetable Subject model is `read_only` in serializer (auto-generated) — Subject Code input in modal shown as read-only placeholder; cannot be set by user
- Campus is required FK in timetable Subject — no campus in user profile causes "Campus not found" error; added guard with clear toast message
- CATEGORY_ICONS key mismatch after renaming would cause icons to silently fall back to default — required careful key update in both features.ts and sidebar

### Future Plans:
- Full end-to-end smoke test: create subject → assign in timetable → verify teacher sees it via Import from Timetable
- Begin working on production smoke testing plan for all features

---

## 24 May 2026 — Sunday | 🚫 No Work — Weekend

---

## 25 May 2026 — Monday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Full end-to-end regression test of all navigation changes across all roles: coordinator, teacher, principal, org_admin, student, auditor, accounts officer
- Test "Timetable / Subjects" accordion appears correctly for coordinator
- Test Shift Timings under Academic Structure for principal
- Test Import from Timetable creates subjects and assignments correctly in subject-service
- Test drag-to-fill assigns periods correctly and displays in grid after reload
- Verify class timetable dialog shows only Subject (no Teacher dropdown)
- Fix any regressions found during smoke testing

### Blockers & Challenges (Anticipated):
- Role-switching between coordinator and principal may expose category mapping edge cases
- Timetable-service subjects and subject-service subjects staying in sync requires careful testing of the import flow

### Future Plans:
- Begin teacher content upload feature (PDF, video, links per module)
- Begin student assignment submission workflow

---

## 26 May 2026 — Tuesday | 🕌 Eid Ul Adha Holiday

> **Eid Ul Adha** — Office closed. No development activity.

---

## 27 May 2026 — Wednesday | 🕌 Eid Ul Adha Holiday

> **Eid Ul Adha** — Office closed. No development activity.

---

## 28 May 2026 — Thursday | 🕌 Eid Ul Adha Holiday

> **Eid Ul Adha** — Office closed. No development activity.

---

## 29 May 2026 — Friday | 🕌 Eid Ul Adha Holiday

> **Eid Ul Adha** — Office closed. No development activity.

---

## 30 May 2026 — Saturday | 🕌 Eid Ul Adha Holiday

> **Eid Ul Adha** — Office closed. No development activity.

---

## 31 May 2026 — Sunday | 🚫 No Work — Weekend

---

## 01 June 2026 — Monday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Resume development after Eid holidays
- Review any environment drift (Docker containers, DB state) that may have occurred during the break
- Implement teacher content module — teachers can create Modules inside a subject assignment
- Build `POST /api/content/modules/` creation form on frontend
- Module fields: title, description, subject_assignment (FK), order
- Implement Module list view on teacher's subject detail page

### Blockers & Challenges (Anticipated):
- Content-service may need migration updates if any schema changes were made pre-Eid
- File upload for content items (PDF, video) requires storage backend configuration (S3 or local media)

### Future Plans:
- Begin Lesson creation inside modules
- Begin ContentItem (file upload) feature

---

## 02 June 2026 — Tuesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Implement Lesson creation inside a Module (`POST /api/content/lessons/`)
- Lesson fields: title, module (FK), order, content_type (video/pdf/text)
- Build lesson list and ordering UI inside module detail page
- Implement drag-to-reorder lessons within a module (using `@dnd-kit` or native HTML5 drag)
- Teacher can preview lessons before publishing

### Blockers & Challenges (Anticipated):
- Lesson ordering on reorder must persist to backend — requires PATCH to update `order` field
- Content type selection (video/pdf/text) determines which upload field to show

### Future Plans:
- Implement ContentItem file upload (actual files stored in media server)

---

## 03 June 2026 — Wednesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Implement ContentItem upload feature (`POST /api/content/content-items/`)
- Support PDF, video URL (YouTube embed), and plain text content
- Build file upload component with progress indicator for PDF files
- Integrate with backend media storage (Django `FileField` or S3 presigned URL)
- Teacher-side: view all uploaded content items in a lesson

### Blockers & Challenges (Anticipated):
- Large file uploads require chunked upload or presigned S3 URL to avoid gateway timeout
- Video embed vs. direct upload decision needs PM confirmation

### Future Plans:
- Student-side content viewing
- Track student content progress (`content_studentcontentprogress` table)

---

## 04 June 2026 — Thursday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Build student content viewing interface — `/student/subjects/[id]/content`
- Student can navigate: Subject → Module → Lesson → ContentItem
- Mark lesson as "completed" — `POST /api/content/student-progress/`
- Progress bar per module shown on subject card (% lessons completed)
- Student cannot submit assignments until at least 1 lesson is viewed (optional gating)

### Blockers & Challenges (Anticipated):
- Progress tracking requires `student_id` which must come from the student's JWT token — verify the content-service correctly extracts it
- Module/Lesson ordering must be respected — backend `ordering = ['order']` in Meta must be confirmed working

### Future Plans:
- Build assignment creation for teachers
- Build assignment submission for students

---

## 05 June 2026 — Friday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Implement Assignment creation for teachers (`POST /api/assignments/assignments/`)
- Assignment fields: title, description, subject_assignment (FK), due_date, max_marks, attachment (optional)
- Build assignment form on teacher portal — `/teacher/assignments/create`
- Teacher can view all created assignments with submission count per assignment
- Assignment list with status (upcoming / past due)

### Blockers & Challenges (Anticipated):
- Due date timezone handling — system uses PKT (UTC+5), frontend must send ISO datetime with timezone offset
- File attachment for assignments: same storage concern as content items

### Future Plans:
- Assignment submission by students
- Assignment grading by teachers

---

## 06 June 2026 — Saturday | 🚫 No Work — Weekend

---

## 07 June 2026 — Sunday | 🚫 No Work — Weekend

---

## 08 June 2026 — Monday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Implement student assignment submission — `POST /api/assignments/submissions/`
- Submission fields: assignment (FK), student_id, submission_file (optional), text_answer, submitted_at
- Build submission UI on student portal — `/student/assignments/[id]/submit`
- Show submission status: Not Submitted / Submitted / Graded
- Prevent re-submission after due date (enforce on frontend + backend)

### Blockers & Challenges (Anticipated):
- File upload for submission (student attaches their answer as PDF/doc)
- Backend must validate `due_date` has not passed before accepting submission

### Future Plans:
- Teacher grading interface for submissions
- Result entry and approval flow

---

## 09 June 2026 — Tuesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Build teacher grading interface — view all submissions for an assignment
- Teacher enters marks per submission (`PATCH /api/assignments/submissions/{id}/` → `marks_obtained`, `feedback`)
- Show graded / ungraded status per student
- Bulk grade action: select multiple submissions, enter same marks
- Email/notification trigger on grading (if notification service wired up)

### Blockers & Challenges (Anticipated):
- `marks_obtained` must be validated: 0 ≤ marks ≤ max_marks
- Notification service stub (returns immediately) — real notifications deferred to later sprint

### Future Plans:
- Result management — teacher result entry
- Coordinator result approval

---

## 10 June 2026 — Wednesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Implement teacher result entry form — `/admin/teachers/result`
- Result fields: student, subject, exam_type (midterm/final), marks_obtained, max_marks, remarks
- POST to result-service API
- Validation: marks cannot exceed max_marks, all required students must have entries
- Result entry progress bar: X out of Y students entered

### Blockers & Challenges (Anticipated):
- Student list for a class must be fetched from student-service (different microservice) — requires API gateway routing to be correct
- Result-service must have correct org filtering via JWT

### Future Plans:
- Coordinator result approval
- Principal result approval

---

## 11 June 2026 — Thursday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Implement coordinator result approval flow — `/admin/coordinator/result-approval`
- View submitted results per class, per subject
- Approve or return with comments
- Status workflow: Draft → Submitted → Coordinator Approved → Principal Approved → Published
- Filter by grade, section, subject
- Approval action: `PATCH /api/results/{id}/approve/`

### Blockers & Challenges (Anticipated):
- Result status machine must be enforced on backend — frontend should not allow skipping steps
- Coordinator can only approve results for classes in their assigned levels

### Future Plans:
- Principal result approval
- Student result view

---

## 12 June 2026 — Friday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Implement principal result approval — `/admin/principal/result-approval`
- View coordinator-approved results
- Final approve → status changes to "Published"
- Published results become visible to students
- Build student result view — `/student/results`
- Student sees: subject, exam type, marks obtained, max marks, grade, remarks
- Print-friendly result card (HTML to PDF via browser print)

### Blockers & Challenges (Anticipated):
- Print layout must be tested across browsers
- Student result page must only show results for the logged-in student (enforce via JWT student_id)

### Future Plans:
- Student attendance view
- Staff attendance module

---

## 13 June 2026 — Saturday | 🚫 No Work — Weekend

---

## 14 June 2026 — Sunday | 🚫 No Work — Weekend

---

## 15 June 2026 — Monday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Build teacher mark attendance interface — `/admin/teachers/attendance`
- Select class, date, subject → list all students → mark Present/Absent/Late/Leave
- Bulk mark (mark all present, then individually change absents)
- `POST /api/attendance/` for each student or bulk endpoint if available
- Attendance already submitted for a date: show view-only mode with Edit button

### Blockers & Challenges (Anticipated):
- Holiday calendar integration — if today is a holiday, attendance should be blocked
- Late threshold (e.g., after 9:15 AM = Late) — configurable per campus/shift

### Future Plans:
- Coordinator attendance review and approval
- Student attendance view

---

## 16 June 2026 — Tuesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Build coordinator attendance review — `/admin/coordinator/attendance-review`
- View attendance records by class, date range
- Approve or return to teacher for correction
- Attendance summary: total present, absent, late per class per month
- Export attendance report (CSV/PDF)

### Blockers & Challenges (Anticipated):
- Date range filtering with pagination — large attendance datasets
- Export requires server-side generation or client-side CSV build

### Future Plans:
- Staff attendance module
- Transfer management

---

## 17 June 2026 — Wednesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Build staff attendance module — `/admin/teachers/staff-attendance`
- Accessible by org_admin, principal, coordinator
- Mark attendance for teaching staff and non-teaching staff
- View attendance history per staff member
- Integration with ZKTeco biometric device (if configured) — pull punch records
- Manual override capability for corrections

### Blockers & Challenges (Anticipated):
- ZKTeco integration plan documented in `TEACHER_ATTENDANCE_ZKTECO_PLAN.md` — actual device integration pending hardware availability
- Manual attendance and biometric attendance must not conflict

### Future Plans:
- Transfer management workflow
- Support desk module

---

## 18 June 2026 — Thursday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Build transfer management — `/admin/principals/transfers`
- Create transfer request: select student/staff, from campus, to campus, effective date, reason
- Principal approves or rejects transfer requests
- Transfer history per student/staff
- Status: Pending → Approved → Transferred / Rejected
- Notification to relevant coordinators on transfer approval

### Blockers & Challenges (Anticipated):
- Cross-campus transfers require data to be updated in the new campus's records
- Student transfer must re-assign to new classroom — requires classroom assignment update

### Future Plans:
- Support desk / request-complain module
- Fees management review

---

## 19 June 2026 — Friday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Build support desk for teachers — `/admin/teachers/request`
- Teacher submits complaint or request: category (leave/complaint/resource), description, attachment
- Coordinator view — `/admin/coordinator/requests`: view and respond to teacher requests
- Principal view — `/admin/principal/requests`: escalated items
- Status: Open → In Progress → Resolved / Closed
- Thread view: teacher and coordinator can exchange messages on a request

### Blockers & Challenges (Anticipated):
- File attachments on requests (same storage concern)
- Notification on new request — stub notifications for now

### Future Plans:
- Fees management integration testing
- Week 3 QA review

---

## 20 June 2026 — Saturday | 🚫 No Work — Weekend

---

## 21 June 2026 — Sunday | 🚫 No Work — Weekend

---

## 22 June 2026 — Monday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Fees management integration review — `/admin/fees` routes
- Test fee structure creation: fee type, amount, campus, level, due date
- Test student fee challan generation
- Test payment recording by accounts officer
- Student fee view — `/student/pay-fees`: outstanding fees, paid history
- Bank account configuration for fee collection

### Blockers & Challenges (Anticipated):
- Fee due date enforcement — late fee calculation if payment is past due date
- Challan PDF generation requires correct school branding (logo, bank details)

### Future Plans:
- Production deployment preparation
- Docker image optimization

---

## 23 June 2026 — Tuesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Production deployment preparation
- Review all Docker Compose services for production-readiness:
  - Remove `DEBUG=True` from production settings
  - Add `ALLOWED_HOSTS` to all services
  - Configure `gunicorn` workers for each Django service
  - Set `SECRET_KEY` from environment variable (not hardcoded)
- Set up Nginx reverse proxy config for API gateway and frontend
- SSL certificate configuration (Let's Encrypt)

### Blockers & Challenges (Anticipated):
- Secret management: API keys, DB passwords must be in Docker secrets or `.env.production` (not in version control)
- Nginx configuration for multiple subdomains (api.domain.com, app.domain.com)

### Future Plans:
- CI/CD pipeline setup
- Security audit

---

## 24 June 2026 — Wednesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Set up CI/CD pipeline (GitHub Actions or similar)
- Automated build and test on every push to main branch
- Docker image build and push to container registry on merge
- Deployment hook: pull new images and restart containers on server
- Rollback procedure: tag images with git SHA, rollback = redeploy previous tagged image

### Blockers & Challenges (Anticipated):
- Self-hosted runner vs cloud runner cost
- Docker build caching in CI to reduce build times

### Future Plans:
- Security audit
- Performance optimization

---

## 25 June 2026 — Thursday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Security audit of all API endpoints:
  - Verify OrganizationManager filters are applied on all ViewSets (multi-tenancy enforcement)
  - Verify JWT auth required on all protected endpoints
  - Check for CORS misconfiguration
  - Test OWASP Top 10: SQL injection (ORM protects), XSS (Next.js sanitizes), IDOR (org filter protects)
- API rate limiting: configure `django-ratelimit` or DRF throttling classes
- Input validation review: max lengths, file type validation, size limits

### Blockers & Challenges (Anticipated):
- Organization isolation must be tested with two separate org accounts to ensure no data leakage
- File upload endpoints need explicit allowed MIME type list

### Future Plans:
- Performance optimization
- Load testing

---

## 26 June 2026 — Friday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Database indexing audit:
  - Add DB indexes on frequently filtered fields: `organization`, `campus`, `teacher_id`, `student_id`, `day`, `created_at`
  - Run `EXPLAIN ANALYZE` on slow queries identified during QA
- Django query optimization:
  - Add `select_related` / `prefetch_related` on ViewSets with N+1 query patterns
  - Use `only()` on serializers with large models
- Next.js performance:
  - Add `loading.tsx` skeletons for slow-loading pages
  - Verify `useMemo` / `useCallback` used appropriately on heavy timetable grid

### Blockers & Challenges (Anticipated):
- Some indexes may already exist from Django migrations — must check before adding duplicates
- Timetable grid renders many cells — may need virtualization for large grids (React Window)

### Future Plans:
- Load testing
- Final QA and bug fixes

---

## 27 June 2026 — Saturday | 🚫 No Work — Weekend

---

## 28 June 2026 — Sunday | 🚫 No Work — Weekend

---

## 29 June 2026 — Monday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Load testing with realistic data volumes:
  - 500 students, 50 teachers, 20 classrooms per campus
  - 6 weeks of timetable data (323+ entries)
  - Concurrent users: 50 teachers marking attendance simultaneously
- Use `locust` or `k6` for HTTP load tests
- Identify bottlenecks: likely timetable grid load (`GET /api/timetable/class-timetable/`)
- Fix top 3 performance bottlenecks found
- Final bug fixes from the past week's testing and QA
- Verify all role-based navigation working correctly across 7 user roles

### Blockers & Challenges (Anticipated):
- PostgreSQL connection pool limits under load (configure `pgbouncer` if needed)
- Django `DEBUG=False` in load test environment — verify no debug-only code paths

### Future Plans:
- Final delivery and documentation update

---

## 30 June 2026 — Tuesday

**Developer:** Rahat Ali Sheikh

### Today's Accomplishments (Planned):
- Final delivery and handoff documentation:
  - Update `SUBJECT_CONTENT_FLOW.md` with any changes made post-May 23
  - Update `SERVICES_DATA_GUIDE.md` with new endpoints added this sprint
  - Write deployment runbook: step-by-step production deployment procedure
  - Write rollback procedure document
- Final smoke test on production environment:
  - Create one subject, assign in timetable, import to subject-service, teacher creates content, student views content, submits assignment, teacher grades, result approved by coordinator and principal
- Tag final release: `git tag v1.0.0-beta`
- Handoff meeting preparation: demo script, known issues list, next sprint backlog

### Blockers & Challenges (Anticipated):
- Production environment may have configuration differences from development (environment variables, file paths, domain names)
- All known bugs must be triaged: critical (block release) vs minor (post-release)

### Future Plans:
- Post v1.0.0-beta: begin v1.1 planning
  - Mobile app (React Native / Flutter) for teachers and students
  - ZKTeco biometric attendance integration (hardware arrives next sprint)
  - SMS/WhatsApp notification integration for fee reminders and result announcements
  - Multi-language support (Urdu, English interface toggle)
  - Parent portal: view student attendance, results, fee status

---

## Summary Statistics

| Period | Working Days | Holidays | Weekends |
|--------|-------------|----------|---------|
| May 16–31 | 7 | 5 (Eid) | 4 |
| June 1–30 | 22 | 0 | 8 |
| **Total** | **29** | **5** | **12** |

## Features Completed (May 18–23)

| # | Feature | Status |
|---|---------|--------|
| 1 | subject-service container crash fix (4 cascading errors) | ✅ Done |
| 2 | content-service container crash fix | ✅ Done |
| 3 | /teacher root route 404 fix | ✅ Done |
| 4 | /student root route 404 fix | ✅ Done |
| 5 | /teacher/subjects/[id] route fix | ✅ Done |
| 6 | SUBJECT_CONTENT_FLOW.md documentation | ✅ Done |
| 7 | Drag-to-fill timetable (Google Sheets style) | ✅ Done |
| 8 | Import from Timetable (subject-service sync) | ✅ Done |
| 9 | Redundant pages cleanup | ✅ Done |
| 10 | Subjects nav scoped to coordinator only | ✅ Done |
| 11 | Shift Timings moved to Academic Structure (principal) | ✅ Done |
| 12 | Timetable/Transfer accordions renamed | ✅ Done |
| 13 | Full database reset (subjects + timetable data) | ✅ Done |
| 14 | Add Subject modal with preset list (old UI restored) | ✅ Done |
| 15 | admin/subjects page → timetable-service API | ✅ Done |
| 16 | Teacher dropdown removed from class timetable dialog | ✅ Done |
| 17 | Subject Assignment merged into Timetable / Subjects nav | ✅ Done |

---

*Report generated: 23 May 2026 | Newton AMS Development Team*
