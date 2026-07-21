# API Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate three silent-failure classes across the Auth-service API: Pydantic v2 null-rejection, Ninja body-vs-query misrouting, and scattered frontend error parsing.

**Architecture:** Three independent work units — backend schema hygiene, backend body typing, frontend error normalization. All changes preserve the existing `/api/employees/*` contract. No DB migrations. No new dependencies.

**Tech Stack:** Django 5 + django-ninja (pydantic v2), Next.js 16, pytest-django (backend tests), Node smoke test (frontend utility).

**Spec:** Builds on findings from `docs/superpowers/specs/2026-04-22-crud-forms-e2e-test-plan.md` (null 422 on designation PUT, `payload: dict` → 422 on branch POST, React crash on unnormalized `{detail: [...]}`).

**Parallelism:** Tasks 1, 2, 3 touch disjoint file sets and can run concurrently. Task 4 depends on all three.

---

## File Structure

| File | Change | Responsibility |
|------|--------|----------------|
| `Backend/src/employees/api.py` | Modify | Schema types (Task 1), body annotations + new create/update schemas (Task 2) |
| `Backend/src/employees/tests_api_hardening.py` | Create | Regression tests for null-field updates + JSON body POST (Tasks 1, 2) |
| `frontend/src/utils/api.ts` | Modify | Add `normalizeApiError`, update `fetchWithAuth` return shape (Task 3) |
| `frontend/src/utils/api.test.mjs` | Create | Node smoke test for `normalizeApiError` (Task 3) |
| `frontend/src/app/branches/page.tsx`, `departments/page.tsx`, `designations/page.tsx`, `institutions/new/page.tsx`, `institutions/[id]/edit/page.tsx` | Modify | Swap ad-hoc error parsing for the new helper (Task 4 sweep) |
| `PROJECT_LOG.md` | Modify | Change-history entry after Task 4 verification (Task 4) |

---

## Task 1: Backend schema `Optional[]` sweep

**Root cause:** Pydantic v2 treats `field: str = None` as "required str with default None" and rejects null at validation time. `DesignationUpdateSchema` already bit us (PUT 422 during E2E). Audit and fix every instance.

**Files:**
- Modify: `Backend/src/employees/api.py`
- Test: `Backend/src/employees/tests_api_hardening.py`

- [ ] **Step 1.1: Write the failing test**

Create `Backend/src/employees/tests_api_hardening.py` (new file):

```python
"""Regression tests for API hardening work (2026-04-22)."""
import json
import pytest
from employees.models import Department, Designation, Institution, Organization


@pytest.fixture
def org(db):
    return Organization.objects.create(org_code="IAK", name="Alkhair")


@pytest.fixture
def institution(db, org):
    return Institution.objects.create(
        organization=org, inst_code="T-INST", name="Test Institution", inst_type="educational"
    )


@pytest.fixture
def department(db, institution):
    return Department.objects.create(
        institution=institution, dept_code="TDEPT", dept_name="Test Dept"
    )


@pytest.fixture
def designation(db, department):
    return Designation.objects.create(
        department=department, position_code="TPOS", position_name="Test Position"
    )


class TestOptionalNullUpdates:
    """Pydantic schemas must accept explicit null for optional fields."""

    @pytest.mark.django_db
    def test_designation_update_accepts_null_description(self, api_client, designation):
        response = api_client.put(
            f"/api/employees/designations/{designation.id}",
            data=json.dumps({"position_name": "Renamed", "description": None}),
            content_type="application/json",
        )
        assert response.status_code == 200, response.content
        designation.refresh_from_db()
        assert designation.position_name == "Renamed"
        assert designation.description is None

    @pytest.mark.django_db
    def test_department_update_accepts_null_description(self, api_client, department):
        response = api_client.put(
            f"/api/employees/departments/{department.dept_code}",
            data=json.dumps({"dept_name": "Renamed", "description": None, "institution_code": None}),
            content_type="application/json",
        )
        assert response.status_code == 200, response.content
```

- [ ] **Step 1.2: Run tests to verify failure on designation**

Run: `cd Backend/src && pytest employees/tests_api_hardening.py::TestOptionalNullUpdates -v`

Expected: `test_designation_update_accepts_null_description` FAILS with 422. `test_department_update_accepts_null_description` already passes (sanity baseline).

Note: if the designation test already passes, the prior Optional fix has persisted — skip to Step 1.4 but still run the full audit in Step 1.3.

- [ ] **Step 1.3: Audit and fix all `: T = None` in api.py**

Run an audit search:

```bash
cd Backend/src
grep -nE ':\s*(str|int|float|bool|date|dict|list)\s*=\s*None' employees/api.py
```

Expected leftovers (as of this plan's writing) are zero — the prior session already patched `DesignationUpdateSchema`. Confirm with the grep above.

If any hits remain, replace each `: T = None` with `: Optional[T] = None` directly in `Backend/src/employees/api.py`. `Optional` is already imported at line 11.

- [ ] **Step 1.4: Run test to verify it passes**

Run: `cd Backend/src && pytest employees/tests_api_hardening.py::TestOptionalNullUpdates -v`

Expected: both tests PASS.

- [ ] **Step 1.5: Commit**

```bash
git add Backend/src/employees/api.py Backend/src/employees/tests_api_hardening.py
git commit -m "test: lock in Optional[] schema contract for designation+department updates"
```

---

## Task 2: Replace `payload: dict` with proper Pydantic schemas

**Root cause:** Ninja routes `payload: dict` as a query param (422 "Field required"). The prior session patched this with `Body[dict]` but that's a workaround — no field-level validation, no OpenAPI schema, no type safety in the endpoint body. Replace with real schemas for `create_institution`, `update_institution`, `create_branch`, `update_branch`.

**Files:**
- Modify: `Backend/src/employees/api.py`
- Test: `Backend/src/employees/tests_api_hardening.py`

- [ ] **Step 2.1: Write the failing test**

Append to `Backend/src/employees/tests_api_hardening.py`:

```python
class TestBodySchemaRouting:
    """Endpoints accept JSON bodies, validate required fields, and surface per-field errors."""

    @pytest.mark.django_db
    def test_create_institution_rejects_missing_name(self, api_client, org):
        response = api_client.post(
            "/api/employees/institutions",
            data=json.dumps({"organization_code": "IAK", "inst_code": "X-INST"}),
            content_type="application/json",
        )
        # Missing `name` must fail with 422 and cite the field.
        assert response.status_code == 422, response.content
        body = response.json()
        assert "detail" in body
        locs = [".".join(str(p) for p in err.get("loc", [])) for err in body["detail"]]
        assert any("name" in loc for loc in locs), locs

    @pytest.mark.django_db
    def test_create_institution_success(self, api_client, org):
        response = api_client.post(
            "/api/employees/institutions",
            data=json.dumps({
                "organization_code": "IAK",
                "inst_code": "X-INST",
                "name": "X Institution",
                "inst_type": "educational",
            }),
            content_type="application/json",
        )
        assert response.status_code == 201, response.content
        assert response.json()["inst_code"] == "X-INST"

    @pytest.mark.django_db
    def test_create_branch_rejects_missing_branch_name(self, api_client, institution):
        response = api_client.post(
            "/api/employees/branches",
            data=json.dumps({"branch_code": "X-BR", "institution_code": institution.inst_code}),
            content_type="application/json",
        )
        assert response.status_code == 422, response.content
        locs = [".".join(str(p) for p in err.get("loc", [])) for err in response.json()["detail"]]
        assert any("branch_name" in loc for loc in locs), locs

    @pytest.mark.django_db
    def test_update_branch_accepts_partial_payload(self, api_client, institution):
        from employees.models import Branch
        branch = Branch.objects.create(
            institution=institution, branch_code="X-BR", branch_name="Before"
        )
        response = api_client.put(
            f"/api/employees/branches/{branch.branch_code}",
            data=json.dumps({"branch_name": "After"}),
            content_type="application/json",
        )
        assert response.status_code == 200, response.content
        branch.refresh_from_db()
        assert branch.branch_name == "After"
```

- [ ] **Step 2.2: Run tests to verify failure**

Run: `cd Backend/src && pytest employees/tests_api_hardening.py::TestBodySchemaRouting -v`

Expected: all four tests FAIL — `test_create_institution_rejects_missing_name` likely returns 201 (no field validation), others behave unpredictably because `Body[dict]` accepts anything.

- [ ] **Step 2.3: Add new schemas next to existing institution/branch schemas**

In `Backend/src/employees/api.py`, near the `InstitutionSchema` / `BranchSchema` block (around line 41-67), append:

```python
class InstitutionCreateSchema(BaseModel):
    """Request body for POST /institutions."""
    organization_code: Optional[str] = None  # Falls back to first Organization when absent
    inst_code: str
    name: str
    inst_type: str = "educational"
    address: Optional[str] = None
    city: Optional[str] = None
    contact_number: Optional[str] = None


class InstitutionUpdateSchema(BaseModel):
    """Request body for PUT /institutions/{id}. All fields optional."""
    organization_code: Optional[str] = None
    inst_code: Optional[str] = None
    name: Optional[str] = None
    inst_type: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    contact_number: Optional[str] = None


class BranchCreateSchema(BaseModel):
    """Request body for POST /branches."""
    institution_code: str
    branch_code: str
    branch_name: str
    status: str = "active"
    address: Optional[str] = None
    city: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    branch_head_name: Optional[str] = None


class BranchUpdateSchema(BaseModel):
    """Request body for PUT /branches/{key}. All fields optional."""
    institution_code: Optional[str] = None
    branch_code: Optional[str] = None
    branch_name: Optional[str] = None
    status: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    contact_number: Optional[str] = None
    email: Optional[str] = None
    branch_head_name: Optional[str] = None
```

- [ ] **Step 2.4: Swap `Body[dict]` for the new schemas in the 4 routes**

In `Backend/src/employees/api.py`:

1. `def create_institution(request, payload: Body[dict]):` → `def create_institution(request, payload: InstitutionCreateSchema):`
2. `def update_institution(request, institution_id: str, payload: Body[dict]):` → `def update_institution(request, institution_id: str, payload: InstitutionUpdateSchema):`
3. `def create_branch(request, payload: Body[dict]):` → `def create_branch(request, payload: BranchCreateSchema):`
4. `def update_branch(request, branch_key: str, payload: Body[dict]):` → `def update_branch(request, branch_key: str, payload: BranchUpdateSchema):`

Inside each function body, update payload access from `payload.get("x")` / `payload["x"]` to attribute access (`payload.x`). Dump to dict via `payload.dict(exclude_unset=True)` when you need to iterate only user-supplied keys (used in `update_branch` and `update_institution` — replaces the current `if "field" in payload:` pattern).

Example — `update_branch` body (replace current content):

```python
data = payload.dict(exclude_unset=True)

inst_code = data.get("institution_code")
if inst_code and inst_code != branch.institution.inst_code:
    inst = Institution.objects.filter(inst_code=inst_code, is_deleted=False).first()
    if not inst:
        return 400, {"error": f"Institution '{inst_code}' not found"}
    branch.institution = inst

new_code = data.get("branch_code")
if new_code and new_code != branch.branch_code:
    if Branch.objects.filter(branch_code=new_code).exclude(pk=branch.pk).exists():
        return 400, {"error": f"Branch code '{new_code}' already exists"}
    branch.branch_code = new_code

for field in ("branch_name", "status", "address", "city", "contact_number", "email", "branch_head_name"):
    if field in data:
        setattr(branch, field, data[field])

try:
    branch.save()
except Exception as e:
    return 400, {"error": str(e)}
```

`create_institution` / `update_institution` mirror the same attribute-access pattern — replace `payload.get("x")` with `payload.x` (create path, where fields are populated) or `data = payload.dict(exclude_unset=True); data.get("x")` (update path, where absent-vs-null matters).

- [ ] **Step 2.5: Run tests to verify they pass**

Run: `cd Backend/src && pytest employees/tests_api_hardening.py::TestBodySchemaRouting -v`

Expected: all four tests PASS.

- [ ] **Step 2.6: Full regression — re-run the hardening test module**

Run: `cd Backend/src && pytest employees/tests_api_hardening.py -v`

Expected: all six tests (Task 1 + Task 2) PASS.

- [ ] **Step 2.7: Commit**

```bash
git add Backend/src/employees/api.py Backend/src/employees/tests_api_hardening.py
git commit -m "refactor(api): replace payload: dict with InstitutionCreate/Update + BranchCreate/Update schemas"
```

---

## Task 3: Centralize frontend error-envelope normalization

**Root cause:** Every page's `onSubmit` contains 10 lines of defensive parsing for Ninja's three response shapes (`{field_errors: {...}}`, `{detail: [{msg, loc}...]}`, `{error: "..."}`) plus `"Network error"` fallback. React crashed when someone passed the `detail` array directly to a text slot. DRY it into one helper.

**Files:**
- Modify: `frontend/src/utils/api.ts`
- Create: `frontend/src/utils/api.test.mjs` (Node smoke test — no test runner dependency)

- [ ] **Step 3.1: Write the failing test**

Create `frontend/src/utils/api.test.mjs`:

```javascript
// Node smoke test for normalizeApiError. Run with: node src/utils/api.test.mjs
// No test framework — just assert + exit code.
import assert from "node:assert/strict";
import { normalizeApiError } from "./api.js";

// Case 1: Ninja field_errors map
assert.deepEqual(
  normalizeApiError({ field_errors: { branch_name: "Required", city: "Too long" } }),
  { fieldErrors: { branch_name: "Required", city: "Too long" }, message: null },
  "field_errors must pass through"
);

// Case 2: Ninja detail array (pydantic validation errors)
const detail = normalizeApiError({
  detail: [
    { type: "missing", loc: ["body", "payload", "name"], msg: "Field required" },
    { type: "value_error", loc: ["body", "payload", "city"], msg: "Invalid city" },
  ],
});
assert.deepEqual(detail.fieldErrors, { name: "Field required", city: "Invalid city" }, "detail → fieldErrors by last loc segment");
assert.equal(detail.message, null, "detail must not set a top-level message when fieldErrors exist");

// Case 3: detail with no usable loc → fallback to joined message
const noLoc = normalizeApiError({ detail: [{ type: "x", msg: "bad thing" }] });
assert.equal(noLoc.fieldErrors, null);
assert.equal(noLoc.message, "bad thing");

// Case 4: Plain string error field (e.g. create_branch exception handler)
assert.deepEqual(
  normalizeApiError({ error: "Branch code exists" }),
  { fieldErrors: null, message: "Branch code exists" }
);

// Case 5: Empty / unknown body
assert.deepEqual(
  normalizeApiError({}),
  { fieldErrors: null, message: "Request failed." }
);
assert.deepEqual(
  normalizeApiError(null),
  { fieldErrors: null, message: "Request failed." }
);

// Case 6: String that looks like JSON-wrapped error (non-dict input)
assert.deepEqual(
  normalizeApiError("boom"),
  { fieldErrors: null, message: "Request failed." },
  "Non-object inputs must not crash"
);

console.log("normalizeApiError: 6/6 cases passed");
```

- [ ] **Step 3.2: Run the test to verify it fails**

Run:

```bash
cd frontend/src/utils && node --experimental-vm-modules api.test.mjs
```

Expected: `Error [ERR_MODULE_NOT_FOUND]` or `normalizeApiError is not a function` — the function doesn't exist yet.

- [ ] **Step 3.3: Add `normalizeApiError` to `api.ts`**

In `frontend/src/utils/api.ts`, at the top (after `API_BASE_URL`), add:

```typescript
export type NormalizedError = {
  fieldErrors: Record<string, string> | null;
  message: string | null;
};

/**
 * Normalize Ninja / Django error response bodies into a single shape.
 * Handles: {field_errors}, {detail: [...]}, {error: "..."}, and empty/unknown.
 */
export function normalizeApiError(body: unknown): NormalizedError {
  if (!body || typeof body !== "object") {
    return { fieldErrors: null, message: "Request failed." };
  }
  const b = body as Record<string, unknown>;

  // Preferred: backend already emitted a field_errors map.
  if (b.field_errors && typeof b.field_errors === "object") {
    return { fieldErrors: b.field_errors as Record<string, string>, message: null };
  }

  // Ninja pydantic validation shape.
  if (Array.isArray(b.detail)) {
    const fieldErrors: Record<string, string> = {};
    const messages: string[] = [];
    for (const entry of b.detail as any[]) {
      const msg = typeof entry?.msg === "string" ? entry.msg : JSON.stringify(entry);
      const loc = Array.isArray(entry?.loc) ? entry.loc : [];
      const fieldName = loc.length ? String(loc[loc.length - 1]) : "";
      if (fieldName && fieldName !== "payload" && fieldName !== "body") {
        fieldErrors[fieldName] = msg;
      } else {
        messages.push(msg);
      }
    }
    if (Object.keys(fieldErrors).length) return { fieldErrors, message: null };
    return { fieldErrors: null, message: messages.join("; ") || "Validation failed." };
  }

  if (typeof b.error === "string") {
    return { fieldErrors: null, message: b.error };
  }
  if (typeof b.detail === "string") {
    return { fieldErrors: null, message: b.detail };
  }

  return { fieldErrors: null, message: "Request failed." };
}
```

- [ ] **Step 3.4: Run the smoke test — verify pass**

Since `api.ts` compiles to `api.js` via Next, the `.mjs` import of `./api.js` needs a tiny runtime shim. Easiest path: point the import at a tsc-transpiled build, OR inline a plain `.mjs` copy for the test.

Use the inline approach. Rename the test entry point:

```bash
cd frontend
npx tsc --target es2020 --module esnext --moduleResolution node \
  --outDir /tmp/api-test-build src/utils/api.ts
node --input-type=module -e "
  import('/tmp/api-test-build/api.js').then(async m => {
    globalThis.normalizeApiError = m.normalizeApiError;
    await import('./src/utils/api.test.mjs').catch(e => { console.error(e); process.exit(1); });
  });
"
```

Simpler alternative (do this instead if the above errors on your Node version): change the first line of `api.test.mjs` from `import { normalizeApiError } from "./api.js";` to a dynamic import that transpiles via `tsx`:

```bash
cd frontend && npx tsx src/utils/api.test.mjs
```

`tsx` is already transitively available via Next.js's dev dependencies. Run:

```bash
cd frontend && npx tsx src/utils/api.test.mjs
```

Expected output: `normalizeApiError: 6/6 cases passed` and exit code 0.

- [ ] **Step 3.5: Wire `normalizeApiError` into `fetchWithAuth` convenience wrapper**

Leave `fetchWithAuth` returning the raw `Response` (changing it breaks every caller). Instead, add a sibling helper that most pages will prefer:

Append to `frontend/src/utils/api.ts`:

```typescript
export type ApiResult<T = unknown> =
  | { ok: true; status: number; data: T }
  | { ok: false; status: number; fieldErrors: Record<string, string> | null; message: string };

/**
 * Fetch + parse + normalize in one call. Most forms should use this instead of fetchWithAuth.
 */
export async function apiCall<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<ApiResult<T>> {
  const res = await fetchWithAuth(endpoint, options);
  let body: unknown = null;
  try { body = await res.json(); } catch { /* empty body is fine */ }

  if (res.ok) return { ok: true, status: res.status, data: (body as T) };

  const { fieldErrors, message } = normalizeApiError(body);
  return {
    ok: false,
    status: res.status,
    fieldErrors,
    message: message ?? "Request failed.",
  };
}
```

- [ ] **Step 3.6: Commit**

```bash
git add frontend/src/utils/api.ts frontend/src/utils/api.test.mjs
git commit -m "feat(frontend): add normalizeApiError + apiCall helper for unified error handling"
```

---

## Task 4: Migrate form pages to `apiCall` + E2E re-verification

**Goal:** Replace the ~10-line defensive parse block in every form page with one `apiCall(...)` invocation, then re-run the 12-check Playwright sweep from the spec to confirm no regression.

**Files:**
- Modify: `frontend/src/app/branches/page.tsx`, `frontend/src/app/departments/page.tsx`, `frontend/src/app/designations/page.tsx`, `frontend/src/app/institutions/new/page.tsx`, `frontend/src/app/institutions/[id]/edit/page.tsx`
- Modify: `PROJECT_LOG.md`

- [ ] **Step 4.1: Migrate `branches/page.tsx` `handleSave`**

Locate the function (grep for `async function handleSave(data: BranchOutput)`). Replace its body so the whole function reads:

```typescript
async function handleSave(data: BranchOutput): Promise<SaveResult> {
  const payload = {
    branch_name: data.branch_name.trim(),
    branch_code: data.branch_code.trim(),
    institution_code: data.institution_code,
    status: data.status,
    city: data.city?.trim() || null,
    address: data.address?.trim() || null,
    contact_number: data.contact_number?.trim() || null,
    email: data.email?.trim() || null,
    branch_head_name: data.branch_head_name?.trim() || null,
  };
  const url = editTarget
    ? `/employees/branches/${editTarget.branch_code}`
    : "/employees/branches";
  const method = editTarget ? "PUT" : "POST";

  const res = await apiCall(url, { method, body: JSON.stringify(payload) });
  if (res.ok) {
    loadData();
    setEditTarget(null);
    return { ok: true };
  }
  return {
    ok: false,
    fieldErrors: res.fieldErrors ?? undefined,
    error: res.fieldErrors ? undefined : res.message,
  };
}
```

Update the import at the top:

```typescript
import { fetchWithAuth, apiCall } from "@/utils/api";
```

If `fetchWithAuth` is no longer used in this file after the edit, drop it from the import.

- [ ] **Step 4.2: Migrate `departments/page.tsx` `handleSave`**

Same pattern — replace the try/catch block with an `apiCall(...)` call, preserving the existing payload shaping (create vs edit). Import `apiCall`.

Model the body on Step 4.1 but keep the branch of logic that sends different fields for create vs edit.

- [ ] **Step 4.3: Migrate `designations/page.tsx` `handleSave`**

Same pattern. Import `apiCall`. Payload shaping unchanged (edit omits `department_code` + `position_code`).

- [ ] **Step 4.4: Migrate `institutions/new/page.tsx` `submit`**

The `submit` handler currently has its own try/catch + 3-branch error parse. Replace with:

```typescript
const submit: SubmitHandler<FormOutput> = async (data) => {
  setSubmitError(null);
  const payload = {
    organization_code: data.organization_code,
    inst_code: data.inst_code.trim(),
    name: data.name.trim(),
    inst_type: data.inst_type,
    address: data.address?.trim() || null,
    city: data.city?.trim() || null,
    contact_number: data.contact_number?.trim() || null,
  };
  const res = await apiCall("/employees/institutions", { method: "POST", body: JSON.stringify(payload) });
  if (res.ok) { router.push("/institutions"); return; }
  if (res.fieldErrors) {
    Object.entries(res.fieldErrors).forEach(([k, v]) => setError(k as any, { message: v }));
    return;
  }
  setSubmitError(res.message);
};
```

Update imports to bring in `apiCall`.

- [ ] **Step 4.5: Migrate `institutions/[id]/edit/page.tsx` `submit`**

Same shape as Step 4.4 but with PUT + the `id` param, and redirect on success.

- [ ] **Step 4.6: Commit the migration sweep**

```bash
git add frontend/src/app/branches/page.tsx \
        frontend/src/app/departments/page.tsx \
        frontend/src/app/designations/page.tsx \
        frontend/src/app/institutions/new/page.tsx \
        frontend/src/app/institutions/[id]/edit/page.tsx
git commit -m "refactor(frontend): migrate form pages to apiCall helper"
```

- [ ] **Step 4.7: Restart dev server + run the 12-check Playwright sweep**

Ensure backend is up (`curl -s -o /dev/null -w "%{http_code}" http://localhost:8000/api/docs` → `200`). Ensure frontend dev server is running on `:3005` (`ss -ltn | grep 3005`).

Re-run the full sweep from `docs/superpowers/specs/2026-04-22-crud-forms-e2e-test-plan.md`:

For each entity in `[branches, departments, designations, institutions]`, exercise (1) create happy path, (2) edit happy path, (3) one validation case. Drive via Playwright MCP. Expected:

- All 12 checks pass.
- Zero console errors in the browser on the happy paths (React no longer crashes on unnormalized detail arrays).
- Inline field errors render when the backend returns either a `field_errors` map OR a `detail` pydantic array — both should now route to rhf's `setError` through `apiCall`.

If any check fails, stop and diagnose before proceeding.

- [ ] **Step 4.8: Update `PROJECT_LOG.md`**

Add a new entry at the top of "Change History":

```markdown
### 2026-04-22 (API hardening — schema hygiene + unified error envelope)

**Backend (`Backend/src/employees/api.py` + `tests_api_hardening.py`):**
- Added regression tests locking in the `Optional[T] = None` contract for `DepartmentUpdateSchema` + `DesignationUpdateSchema` (the latter caused silent 422s in the prior E2E run when the frontend sent explicit `null` for `description`).
- Replaced `payload: Body[dict]` workarounds on `create_institution`, `update_institution`, `create_branch`, `update_branch` with real Pydantic schemas (`InstitutionCreateSchema`, `InstitutionUpdateSchema`, `BranchCreateSchema`, `BranchUpdateSchema`). This restores field-level validation, auto-generated OpenAPI docs, and typed payload access in the handlers. Update paths use `payload.dict(exclude_unset=True)` so absent fields are skipped (vs explicit null, which now overwrites — matching PATCH-ish semantics callers expect).
- New tests cover: missing required field → 422 with locatable field in `detail`; happy-path create → 201; partial update → 200 with only supplied fields touched.

**Frontend (`frontend/src/utils/api.ts`):**
- Added `normalizeApiError(body)` — pure function that collapses Ninja's three error shapes (`{field_errors}`, `{detail: [...]}`, `{error: "..."}`) plus unknown/empty into a single `{fieldErrors, message}` envelope. Node smoke test covers six cases.
- Added `apiCall<T>(endpoint, options)` — sibling of `fetchWithAuth` that fetches, parses, and normalizes in one call. Returns `{ok: true, data}` or `{ok: false, fieldErrors, message, status}`. `fetchWithAuth` preserved for non-form callers.
- Migrated all 5 form pages (branches/departments/designations/institutions new+edit) from the ad-hoc defensive parse block to `apiCall`. ~40 lines of boilerplate deleted; React can no longer crash on unnormalized detail arrays.

**Verified:** pytest (6/6 hardening tests), Playwright 12-check sweep (per `specs/2026-04-22-crud-forms-e2e-test-plan.md`) — all green.
```

- [ ] **Step 4.9: Final commit**

```bash
git add PROJECT_LOG.md
git commit -m "docs: log API hardening work (schemas + unified error envelope)"
```

---

## Notes for the executor

- **Parallelism:** Tasks 1, 2, 3 can be dispatched to three concurrent subagents. Task 4 must wait for all three. If running inline, do 1 → 2 → 3 → 4.
- **No DB migrations** in any step. Schema changes are Pydantic-layer only.
- **Backend restart:** After each backend code change, `docker compose restart auth-service` and wait for `/api/docs` to return 200 before running tests via the network. For pytest, no restart needed — the test runner loads the code fresh.
- **Stale conftest:** `Backend/src/conftest.py` has a `sample_employee` fixture that uses old `Employee.department` / `.designation` FKs that no longer exist on the model (they moved to `EmployeeAssignment`). Don't use that fixture in the new tests — this plan's fixtures create records directly. Fixing `conftest.py` is out of scope.
- **Test artifacts in DB:** The prior E2E run left `TB-T001`, `TDT001`, `TPT001`, `TI-T001`, `zzTEST` records. Leave them — they're soft-deletable later and don't conflict with the isolated DB used by pytest.
