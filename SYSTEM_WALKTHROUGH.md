# SYSTEM_WALKTHROUGH.md
# FHA Development Approval & Property Mapping System
## Complete System Details (As-Built)

**Project Status:** MVP / Prototype  
**Version:** 0.3  
**Date:** 7 October 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Related:** `ARCHITECTURE.md`, `API.md`, `AUTHORIZATION_RBAC.md`, `WORKFLOWS.md`, `DATABASE.md`, `GIS.md`, `MAP_TUTORIAL.md`, `SECURITY.md`, `DEPLOYMENT.md`, `AGENTS.md`

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
| Auth | Supabase Auth — **shared username/password login** (demo override, see §4) |
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
│   │   ├── proxy.ts           # Auth + role gate for pages (Next.js 16 convention)
│   │   ├── app/
│   │   │   ├── page.tsx              # / → redirect dashboard|login
│   │   │   ├── (auth)/login/         # Shared admin password login
│   │   │   ├── (dashboard)/          # Authenticated UI
│   │   │   ├── forbidden/            # 403 page
│   │   │   └── api/v1/               # REST API
│   │   ├── components/               # UI, map, nav, photos
│   │   └── lib/                      # supabase, api-auth, audit, rate-limit, geo, photo-gps
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

> **Owner decision (Oct 2026):** the demo uses a **shared username/password
> login**, superseding the original email-OTP flow (documented override in
> `AGENTS.md` §1.1). Revisit before any production deployment.

```text
/login
  → enter username + password (demo: admin / passadmin)
  → username "admin" normalises to admin@demo.fha
  → Supabase signInWithPassword
  → session stored in httpOnly cookies
  → redirect /dashboard
```

| Step | Detail |
|---|---|
| Public paths | `/`, `/login`, `/forbidden`, `/api/v1/auth` |
| Protected | `/dashboard`, `/map`, `/plots`, `/approvals`, `/documents`, `/admin`, `/audit`, other `/api/*` |
| Not logged in → page | Redirect `/login?redirect=…` |
| Not logged in → API | `401 AUTH_REQUIRED` |
| Inactive account | Layout redirects `/login?error=disabled` |
| Logout | `GET/POST /api/v1/auth/logout` — clears cookies, validates Origin allowlist |
| Who am I | `GET /api/v1/auth/me` → profile `{ id, email, display_name, role, is_active }` |
| Shared-account trade-off | All field users sign in as `admin` — per-user attribution in audit/history rows shows `admin` |

Password reset / change and leaked-password protection are **not applicable**
to the shared demo account and are intentionally not built.

---

## 5. AUTHORIZATION LAYERS

Access is enforced in **three places** (not just hidden buttons):

```text
1. Proxy (web/src/proxy.ts)            → page routes only
2. API handlers (requireAuth / role checks) → every sensitive endpoint
3. Postgres RLS (supabase/Schema.sql)     → row-level policies
```

### 5.1 Proxy role map (pages)

| Prefix | Allowed roles |
|---|---|
| `/admin` | ADMIN, SUPERVISOR |
| `/audit` | ADMIN, SUPERVISOR |
| Everything else protected | Any authenticated user |

API routes are **not** role-checked by the proxy (except requiring login); each route checks roles itself.

### 5.2 Roles

| Role | Purpose |
|---|---|
| **ADMIN** | Full oversight: users, all map areas, audit log |
| **SUPERVISOR** | Reviews map areas and recorded outcomes |
| **ENGINEER** | Field work: draw areas, capture GPS/photos, record outcomes |
| **APPROVAL_OFFICER** | Approve / condition / reject plot approvals; reviews recorded outcomes |
| **GIS_OFFICER** | Map drawing + area management |

Roles are provisional until FHA confirms them (`AUTHORIZATION_RBAC.md`).

### 5.3 Sidebar navigation by role

**All roles:** Dashboard, Estate Map, Properties, Approvals, Documents

| Section | Shown for |
|---|---|
| Admin → Audit Log | ADMIN |

> **User management is hidden and disabled (owner decision).** The
> `/admin/users` nav entry and dashboard cards were removed, the proxy
> redirects `/admin/users` → `/dashboard`, and the API's POST/PATCH/DELETE
> handlers return `403 FEATURE_DISABLED` (GET still works for role checks).

---

## 6. COMPLETE ROLE WALKTHROUGH

### 6.1 ADMIN

**Dashboard stats:** Properties, Approved, Pending, Map Areas  
**Quick actions:** Open Map, Properties, Audit Log

| Capability | Access |
|---|---|
| Invite / edit / deactivate users | **Disabled** — POST/PATCH/DELETE `/api/v1/admin/users` → `403 FEATURE_DISABLED` |
| List all users | Yes (GET) |
| Draw / edit / delete map areas | Yes (delete cascades to nested sub-areas) |
| Record property/plot outcome | Yes — any leaf area |
| Change plot inspection **and** approval status | Yes |
| Approve / condition / reject on Approvals page | Yes |
| View audit log | Yes |

**Cannot:** demote own role or deactivate own account (API + DB trigger).  
**Integrity rules that still apply to ADMIN:** re-recording an outcome replaces the previous record; a PROPERTY outcome needs ≥1 evidence photo; photos lock once an outcome exists.

---

### 6.2 SUPERVISOR

**Dashboard stats:** Properties, Approved, Pending, Map Areas  
**Quick actions:** Open Map, Properties, Documents

| Capability | Access |
|---|---|
| List all users (full profile list) | Yes (GET only) |
| Draw / edit / delete map areas | Yes |
| Record property/plot outcome | Yes — any leaf area |
| Change plot inspection + approval status | Yes |
| Approve / condition / reject on Approvals page | Yes |
| View audit log | Yes |

**Cannot:** invite/edit/deactivate users (mutations ADMIN-only).

---

### 6.3 ENGINEER

**Dashboard stats:** Properties, Approved, Pending, Map Areas  
**Quick actions:** Open Map, Properties, Approvals

| Capability | Access |
|---|---|
| Draw areas; upload/delete own evidence photos | Yes |
| Record property/plot outcome | **Own drawn areas only** |
| Edit / delete other users' areas | No |
| Change plot **inspection** status | Yes |
| Change plot **approval** status | No |
| Review on Approvals page | No |
| Audit / user management | No |

**Route gate:** `/admin`, `/audit` → redirected to `/forbidden`.

**Field workflow:**

```text
Login → Map → draw a PROPERTY/PLOT inside a zone → save
  → add ≥1 evidence photo → record one of the four outcomes
  → plot detail: Start Inspection → Submit for Review (AWAITING_REVIEW)
  → approval officer decides on /approvals
```

---

### 6.4 APPROVAL_OFFICER

**Dashboard stats:** Pending Approvals, Approved, Properties, Pending  
**Quick actions:** Approvals Queue, Properties, Documents, Open Map

| Capability | Access |
|---|---|
| Change plot **approval** status | Yes |
| Approve / Approve with Conditions / Reject on Approvals page | Yes |
| View recorded map-area outcomes (photo + activity) | Yes (read-only) |
| Record outcome | Own drawn areas only |
| Edit / delete map areas | No (own drawn areas only) |
| Change plot inspection status | No |
| Draw areas | Yes (any active account) |
| Audit / user management | No |

**Approval wording rule:** the system records stored status (e.g. “Approval record found / Status: ACTIVE”). It does **not** issue legal conclusions.

---

### 6.5 GIS_OFFICER

**Dashboard stats:** Map Areas, Properties, Approved, Pending  
**Quick actions:** Open Map, Properties, Documents

| Capability | Access |
|---|---|
| Draw / edit / delete map areas | Yes (delete cascades to nested sub-areas) |
| Record property/plot outcome | Yes — any leaf area |
| Engineer directory (GET `/admin/users`) | Yes — returns **ENGINEER-only** profiles |
| Full user list | No (ADMIN/SUPERVISOR only) |
| Change plot statuses | No |
| Audit / user management | No |

**GIS workflow:**

```text
Login → Map → draw polygon/rectangle (Geoman)
  → name modal previews where the shape will be stored before saving
      (shape inside an existing area → nested child of the innermost
       containing area, any depth; inside nothing → new top-level zone)
  → save map_areas — status is set by the server (never by the client):
      ZONE → ACTIVE (container — never takes an outcome)
      PLOT/PROPERTY → AWAITING_OUTCOME
      plot_ids = plots detected inside the shape
  → Saved Areas list (bottom-right of map) shows every saved area
      (labelled by depth: Zone / Property / Plot / Sub-area)
  → leaf-area panel: upload evidence photo (AreaPhotoCapture) →
      record one of the four outcomes — Approved property /
      Empty / Unoccupied / Unapproved property / Set for Demolition
      → one step, saved as RECORDED with who/when; status becomes the outcome
      → PROPERTY needs ≥1 photo (button disabled, else 422 PHOTO_REQUIRED)
      → re-record replaces the previous record; photos lock once an outcome
        exists (route + RLS + storage policies)
      — a field observation/recommendation, never an enforcement decision (AGENTS §8)
  → zone panel: "Zones are always active containers" note (no outcome buttons)
  → area panel Activity section: per-area history (who recorded what, when)
  → area panel [Delete Zone] / [Delete Area] (ADMIN/SUPERVISOR/GIS or the
      creator of an AWAITING_OUTCOME area) with confirm
      → deleting an area also deletes every nested sub-area inside it (all depths)
      → confirm shows the descendant count when the sub-area list is loaded
  → /approvals lists recorded outcomes with the latest evidence photo + who/when
```

---

### 6.6 Permission matrix

| Capability | ADMIN | SUPERVISOR | ENGINEER | APPROVAL_OFFICER | GIS_OFFICER |
|---|:---:|:---:|:---:|:---:|:---:|
| Manage users (mutations) | ✅ | ❌ | ❌ | ❌ | ❌ |
| List users (full) | ✅ | ✅ | ❌ | ❌ | ❌ |
| List engineers only | ✅ | ✅ | ❌ | ❌ | ✅ |
| Draw / create map areas | ✅ | ✅ | ✅ | ✅ | ✅ |
| Edit area fields (name / description / color / type / plots) | ✅ | ✅ | ❌ | ❌ | ✅ |
| Delete area (cascades to nested sub-areas) | ✅ | ✅ | Own, `AWAITING_OUTCOME` only | Own, `AWAITING_OUTCOME` only | ✅ |
| Record property/plot outcome | ✅ (any leaf) | ✅ (any leaf) | Own drawn area | Own drawn area | ✅ (any leaf) |
| Plot inspection status change | ✅ | ✅ | ✅ | ❌ | ❌ |
| Plot approval status change | ✅ | ✅ | ❌ | ✅ | ❌ |
| Approve / condition / reject plot (Approvals page) | ✅ | ✅ | ❌ | ✅ | ❌ |
| View recorded outcomes + evidence photos (read-only) | ✅ | ✅ | ✅ | ✅ | ✅ |
| View audit log | ✅ | ✅ | ❌ | ❌ | ❌ |

Drawing needs an active account only (server + RLS check `drawn_by = auth.uid()`); field edits, deletes, and outcomes are additionally role-gated in the API. A `PROPERTY` outcome additionally requires ≥1 evidence photo.

---

## 7. PAGE ROUTES

| Route | Description | Min. access |
|---|---|---|
| `/` | Server redirect → dashboard or login | Public |
| `/login` | Shared username + password login (demo: `admin` / `passadmin`) | Public |
| `/dashboard` | Role-aware stats (every card links to its page; exact `head:true` counts) + quick actions | Authenticated |
| `/map` | Estate GIS map, search (**plot search + Nominatim place search**), satellite, drawing; **plot popups show the building photo (latest inspection photo) and the owner (current property interest, fetched on open)**; plot markers open the popup (details link inside) + area panel offers **View in Google Maps** (external, view-only, Maps URL — no API key, never FHA boundary data); leaf-area panel records **property/plot outcomes with evidence photos + Activity**; Saved Areas list (depth-labelled); **"How to use this map" help button + first-visit hint card** (`MapHelp.tsx`, full guide in `MAP_TUTORIAL.md`) | Authenticated |
| `/plots` | Property **records list with photo + details** (building-photo thumbnail per plot, owner, allocation, block/estate/size, status badges) + search | Authenticated |
| `/plots/[id]` | Plot detail, dual status, history, status actions, **Documents** list (signed-URL view), Location row with **View in Google Maps** | Authenticated |
| `/approvals` | Review queue (plot approvals + recorded map-area outcomes) + decision actions; each outcome card shows the **latest evidence photo + details** and **who recorded it** | Authenticated (actions role-gated) |
| `/documents` | Document metadata list with **View** (short-lived signed URL) | Authenticated |
| `/admin/users` | **Hidden + disabled (owner decision)** — nav entry removed, proxy redirects to `/dashboard` | Redirected |
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
| POST/PATCH/DELETE | `/admin/users` | **Disabled (owner decision)** — `403 FEATURE_DISABLED` |

### Plots

| Method | Path | Access |
|---|---|---|
| GET | `/plots` | Authenticated — search, pagination |
| GET | `/plots/[id]` | Authenticated |
| GET | `/plots/[id]/photo` | Authenticated — `302` to a short-lived signed URL of the plot's latest inspection photo ("building photo"); `404` when none |
| GET | `/plots/[id]/history` | Authenticated — status history |
| PATCH | `/plots/[id]/status` | Inspection: ENGINEER/SUPERVISOR/ADMIN; Approval: APPROVAL_OFFICER/SUPERVISOR/ADMIN |

### Approvals, documents, map, audit

| Method | Path | Access |
|---|---|---|
| GET | `/approvals` | Authenticated — verify approval |
| GET | `/documents` | Authenticated |
| GET | `/documents/{id}/url` | Authenticated (active profile) — short-lived signed URL, audited `VIEW_DOCUMENT` |
| GET/POST | `/map-areas` | Authenticated with an active profile (any role). Shape fully inside an existing area → nested child of the innermost containing area, any depth; otherwise a top-level zone. Status set by the server: ZONE → `ACTIVE`, PLOT/PROPERTY → `AWAITING_OUTCOME` |
| PATCH/DELETE | `/map-areas/[id]` | PATCH: `name/description/color/area_type/plot_ids/metadata` for ADMIN/SUPERVISOR/GIS_OFFICER; `property_outcome: { type }` for those roles on **any** leaf area and for other roles on **their own drawn area** (one-step record → state `RECORDED`, `status` becomes the outcome status; PROPERTY requires ≥1 photo else `422 PHOTO_REQUIRED`; zones → `422 NO_OUTCOME_ON_ZONE`; a direct `status` write → `422`). DELETE: ADMIN/SUPERVISOR/GIS_OFFICER at any status, or the creator while status is `AWAITING_OUTCOME` — cascades to all nested descendants (`removedDescendants` in response) |
| GET | `/map-areas/{id}/children` | Authenticated — full descendant subtree of any area (any depth, each row with `depth`) + author names |
| GET | `/map-areas/history` | Authenticated — `?areaIds=uuid,…` (1–100): status + property-outcome history rows newest-first with actor names (who recorded what, when) |
| GET/POST | `/map-areas/{id}/photos` | GET: authenticated (evidence photos + `meta.locked`); POST: multipart upload (JPG/PNG ≤10MB, magic-byte check, optional GPS form fields via `lib/photo-gps.ts`) — `403 LOCKED` once an outcome is recorded (`RECORDED`/`PROPOSED`/`ACCEPTED`); RLS enforces the same |
| GET/DELETE | `/map-areas/{id}/photos/{photoId}` | GET: authenticated — short-lived signed URL (60s); DELETE: uploader or ADMIN/SUPERVISOR while no outcome is recorded (`403 LOCKED` afterwards) — "mistake" removal |
| GET | `/map-areas/photos` | Authenticated — `?area_ids=uuid,…` (1–100): latest photo per area with a signed URL (batch, used by the outcome cards) |
| GET | `/audit` | ADMIN, SUPERVISOR |

---

## 9. CORE DEMO JOURNEY

As-built end-to-end path. The inspection/assignment flow from `AGENTS.md`
§33 is **not present in this build** — it was removed together with the
assignments & inspections feature (pages, APIs, libs). AGENTS §2/§33 need
owner re-alignment.

```text
1. LOGIN
      username + password → /dashboard  (demo: admin / passadmin)

2. MAP
      /map — estate boundary, roads, plots
      optional: satellite toggle, plot/place search, opacity slider
      plot popup: building photo + owner + statuses

3. SELECT PLOT 003
      click polygon or search → open plot

4. PLOT DETAILS
      dual status (inspection + approval), allottee, block,
      status actions (Start Inspection → Submit for Review, approval buttons),
      documents (signed-URL view)

5. APPROVAL
      approval record + conditions (stored info, not legal ruling)
      /approvals → Approve / Approve with Conditions / Reject

6. DRAW / SELECT AREA
      Geoman polygon → name modal (container preview) → saved
      ZONE → ACTIVE | PLOT/PROPERTY → AWAITING_OUTCOME (server-set)

7. EVIDENCE PHOTO
      leaf-area panel → AreaPhotoCapture (JPG/PNG ≤10MB, GPS-stamped)

8. RECORD OUTCOME
      one of four outcomes → state RECORDED (who/when) + status = outcome
      PROPERTY requires ≥1 photo; zones can never take an outcome
      → history row in map_area_status_history + audit log entry

9. SEE IT REVIEWED
      /approvals lists recorded outcomes (photo + who/when) — read-only
      area panel Activity + audit trail show the same event
```

---

## 10. GIS DETAILS

| Feature | Implementation |
|---|---|
| Basemap | MapLibre style + OSM raster |
| Satellite | Esri World Imagery — added/removed dynamically on toggle |
| Drawing | MapLibre-Geoman free — polygon/rectangle for zones, properties and plots |
| Search | Plot search (`/plots?search=`) + Nominatim geocoding (`MapSearch`) |
| Layers | Estate boundary, roads, blocks, plot polygons, plot numbers, dual-status colors |
| Relationship | `GIS polygon → stable plot UUID → property → approval / documents / inspections` |

**Hard rules:** never invent official boundaries; synthetic geometry is demo-only and replaceable via seed/import — not hard-coded in business logic.

Map area roles: any **active** account can draw (RLS keeps rows own-scoped);
editing area fields and deleting others' areas is limited to
ADMIN/SUPERVISOR/GIS_OFFICER (see §6.6).

---

## 11. DATA MODEL (CORE ENTITIES)

```text
profiles (role, is_active, display_name)
    │
estates / blocks / plots (PostGIS geometry, dual status)
    │
geographical_units (hierarchical: estate → … → plot)
    │
approvals / documents
    │
map_areas (drawn polygons: ZONE / PLOT / PROPERTY)
    │
map_area_photos (outcome evidence photos, bucket `area-photos`)
    │
map_area_status_history (per-area who / what / when)
    │
plot_status_history / audit_logs
```

> **Legacy tables** — `inspections`, `inspection_photos`,
> `inspection_assignments`, `assignment_areas` remain in the schema with
> pre-existing rows (`inspection_photos` still feeds the plot "building
> photo"). No current page or API writes them; `mock_data.sql` still seeds
> assignment rows for historical demo data.

**Dual status on plots:**

- `inspection_status` — e.g. NOT_INSPECTED, INSPECTED, AWAITING_REVIEW  
- `approval_status` — e.g. NOT_REVIEWED, PENDING, APPROVED, REJECTED  

**Map areas** use `map_area_status` — simplified model (owner decision,
Oct 2026): zones are always `ACTIVE`; plots/properties start at
`AWAITING_OUTCOME` and move to exactly one of the four property-outcome
values (`APPROVED_PROPERTY`, `EMPTY_UNOCCUPIED`, `UNAPPROVED_PROPERTY`,
`SET_FOR_DEMOLITION`) when an outcome is recorded. Status is **derived** —
the PATCH route rejects direct `status` writes (`422`). Legacy workflow
values (DRAFT, MARKED, IN_PROGRESS, INSPECTED, AWAITING_REVIEW, APPROVED,
REJECTED, REINSPECTION_REQUIRED, NON_COMPLIANT_OBSERVED, AWAITING_OWNER)
remain in the enum for pre-simplification rows. Property outcomes are
observations / recommendations recorded by the field officer, never
enforcement decisions (AGENTS §8).

**Property outcome** (`map_areas.metadata.property_outcome`) — a direct
one-step record (owner decision, Oct 2026): pick one of the four outcomes
on the leaf-area panel → saved immediately as state `RECORDED` with
who/when, and `map_areas.status` becomes the matching outcome status.
≥1 evidence photo is required for `PROPERTY` areas (else `422
PHOTO_REQUIRED`); zones can never carry an outcome (`422
NO_OUTCOME_ON_ZONE`). Re-recording replaces the previous record; photos
lock once an outcome exists. Pre-simplification rows
(`PROPOSED` → `ACCEPTED` / `REJECTED`) still render with a legacy label.
Server-enforced in `PATCH /map-areas/{id}`; record composition lives in
`recordPropertyOutcome` (`lib/property-outcome.ts`, unit-tested).

Every status transition and outcome change is appended to
`map_area_status_history` (area, actor, field, old → new, timestamp; written
by the PATCH route, read via `GET /map-areas/history`), rendered in the map
area panel's Activity section and as the recorded-by lines on
`/approvals` cards (`deriveAreaActivity` in `lib/area-activity.ts`,
unit-tested).

Status values are centralized and **provisional** until FHA confirms them.

---

## 12. SECURITY SUMMARY

| Control | Where |
|---|---|
| Shared password login | Supabase Auth `signInWithPassword` — single demo account (`admin`), owner-decided override of AGENTS §1.1; no reset/change flows |
| Area evidence photos | Upload/delete blocked (route + RLS + storage policies) once an outcome is recorded; recording a `PROPERTY` outcome requires ≥1 photo |
| Cookie sessions | `@supabase/ssr` httpOnly |
| Fail-closed layout | No user → `/login`; inactive → `/login?error=disabled` |
| Page role gate | `proxy.ts` |
| API auth helper | `lib/api-auth.ts` → `requireAuth({ roles })` |
| Rate limiting | `lib/rate-limit.ts` (in-memory sliding window) |
| UUID validation | Dynamic API segments |
| RLS | Enabled on business tables |
| Map-area writes | API role-gates field edits/deletes/outcomes; RLS backstops with `map_areas_update_roles` / `map_areas_update_own` (own-drawn rows) |
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
