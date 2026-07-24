# FoxFace AI — Master Integration Doc (SaaS)

> **Status:** Planning → Phase 1 ready
> **Supersedes/extends:** [`biometric_verification.md`](./biometric_verification.md)
> **Goal:** Replace removed **ZKTeco** machines with **Foxit FoxFace AI** face
> machines, as a **multi-tenant SaaS** sold to schools (8 live now, designed to scale).
> A mark on the machine → attendance in our system, exactly like the old flow.

---

## 0. TL;DR — the decisions

1. **Two transports, one core.** Build a **device-agnostic biometric ingestion
   layer**. The attendance logic (identify person → resolve shift → upsert) is
   shared. The *transport* is a thin adapter:
   - **Phase 1 — HTTP push** (`foxface_push()` webhook). Drop-in, reuses ~90% of
     `zkteco_push`, needs **no new infra**. Gets us live on all 8 schools fast.
   - **Phase 2 — MQTT backbone** (EMQX broker + consumer worker). The long-term
     SaaS fleet layer: **bi-directional** (remote enroll, gate control,
     online/offline, reboot), scales to hundreds of devices behind any NAT.
2. **Network:** don't hand-set static IPs per school. Use **DHCP reservation
   (MAC bind)** on each school's router. The device talks **outbound** to our
   cloud, so its local IP barely matters for the SaaS path.
3. **Scope:** Phase 1 = **staff only** (true drop-in for ZKTeco). Students =
   Phase 3, after the loop is proven.
4. **Identity link:** set each person's `biometric_id = employee_code` so the
   existing fallback resolver works with zero new enrollment plumbing.

---

## 1. The device (confirmed from unit on hand)

| Field | Value |
|---|---|
| Model | **FOXit FQ8i** |
| Serial No | `Y231218011000028` |
| Device ID | `2385083` |
| Firmware | `v8.52.12.2` (Web `1.0.2.7`) |
| MAC | `28:36:13:20:8e:9b` |
| Web admin | `http://<device-ip>/login.asp` (admin/admin) — currently `10.0.11.11` |
| Opening method | Whitelist + Facial Verification, threshold 85 |

**This firmware ("Face Server") exposes 3 outbound integration channels:**

| Channel | Web tab | Direction | Verdict for SaaS |
|---|---|---|---|
| **Central Connection** | System Mgmt → Central Connection (TCP `6666`) | out | ❌ proprietary SDK / local-server style |
| **MQTT** | System Mgmt → MQTT (`mqtt/face/<deviceId>`) | out, **bi-directional** | ✅ **Phase 2 backbone** |
| **HTTP Subscription** | System Mgmt → HTTP Subscription | out (webhook) | ✅ **Phase 1 drop-in** |

> Current device state: MQTT shows **"Not connected. Login failed"** (broker/creds
> not set yet). HTTP Subscription is in `LAN` mode pointing at `192.168.2.11`.
> Timezone is **GMT+08 Beijing — WRONG**, must be GMT+05 or NTP, else timestamps drift.
> `Identification Log = Upload w/ Image` is already correct (sends snapshot).

---

## 2. Current system (confirmed in code)

Stack: Django microservices, `microservices/attendance-service` on port **8006**.

### Flow (ZKTeco, today)
```
ZKTeco ──PUSH(ADMS)──▶ nginx /iclock/ ──▶ attendance-service: zkteco_push()
                                              ├─ parse punch (user_id, ts, punch_type)
                                              ├─ identify staff (mapping → biometric_id/username → placeholder)
                                              ├─ resolve shift (employee → campus default → 08:00/grace 10)
                                              └─ upsert StaffAttendance (check_in/out, late, source='biometric')
```

### Real code references
| Piece | Location |
|---|---|
| Push receiver | `attendance/views.py:3175` `zkteco_push()` (GET→`"OK"` heartbeat, POST→ADMS text parse) |
| URLs | `attendance/urls.py` — `iclock/cdata`, `iclock/getrequest`, `iclock/registry`, `iclock/push`, `zkteco/push/`, plus device/mapping mgmt |
| nginx | `nginx/nginx.conf:238` `location /iclock/` → `attendance-service:8006` (and `:233` `/api/attendance/`) |
| Device model | `attendance/models.py:659` `ZKTecoDevice` — **no `device_type` field yet** |
| Mapping | `attendance/models.py:687` `ZKTecoEmployeeMapping` — unique `(device, device_user_id)` |
| Attendance row | `attendance/models.py:485` `StaffAttendance` — `source ∈ {biometric, manual}` (**no `face`**), `device → ZKTecoDevice` |
| Identity link | `User.biometric_id` / `username` fallback (views.py:3300) |

### Identification logic (reuse as-is)
1. `ZKTecoEmployeeMapping(device, device_user_id)` → `user`
2. fallback: `User.biometric_id == id` or `User.username == id` (scoped to org)
3. unknown → auto-create placeholder mapping for later linking (UI exists:
   `zkteco/unmapped-staff/`)

### Timing logic (reuse as-is)
`user.shift_timing` (custom or campus preset) → `CampusDefaultTiming(full_day)` →
hardcoded `08:00`, grace `10`. Late = `punch - shift_start > grace`.

### Infra already present
`redis`, `rabbitmq` (AMQP) in `docker-compose.yml`. **No MQTT broker yet** — added in Phase 2.

---

## 3. Target architecture — device-agnostic biometric layer

```
                    ┌───────────────── shared core (reused) ─────────────────┐
HTTP webhook ─┐     │ resolve_user_from_device(device, person_id)            │
 (Phase 1)    ├────▶│ resolve_shift_timing(user)                             │──▶ StaffAttendance
MQTT consumer ┘     │ upsert_staff_attendance(user, ts, direction, device)   │     (source='biometric')
 (Phase 2)          └────────────────────────────────────────────────────────┘
```

**Refactor first (no behavior change):** extract three helpers out of
`zkteco_push` so both ZKTeco and FoxFace share them:
```python
def resolve_user_from_device(device, device_user_id): ...   # steps 1–3 above
def resolve_shift_timing(user): ...                          # returns (shift_start, grace)
def upsert_staff_attendance(user, punch_dt, punch_type, device): ...
```
Then `zkteco_push` and `foxface_push` are just **parsers** that call the same core.

### 3.1 Model / naming generalization — ✅ DONE (commit pending)
The whole `ZKTeco*` brand naming was renamed to a device-agnostic `Biometric*`
layer (so FoxFace + future devices share it). Decision: `source='biometric'` kept
(no separate `'face'`).

| Old | New |
|---|---|
| `ZKTecoDevice` | **`BiometricDevice`** (+ `device_type ∈ {zkteco, foxface}`) |
| `ZKTecoEmployeeMapping` | **`BiometricEmployeeMapping`** |
| `ZKTecoDeviceSerializer` / `ZKTecoMappingSerializer` | `BiometricDeviceSerializer` / `BiometricEmployeeMappingSerializer` |
| view `zkteco_push` | `adms_push` (legacy ADMS/ZKTeco-protocol receiver) |
| views `zkteco_devices/…` | `biometric_devices`, `biometric_device_detail`, `biometric_mappings`, `biometric_mapping_detail`, `biometric_unmapped_staff` |
| API `/api/attendance/zkteco/*` | `/api/attendance/biometric/*` (`iclock/*` ADMS paths kept) |
| frontend `getZKDevices` … | `getBiometricDevices`, `getBiometricMappings`, … |

- Migration: `attendance/migrations/0009_rename_biometric_device.py`
  (`RenameModel` ×2 — preserves all rows & FKs — + `AddField device_type`).
- `related_name`: `zkteco_devices/zkteco_mappings` → `biometric_devices/biometric_mappings`.
- For FoxFace, `device_user_id` = FoxFace `person_id` = person's `employee_code`.

> NOTE: no running DB/container available, so the migration was hand-written
> (RenameModel). Run `manage.py migrate attendance` on deploy; verify with
> `manage.py makemigrations --check attendance` (should report no changes).

### 3.2 Phase 1 — HTTP webhook (`foxface_push`)
- New view `foxface_push()` parallel to `zkteco_push` (do **not** overload the ADMS parser).
- URL: `path('foxface/push/', views.foxface_push)`.
- nginx: add `location /foxface/ { set $svc "attendance-service:8006"; ... }`
  mirroring the `/iclock/` block at `nginx.conf:238`.
- Responsibilities: verify device by serial/id → parse JSON event → call the 3
  shared helpers → return the ack the device expects (likely `200` / `"OK"`).
- **Working payload assumption** (confirm against a real captured POST):
  ```json
  {
    "device_sn": "Y231218011000028",
    "person_id": "IAK-26-T-0001",
    "name": "Sheikh",
    "timestamp": "2026-06-13 08:05:00",
    "event": "recognized",
    "direction": "in"
  }
  ```

### 3.3 ✅ ACTUAL transport — vendor hosts the platform (no self-hosted broker needed)
Confirmed 2026-06-15: the vendor runs a **hosted platform** at
`https://foxface.foxit.pk` (Foxit, version 9.0.0.85) that already does device
ingestion + **MQTT (Running)** + a documented **REST API Portal**. So we do NOT
build EMQX/webhook ourselves — we **consume their API** into our `StaffAttendance`.

**API Portal (REST, pull-based)** — two API-key groups:
- `DEVICE` — API_KEY `Foxit_12345678_098765432109879036`
  - `GET ALL DEVICES JSON`
  - `POST ADD USER DEVICE MAPPING`, `POST SYNC USER IN DEVICE`, `POST SYNC USER IN ALL DEVICE`
  - `DELETE USER IN DEVICE` / `… ALL DEVICES` / `… ALL DEVICES & DATABASE`
- `USER LOGS` — API_KEY `Foxit_12345678_0987654321098112`
  - `GET ALL USERLOGS TIME WISE`, `GET USERLOGS BY DEVICE ID`,
    `GET USERLOGS WITH IN OUT`, `GET USERLOGS BY DATE RANGE`

**Our integration (recommended):** a scheduled **API-pull** command in
attendance-service polls `GET USERLOGS BY DATE RANGE / WITH IN OUT` (userlogs key)
every few minutes → for each log calls the **same shared helpers**
(`resolve_user_from_device` → `resolve_shift_timing` → `upsert_staff_attendance`).
Idempotent (we upsert by user+date). Enrollment = push our staff via
`SYNC USER IN DEVICE` (device key). MQTT real-time can be added later; API pull first.

> Exact endpoint URLs / params / response JSON still needed (portal accordions
> must be expanded). Store base URL + both API keys in env.

### 3.3a ✅ DEVICE ONLINE (2026-06-23)
Device `Al Khair` (SN `2385083`) now connects and recognises faces ("Rahat Ali —
Access granted!"). MQTT blocker resolved. Logs are now accumulating on the platform.

### 3.3b ✅ Integration code built (2026-06-23, API-pull, contract pending)
Implemented in attendance-service:
- **`attendance/services/biometric_core.py`** — shared device-agnostic core:
  `resolve_device`, `resolve_user_from_device`, `resolve_shift_start_grace`,
  `upsert_staff_attendance`, `process_punch`. Single source of truth for
  identification + timing + idempotent upsert.
- **`attendance/services/foxface_client.py`** — `FoxFaceClient` (REST pull) +
  `normalize_log`. **Only place** that knows the vendor wire format; endpoint
  path / param names / JSON field names are centralised placeholders.
- **`attendance/management/commands/sync_foxface_logs.py`** — scheduled pull
  (`--minutes` overlap window or `--from/--to`); maps each log to its device by
  serial, feeds `process_punch`. Multi-tenant: one tenant key covers all schools.
- **`adms_push`** refactored to call the same `process_punch` (no duplicate logic).
- Settings: `FOXFACE_BASE_URL`, `FOXFACE_USERLOGS_API_KEY`, `FOXFACE_USERLOGS_PATH`,
  `FOXFACE_API_KEY_HEADER` (env). `requests` added to requirements.

### 3.3c ✅ Auto-link, live status & device-user sync built (2026-06-24)
All three driven by the same contract-agnostic client; only endpoint paths/field
names are pending.
- **Auto-link** (works now, no vendor API): `biometric_core.upsert_device_user_mapping`
  + `auto_link_placeholder_mappings` match a device user id → staff by
  `biometric_id` then `username`. Runs on every punch/pull, on user-sync, and via a
  principal-triggered button. Convention: device Person ID = staff `biometric_id`
  (ideally = `employee_code`).
- **Live status**: `BiometricDevice.is_online` + `last_status_check` (migration 0010),
  mirrored from the platform by `sync_foxface_device_status` (uses `GET ALL DEVICES`,
  DEVICE key). UI card shows real 🟢 Online / 🔴 Offline, falling back to the
  Active/Inactive admin flag when never synced.
- **Device-user pre-load**: `sync_foxface_users` / `POST biometric/devices/<id>/sync-users/`
  pull enrolled users (`GET USERS`, DEVICE key) into mappings so a principal can link
  them before anyone punches. Frontend: "Sync device users" + "Auto-link" buttons
  (principal-only) on the Device Mapping tab.

**New endpoints/commands:** `POST biometric/devices/<id>/sync-users/`,
`POST biometric/auto-link/`; `manage.py sync_foxface_logs|sync_foxface_users|sync_foxface_device_status`.

**Env (attendance-service):**
```
FOXFACE_BASE_URL=https://foxface.foxit.pk
FOXFACE_API_KEY_HEADER=API_KEY              # confirm from portal
FOXFACE_USERLOGS_API_KEY=Foxit_12345678_0987654321098112
FOXFACE_DEVICE_API_KEY=Foxit_12345678_098765432109879036
FOXFACE_USERLOGS_PATH=<GET USERLOGS BY DATE RANGE path>
FOXFACE_DEVICES_PATH=<GET ALL DEVICES path>
FOXFACE_USERS_PATH=<GET USERS path>
```

### 3.3d ✅ USER LOGS contract CONFIRMED + wired + verified (2026-06-24)
Tested live against the portal. **All params go in HTTP headers** (not query string):
- Header `key` = API key (USER LOGS key). Date params `fromDate`/`toDate` = `YYYY-MM-DD`,
  also headers. `LocationId` optional header (we don't need it — we scope by deviceId).
- **GET USERLOGS BY DATE RANGE** = `http://foxface.foxit.pk/api/UserLogApi/GetUserLogsByDate`
  (others: `GetAllUserLogsTimeWise`, `GetUserLogsByDeviceId` [hdr `deviceId`],
  `GetUserLogsInOut`, `GetUserSyncedDevices` [hdr `empCode`]).
- Response: `{"statusCode":200,"data":[{deviceId,employeeCode,employeeName,logType,status,time}]}`.
  `status`: **`entr`=in / `exit`=out**. `time` = ISO. `employeeCode` = device user id.
  404 `Record not found` = empty result (handled as []).
- Defaults baked into settings: `FOXFACE_USERLOGS_PATH`, `FOXFACE_API_KEY_HEADER=key`,
  keys. `foxface_client._FIELD_*` set to the real keys; `_get` sends params as headers.
- Verified: 187 valid rows pulled; our device `2385083` → empCode `1234567891`, 36
  `entr` punches on 2026-06-23 (matches the on-device "Access granted" test).

**To mark attendance from these logs (no more API blocker):**
1. Register device serial `2385083` in SMS (principal, Device Mapping → Add Device).
2. Give the staff a `biometric_id` = their device `employeeCode` (e.g. `1234567891`) → auto-links.
3. Schedule `manage.py sync_foxface_logs` (~every 5 min). Idempotent.

### 3.3e ✅ Live status + device-user discovery CONFIRMED + wired (2026-06-24)
Both also authorize with the **USER LOGS key** (the DEVICE key 401s on this deployment):
- **Live status** = `GET http://foxface.foxit.pk/api/DeviceApi/GetAllDevicesJson`.
  Device object: `{id, deviceId, deviceName, status (Active/InActive admin flag),
  connectionStatus (bool = LIVE online/offline), connectionStatusDatetime, ipAddress,...}`.
  We mirror `connectionStatus` → `BiometricDevice.is_online`. Verified: device `2385083`
  `connectionStatus=True`.
- **Enrolled users** = `GET .../api/UserLogApi/GetUserLogsByDeviceId` (header `deviceId`);
  we dedupe log rows by `employeeCode` → distinct users. Verified: 2385083 →
  `1234567891` Rahat Ali, `1234567897` Ubaid Qureshi. (No separate "list users"
  endpoint exists; the DEVICE-section POSTs are for *pushing* staff onto devices.)
- Settings defaults set: `FOXFACE_DEVICES_PATH=api/DeviceApi/GetAllDevicesJson`,
  `FOXFACE_USERS_PATH=api/UserLogApi/GetUserLogsByDeviceId`. `get_devices`/`get_device_users`
  use the userlogs key. **All three features now fully wired — nothing pending.**

**Enrollment (push staff → device), for later:** DEVICE section `POST SYNC USER IN DEVICE`
/ `ADD USER RECORD SYNC IN SINGLE DEVICE` (DEVICE key) — use to register SMS staff onto a
device with Person ID = employee_code. Not required for pulling attendance.

### ⚠️ ~~BLOCKER (2026-06-15): device OFFLINE~~ — RESOLVED 2026-06-23
~~Dashboard = `00 online | 50 offline`~~; was device MQTT misconfig
(`Cloud Address 172.168.2.90`, `Port 61613`, "Not connected. Login failed!" —
private LAN IP couldn't reach cloud; broker `Cloud Port 3883`). Now online.
Still do the **DHCP reservation** (portal showed IP drifting `10.0.11.11` →
`10.0.11.48`) so the device IP stays fixed.

---

## 4. Network / static IP standard (per school)

For a SaaS across many networks, standardize the onboarding:

1. **DHCP reservation (preferred):** bind device MAC → fixed IP on the school's
   router. Device stays on DHCP, always gets the same IP, no per-subnet guesswork.
   - Alternative (Option A): uncheck DHCP on device, set a static IP **outside the
     DHCP pool** (else conflicts). Avoid at scale — every school's subnet differs.
2. **Cloud path needs no inbound access** — device pushes **out** (HTTP/MQTT), so
   no port-forwarding/firewall holes at the school. Local IP is only for on-site admin.
3. **Time:** set timezone **GMT+05:00** (or a reachable NTP server) on every device.

---

## 5. Per-device config template (apply on every deploy)

| Setting | Value |
|---|---|
| DHCP reservation | MAC bound on school router |
| Timezone | GMT+05:00 (or NTP) |
| Opening Method | Whitelist + Facial Verification |
| **Phase 1** HTTP Subscription | Server = `<cloud>`, Auth/Identification subscription = Upload |
| **Phase 2** MQTT | Enable, `mqtt.<domain>:8883`, topic `mqtt/face/<deviceId>`, per-device creds, `Identification Log = Upload w/ Image` |
| Person ID convention | FoxFace `person_id` = system `employee_code` |

Keep this as a printed onboarding checklist — target: a new school live in ~15 min.

---

## 6. Phased plan

**Phase 0 — Discovery (blocking, small):**
- [ ] Capture a **real** FoxFace HTTP Subscription POST (point it at a test endpoint /
      requestbin) and confirm exact JSON fields → fill §3.2 payload.
- [ ] Confirm enrollment API (push photo+person_id) vs on-device only.

**Phase 1 — Staff attendance via HTTP push (drop-in, no new infra):**
- [ ] Migration: add `device_type` to device model; register the FQ8i as `foxface`.
- [ ] Refactor `zkteco_push` → 3 shared helpers (no behavior change).
- [ ] Add `foxface_push()` view + `foxface/push/` URL + nginx `/foxface/` route.
- [ ] Identity link: set staff `biometric_id = employee_code`.
- [ ] Test: mark on machine → `StaffAttendance` row, `source='biometric'`, correct
      `late_minutes`, visible in Staff Attendance UI.
- [ ] Generalize device-mgmt UI labels (ZKTeco → Biometric/Face).
- [ ] Roll out to all 8 schools via the §5 template.

**Phase 2 — MQTT backbone (SaaS scale + control):**
- [ ] Add EMQX to compose; MQTT consumer worker → same shared helpers.
- [ ] Online/offline + heartbeat dashboard per device.
- [ ] Remote enrollment API (push student/staff photo + person_id to device).

**Phase 3 — Students (optional):**
- [ ] Enroll student faces (bulk push or on-device).
- [ ] Extend core to write `StudentAttendance` when person resolves to a student.

**Phase 4 — Cleanup:**
- [ ] Decommission ZKTeco routes once FoxFace is live everywhere; keep the generic layer.

---

## 7. Files that will change

| File | Change |
|---|---|
| `attendance/models.py` | `device_type` on device model; maybe `source='face'` |
| `attendance/views.py` | extract `resolve_user_from_device` / `resolve_shift_timing` / `upsert_staff_attendance`; add `foxface_push()` |
| `attendance/urls.py` | add `foxface/push/` |
| `attendance/migrations/` | additive migration (`device_type`) |
| `nginx/nginx.conf` | add `location /foxface/` → `attendance-service:8006` |
| `docker-compose.yml` | (Phase 2) EMQX broker |
| `attendance/management/commands/` | (Phase 2) `consume_face_mqtt.py` |
| frontend device-mgmt pages | device-type / face-machine labels |

---

## 8. Open decisions (need your call)

1. **Source label:** keep `source='biometric'` for FoxFace, or add a distinct
   `'face'` for reporting? *(Recommend: keep `biometric` in Phase 1, add `face` later if needed.)*
2. **Phase 1 transport:** confirm HTTP push first (fast), MQTT as Phase 2 — agreed?
3. **Enrollment:** does the FQ8i expose an API to push photos, or on-device only?
   (Determines Phase 2 remote-enroll scope.)
4. **Students:** Phase 3 staff-only first — confirm.
5. **Per-device MQTT creds** vs one shared cred — security vs simplicity.

> **Next step:** Phase 0 — capture one real FoxFace POST so §3.2 is exact, then
> write the Phase 1 code (refactor + `foxface_push` + route + migration).
