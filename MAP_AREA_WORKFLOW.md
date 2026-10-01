# MAP_AREA_WORKFLOW.md
# From Map Marking to End of App — Detailed Function Workflow

**Status:** As-built trace (code-verified) + identified gaps + recommended links
**Date:** 28 September 2026
**Update (28 Sep 2026):** Fixes **A (area↔plot link), B (real Start Inspection), and
C (Saved Areas list + area chip)** are now **implemented** — see §4 for current status.
Break points B1, B2, B3, B4 and B6 below are resolved; the rest remain open.
**Update 2 (28 Sep 2026):** Zone → officer → field-area workflow **implemented** — see §6.
**Update 3 (29 Sep 2026):** Workflow audit fixes — `inspections.map_area_id` written and
shown (B4 ✅) and the approvals queue lists submitted map areas (B9 ✅).
**Update 4 (29 Sep 2026):** Zone **Delete now removes every field area inside it**
(UI shows the zone delete button at any status + confirm prompt; API deletes
descendants deepest-first; DB FK `parent_area_id` is `ON DELETE CASCADE`), and the
engineer gained two **field-outcome** statuses — `NON_COMPLIANT_OBSERVED`
("Non-Compliant (Observed)") and `AWAITING_OWNER` ("Awaiting Property Owner"),
both provisional wording for FHA confirmation (observations, not legal decisions).
**Update 5 (30 Sep 2026):** Assignment progress bar redefined as **shared zone
coverage** — `zone plots covered by any officer's marked child areas / zone plots`,
scaled to a **70% target** (70% coverage = 100% bar → assignment auto-COMPLETED;
drops below → reopens). Drawing counts immediately (any child status); child
`plot_ids` no longer inherit the zone's list (an empty shape covers nothing).
Third field outcome added: `EMPTY_UNOCCUPIED` ("Empty / Unoccupied"). 70% target
and wording are provisional — for FHA confirmation.
**Update 6 (30 Sep 2026): SUPERSEDES Update 5's progress model** per WORKFLOWS
v0.2 (§5B/§18D): progress is now **partitioned per assignment** — `submitted rows
of that assignment's own scope / its total rows` (counted: `AWAITING_REVIEW`,
`INSPECTED`, `REINSPECTION_REQUIRED`; draft work never counts). **No shared zone
coverage, no 70% target, no auto-COMPLETED**: 100% → `READY_FOR_COMPLETION`
(new `assignment_status` enum value) → ADMIN/SUPERVISOR explicitly
`PATCH /assignments/{id} { action: "complete" }` → `COMPLETED`. Assign accepts an
optional `plot_ids` scope (default: zone plots not already claimed by another
active assignment); an engineer's field area may only cover plots inside their
own scope (422 `OUTSIDE_ASSIGNED_SCOPE`); submitting/reviewing a section maps its
status onto its scoped plot rows. `EMPTY_UNOCCUPIED` (Update 5) remains.
**Reason for this document:** After saving a named marked area on the map, the area is not
visible in Assignments, Inspections, or anywhere else. This document traces every step from
the act of marking the map through the app's major functions to the end, and shows exactly
where the chain stops.

> **DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD**
> All examples, plot numbers and statuses in this document are fictional demo data.

---

## 1. VERIFIED ANSWER FIRST — Is the next function INSPECTION or ASSIGNMENT?

**It is INSPECTION.** Verified from code (not assumed):

| # | Evidence | Location |
|---|---|---|
| 1 | Saved areas default to `area_type = 'INSPECTION_ZONE'` — enum is `INSPECTION_ZONE, INSPECTED_AREA, REVIEW_AREA` (all inspection vocabulary; no assignment vocabulary) | `supabase/Schema.sql:36-37, 370` |
| 2 | The area action panel's primary button is literally **"Start Inspection"** | `web/src/components/map/MapView.tsx:891-895` |
| 3 | The area status lifecycle mirrors an inspection lifecycle: `MARKED → IN_PROGRESS → INSPECTED → AWAITING_REVIEW → APPROVED / REJECTED → REINSPECTION_REQUIRED` | `Schema.sql:37`, buttons in `MapView.tsx:891-915` |
| 4 | `map_areas.assignment_id` exists but is **never written by any client and never read downstream** — vestigial column | `Schema.sql:367`; POST always stores `?? null` (`api/v1/map-areas/route.ts:95`) |
| 5 | The walkthrough itself calls assignment creation **"optionally"** and describes it as a *separate* action under geo-units | `SYSTEM_WALKTHROUGH.md:275-280` |

**Conclusion:** The intended next function after marking/saving an area is
**Start Inspection on that area**. Map → Assignment is a separate, optional, and currently
unimplemented side path. Neither path is wired today (see §3).

---

## 2. THE AS-BUILT WORKFLOW — STAGE BY STAGE

### Stage 0 — Entry

```text
LOGIN (email → 6-digit PIN OTP, no passwords)
  ↓  web/src/app/(auth)/login, middleware gates protected routes
DASHBOARD (role-aware stats + quick actions)
  ↓  web/src/app/(dashboard)/dashboard/page.tsx
```

- Route gate: `web/src/middleware.ts` protects `/map`, `/inspections`, `/assignments`, etc.
- Roles: ADMIN, SUPERVISOR, ENGINEER, APPROVAL_OFFICER, GIS_OFFICER (`SYSTEM_WALKTHROUGH.md §6`).

### Stage 1 — Mark the map (works today)

```text
Open /map
  ↓  server component loads plots + map_areas  (map/page.tsx:60-76)
Choose draw tool (Polygon / Box)
  ↓  MapDrawToolbar → handleToolChange → Geoman enableDraw  (MapView.tsx:465+)
Draw the shape
  ↓  gm:create event → name modal  (MapView.tsx:362-368)
Enter a name → Save
  ↓  saveArea(name) → POST /api/v1/map-areas  (MapView.tsx:560-570)
```

**POST payload actually sent** (`MapView.tsx:563-569`):

```json
{ "name": "...", "area_type": "INSPECTION_ZONE", "geojson": {...},
  "color": null, "plot_ids": ["<uuid of each plot centre inside the shape>"],
  "metadata": { "drawn_by_role": "..." } }
```

**Row written to `map_areas`** (`api/v1/map-areas/route.ts:86-100`):

| Column | Value stored | Note |
|---|---|---|
| `name` | your name | |
| `status` | **hard-coded `'MARKED'`** | `route.ts:91` |
| `geometry` / `geojson` | your polygon | |
| `plot_ids` | **plots whose centre point falls inside the polygon** (computed in `saveArea` via `plotIdsInside`, validated as uuids server-side) | added with fix A |
| `assignment_id` | **`NULL`** — still unused (optional future link) | `route.ts:95` |
| `drawn_by` | your user id | |

**Where the area is visible after saving:**

1. The `/map` page — as a coloured polygon (click it → action panel) — `MapView.tsx`
2. **"Saved Areas (n)" list, bottom-right of the map** — name, status, plot count; click to fly to + open the action panel (fix C)
3. A count badge: "DRAWN AREAS (n)" — `MapFilters.tsx:59-72`
4. Dashboard stat card **"Map Areas" — GIS_OFFICER role only** — `dashboard/page.tsx:103-109, 242`
5. When an inspection is started from it: a **"Marked area: …" chip** on `/inspections/new` (fix C)

### Stage 2 — "Start Inspection" on the area (intended next function — IMPLEMENTED)

```text
Click saved area (or Saved Areas list item) → [Start Inspection]      (ADMIN/SUPERVISOR/ENGINEER)
  ↓  plot_ids empty → recompute from the area polygon; still empty → guidance alert
  ↓  plot_ids = 1  → PATCH status IN_PROGRESS (best effort, if permitted)
  ↓                 → router.push(/inspections/new?plotId=…&areaId=…)
  ↓  plot_ids > 1  → plot picker in the panel first, then same navigation
  ↓
/inspections/new — loads plot, shows "Marked area: <name>" chip
  ↓
Inspection form (GPS + photos + observations)
  ↓
Approved vs observed → findings → submit
  ↓
Area status advances  MARKED → IN_PROGRESS → INSPECTED → AWAITING_REVIEW → APPROVED
```

Notes:

- GIS_OFFICER (cannot create inspections) sees **"Mark In Progress"** (status flip only)
  instead of "Start Inspection".
- The remaining status buttons ("Mark Inspected", "Submit for Review", "Approve/Reject")
  still update `map_areas.status` only — the plot/inspection status side advances through
  the actual inspection workflow, not through these buttons (break B8 remains).

### Stage 3 — Real inspections (plot-scoped; entered from an area via `?plotId&areaId`)

```text
Marked map area → [Start Inspection]        (now also a valid entry point — fix B)
PLOT page → [New Inspection]                (plots/[id]/page.tsx:181 → /inspections/new?plotId=...)
Inspections list → [New Inspection]         (inspections/page.tsx:68 → /inspections/new — NO params)
  ↓
/inspections/new requires ?plotId=  (inspections/new/page.tsx:42)
  ?areaId= additionally shows the "Marked area" chip (fix C)
  no ?plotId → "No plot selected. Go to the map or a plot page..."  (page.tsx:188-190)
  ↓
POST /api/v1/inspections
  - resolves plot from d.plotId          (api/v1/inspections/route.ts:42)
  - ENGINEER authorized via assignment_areas.geo_unit_id == plotId  (:54)
  - inserts inspections.plot_id NOT NULL  (Schema.sql: inspections table)
```

**Fixed:** `?areaId=` is accepted end-to-end: the page sends `areaId` in the POST body,
the API validates it and stores `inspections.map_area_id` (FK → `map_areas`,
`Schema.sql` + `live_update.sql` §21), and the area name is shown on the inspections
list and detail pages. `inspections.plot_id` stays `NOT NULL` — an inspection still
targets a **plot**; the area is context, not a replacement.

### Stage 4 — Assignments (separate universe; area cannot enter)

```text
/assignments/new (3-step wizard)
  Step 1  Select Geographic Area  → GET /api/v1/geo-units   (page.tsx:60,82,92,121)
  Step 2  Choose Plots            → plots of that geo-unit  (page.tsx:297-321)
  Step 3  Assign & submit         → POST /api/v1/assignments (page.tsx:143-154)
            body: { title, geoUnitId, assignedTo, areaIds: [plot UUIDs], ... }
  ↓
inspection_assignments  +  assignment_areas (rows keyed by geographical_units ids)
```

- The wizard **never fetches `/api/v1/map-areas`** — only `/api/v1/geo-units`.
- `geographical_units` is seeded only from `estates / blocks / plots`
  (`mock_data.sql:200-222`, `live_update.sql:375-388`) — never from `map_areas`.
- Assignment detail joins `assignment_areas → geographical_units` only
  (`assignments/[id]/route.ts:54-61`) — no `map_areas`.

**Break:** a saved map area cannot appear in any assignment screen because the two
features share no key: wizard reads geo-units, areas live in `map_areas`, and
`map_areas.assignment_id` is never set nor read.

**Note:** Map → Assignment (attaching a drawn polygon to an assignment) is a *separate,
optional* future link — not the primary chain. The primary chain is map → inspection (§1).

### Stage 5 — Inspection execution (works, once entered from a plot)

```text
/inspections/[id]
  ↓  capture GPS (lat/lng/accuracy/time), photos, observations
  ↓  approved vs observed comparison  (domain comparison service)
  ↓  record findings (POTENTIAL DISCREPANCY etc. — never a legal decision)
  ↓  SUBMIT → status DRAFT → SUBMITTED → review → COMPLETED
  ↓
Inspection history (plot page + inspections list)
```

Plot-scoped; the originating map area travels with the record via
`inspections.map_area_id` and its name is shown on the list and detail pages.

### Stage 6 — The rest of the major functions (for completeness)

```text
APPROVALS        /approvals         review queue + decision actions (role-gated)
DOCUMENTS        /documents         document metadata, authenticated access only
PLOTS            /plots, /plots/[id] property list, dual status, history, New Inspection
MY ASSIGNMENTS   /my-assignments    engineer's own assignments (from geo-unit model)
ASSIGNMENTS      /assignments/[id]  supervisor area-progress queue (assignment_areas)
ADMIN USERS      /admin/users       user management (ADMIN/SUPERVISOR)
AUDIT            /audit             who/what/record/when (ADMIN/SUPERVISOR)
```

All of Stage 6 except APPROVALS still ignore `map_areas` (verified by grep across
`web/src`). `/approvals` now also lists submitted map areas (B9) — documents, plots,
assignments and audit read plot/assignment data only.

---

## 3. BREAK-POINT SUMMARY (why your saved area is invisible)

| # | Break | Status | Location |
|---|---|---|---|
| B1 | **"Start Inspection" only PATCHed status** — no inspection created, no navigation | ✅ **FIXED** — navigates to `/inspections/new?plotId&areaId` (multi-plot picker; GIS officer gets "Mark In Progress") | `MapView.tsx` `startInspectionFromArea` / `goToInspection` |
| B2 | **`map_areas.plot_ids` always `[]`** — the area↔plot bridge was never populated | ✅ **FIXED** — computed in `saveArea` via `plotIdsInside` (+ recompute fallback for legacy areas); uuid-validated server-side | `MapView.tsx` `saveArea`, `lib/geo.ts`, `map-areas/route.ts` |
| B3 | **`map_areas.assignment_id` always NULL** and never read downstream | ✅ **FIXED for zones** — written by `POST /map-areas/{id}/assign`; read to resolve an engineer's assigned zones (page). Child-area POST resolves the engineer's **own** assignment via the zone geo-unit (not `zone.assignment_id`, which only holds the latest officer). Still unused for legacy/unassigned areas | `api/v1/map-areas/[id]/assign/route.ts`, `map/page.tsx`, `map-areas/route.ts` |
| B4 | **No inspection accepted an area id** — page read only `?plotId=`; API requires `plot_id NOT NULL` | ✅ **FIXED** — `areaId` validated + stored in `inspections.map_area_id` (FK, `live_update.sql` §21); area name shown on inspections list + detail. Inspection stays plot-scoped by design (`plot_id NOT NULL`) | `inspections/new/page.tsx`, `api/v1/inspections/route.ts`, `inspections/page.tsx`, `inspections/[id]/page.tsx` |
| B5 | **Assignment wizard never fetches map areas** — only geo-units | ⬜ OPEN (map→assignment deliberately out of scope) | `assignments/new/page.tsx:60,82,92,121,209` |
| B6 | **No saved-areas list anywhere** — only a count + legend on the map | ✅ **FIXED** — "Saved Areas (n)" list, bottom-right of map: name, status, plot count, click to fly + open panel | `MapView.tsx` |
| B7 | **Dashboard exposure is GIS_OFFICER-only count** | ⬜ OPEN | `dashboard/page.tsx:103-109, 242` |
| B8 | **Status vocabularies differ** (`map_area_status` vs plot/inspection statuses) — area status flips don't propagate to plots | ⬜ OPEN | `Schema.sql:37` vs plot/inspection enums |
| B9 | **Approvals queue never showed map areas** — a submitted zone/field area was invisible on `/approvals` | ✅ **FIXED** — "Map areas awaiting review" section: type/status badges, parent zone, Approve / Reject / Request Re-inspection (role-gated, `PATCH /map-areas/{id}`) | `approvals/page.tsx` |

**Net:** the primary chain **map → inspection now works end-to-end**; `map_areas` is no
longer a pure sink (Saved Areas list + inspection entry). Remaining gaps are the optional
assignment link (B3/B5) and dashboard/status propagation polish (B7/B8).

---

## 4. RECOMMENDED MINIMAL CHAIN (map → inspection) — IMPLEMENTED (A, B, C)

Design intent only — no official FHA rule is invented here; wording/behaviour should be
confirmed with FHA before implementation is treated as final.

```text
A. Link the area to its plots when saved                          ✅ IMPLEMENTED
   saveArea → plotIdsInside(polygon, plots) → POST plot_ids
   (centre-point hit test in lib/geo.ts; uuid-validated server-side;
    legacy areas without plot_ids are recomputed on the fly)

B. Make [Start Inspection] do a real inspection                   ✅ IMPLEMENTED
   area.plot_ids empty  → recompute → still empty → guidance alert
   area.plot_ids = 1    → PATCH status IN_PROGRESS (best effort) → /inspections/new?plotId&areaId
   area.plot_ids > 1    → plot picker in the panel → same navigation
   GIS officer          → "Mark In Progress" (status only — cannot create inspections)

C. Show saved areas where users look                              ✅ IMPLEMENTED
   - "Saved Areas (n)" list on /map (name, status, plot count; click → fly + panel)
   - "Marked area: …" chip on /inspections/new when opened with ?areaId

D. Keep assignment linkage out of this chain (separate, optional feature)   ⬜ PENDING — FHA
```

Remaining validation: run through the demo path in a logged-in session
(draw → save → Saved Areas → Start Inspection → chip → submit), and confirm wording
with FHA. The chip now writes `areaId` into the inspection record
(`inspections.map_area_id`, FK → `map_areas`).

---

## 5. WORKFLOW DIAGRAM (as-built after fixes A/B/C)

```text
[MARK] draw polygon → name → save
           ↓
     map_areas row (status MARKED, plot_ids = plots inside the shape)      ✅ fix A
           ↓
     visible in "Saved Areas (n)" list on /map                             ✅ fix C
           ↓
[Start Inspection] on the area  (ADMIN/SUPERVISOR/ENGINEER)
           ↓
     resolve plots (plot_ids, recompute if legacy) → picker if several
           ↓
     /inspections/new?plotId&areaId  + "Marked area" chip                   ✅ fixes B/C
           ↓
     capture GPS / photos / observations
           ↓
     approved vs observed → findings
           ↓
     submit → review → COMPLETED
           ↓
     area status: IN_PROGRESS → INSPECTED → AWAITING_REVIEW → APPROVED
           ↓
     inspection history on plot
           ↓
[SEPARATE/OPTIONAL] assignment under geo-unit (supervisor) → engineer executes   ⬜ D
           ↓
[END] approvals / documents / audit
```

---

## 6. ZONE → OFFICER → FIELD-AREA WORKFLOW (IMPLEMENTED — 28 Sep 2026)

Design intent for FHA confirmation — assignment rules, status wording and who may
approve are configurable defaults, not official FHA procedure.

```text
[ADMIN/SUPERVISOR/GIS] draws an area (polygon/rectangle)
   ↓  fully inside an existing area → nested child of the INNERMOST containing
   ↓          area (any depth: zone → child → grandchild → …), status MARKED,
   ↓          plot_ids = detected ∩ root-zone plots (only when the zone list is
   ↓          non-empty; top-level zones keep the raw detected list)
   ↓  inside nothing → new top-level zone (INSPECTION_ZONE, status MARKED)
   ↓  name modal previews the target before saving ("sub-area inside X" /
   ↓          "new top-level zone" / engineer warning when outside their zone)
   ↓  zone panel → [Assign Officer] dropdown (active ENGINEERs) + scope selector
   ↓          (Remaining plots [recommended] / Entire zone / choose plots)
POST /api/v1/map-areas/{id}/assign   [body: assigned_to, optional plot_ids]
   ↓  creates ZONE geo-unit (service role, once) → zone.metadata.geo_unit_id
   ↓  scope = plot_ids if given (⊆ zone plots, else 422 OUTSIDE_ZONE), otherwise
   ↓          zone plots not yet claimed by another active assignment (else all)
   ↓  creates inspection_assignments (ACTIVE, FHA/ASN/YYYY/XXXX) + assignment_areas
   ↓          (scope plots only — each officer's bar counts only their own rows)
   ↓  zone.assignment_id = new assignment; zone MARKED → IN_PROGRESS
   ↓  multiple officers per zone allowed (each gets own assignment; duplicate → 409)
   ↓
zone panel lists Assigned Officers + Field Areas (author names) ; "Assigned to you" chip
   ↓
[ENGINEER] draws a field area inside an assigned zone (or inside any area
   ↓          nested within it — child / grandchild / …)
POST /api/v1/map-areas (ENGINEER branch)
   ↓  validates every vertex of the drawn ring is inside the assigned-zone
   ↓          subtree (zone + all its descendants; plus a root-zone containment check)
   ↓  parent = innermost containing allowed area (any depth)
   ↓  forces: area_type=INSPECTED_AREA, status=DRAFT,
   ↓          assignment_id=the engineer's OWN assignment (resolved via the ROOT
   ↓          zone's geo-unit — zone.assignment_id may hold another officer's),
   ↓          plot_ids = client ∩ ROOT zone plots
   ↓          (no fallback: a shape with no plots inside covers nothing)
   ↓  plots inside the shape but outside the officer's assignment scope
   ↓          → 422 OUTSIDE_ASSIGNED_SCOPE
   ↓  no assigned zone → 403 NO_ASSIGNED_ZONE; outside the subtree → 422 OUTSIDE_ASSIGNED_ZONE
   ↓  creating/moving areas never counts by itself — only submitted plot rows do
   ↓          (PATCH on submit/review maps section status → its scoped plot rows)
   ↓
[ENGINEER] field-area actions (own area, status subset only)
   ↓  [Start Inspection] DRAFT/IN_PROGRESS/REINSPECTION/NON_COMPLIANT/
   ↓       AWAITING_OWNER/EMPTY_UNOCCUPIED
   ↓       → /inspections/new?plotId&areaId (also resumes a paused area → IN_PROGRESS)
   ↓  [Submit for Approval] → AWAITING_REVIEW
   ↓  [Field Outcome] → Non-Compliant (Observed) | Awaiting Property Owner |
   ↓       Empty / Unoccupied
   ↓       (observation/pause markers; not enforcement decisions — for FHA confirmation)
   ↓  [Delete] own DRAFT / REINSPECTION_REQUIRED (redraw after rework)
   ↓
[APPROVAL_OFFICER/SUPERVISOR/ADMIN] review
   ↓  [Approve] → APPROVED   |   [Reject] → REJECTED
   ↓  [Request Re-inspection] (REJECTED → REINSPECTION_REQUIRED)
   ↓  engineer corrects (delete + redraw) → resubmit
   ↓
[ADMIN/SUPERVISOR/GIS] [Delete Zone]/[Delete Area] at any status (confirm prompt)
   ↓  deletes ALL nested descendants (children + grandchildren), root last —
   ↓          confirm shows the descendant count when the list is loaded
   ↓  API walks parent_area_id level-by-level; DB FK parent_area_id = ON DELETE CASCADE
[END] field areas appear under their parent in Saved Areas (labelled by depth:
      Zone / Field area / Sub-area) + parent panel (descendants indented by depth)
```

**Enforcement:**

- API: `POST /map-areas` role split (ADMIN/SUPERVISOR/GIS = auto-nested child of the
  innermost containing area at any depth, else a top-level zone; ENGINEER = validated
  children only — vertex-inside-assigned-zone-subtree **and** plot-in-own-scope
  checks, parent = innermost containing allowed area); `PATCH` engineer
  = own area, status subset (incl. the field-outcome values, now also
  `EMPTY_UNOCCUPIED`), never APPROVED/REJECTED — and on submit/review the section
  status is mapped onto its scoped plot rows; `DELETE` = admin roles
  (zone delete cascades to all descendant field areas, verified + reported as
  `removedDescendants`) or creator of own DRAFT/REINSPECTION area. Progress is
  recomputed per assignment from its own rows only
  (`lib/assignment-progress.ts` → `recomputeAssignmentProgress`; 100% →
  `READY_FOR_COMPLETION`, completion only via
  `PATCH /assignments/{id} { action: "complete" }`).
- DB (RLS): `map_areas_update_roles` (reviewers, any status) OR `map_areas_update_own`
  (creator, `WITH CHECK status NOT IN ('APPROVED','REJECTED')` — no self-approval);
  `map_areas_delete_auth` = creator OR ADMIN/SUPERVISOR/GIS_OFFICER; FK
  `map_areas.parent_area_id` = `ON DELETE CASCADE` (zone → children, any depth).
- Assignment table link: `map_areas.parent_area_id` → zone (`idx_map_areas_parent`),
  `map_areas.assignment_id` → `inspection_assignments`, `metadata.geo_unit_id` →
  `geographical_units` (ZONE unit, required by `inspection_assignments.geo_unit_id`).
- Author names on other people's field areas use an id-scoped service-role read
  (profiles RLS exposes only own/admin-readable profiles).

**MVP limits (documented, deliberate):** containment test is per-vertex (concave-zone
edges are not clipped); child plot coverage comes from the client's plot-in-shape
computation (a shape whose plots are not detected covers nothing — never inherited
from the zone); zone approval remains optional (approve/reject buttons exist but
assignment does not wait for it — per decision: assign directly, approval optional);
the area nesting structure (innermost-parent auto-nest at any depth, admin children
stored as `INSPECTED_AREA` with status `MARKED`) is provisional until FHA confirms
the official hierarchy — the delete cascade removes a whole subtree and may change;
counted statuses, default scope rules and the `READY_FOR_COMPLETION` wording are
provisional until FHA confirms them (WORKFLOWS v0.2 §46).

---
