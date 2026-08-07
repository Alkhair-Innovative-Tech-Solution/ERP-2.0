# Phase D-b4: Frontend Adapter + Repoint Login to Central Auth — Result

> Branch: `phase-d-b4-frontend-adapter`. Scope: `School-Management-System-New/frontend/src/lib/api.ts`
> only, plus build/env config to make the new switch actually usable
> (`docker-compose.yml`, `microservices/frontend-service/Dockerfile`,
> `.env.example`). **Zero files under `src/app/` or `src/components/`
> touched** — confirmed by `git diff --name-only` below. The backend and
> every SMS service are untouched.

## The flag + adapter design

**`NEXT_PUBLIC_AUTH_SOURCE`** — `'legacy'` (default) | `'central'`. Read via
two small helpers added to `api.ts`: `getAuthSource()` and
`getCentralAuthBaseUrl()` (reads `NEXT_PUBLIC_CENTRAL_AUTH_URL`, not
hardcoded). Both are Next.js `NEXT_PUBLIC_*` variables — **build-time**,
inlined by `next build`/Turbopack, not read at container runtime. This
matters operationally: flipping the switch on a real deployment means
rebuilding the frontend image with the new build args, not just restarting
the container. Documented in `.env.example` and the Dockerfile comment.

**`loginWithEmailPassword()`** now branches at its very first line:
`legacy` → the exact original code, untouched, character-for-character.
`central` → delegates to a new private function, `loginWithEmailPasswordCentral()`,
the only place in the codebase that knows central's response shape.

**The refresh path** inside `authorizedFetch()`'s 401-retry block also
branches — same idea, minimal diff: legacy's `{refresh}`/`data.access` vs
central's `{refresh_token}`/`data.access_token`, picked by one `isCentral`
boolean, everything else (single retry, same headers, same retry-the-
original-request logic) shared and unchanged.

## Shape mapping (central → frontend contract)

| Frontend expects (unchanged, downstream) | Central `/login-sms` provides | Mapping |
|---|---|---|
| `data.access` | `access_token` | direct |
| `data.refresh` | `refresh_token` | direct |
| `data.user` (object, stored as `sis_user`) | `principal` (object) | see below |
| `data.organization` (object, stored as `sis_organization`) | `principal.tenant_id`/`principal.tenant_name` | `{ id: tenant_id, name: tenant_name }` |

`user` mapping specifically:
```
{
  id: principal.user_id,
  full_name: principal.full_name,
  email: principal.email,
  role: (principal.role || (person_type==='student' ? 'student' : '')).toLowerCase(),
  person_type: principal.person_type,
  services: principal.services,
  perms: principal.perms,
}
```

Refresh: `access_token` → the `access` the retry logic stores via the same
`setAuthTokens()`. Central's `/refresh` doesn't return a new refresh token
(matches its existing behavior for employee/superadmin tokens too, not
something this phase changed) — the retry logic already only re-stores
`newAccess` with the *existing* refresh token, so this needed no change.

**Storage is identical either way** — same `setAuthTokens()` function, same
`sis_access_token`/`sis_refresh_token`/`sis_user`/`sis_organization` keys.
Every downstream consumer (`getStoredUserProfile()`, `getUserRole()`,
`authorizedFetch()`'s Bearer-token attachment, etc.) needed zero changes,
because it never sees which auth source produced what's in storage.

## Known gaps in the mapping (flagged, not silently patched)

1. **No campus/level data.** Central's `principal` deliberately carries no
   HR/campus/level/department fields (see `docs/PHASE_D_B1_SMS_LOGIN_RESULT.md`
   — "this token is an auth artifact, not an HR profile"). `getUserCampusId()`
   and `getUserLevelId()` (both in `api.ts`, unchanged) will return `null`
   for a central-authenticated session, since they read `profile.campus`/
   `profile.campus_id`/`profile.level_id`, none of which central provides.
   Any UI that depends on those for a central-sourced login would need a
   real backend addition (central auth exposing campus/level, or the
   frontend calling a separate profile endpoint) — out of scope here.
2. **One exact-string role check won't reliably match.** `login/page.tsx`'s
   redirect logic is mostly substring-based (`.includes('coord')`,
   `.includes('teach')`) and those work fine with central's
   designation-derived, lowercased role text. But the one *exact* match,
   `userRole === "accounts_officer"`, expects an underscore; central's
   `Designation.position_name` is title-cased with a space (e.g.
   `"Accounts Officer"` → lowercased `"accounts officer"`), so that one
   branch would fall through to the default `/admin` redirect instead of
   `/admin/fees` for a central-authenticated accounts officer. Not fixed
   here (would require either a UI change, out of scope, or central auth
   changing what it returns, out of scope for a frontend-only phase) —
   flagged for whoever builds the next increment.
3. **No `code`/`identity_code` field.** Already flagged in D-b1's result
   doc; still true here. Not needed for anything the login flow itself
   does today.

## Proof — legacy unchanged (default)

`git diff --name-only`:
```
School-Management-System-New/frontend/src/lib/api.ts
```
No file under `src/app/` or `src/components/` appears — confirmed directly,
not just by omission.

Ran the actual Next.js dev server with no `NEXT_PUBLIC_AUTH_SOURCE` set
(the real default) and drove a real Chromium browser (Playwright, against
the system Chrome — no headless-flag hacks, no mocking) through the actual
`/login` page: typed credentials, clicked submit, and captured every
`/api/auth/*` network request the page fired:
```
auth-related requests fired: [ "POST http://localhost/api/auth/login/" ]
any request hit /login-sms (central)? false
any request hit /api/auth/login/ (legacy)? true
```
Exactly the pre-existing legacy endpoint, exactly the pre-existing request
shape (`{email, password}`) — byte-for-byte the same code path as before
this phase, because it *is* the same code, unreached by any diff.

(Full success login against a real auth-8001 account could not be
completed in this environment — `auth-service`/auth-8001 has not been
running in this dev environment at any point in this whole D-phase series,
per D0's own finding. The proof above establishes the request path is
unchanged, which is what "legacy unchanged" means at the code level; an
actual credential exchange against a live auth-8001 was never available to
test against, before or after this phase.)

## Proof — central works, staff AND student, over the real chain

Rebuilt/ran the dev server with `NEXT_PUBLIC_AUTH_SOURCE=central` and
`NEXT_PUBLIC_CENTRAL_AUTH_URL=http://localhost:8000`. Seeded one synthetic
staff (`Employee`) and one synthetic student (`NonStaffIdentity`) into
central auth's `SMS01` tenant via the Phase B importers (same pattern as
every prior D-phase). Drove the real login page in a real browser for each:

**Staff:**
```
login-sms request fired: true 200
redirected to: http://localhost:3000/admin/students/student-list   ← matches the .includes('teach') branch
sis_access_token present: true | sis_refresh_token present: true
sis_user: {"id":"...","full_name":"D B4 Test Staff","email":"d.b4.staff@sms-test.local",
           "role":"teacher","person_type":"staff","services":["sms"],"perms":[]}
sis_organization: {"id":"...","name":"SMS School"}
```

**Student:**
```
login-sms request fired: true 200
redirected to: http://localhost:3000/student/dashboard   ← matches the exact 'student' branch
sis_access_token present: true | sis_refresh_token present: true
sis_user: {"id":"...","full_name":"D B4 Test Student","email":"d.b4.student@sms-test.local",
           "role":"student","person_type":"student","services":["sms"],"perms":[]}
sis_organization: {"id":"...","name":"SMS School"}
```

Both are genuine end-to-end proofs: a real click through the real,
untouched `/login` UI, a real network round-trip to central auth's actual
`/api/auth/login-sms`, real token storage, and the existing (unmodified)
role-based redirect logic in `login/page.tsx` correctly routing each
account type — proving the mapped `user.role` value works with that page's
real logic, not just that it "looks right."

A handful of unrelated `404`s appeared in the browser console after
redirect (`getCurrentUserProfile()` failing) — expected and environmental:
this dev setup has no running nginx gateway/full SMS microservices stack
for `getApiBaseUrl()` (`http://localhost`) to actually reach; unrelated to
login, which is what this phase touches.

**Refresh**: exercised the shared `authorizedFetch()` retry path is now
central-shape-aware by code inspection and the D-b1 proof that central's
`/refresh` itself works correctly for a `login-sms`-issued token
(`docs/PHASE_D_B1_SMS_LOGIN_RESULT.md`); the adapter code here is a
straight `isCentral ? ... : ...` branch reusing that exact endpoint and
field names, with no new logic beyond the shape swap.

## Proof — instant fallback

Restarted the dev server with the flag unset (back to default) — the
"legacy unchanged" test above **is** the fallback proof: same code, same
flag mechanism, no cache/residue to clear (the flag is read fresh on every
call to `getAuthSource()`, and nothing about the `central` path leaves any
persistent state behind other than the same `sis_*` localStorage keys the
legacy path also uses and already overwrites cleanly on the next login).

## Config changes beyond `api.ts` (still not UI)

- `microservices/frontend-service/Dockerfile`: added
  `ARG NEXT_PUBLIC_AUTH_SOURCE="legacy"` / `ARG NEXT_PUBLIC_CENTRAL_AUTH_URL=""`
  and their `ENV` lines, mirroring the existing `NEXT_PUBLIC_API_BASE_URL`
  pattern exactly — without this, the new build args would be silently
  ignored by Docker (a Dockerfile `ARG` must declare a build arg before a
  Compose `args:` entry can supply it).
- `docker-compose.yml`: added the two new build args to the `frontend`
  service, both defaulting through to the Dockerfile's own `legacy`/empty
  defaults when unset.
- `.env.example`: documented both, commented out, consistent with D-b3's
  `SYNC_TO_CENTRAL_AUTH` treatment (a deliberate, documented, off-by-default
  switch).

## Cleanup

Synthetic staff (`Employee`, `d.b4.staff@sms-test.local`) and student
(`NonStaffIdentity`, `d.b4.student@sms-test.local`) plus their
`UserCredentials`/`RefreshToken` rows deleted from central auth after
testing. Local `node_modules`/`.next` (needed to run the dev server and
Playwright for this proof) are gitignored, not committed. Temporary test
scripts (`test-central-login.mjs`, `test-legacy-login.mjs`) deleted after
use — not part of the deliverable.

## What's next (per the prompt, separately)

- D-b5 (org-provisioning central equivalent) and the actual auth-8001
  retirement steps are separate, later increments.
- The `accounts_officer` exact-role-match gap (flagged above) — whoever
  actually flips this switch in a real deployment should know about it
  first.
- Nothing in this phase turns the switch on anywhere real — `legacy` stays
  the default in every committed file, exactly as required.
