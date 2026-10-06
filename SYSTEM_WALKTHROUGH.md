# SYSTEM_WALKTHROUGH.md
# FHA Development Approval & Property Mapping System
## Complete System Details (As-Built)

**Project Status:** MVP / Prototype  
**Version:** 0.2  
**Date:** 23 September 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Related:** `ARCHITECTURE.md`, `API.md`, `AUTHORIZATION_RBAC.md`, `WORKFLOWS.md`, `DATABASE.md`, `GIS.md`, `SECURITY.md`, `DEPLOYMENT.md`, `AGENTS.md`

> **DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD**  
> All plots, coordinates, approvals, owners, and boundaries in this prototype are fictional until FHA supplies official data.

---

## 1. PURPOSE

This document is the **as-built walkthrough** of the running system: every page, API route, role, permission layer, and the end-to-end demo path.

Design intent lives in `ARCHITECTURE.md` / `WORKFLOWS.md`. This file describes **what the code actually does today**.

---

## 2. SYSTEM AT A GLANCE

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router), React 19, TypeScript 5 |
| Styling | Tailwind CSS 4 |
| Auth | Supabase Auth — email OTP (6-digit PIN). **No passwords.** |
| Session | httpOnly cookies via `@supabase/ssr` |
| Database | Supabase PostgreSQL + PostGIS |
| Maps | MapLibre GL 5 + MapLibre-Geoman (drawing) |
| Satellite | Esri World Imagery tiles |
| Search (geo) | Nominatim (OpenStreetMap) |
| Validation | Zod |
| Host | Netlify (`fhafha.netlify.app`) |
| Repo | `https://github.com/anantiikenna/FHA.git` (`master`) |

**Supabase project ref:** `shvmrjzhovmnndohllpa`

---

## 3. PROJECT STRUCTURE

```
FHA/
├── supabase/
│   ├── Schema.sql            # Fresh install (full schema)
│   ├── live_update.sql       # Incremental migration (safe to re-run)
│   ├── mock_data.sql         # Demo seed
│   ├── drop_mock_data.sql    # Remove demo seed
│   ├── storage.sql           # Pointer only — DDL lives in Schema.sql + live_update.sql
│   └── config.toml
├── web/
│   ├── src/
│   │   ├── middleware.ts     # Auth + role gate for pages
│   │   ├── app/
│   │   │   ├── page.tsx              # / → redirect dashboard|login
│   │   │   ├── (auth)/login/         # OTP login
│   │   │   ├── (dashboard)/          # Authenticated UI
│   │   │   ├── forbidden/            # 403 page
│   │   │   └── api/v1/               # REST API
│   │   ├── components/               # UI, map, nav, inspection
│   │   └── lib/                      # supabase, api-auth, audit, rate-limit, comparison
│   └── package.json
├── netlify.toml
├── AGENTS.md
└── SYSTEM_WALKTHROUGH.md     # This file
```

### SQL rule (AGENTS.md §35)

Only two schema files are maintained:

| File | When to run |
|---|---|
| `supabase/Schema.sql` | Once, fresh database |
| `supabase/live_update.sql` | Existing DB, safe to re-run |

Never create numbered migration files. Every schema change goes into **both** files.

---

## 4. AUTHENTICATION FLOW

Email verification PIN only — **never** passwords.

```text
/login
  → enter email
  → Supabase signInWithOtp
  → user receives 6-digit PIN
  → verifyOtp
  → session stored in httpOnly cookies
  → redirect /dashboard
```

| Step | Detail |
|---|---|
| Public paths | `/`, `/login`, `/forbidden`, `/api/v1/auth` |
| Protected | `/dashboard`, `/map`, `/plots`, `/inspections`, `/approvals`, `/documents`, `/admin`, `/assignments`, `/my-assignments`, `/audit`, other `/api/*` |
| Not logged in → page | Redirect `/login?redirect=…` |
| Not logged in → API | `401 AUTH_REQUIRED` |
| Inactive account | Layout redirects `/login?error=disabled` |
| Logout | `GET/POST /api/v1/auth/logout` — clears cookies, validates Origin allowlist |
| Who am I | `GET /api/v1/auth/me` → profile `{ id, email, display_name, role, is_active }` |

Leaked-password protection is **disabled by design** (OTP only).

---

## 5. AUTHORIZATION LAYERS

Access is enforced in **three places** (not just hidden buttons):

```text
1. Middleware (web/src/middleware.ts)     → page routes only
2. API handlers (requireAuth / role checks) → every sensitive endpoint
3. Postgres RLS (supabase/Schema.sql)     → row-level policies
```

### 5.1 Middleware role map (pages)

| Prefix | Allowed roles |
|---|---|
| `/admin` | ADMIN, SUPERVISOR |
| `/assignments` | SUPERVISOR, ADMIN, **GIS_OFFICER** |
| `/audit` | ADMIN, SUPERVISOR |
| Everything else protected | Any authenticated user |

API routes are **not** role-checked by middleware (except requiring login); each route checks roles itself.

### 5.2 Roles

| Role | Purpose |
|---|---|
| **ADMIN** | Full oversight: users, all assignments, audit log |
| **SUPERVISOR** | Creates/reviews assignments and inspections |
| **ENGINEER** | Field work: assigned plots, inspections, GPS/photos |
| **APPROVAL_OFFICER** | Approve / condition / reject plots |
| **GIS_OFFICER** | Map drawing + create assignments from spatial units |

Roles are provisional until FHA confirms them (`AUTHORIZATION_RBAC.md`).

### 5.3 Sidebar navigation by role

**All roles:** Dashboard, Estate Map, Inspections, Properties, Approvals, Documents, My Assignments

| Section | Shown for |
|---|---|
| Supervisor → Manage / Create Assignment | SUPERVISOR |
| GIS → Manage / Create Assignment | GIS_OFFICER |
| Admin → User Management, All Assignments, Create Assignment, Audit Log | ADMIN |

---

## 6. COMPLETE ROLE WALKTHROUGH

### 6.1 ADMIN

**Dashboard stats:** Total Users, Pending Reviews, Properties, Inspections  
**Quick actions:** User Management, All Assignments, Open Map, Audit Log

| Capability | Access |
|---|---|
| Invite / edit / deactivate users | Yes (POST/PATCH/DELETE `/api/v1/admin/users`) |
| List all users | Yes (GET) |
| Create / delete assignments | Yes |
| Create inspections, review → COMPLETED | Yes |
| Edit any DRAFT inspection; submit any DRAFT → SUBMITTED | Yes |
| Upload photos to any (non-completed) inspection | Yes |
| Delete inspections (draft/submitted) | Yes |
| Change plot inspection **and** approval status | Yes |
| Draw / edit / delete map areas | Yes |
| View audit log | Yes |
| View all inspections & assignments | Yes (not filtered) |

**Cannot:** demote own role or deactivate own account (API + DB trigger).  
**Integrity rules that still apply to ADMIN:** inspection fields stay editable only while `DRAFT`; photos cannot be added to a `COMPLETED` inspection; delete stays limited to `DRAFT`/`SUBMITTED`.

---

### 6.2 SUPERVISOR

**Dashboard stats:** Pending Reviews, Active Assignments, Total Inspections, Properties  
**Quick actions:** Create Assignment, Manage Assignments, Inspections, Open Map

| Capability | Access |
|---|---|
| Create / delete assignments | Yes |
| List all users (full profile list) | Yes (GET only) |
| Create inspections; review → UNDER_REVIEW / COMPLETED | Yes |
| Delete inspections (draft/submitted) | Yes |
| Change plot inspection + approval status | Yes |
| Map areas CRUD | Yes |
| Audit log | Yes |
| View all inspections & assignments | Yes |

**Cannot:** invite/edit/deactivate users (mutations ADMIN-only).

---

### 6.3 ENGINEER

**Dashboard stats:** My Inspections (draft + submitted), Active Assignments, Properties, Approved  
**Quick actions:** Open Map, My Assignments, Inspections, Properties

| Capability | Access |
|---|---|
| View **own** assignments only | Yes (`assigned_to = self`) |
| View **own** inspections only | Yes (`inspector_id = self`) |
| Create inspection; GPS / photos / observations | Yes |
| Submit own inspection → SUBMITTED | Yes |
| Update assignment areas (if assignee) | Yes |
| Change plot **inspection** status | Yes |
| Change plot **approval** status | No |
| Create/delete assignments | No |
| Review → UNDER_REVIEW / COMPLETED | No |
| Delete inspections | No |
| Map area drawing | No |
| Audit / user management | No |

**Route gate:** `/assignments`, `/admin`, `/audit` → redirected to `/forbidden`.

**Field workflow:**

```text
Login → My Assignments → open assignment → Map → select plot
  → Start Inspection → GPS + photos + observations
  → Approved vs Observed → Submit (SUBMITTED)
  → Supervisor reviews → COMPLETED
```

---

### 6.4 APPROVAL_OFFICER

**Dashboard stats:** Pending Approvals, Approved, Properties, Pending  
**Quick actions:** Approvals Queue, Properties, Documents, Open Map

| Capability | Access |
|---|---|
| Change plot **approval** status | Yes |
| Move inspections → COMPLETED | Yes |
| Approve / Approve with Conditions / Reject on Approvals page | Yes |
| View all inspections, plots, documents | Yes |
| Create inspections / assignments | No |
| Change plot inspection status | No |
| Map area drawing | No |
| Audit / user management | No |

**Approval wording rule:** the system records stored status (e.g. “Approval record found / Status: ACTIVE”). It does **not** issue legal conclusions.

---

### 6.5 GIS_OFFICER

**Dashboard stats:** Map Areas, Properties, Approved, Pending  
**Quick actions:** Open Map, Create Assignment, Properties, Documents

| Capability | Access |
|---|---|
| Draw / edit / delete map areas | Yes |
| Create assignments | Yes (API + pages) |
| List engineer directory (for assign dropdown) | Yes — GET returns **ENGINEER-only** profiles |
| Full user list | No (ADMIN/SUPERVISOR only) |
| Create inspections | No |
| Change plot statuses | No |
| Delete assignments | No |
| Audit / user management | No |

**GIS workflow:**

```text
Login → Map → draw polygon/rectangle (Geoman)
  → save map_areas (status MARKED, plot_ids = plots detected inside the shape)
      → admin shape fully inside an existing area → nested child of the innermost
        containing area (any depth: zone → child → grandchild → …); inside nothing
        → new top-level zone
      → name modal previews where the shape will be stored before saving
  → Saved Areas list (bottom-right of map) shows every saved area
      (labelled by depth: Zone / Field area / Sub-area)
  → area panel [Start Inspection] (ADMIN/SUPERVISOR/ENGINEER)
      → /inspections/new?plotId=...&areaId=... (chip shows the marked area; stored as inspections.map_area_id)
      → multiple plots inside the area → plot picker first
  → GIS_OFFICER area panel shows [Mark In Progress] (status only; cannot create inspections)
  → area panel Activity section: per-area history (who submitted / approved /
    rejected / requested re-inspection / outcome events, with names + times)
  → area panel [Delete Zone] / [Delete Area] (ADMIN/SUPERVISOR/GIS or creator) with confirm
      → deleting an area also deletes every nested sub-area inside it (all depths)
      → confirm shows the descendant count when the sub-area list is loaded
  → field outcome on own field area: [Non-Compliant (Observed)] / [Awaiting Property Owner] /
      [Empty / Unoccupied]
  → optionally create assignment under geo-unit (separate path)
  → Supervisor/Engineer executes inspection
```

**Zone → officer → field-area workflow (map-area assignment):**

```text
GIS/SUPERVISOR/ADMIN marks a zone (INSPECTION_ZONE, status MARKED)
  → zone panel [Assign Officer] dropdown (active ENGINEERs) + scope selector
      (Remaining plots [recommended] / Entire zone / choose plots)
      → or [Assign to me] — a higher role takes the zone itself (same scope
        rules, zone MARKED → IN_PROGRESS, assignment shows under My Assignments)
  → POST /map-areas/{id}/assign  [body: assigned_to, optional plot_ids]
      → lazily creates a ZONE geo-unit (service role) links it in zone metadata
      → scope = plot_ids if given (must belong to the zone → 422 OUTSIDE_ZONE),
        else zone plots not already claimed by another active assignment
        (falls back to the whole zone so the assignment is never empty)
      → creates inspection_assignments (ACTIVE) + assignment_areas (scope plots only)
      → zone.assignment_id set; zone status MARKED → IN_PROGRESS
      → multiple officers per zone allowed (one assignment each; duplicate = 409;
        each officer keeps an independent, partitioned progress bar)
  → zone panel lists Assigned Officers + descendant sub-areas (any depth,
    indented, with author names; header Field Areas on zones / Sub-areas on children)
  → engineer sees "Assigned to you" chip on the zone panel
  → engineer draws a field area inside the assigned zone (or inside any area
      nested within it — child / grandchild / …)
      → POST /map-areas (ENGINEER) validates every vertex lies inside their assigned
        zone subtree → parent_area_id = the innermost containing allowed area
        (any depth), forces area_type INSPECTED_AREA,
        status DRAFT, assignment_id = the engineer's own assignment (resolved via
        the ROOT zone's geo-unit — zone.assignment_id may hold another officer's),
        plot_ids = plots inside the drawn shape ∩ ROOT zone plots
      → plots inside the shape but outside the engineer's own assignment scope
        → 422 OUTSIDE_ASSIGNED_SCOPE
      → no assigned zone / outside all zones → 403 / 422 with guidance
  → engineer: [Start Inspection], [Submit for Approval] (DRAFT/IN_PROGRESS/
      REINSPECTION_REQUIRED/NON_COMPLIANT_OBSERVED/AWAITING_OWNER/EMPTY_UNOCCUPIED/
      UNAPPROVED_PROPERTY/SET_FOR_DEMOLITION → AWAITING_REVIEW),
      [Field Outcome] → Non-Compliant (Observed) / Awaiting Property Owner
      (own or zone-assigned area; observations, not enforcement decisions),
      delete own DRAFT/REINSPECTION area
  → admin-created children follow the ZONE flow (same buttons):
      MARKED → [Start Inspection] → IN_PROGRESS → [Mark Inspected] → INSPECTED
      → [Submit for Review] → AWAITING_REVIEW → [Approve] / [Reject]
  → Property Outcome section (any field area):
      officers (own area or assigned to the root zone) pick
      Approved property / Unoccupied property / Unapproved property /
      Property set for demolition  → submitted for approval
      → recorded as PROPOSED (+ paired outcome status) — after submission only
      a higher review role can [Agree] / [Reject] it
      APPROVAL_OFFICER/SUPERVISOR/ADMIN also get Direct accept / Direct reject
      rows that bypass the officer's submission (accept → straight to ACCEPTED;
      reject → fresh REJECTED record even when none exists); agree/reject also
      from /approvals ("Agree Outcome" button)
      — a field observation/recommendation, never an automated enforcement
      decision (AGENTS §8)
  → reviewer (APPROVAL_OFFICER/SUPERVISOR/ADMIN): [Approve] / [Reject]
  → rejected → [Request Re-inspection] (REJECTED → REINSPECTION_REQUIRED)
  → forward path (no dead end): owner engineer resumes via own-area
      [Start Inspection] / [Submit for Approval]; zone admins (or owner) get
      [Start Re-inspection] (GIS_OFFICER: [Mark In Progress]); zone admins get
      [Start Re-inspection] on a child they did not draw → IN_PROGRESS →
      [Mark Inspected] → [Submit for Review] → re-review; the approval officer
      (no area access) sees a "re-inspection requested" note
  → the same actions are also available on /approvals
      ("Map areas awaiting review" section, role-gated; REINSPECTION_REQUIRED
      cards say which officer holds the area)
  → [Delete Zone] (ADMIN/SUPERVISOR/GIS) works at any status — confirm prompt, then all
      descendant field areas are deleted too (API level-by-level + FK ON DELETE CASCADE)
```

**Assignment progress bar (partitioned — submitted work only, manual completion):**

```text
bar = rows of THIS assignment in a submitted state / total rows in this assignment
      [provisional — for FHA confirmation]
  counted states: AWAITING_REVIEW, INSPECTED, REINSPECTION_REQUIRED
  not counted: NOT_INSPECTED, INSPECTION_IN_PROGRESS (draft work never counts)
  → 100% → status READY_FOR_COMPLETION (automatic — never auto-COMPLETED)
  → ADMIN/SUPERVISOR explicitly completes:
      PATCH /assignments/{id} { action: "complete" }
      (requires READY_FOR_COMPLETION after a fresh recompute → COMPLETED + completed_at)
  → row goes below 100% again → READY_FOR_COMPLETION reopens to ACTIVE
  → CANCELLED / COMPLETED are never reopened automatically

  PARTITIONED: each bar counts only its own assignment's rows (the plots in
  that officer's assigned scope) — other officers' work never moves it,
  and each assignment's scope is fixed at assign time (see above).

  section status → its scoped plot rows (PATCH /map-areas/{id}):
      AWAITING_REVIEW → AWAITING_REVIEW
      APPROVED / REJECTED → INSPECTED
      REINSPECTION_REQUIRED → REINSPECTION_REQUIRED
      zone statuses and field outcomes (incl. EMPTY_UNOCCUPIED) never map
      to plot rows

  recompute triggers — one shared domain service
  (web/src/lib/assignment-progress.ts):
    PATCH /map-areas/{id}         → section status → plot rows → recompute
    POST /map-areas/{id}/assign   → normalize the new assignment's own bar
    PATCH /assignments/{id}/areas → recomputeAssignmentProgress
    inspection create/submit/delete + PATCH /plots/{id}/status
        → syncAssignmentAreaFromPlot / revertAssignmentAreaForInspection
          (rank-guarded forward moves; REINSPECTION reopens; also keeps the
          geo unit's inspection_status in step)

  All syncs best-effort — never fail the caller's main action.
```

---

### 6.6 Permission matrix

| Capability | ADMIN | SUPERVISOR | ENGINEER | APPROVAL_OFFICER | GIS_OFFICER |
|---|:---:|:---:|:---:|:---:|:---:|
| Manage users (mutations) | ✅ | ❌ | ❌ | ❌ | ❌ |
| List users (full) | ✅ | ✅ | ❌ | ❌ | ❌ |
| List engineers only | ✅ | ✅ | ❌ | ❌ | ✅ |
| Create assignment | ✅ | ✅ | ❌ | ❌ | ✅ |
| Delete assignment | ✅ | ✅ | ❌ | ❌ | ❌ |
| Create inspection | ✅ | ✅ | ✅ | ❌ | ❌ |
| Submit inspection | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| Edit draft fields | Any inspection | Own only | Own only | ❌ | ❌ |
| Upload photos (non-completed) | Any inspection | Own only | Own only | ❌ | ❌ |
| Review → UNDER_REVIEW / COMPLETED | ✅ | ✅ | ❌ | ✅ (COMPLETED) | ❌ |
| Delete inspection | ✅ | ✅ | ❌ | ❌ | ❌ |
| Plot inspection status change | ✅ | ✅ | ✅ | ❌ | ❌ |
| Plot approval status change | ✅ | ✅ | ❌ | ✅ | ❌ |
| Map areas CRUD | ✅ | ✅ | Own field area (status only; delete DRAFT/REINSPECTION) | ❌ | ✅ |
| Delete area (cascades to all nested sub-areas, any depth) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Mark field outcome (non-compliant / awaiting owner / empty-unoccupied) | ✅ | ✅ | ✅ (own field area) | ❌ | ✅ |
| Assign zone to officer (with scope) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Complete assignment (manual gate, 100% submitted) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Draw field area in assigned zone subtree (any depth) | ❌ | ❌ | ✅ (assigned zones + their sub-areas) | ❌ | ❌ |
| Submit field area for approval | ✅ | ✅ | ✅ (own) | ❌ | ❌ |
| Approve / reject field area | ✅ | ✅ | ❌ | ✅ | ❌ |
| Propose property outcome (approved / unoccupied / unapproved / demolition) | ✅ (straight to accepted) | ✅ (straight to accepted) | ✅ own/zone child → PROPOSED | ✅ (straight to accepted) | ✅ own child → PROPOSED |
| Agree proposed outcome | ✅ | ✅ | ❌ | ✅ | ❌ |
| Direct reject outcome (bypass — no submission needed) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Request re-inspection (area) | ✅ | ✅ | ❌ | ✅ | ❌ |
| Resume re-inspection (zone; non-owned child) | ✅ | ✅ | ✅ (own area) | ❌ | ✅ (zone status-only) |
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ |
| View all inspections | ✅ | ✅ | Own only | ✅ | ✅ |

---

## 7. PAGE ROUTES

| Route | Description | Min. access |
|---|---|---|
| `/` | Server redirect → dashboard or login | Public |
| `/login` | Email → PIN OTP login | Public |
| `/dashboard` | Role-aware stats (every card links to its page; exact `head:true` counts) + quick actions | Authenticated |
| `/map` | Estate GIS map, search, satellite, drawing; plot popups + area panel offer **View in Google Maps** (external, view-only, Maps URL — no API key, never FHA boundary data) | Authenticated |
| `/plots` | Property list + search | Authenticated |
| `/plots/[id]` | Plot detail, dual status, history, status actions, **Documents** list (signed-URL view), Location row with **View in Google Maps** | Authenticated |
| `/inspections` | Inspection list — shows the linked marked area (`map_area.name`) when opened from the map | Authenticated |
| `/inspections/new` | Start inspection for a plot (also opened from a marked map area via `?plotId&areaId`; `areaId` shows a "Marked area" chip and is stored as `inspections.map_area_id`). Field order: **GPS → Site Photos (repeatable, thumbnails) → Observations → Approved-vs-Observed → Save/Submit**; each photo is stamped with its own GPS fix (fresh at capture, falling back to the site GPS) + `captured_at` | ENGINEER / SUPERVISOR / ADMIN (API) |
| `/inspections/[id]` | Capture GPS/photos/observations, compare, submit — header shows the originating map area; **GPS Evidence** card (coords + accuracy + captured time + **View in Google Maps**) and read-only **Site Photos** gallery (signed-URL thumbnails; hover shows per-photo coordinates) | Authenticated |
| `/approvals` | Review queue (plot approvals + submitted map areas) + decision actions; each area card shows **who submitted / approved / rejected / requested re-inspection** | Authenticated (actions role-gated) |
| `/documents` | Document metadata list with **View** (short-lived signed URL) | Authenticated |
| `/my-assignments` | Own assignments for any role (incl. a zone self-assigned from the map; fetched with `?mine=1`) | Authenticated |
| `/assignments` | All assignments (list/manage) | SUPERVISOR, ADMIN, GIS_OFFICER |
| `/assignments/new` | 3-step create (area → plots → details) | Same as above |
| `/assignments/[id]` | Assignment detail + partitioned progress + role-gated **[Mark Complete]** (100% submitted only) | Authenticated (API scopes ownership) |
| `/admin/users` | User management | ADMIN, SUPERVISOR |
| `/audit` | Audit trail with filters | ADMIN, SUPERVISOR |
| `/forbidden` | Access denied | Public |

---

## 8. API ROUTES

Base: `/api/v1`  
Response shape: `{ success: boolean, data?: …, error?: { code, message } }`

### Auth

| Method | Path | Access |
|---|---|---|
| GET | `/auth/me` | Authenticated |
| GET/POST | `/auth/logout` | Authenticated (Origin-checked) |

### Admin

| Method | Path | Access |
|---|---|---|
| GET | `/admin/users` | ADMIN, SUPERVISOR (full); GIS_OFFICER (engineers only) |
| POST | `/admin/users` | ADMIN — invite via service_role + OTP |
| PATCH | `/admin/users` | ADMIN — role / is_active / display_name |
| DELETE | `/admin/users` | ADMIN — soft deactivate |

### Plots

| Method | Path | Access |
|---|---|---|
| GET | `/plots` | Authenticated — search, pagination |
| GET | `/plots/[id]` | Authenticated |
| GET | `/plots/[id]/history` | Authenticated — status history |
| PATCH | `/plots/[id]/status` | Inspection: ENGINEER/SUPERVISOR/ADMIN; Approval: APPROVAL_OFFICER/SUPERVISOR/ADMIN |

### Inspections

| Method | Path | Access |
|---|---|---|
| GET | `/inspections` | Authenticated — ENGINEER filtered to own; rows include `plot` + `map_area` |
| POST | `/inspections` | ENGINEER, SUPERVISOR, ADMIN — optional `areaId` links the map area (`inspections.map_area_id`) |
| GET/PATCH/DELETE | `/inspections/[id]` | Authenticated + ownership/role rules |
| GET/POST | `/inspections/[id]/photos` | GET: own inspection or privileged (returns per-photo `latitude/longitude/captured_at`); POST: own inspection, ADMIN → any non-completed — optional `latitude/longitude/capturedAt` form fields (validated by `lib/photo-gps.ts`) |

### Assignments

| Method | Path | Access |
|---|---|---|
| GET | `/assignments` | ENGINEER → own only (`?mine=1` → own for any role, used by `/my-assignments`); others → all |
| POST | `/assignments` | SUPERVISOR, ADMIN, GIS_OFFICER |
| GET | `/assignments/[id]` | Authenticated |
| PATCH | `/assignments/[id]` | ADMIN, SUPERVISOR — `{ action: "complete" }` only; 422 `NOT_READY` unless 100% submitted |
| DELETE | `/assignments/[id]` | ADMIN, SUPERVISOR |
| PATCH | `/assignments/[id]/areas` | ADMIN/SUPERVISOR or assigned engineer |

### Approvals, documents, geo, map, audit

| Method | Path | Access |
|---|---|---|
| GET | `/approvals` | Authenticated — verify approval |
| GET | `/documents` | Authenticated |
| GET | `/documents/{id}/url` | Authenticated (active profile) — short-lived signed URL, audited `VIEW_DOCUMENT` |
| GET | `/geo-units` | Authenticated — hierarchy |
| GET/POST | `/map-areas` | Writes: ADMIN, SUPERVISOR, GIS_OFFICER (shape fully inside an existing area → nested child of the innermost containing area, any depth; otherwise a top-level zone); ENGINEER may POST only child areas inside own assigned zone subtree (server-validated, parent = innermost containing area) |
| PATCH/DELETE | `/map-areas/[id]` | PATCH: full fields for ADMIN/SUPERVISOR/GIS_OFFICER, status-only for APPROVAL_OFFICER (any) and ENGINEER (own area or zone-assigned child for outcome proposals, subset — never APPROVED/REJECTED) + `property_outcome: { type, action }` for all of the above (propose = officer → PROPOSED / higher role → ACCEPTED; agree = APPROVAL_OFFICER/SUPERVISOR/ADMIN only (matching PROPOSED record); reject = same roles, allowed with or without a prior record (direct bypass)); DELETE: ADMIN/SUPERVISOR/GIS_OFFICER or creator of own DRAFT/REINSPECTION area — area delete removes all nested descendants (`removedDescendants` in response) |
| GET | `/map-areas/{id}/children` | Authenticated — full descendant subtree of any area (any depth, each row with `depth`) + author names |
| GET | `/map-areas/history` | Authenticated — `?areaIds=uuid,…` (1–100): status + property-outcome history rows newest-first with actor names (who submitted / approved / rejected / requested re-inspection) |
| GET/POST | `/map-areas/{id}/assign` | GET: authenticated (assigned officers list); POST: ADMIN, SUPERVISOR, GIS_OFFICER (assign an active ENGINEER — **or yourself**: `assigned_to` = own user id lets a higher role take the zone and inspect it personally, audited `ASSIGN_ZONE`; optional `plot_ids` scope ⊆ zone plots → 422 `OUTSIDE_ZONE`) |
| GET | `/audit` | ADMIN, SUPERVISOR |

---

## 9. CORE DEMO JOURNEY

Target end-to-end path (`AGENTS.md` §33):

```text
1. LOGIN
      email → 6-digit PIN → /dashboard

2. MAP
      /map — estate boundary, roads, plots
      optional: satellite toggle, search, opacity slider

3. SELECT PLOT 003
      click polygon or search → open plot

4. PLOT DETAILS
      dual status (inspection + approval), allottee, block

5. APPROVAL
      approval record + conditions (stored info, not legal ruling)

6. NEW INSPECTION
      /inspections/new → link plot → start

7. GPS + PHOTO + OBSERVATION
      capture coordinates (lat/lng/accuracy/timestamp → inspections.gps_captured_at)
      → "View in Google Maps" opens the point externally (reference only)
      upload site photos (repeatable, thumbnails) — each photo stores its own
      latitude/longitude/captured_at (fresh fix, else site GPS)
      record observations

8. APPROVED VS OBSERVED
      system compares floors/units etc.
      → POTENTIAL DISCREPANCY (flag only — never “illegal”)

9. SUBMIT
      inspection → SUBMITTED

10. INSPECTION HISTORY
      plot/inspection history + audit trail
```

---

## 10. GIS DETAILS

| Feature | Implementation |
|---|---|
| Basemap | MapLibre style + OSM raster |
| Satellite | Esri World Imagery — added/removed dynamically on toggle |
| Drawing | MapLibre-Geoman free — polygon/rectangle for inspection zones |
| Search | Nominatim geocoding (`MapSearch`) |
| Layers | Estate boundary, roads, blocks, plot polygons, plot numbers, dual-status colors |
| Relationship | `GIS polygon → stable plot UUID → property → approval / documents / inspections` |

**Hard rules:** never invent official boundaries; synthetic geometry is demo-only and replaceable via seed/import — not hard-coded in business logic.

Map area roles: ADMIN, SUPERVISOR, GIS_OFFICER can draw/edit/delete.

---

## 11. DATA MODEL (CORE ENTITIES)

```text
profiles (role, is_active, display_name)
    │
estates / blocks / plots (PostGIS geometry, dual status)
    │
geographical_units (hierarchical: estate → … → plot)
    │
inspection_assignments ── assignment_areas
    │
inspections ── inspection_photos
    │
approvals / documents
    │
map_areas (drawn polygons; referenced by inspections.map_area_id)
    │
plot_status_history / audit_logs
```

**Dual status on plots:**

- `inspection_status` — e.g. NOT_INSPECTED, INSPECTED, AWAITING_REVIEW  
- `approval_status` — e.g. NOT_REVIEWED, PENDING, APPROVED, REJECTED  

**Map areas** use `map_area_status`: DRAFT, MARKED, IN_PROGRESS, INSPECTED,
AWAITING_REVIEW, APPROVED, REJECTED, REINSPECTION_REQUIRED, plus three engineer
field-outcome values — NON_COMPLIANT_OBSERVED ("Non-Compliant (Observed)"),
AWAITING_OWNER ("Awaiting Property Owner") and EMPTY_UNOCCUPIED
("Empty / Unoccupied"), two negative property-outcome values —
UNAPPROVED_PROPERTY ("Unapproved Property") and SET_FOR_DEMOLITION
("Set for Demolition") — and one positive property-outcome value —
APPROVED_PROPERTY ("Approved Property"). Field/property outcomes are
observations / recommendations recorded by the inspector, never enforcement
decisions.

**Property outcome** (`map_areas.metadata.property_outcome`) — type
(APPROVED_PROPERTY / UNOCCUPIED / UNAPPROVED / SET_FOR_DEMOLITION) +
state PROPOSED → ACCEPTED / REJECTED: proposed by the assigned officer
("submitted for approval"), agreed only by a higher review role
(APPROVAL_OFFICER/SUPERVISOR/ADMIN) after submission; a higher role recording
one is accepted immediately, and those roles may also **directly reject**
any option with no prior record (bypassing the submission). Server-enforced in
`PATCH /map-areas/{id}` (`property_outcome: { type, action }`); record
composition lives in `buildPropertyOutcomeRecord` (`lib/property-outcome.ts`,
unit-tested).

Every status transition and outcome change is appended to
`map_area_status_history` (area, actor, field, old → new, timestamp; written
by the PATCH route, read via `GET /map-areas/history`), rendered in the map
area panel's Activity section and as the submitted/reviewed-by lines on
`/approvals` cards (`deriveAreaActivity` in `lib/area-activity.ts`,
unit-tested).

Status values are centralized and **provisional** until FHA confirms them.

**Comparison service:** `lib/comparison.ts` — approved + observed → result (`POTENTIAL DISCREPANCY`). UI never declares legality.

---

## 12. SECURITY SUMMARY

| Control | Where |
|---|---|
| OTP-only auth | Supabase Auth |
| Cookie sessions | `@supabase/ssr` httpOnly |
| Fail-closed layout | No user → `/login`; inactive → `/login?error=disabled` |
| Page role gate | `middleware.ts` |
| API auth helper | `lib/api-auth.ts` → `requireAuth({ roles })` |
| Rate limiting | `lib/rate-limit.ts` (in-memory sliding window) |
| UUID validation | Dynamic API segments |
| RLS | Enabled on business tables |
| RLS write exception | Assigned-engineer property-outcome proposal on a child they did not draw: server authorizes (root-zone assignment) then writes via service role — all other map-area writes stay under RLS (AGENTS §31 assumption) |
| SECURITY DEFINER | `is_admin_user()` — GRANT EXECUTE to `authenticated`, REVOKE from `anon` |
| Self-protection | Cannot demote/deactivate self (API + `prevent_self_role_change`) |
| Logout CSRF | Origin allowlist |
| Document access | Authenticated only — no public static folder |
| Service role | Server-only (`SUPABASE_SERVICE_ROLE_KEY`) — never in client |
| Security headers | `web/next.config.ts` |

**Known lint note:** `spatial_ref_sys` RLS warning is expected (PostGIS system table) — safe to ignore.

---

## 13. ENVIRONMENT VARIABLES

See `web/.env.example`:

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY      # server only — user invites
SUPABASE_DB_URL
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_APP_ENV
NEXT_PUBLIC_DEMO_DATA_BANNER
NEXT_PUBLIC_MAP_STYLE_URL
MAP_PROVIDER_KEY
```

Never commit real keys. Keep `.env.local` out of git.

---

## 14. LOCAL DEV & DEPLOY

```bash
cd web
cp ../.env.example .env.local   # fill Supabase keys
npm install
npm run dev                     # http://localhost:3000
npm run lint
npx tsc --noEmit
npm run build
```

| Item | Value |
|---|---|
| Production URL | `https://fhafha.netlify.app` |
| Build | Netlify, base `web`, `npm run build`, Node 20 |
| Plugin | `@netlify/plugin-nextjs` |
| Git | Push `master` → Netlify auto-deploy |

**Database setup:**

1. Run `supabase/Schema.sql` (fresh — includes storage buckets/policies)  
2. Run `supabase/mock_data.sql` (demo data)  
3. On existing DB only: re-run `supabase/live_update.sql` (includes storage policies)  
4. Ensure: `GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;`

`storage.sql` is a pointer only — storage DDL lives in Schema.sql + live_update.sql (AGENTS §35).

---

## 15. DEMO DATA RULE

All seed records are fictional:

```text
DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD
```

Never invent real FHA records, owners, coordinates, or legal boundaries. Reset with `drop_mock_data.sql` + `mock_data.sql`.

---

## 16. OUT OF SCOPE (DO NOT BUILD YET)

Per `AGENTS.md` §30 — nationwide deployment, public verification portal, payments, online applications, automated legal decisions, AI satellite detection, full cadastral survey, multi-agency integrations, enterprise analytics.

**Deferred:** offline inspection sync (do not claim offline until implemented and tested).

---

## 17. KNOWN LIMITATIONS

| Limitation | Note |
|---|---|
| Synthetic GIS geometry | No official FHA boundaries yet |
| Provisional statuses | Pending FHA confirmation |
| Prototype lint debt | Some pre-existing ESLint issues in older pages/components |
| `@supabase/ssr` typing | Auth methods typed via shared `AuthLike` cast |
| In-memory rate limiter | Resets on server restart — fine for MVP |
| Offline mode | Not implemented |

---

## 18. RELATED DOCUMENTS

| Doc | Contents |
|---|---|
| `AGENTS.md` | AI agent rules, SQL file rule, demo rule |
| `ARCHITECTURE.md` | Technical architecture |
| `DATABASE.md` / `DATA_DICTIONARY.md` | Schema & fields |
| `API.md` | API design specification |
| `AUTHORIZATION_RBAC.md` | Provisional RBAC model |
| `WORKFLOWS.md` | Business workflow specs |
| `GIS.md` | GIS rules |
| `SECURITY.md` | Security policy |
| `UI_UX.md` | UI principles |
| `TESTING.md` | Test plan |
| `DEPLOYMENT.md` | Environments & deploy |
| `CHANGELOG.md` | Version history |
| `README.md` | Quick start |

---

**END OF SYSTEM_WALKTHROUGH.md**
