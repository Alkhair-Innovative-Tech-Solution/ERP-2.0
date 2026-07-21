# CRUD Forms E2E Test Plan — Phase 2

**Date:** 2026-04-22
**Scope:** Verify rebuilt CRUD forms (rhf+zod) for branches, departments, designations, institutions.

## Goal

Confirm that the rhf+zod rebuild is wired correctly end-to-end: form submission → backend → list refresh → edit pre-population → inline validation errors render before network calls.

## Non-goals

- Delete flows (soft-delete audited in Phase 1).
- Exhaustive validation coverage (one case per entity is enough to prove the zod→inline-error wiring).
- Load/perf testing.

## Runner

Playwright MCP (chromium cached at `~/.cache/ms-playwright/chromium-1217`).
Backend `http://localhost:8000`, frontend `http://localhost:3005`.
Login: `AIT01-G-26-T-0001` / `12345`, once at session start.

## Test Matrix

For each entity, three checks run in order. If check 1 fails, checks 2-3 for that entity are skipped.

| Entity | Surface | Check 1: Create | Check 2: Edit | Check 3: Validation |
|--------|---------|-----------------|---------------|----------------------|
| Branch | `/branches` modal | Fill name+code+institution → submit → row in list | Reopen → change name → save → list reflects | Clear `branch_name` → submit → inline error shows, no POST fires |
| Department | `/departments` modal | Fill name+code+institution → submit → card in grid | Reopen → change description → save → list reflects | `dept_code = "AB$"` → submit → inline regex error |
| Designation | `/designations` modal | Fill name+code+department → submit → row in table | Reopen → change name → save → list reflects | Clear `position_name` → submit → inline error |
| Institution | `/institutions/new` + `[id]/edit` | Pick org → fill code+name → submit → redirect to `/institutions` | Open edit → change name → save → redirect | `contact_number = "12345"` → submit → inline phone error |

## Record Naming

Test records suffixed with `-T${timestamp}` so they are identifiable and don't collide with prior test runs.

## Reporting

Final table — entity × check × pass/fail + short note on any failure. One PROJECT_LOG entry summarizing the results.

## Exit Criteria

All 12 checks pass. If any check fails, log the failure, fix root cause, re-run only the failed entity's checks.
