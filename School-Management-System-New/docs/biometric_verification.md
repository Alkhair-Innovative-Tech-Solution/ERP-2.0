# Biometric Verification — FoxFace AI Integration Plan

> Goal: Replace the old **ZKTeco** (fingerprint/RFID) attendance machines with
> **Foxit FoxFace AI** face-recognition machines. A mark on the machine must
> reflect in our system as attendance — same as today, but for face devices.
>
> Vendor: https://foxit.pk/product/ (FoxFace AI series)

---

## 1. How the CURRENT (ZKTeco) system works

This is what we already have, so the new machine must slot into the same flow.

### Flow
```
ZKTeco machine  ──PUSH(ADMS)──▶  nginx /iclock/*  ──▶  attendance-service: zkteco_push()
                                                              │
                                                              ├─ parse punch (user_id, timestamp, punch_type)
                                                              ├─ identify staff  (mapping table → User, fallback biometric_id/username)
                                                              ├─ resolve shift timing (employee → campus default → hardcoded)
                                                              └─ upsert StaffAttendance (check_in/out, late_minutes, source='biometric')
```

### Key code
| Piece | Location |
|---|---|
| Push receiver | `attendance-service/attendance/views.py` → `zkteco_push()` (~line 3175) |
| URL routes | `attendance/urls.py` (`iclock/cdata`, `iclock/getrequest`, `iclock/push`, `zkteco/push/`) + `attendance_service/urls.py` |
| nginx route | `nginx/nginx.conf` → `location /iclock/` → `attendance-service:8006` |
| Device model | `ZKTecoDevice` (serial_number, ip_address, port, campus, organization, is_active, last_sync) |
| ID mapping | `ZKTecoEmployeeMapping` (device + device_user_id → User/Teacher, employee_code) |
| Attendance row | `StaffAttendance` (user, date, check_in_time, check_out_time, status, **source='biometric'**, late_minutes, device) |
| Staff `biometric_id` | on `User`, `Teacher`, `Coordinator`, `Principal` (the "device user id") |

### Identification logic (today)
1. Look up `ZKTecoEmployeeMapping(device, device_user_id)` → `User`.
2. Fallback: `User.biometric_id == device_user_id` or `User.username == device_user_id`.
3. Unknown user → auto-create a placeholder mapping for later linking.

### Important scope note
- The biometric flow only marks **STAFF** attendance (teacher / coordinator / principal).
- **Student** attendance is still marked manually by the class teacher
  (`Attendance` / `StudentAttendance` models, source='manual').
- FoxFace face machines *can* recognise students too — decision needed (see §6).

---

## 2. What's DIFFERENT about FoxFace AI

| Aspect | ZKTeco (old) | FoxFace AI (new) |
|---|---|---|
| Identification | Fingerprint / RFID card | **Face recognition** (AI) |
| Enrollment | Fingerprint scan on device | **Face photo** registered to a person ID |
| Push protocol | ADMS (HTTP, tab/`key=value` text to `/iclock/`) | **TBD — must confirm** (see §3) |
| Person identifier | `device_user_id` (PIN) | FoxFace `person_id` / `employee_no` |
| Payload | Raw text lines | Likely **JSON** (event webhook) |

---

## 3. UNKNOWNS to confirm with Foxit / device manual ⚠️

Before coding, we MUST get these from the FoxFace device docs / vendor. The
integration shape depends entirely on the answers:

1. **Push mode** — does the device:
   - (a) HTTP POST recognition events to a URL we configure (webhook)? ← most likely, easiest
   - (b) only talk to Foxit's cloud platform (then we use their cloud API / pull)?
   - (c) need a local SDK / TCP connection?
2. **Payload format** — exact JSON fields for a recognition event:
   - person id field name (`personId` / `employeeNo` / `pin`)
   - timestamp field + format/timezone
   - event/direction (in/out) field, if any
   - device serial / id field
   - whether it sends a snapshot image (base64/URL)
3. **Auth** — does the push carry a token/signature we should verify?
4. **Heartbeat** — does it expect a specific keep-alive response (like ZKTeco's `"OK"`)?
5. **Enrollment** — how is a person registered:
   - on-device only, or via an API where we send name + face photo + person_id?
   - can we push our students'/staff' photos to enroll them in bulk?
6. **Capacity / students** — can it hold all students + staff faces (device limit)?

> 👉 Action: collect the FoxFace HTTP/API documentation (or a sample of a real
> push request captured from the device) and fill the "Assumptions" below.

### Working assumption for the plan (revise once confirmed)
FoxFace POSTs a JSON recognition event to a webhook URL, e.g.:
```json
{
  "device_sn": "FOX-XXXX",
  "person_id": "IAK-26-T-0001",
  "name": "Sheikh",
  "timestamp": "2026-06-08 08:05:00",
  "event": "recognized",
  "direction": "in"
}
```

---

## 4. Design — generalise to a device-agnostic biometric layer

Rather than hard-coupling to "ZKTeco", introduce a **device-type-aware** layer so
both old and new machines (and future ones) share one ingestion path.

### 4.1 Model changes (attendance-service)
- Add `device_type` to the device model: `('zkteco', 'foxface', ...)`.
  - Option A (low-risk): keep `ZKTecoDevice`, add `device_type` field (default `zkteco`).
  - Option B (clean): rename to `BiometricDevice` with `device_type`, keep
    `ZKTecoDevice` as an alias/proxy for backward compat. ← preferred long-term.
- `ZKTecoEmployeeMapping` → works as-is (device + `device_user_id` → User);
  for FoxFace, `device_user_id` = FoxFace `person_id`. Rename later to
  `BiometricEmployeeMapping` (alias kept).
- `StaffAttendance.source='biometric'` already exists — reuse, optionally add a
  finer `source='face'` if we want to distinguish in reports.

### 4.2 New ingestion endpoint
- New view `foxface_push()` in `attendance-service/attendance/views.py`
  (parallel to `zkteco_push`, do NOT overload the ADMS parser).
- URL: `path('foxface/push/', views.foxface_push)` + nginx `location /foxface/`
  → `attendance-service:8006` (mirror the `/iclock/` block, SSE not needed).
- Responsibilities (reuse existing helpers where possible):
  1. Verify device by `device_sn` (+ optional secret/signature).
  2. Parse JSON event → `person_id`, `timestamp`, `direction`.
  3. **Identify person** (shared resolver — see §4.3).
  4. Resolve shift timing (reuse the exact logic from `zkteco_push`).
  5. Upsert `StaffAttendance` (check-in/out + late) — reuse existing upsert block.
  6. Return the heartbeat/ack format FoxFace expects.

### 4.3 Shared person resolver (refactor)
Extract the identification logic from `zkteco_push` into a reusable function so
both devices use it:
```python
def resolve_user_from_device(device, device_user_id):
    # 1. BiometricEmployeeMapping(device, device_user_id) → user
    # 2. fallback: User.biometric_id == id  or  User.username == id
    # 3. unknown → create placeholder mapping
```
For FoxFace, set each person's `biometric_id` (or mapping) = their
`employee_code` (e.g. `IAK-26-T-0001`) so the existing fallback works
out-of-the-box — this is the simplest enrollment-to-system link.

---

## 5. Enrollment (linking a face to a system user)

Two paths depending on FoxFace capability (§3.5):

- **If FoxFace has an enrollment API:** when staff/student is created (or via a
  bulk action), push `{person_id = employee_code/student_id, name, photo}` to the
  device. We already store photos for staff/students — reuse them.
- **If on-device enrollment only:** admin enrolls the face on the machine using
  the person's `employee_code`/`student_id` as the person ID. Our existing
  `ZKTecoEmployeeMapping` "unmapped users" screen already handles linking unknown
  device IDs to users — reuse that UI for FoxFace.

The **mapping UI already exists** (`zkteco/mappings/`, `zkteco/unmapped-staff/`).
Generalise its labels to "Biometric Devices / Face Devices".

---

## 6. Decision needed — students on the face machine?

FoxFace recognises students' faces too. Options:
- **A) Staff only (like today):** smallest change. Students stay manual. ← safe first step.
- **B) Staff + Students:** face machine also marks student attendance.
  - Requires student face enrollment + a student-attendance upsert path in the
    new endpoint (write to `StudentAttendance` instead of `StaffAttendance` when
    the person resolves to a student).
  - Bigger change; do as Phase 2 after staff flow is proven.

**Recommendation:** Phase 1 = staff only (drop-in replacement for ZKTeco).
Phase 2 = add students once the push protocol is verified and stable.

---

## 7. Proposed phased implementation

### Phase 0 — Discovery (blocking)
- [ ] Get FoxFace push/API spec (or capture a real device POST).
- [ ] Fill §3 "Assumptions" with confirmed fields.

### Phase 1 — Staff attendance via FoxFace (drop-in)
- [ ] Add `device_type` to device model (+ migration); register FoxFace devices.
- [ ] Refactor `zkteco_push` identification + timing + upsert into shared helpers.
- [ ] Add `foxface_push()` view + URL + nginx `/foxface/` route.
- [ ] Enrollment link: set `biometric_id = employee_code` for staff (or mapping).
- [ ] Test: mark on machine → `StaffAttendance` row appears with `source='biometric'`,
      correct late_minutes, visible in Staff Attendance UI.
- [ ] Generalise device-management UI labels (ZKTeco → Biometric/Face).

### Phase 2 — Students (optional, after Phase 1)
- [ ] Enroll student faces (bulk push or on-device).
- [ ] Extend `foxface_push()` to write `StudentAttendance` when person is a student.
- [ ] Reflect in the teacher's attendance sheet (read-only "marked by machine").

### Phase 3 — Cleanup
- [ ] Once FoxFace is live everywhere, decommission ZKTeco routes/devices.
- [ ] Keep the generic biometric layer for future device types.

---

## 8. Files that will change

| File | Change |
|---|---|
| `attendance-service/attendance/models.py` | `device_type` on device model; (later) rename to `BiometricDevice` |
| `attendance-service/attendance/views.py` | extract shared helpers; add `foxface_push()` |
| `attendance-service/attendance/urls.py` | add `foxface/push/` route |
| `attendance-service/attendance/migrations/` | new migration for `device_type` |
| `nginx/nginx.conf` | add `location /foxface/` → `attendance-service:8006` |
| frontend device-management pages | label/device-type support for face machines |
| (Phase 2) `foxface_push` | student-attendance write path |

---

## 9. Open questions for the team
1. Phase 1 staff-only first, ya direct staff+students?
2. FoxFace enrollment — API se bulk push possible hai, ya on-device manual?
3. Ek hi face machine poore campus ke liye, ya per-shift/per-gate multiple?
4. Late/early rules face machine pe wahi rahenge jo ZKTeco pe the? (haan — reuse)

> Next step: §3 ke unknowns confirm karke is doc ko update karo, phir Phase 1
> ka code likhna shuru karenge.
