# AUDIT_REPORT.md
# FHA System — Deep Audit Findings

**Date:** 23 September 2026  
**Scope:** Full stack — API, frontend auth, SQL/RLS, domain logic, UI/map  
**Method:** Parallel deep reads of every route, page, component, and SQL file  
**Status:** Pass 1 fixed (`125f65c`); pass 2 fixed (pending commit); re-audit after SQL redeploy

> Severity: CRITICAL > HIGH > MEDIUM > LOW > INFO

---

## Executive summary

| Area | Critical | High | Medium | Low |
|---|---|---|---|---|
| Middleware / auth gate | 1 | 1 | 1 | 2 |
| API authorization | 1 | 5 | 6 | 8 |
| SQL / RLS | 3 | 4 | 6 | 5 |
| Domain / business logic | 3 | 6 | 10 | 8 |
| Frontend / UI / map | 0 | 5 | 12 | 8 |

**Top systemic themes:**

1. **Middleware `publicPaths` uses `startsWith("/")` — matches every path.** Auth redirect, API 401 branch, and the entire `ROLE_MAP` page gate are dead code. Defense currently depends only on layout + per-route checks.
2. **RLS write policies `USING (true)` on `plots` and `approvals`** — any authenticated browser client can bypass every API role check via PostgREST.
3. **Admin mutations silently no-op** — profile UPDATE/DELETE as `authenticated` hits RLS `profiles_update_own` (0 rows) + `prevent_self_role_change` trigger. Role changes and deactivations report success but change nothing.
4. **`handle_new_user` trusts `raw_user_meta_data->>'role'`** — client-controlled privilege at signup if public signup is enabled.
5. **Fresh install seed fails** — `mock_data.sql` inserts assignment before `geographical_units` rows exist (migration only lives in `live_update.sql`).
6. **Multiple API “success” responses are lies** — RLS filters 0 rows without error (inspection DELETE, assignment progress, geo-unit status, admin PATCH).

---

## CRITICAL

### C-01 Middleware auth is a complete no-op
**File:** `web/src/middleware.ts:28-31`

```ts
const publicPaths = ["/", "/login", "/forbidden", "/api/v1/auth"];
if (publicPaths.some((p) => pathname.startsWith(p))) return NextResponse.next();
```

`"/dashboard".startsWith("/")` is always true → every request returns early.

**Dead code:** session refresh, unauthenticated 401/redirect, `ROLE_MAP` (`/admin`, `/assignments`, `/audit`).

**Impact:** ENGINEER can load `/admin/users` page shell (API still 403s). Any future route relying on middleware is unprotected.

**Fix:** exact-match public paths; never `startsWith("/")`.

---

### C-02 Over-permissive write RLS bypasses all API role checks
**Files:** `supabase/Schema.sql`, `supabase/live_update.sql`

| Policy | Problem |
|---|---|
| `plots_update_auth` `USING (true)` | Any auth user can UPDATE any plot (geometry, status, numbers) |
| `approvals_insert_auth` `WITH CHECK (true)` | Any auth user can fabricate approvals |
| `approvals_update_auth` `USING (true)` | Any auth user can alter any approval |

Browser already has `lib/supabase/client.ts` (used by approvals page). Direct PostgREST writes defeat `plots/[id]/status` role gates.

---

### C-03 Signup trigger trusts client-controlled role
**File:** `supabase/Schema.sql` — `handle_new_user`

```sql
coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'ENGINEER')
```

Anyone with the anon key can call Auth signup with `role: "ADMIN"` if public signup is enabled. Invite flow depends on this path today.

**Fix:** ignore `role` from metadata; set role only via service_role after invite.

---

### C-04 Admin role-change / deactivation silently no-ops
**Files:** `web/src/app/api/v1/admin/users/route.ts:102,149,186` + RLS + trigger

- PATCH/DELETE run as `authenticated` → RLS `profiles_update_own` matches only own row → **0 rows, no error** → API returns `success: true`.
- `prevent_self_role_change` blocks any non-`service_role` role change.
- Invite “works” only because role rides in `user_metadata` consumed by the signup trigger.

**Impact:** User Management UI lies; deactivation is UI-only.

---

### C-05 Fresh install seed FK failure on `geographical_units`
**Files:** `supabase/mock_data.sql` + `Schema.sql`

Assignment insert (`geo_unit_id`) runs before GU rows are ensured. GU migration exists only in `live_update.sql`, not in the documented fresh path (`Schema.sql` → `mock_data.sql`).

**Impact:** Fresh demo seed aborts; no assignment/map-area demo data.

---

### C-06 Inspection DELETE returns success but deletes nothing
**Files:** `web/src/app/api/v1/inspections/[id]/route.ts:165-172` + `Schema.sql`

No `DELETE` policy on `inspections` → PostgREST deletes 0 rows silently → false `success: true` + false audit row.

**Same class:** assignment progress UPDATE (engineer), `geographical_units` UPDATE (all roles — no UPDATE policy), admin profile mutations.

---

## HIGH

### API / auth

| ID | Finding | Location |
|---|---|---|
| H-01 | `is_active` almost never enforced in APIs (deactivated sessions keep working) | Most routes; only `requireAuth` + layout check |
| H-02 | `requireAuth({roles})` fail-opens on null profile | `lib/api-auth.ts:42,51` |
| H-03 | Photo GET IDOR — any auth user lists any inspection’s photos + `storage_key` | `photos/route.ts:19-29` |
| H-04 | Documents GET dumps entire table metadata when no params | `documents/route.ts:15-32` |
| H-05 | Inspection GET IDOR — GPS lat/lng for any inspection | `inspections/[id]/route.ts:6-36` |
| H-06 | Assignment GET IDOR — bypasses list engineer filter; exposes assignee emails | `assignments/[id]/route.ts:8-52` |
| H-07 | Rate limiter defined but never imported anywhere | `lib/rate-limit.ts` dead |
| H-08 | Approval auto-create: unchecked insert; invalid enum values written to `approvals.status` | `plots/[id]/status/route.ts:77-97` |
| H-09 | Client `approvalId` not verified to belong to plot → wrong comparison | `inspections/route.ts:51` |
| H-10 | Logout: Host-header open redirect; no `signOut()`; GET CSRF | `auth/logout/route.ts` |

### SQL / RLS

| ID | Finding | Location |
|---|---|---|
| H-11 | `assignment_areas` UPDATE `WITH CHECK (true)` — engineer can re-point area | Schema + live_update |
| H-12 | Own-draft inspection UPDATE can set any status (skip review) | `inspections_update_own_draft` |
| H-13 | Wide SELECT `USING (true)` on documents, photos, PII tables | Schema |
| H-14 | `REVOKE EXECUTE ... FROM anon` ineffective without `FROM PUBLIC` | Schema + live_update |
| H-15 | `storage.sql` orphaned from install path; documents bucket INSERT open to all auth | `storage.sql` |
| H-16 | GIS_OFFICER create assignment allowed by API, blocked by RLS insert policy | API vs `assign_insert_auth` |
| H-17 | SUPERVISOR audit API allowed, RLS `audit_select_admin` is ADMIN-only → empty trail | API vs RLS |
| H-18 | Profiles SELECT: supervisors/GIS see only own row → assignee shows “Unassigned”; GIS engineer dropdown empty via join | `profiles_select_own` only for non-admins — **admin GET uses same client** |

### Domain / UI

| ID | Finding | Location |
|---|---|---|
| H-19 | ComparisonCard never renders on detail page — to-one join is object not array | `inspections/[id]/page.tsx:156` |
| H-20 | `REVIEW_REQUIRED` reported as “No difference detected” (green) | `lib/comparison.ts:39-43` |
| H-21 | Engineer assignment progress update silently fails (RLS assign_update ADMIN/SUP only) | `areas/route.ts:123-130` |
| H-22 | `geographical_units` has no UPDATE policy — status never changes | areas route |
| H-23 | Map area Approve button shown only to APPROVAL_OFFICER; server excludes that role → guaranteed 403 | `MapView.tsx:641` |
| H-24 | Area status actions shown to ENGINEER; `res.ok` never checked | `MapView.tsx:626-356` |
| H-25 | Mobile fixed header covers content + prototype banner | `MobileNav` + layout |
| H-26 | No `global-error.tsx` | app root |
| H-27 | Hardcoded `?? "ENGINEER"` default role on profile fetch failure | map, plots/[id], dashboard |
| H-28 | `/admin/users` full UI to any role (middleware dead); API blocks data | admin page |
| H-29 | Login: raw provider errors; account enumeration; `?error=disabled` never shown | LoginForm |
| H-30 | Dead draw toolbar: stuck “0 points”; duplicate name modals; `map:navigate` no listener | MapView / MapDrawToolbar |

---

## MEDIUM (summary)

- Missing UUID/enum validation on most dynamic IDs → 500s instead of 422
- PostgREST `.or()` search: commas not stripped (filter smuggling)
- Inspection status: no transition matrix; plot status mapping walks backwards
- History not written on inspection-driven plot status changes
- Photo MIME client-only; `image/jpg` mismatch vs bucket; no magic bytes; no status gate
- GPS: no capture provenance; `gpsSchema`/`capturedAt` dead; no accuracy gate
- Approval number race (`Date.now()%10000`) unchecked
- Assignment number count-based race
- To-one join bugs: plot number “—” in lists; block/estate “—” on new inspection
- Approvals page: errors shown as “All clear”
- Dashboard/map: silent zero/empty on DB error
- Logout Origin check substitutes rather than rejects
- Duplicate nav arrays (layout + MobileNav)
- Status color logic triplicated
- Unbounded plots list / full marker rebuilds
- `map:blockFilter` event no listener
- `image/jpg` / storage mime mismatch
- Dual-status drift (plots vs geographical_units vs legacy `status`)

---

## LOW / INFO

- Audit log self-access not audited; auditLog failures silent
- Hard-delete SUBMITTED inspections (traceability)
- Self-deactivation allowed via PATCH
- No CSP header (popup uses `setHTML` but all values `esc()`’d today)
- `AuthLike` double-casts (~40 sites)
- Pre-existing ESLint debt (setState-in-effect, unescaped quotes, MapView any)
- `spatial_ref_sys` RLS linter warning — expected, ignore
- Button has no `size` prop — no callers use one (OK)

---

## Verified positives

- All 19 API files implement 401 checks themselves (mitigates C-01 for data)
- Zod validation on inspection POST (GPS ranges, lengths, enums)
- UUID gates on best routes: `plots/[id]`, `geo-units`, `assignments/[id]/areas`
- Engineer list scoping ignores client `assigned_to`
- Approval wording `RECORD_FOUND` compliant with AGENTS §7
- Storage buckets **private**; photo insert policy checks inspector
- `prevent_self_role_change` blocks self-escalation via REST
- No localStorage/sessionStorage for tokens
- No raw SQL; all PostgREST query builder / bound RPC
- Service role key only on server
- Logout Origin allowlist present (needs reject-not-substitute)
- StatusActions client role lists **match** API exactly
- Map draw `canDraw` matches server `ADMIN_ROLES`

---

## Remediation log

| Date | Action | Commit |
|---|---|---|
| 2026-09-23 | Audit completed (5 parallel deep passes) | — |
| 2026-09-23 | **C-01** middleware `publicPaths` exact-match (no `startsWith("/")`) | `125f65c` |
| 2026-09-23 | **C-02** plots/approvals RLS role-gated; plots column-level UPDATE grant | `125f65c` |
| 2026-09-23 | **C-03** `handle_new_user` always ENGINEER (never trusts metadata role) | `125f65c` |
| 2026-09-23 | **C-04** admin invite/role/deactivate via `service_role` REST + 0-row checks | `125f65c` |
| 2026-09-23 | **C-05** mock_data GU FK order (estate→block→plots before assignment) | `125f65c` |
| 2026-09-23 | **C-06** inspections delete policy + verify deleted rows; assignment delete verify | `125f65c` |
| 2026-09-23 | **H-02** `requireAuth` fail-closed on null profile + `is_active` | `125f65c` |
| 2026-09-23 | **H-03** photo GET scoped (engineer owns inspection / privileged roles) | `125f65c` |
| 2026-09-23 | **H-04** documents GET requires plotId/approvalId/inspectionId | `125f65c` |
| 2026-09-23 | **H-05** inspection GET IDOR (engineer own-only; strip inspector_id) | `125f65c` |
| 2026-09-23 | **H-06** assignment GET IDOR (engineer assignee-only) | `125f65c` |
| 2026-09-23 | **H-08/H-09** approvalId plot-ownership validation; plot status 0-row check | `125f65c` |
| 2026-09-23 | **H-11/H-12/H-14** aa_update WITH CHECK; draft→submit only; REVOKE FROM PUBLIC | `125f65c` |
| 2026-09-23 | **H-16/H-17/H-18/H-21/H-22** GIS insert; SUPERVISOR audit; `can_list_users()`; engineer progress; GU UPDATE | `125f65c` |
| 2026-09-23 | **H-19/H-20** ComparisonCard object/array normalize; REVIEW_REQUIRED summary | `125f65c` |
| 2026-09-23 | **H-28** admin/users page 403/401 handling | `125f65c` |
| 2026-09-23 | Plot search `.or()` strips `,()` (filter smuggling) | `125f65c` |
| 2026-09-23 | Schema.sql + live_update.sql GRANTs aligned | `125f65c` |

### Pass 2 remediation (2026-09-23)

| ID | Severity | Fix | Files |
|---|---|---|---|
| P2-C1 | CRITICAL | Storage policies: photo SELECT scoped to inspector/privileged; document INSERT limited to ADMIN/SUPERVISOR/APPROVAL_OFFICER; document SELECT requires active profile | `supabase/storage.sql` |
| P2-C2 | CRITICAL | `protect_plot_approval_status()` trigger — ENGINEER cannot change `plots.approval_status` via PostgREST | `Schema.sql`, `live_update.sql` |
| P2-C3 | CRITICAL | SELECT RLS scoped: inspections/photos/findings own-or-privileged; assignments/areas scoped; documents require `is_active` | `Schema.sql`, `live_update.sql` |
| P2-C4 | CRITICAL | `is_active` enforced on all write RLS + middleware + every API route profile check | both SQL + all API routes + `middleware.ts` |
| P2-C5 | CRITICAL | `prevent_self_role_change` allows `postgres`/`dashboard`/`service_role` (mock_data bootstrap unblocked); still blocks self-escalation | both SQL |
| P2-H1 | HIGH | Inspections PATCH transition matrix (DRAFT→SUBMITTED→UNDER_REVIEW→COMPLETED) + 0-row verify | `inspections/[id]/route.ts` |
| P2-H2 | HIGH | Logout: `signOut()` + Host open-redirect fix + Origin reject on POST | `auth/logout/route.ts` |
| P2-H3 | HIGH | `live_update`: `inspections_update_own_draft` WITH CHECK rebuild; GRANT parity (photos/findings/audit/history/map_areas INSERT; GU column-limited) | `live_update.sql` |
| P2-H4 | HIGH | Middleware allows ENGINEER on `/assignments/[uuid]` (list/new still gated); is_active fail-closed | `middleware.ts` |
| P2-H5 | HIGH | Layout null-profile redirect; `?error=disabled` / `?error=session` shown on login | `layout.tsx`, `LoginForm.tsx` |
| P2-H6 | HIGH | Login: no account enumeration; no raw OTP errors; `global-error.tsx`; CSP headers | `LoginForm.tsx`, `global-error.tsx`, `next.config.ts` |
| P2-H7 | HIGH | Silent mutation `res.ok` sweep (admin toggle/role, approvals, inspection submit, assignment area) | multiple pages |
| P2-H8 | HIGH | ComparisonCard always renders (REVIEW_REQUIRED when no approval); map `safeColor` hex-only; MapSearch `res.ok`+array check | comparison UI, `MapView`, `MapSearch` |
| P2-H9 | HIGH | Mobile header content offset; map-areas DELETE 0-row; photo `uploaded_by` verify + orphan cleanup; approval enum sync (`APPROVED_WITH_CONDITIONS`) | layout, APIs, SQL enums |
| P2-H10 | HIGH | Approvals page: load/update errors no longer shown as "All clear" | `approvals/page.tsx` |

**Still outstanding (user action):**
1. Run updated `live_update.sql` (or fresh `Schema.sql` + `storage.sql` + `mock_data.sql`) in Supabase SQL Editor
2. Confirm `GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;` (included in live_update)
3. Re-run third audit pass after deploy

---

**END OF AUDIT_REPORT.md**
