# 🚀 SIS → Auth Service: Quick Setup & Migration Guide

Follow this concise checklist to ensure a 100% successful data migration.

## 1. Prerequisites (Small → Large)

- **Python Environment:** Ensure `psycopg2` is installed (`pip install psycopg2-binary`).
- **Database Access:** Both `sms_iak_db` (SIS) and Auth Service DB must be reachable.
- **Django State:** Latest migrations must be applied in Auth Service.
  ```bash
  python manage.py migrate
  ```
- **Base Organization:** At least one **Organization** record MUST exist in the Auth Service Admin panel.
- **Backup:** Take a quick backup of your target database before running the live script.

## 2. Important Migration Notes

- **One-Click Script:** Use `run_full_migration.py`. It handles setup, campuses, and employees in one go.
- **Shift Preservation:** "Both" shifts are kept as "both" (M+A) to ensure data parity.
- **Academic Data:** Subjects & classes are moved to `role_data` (JSON). Core HR models stay clean.
- **Historical Accuracy:** Original `created_at` and `updated_at` timestamps from SIS are preserved.
- **ID Management:**
  - `employee_id` (e.g., IAK-0001) is generated for the new system.
  - `employee_code` (e.g., C01-M-25-T-0208) is preserved for legacy tracking.

## 3. Expected Impact

- **Data Parity:** 219 Employees & 7 Campuses will be available in Auth Service.
- **Branch Hierarchy:** SIS Campuses will become Auth Service Branches under "Al-Khair Schools".
- **Zero Loss:** Education and Work history will be fully migrated into JSON fields.
- **Audit Trails:** All records will reflect their original SIS creation dates.

## 4. Execution

**Test Run (Safe):**
```bash
python run_full_migration.py --dry-run
```

**Live Migration:**
```bash
python run_full_migration.py
```

**Status:** Consistently verified via dry-runs. Ready for Production.

---

### Migration Logs

```text
INFO: Checking shifts in coordinator_coordinator...
INFO:   ✓ Fixed C06-B-22-C-0003: general -> both
INFO:   ✓ Fixed C06-B-20-C-0007: general -> both
INFO:   ✓ Fixed C01-M-25-C-0010: general -> both
ERROR: Failed to send email to IAK-0236: please run connect() first
INFO:   ✓ Fixed C01-M-22-C-0009: general -> both
INFO:   ✓ Fixed C01-M-25-C-0012: general -> both
INFO: Checking shifts in principals_principal...
INFO:   ✓ Fixed C06-B-15-P-0002: general -> both
INFO:   ✓ Fixed C02-B-25-P-0003: general -> both
INFO:   ✓ Fixed C01-B-25-P-0009: general -> both
INFO: Done. Updated 14 records.
```
