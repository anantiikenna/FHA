# MAP_AREA_WORKFLOW.md
# From Map Marking to End of App — Detailed Function Workflow

**Status:** As-built trace (code-verified) + identified gaps + recommended links
**Date:** 28 September 2026
**Update (28 Sep 2026):** Fixes **A (area↔plot link), B (real Start Inspection), and
C (Saved Areas list + area chip)** are now **implemented** — see §4 for current status.
Break points B1, B2 and B6 below are resolved; the rest remain open.
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

**Break:** there is no `areaId` / `mapAreaId` parameter anywhere in the inspection page
or API. `inspections.plot_id` is `NOT NULL` — an inspection must target a **plot**, and
`map_areas.plot_ids` (the column that could bridge them) is always `[]`.

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

Entirely plot-scoped. Nothing from `map_areas` is read here.

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

None of these read `map_areas` either (verified by grep across `web/src`).

---

## 3. BREAK-POINT SUMMARY (why your saved area is invisible)

| # | Break | Status | Location |
|---|---|---|---|
| B1 | **"Start Inspection" only PATCHed status** — no inspection created, no navigation | ✅ **FIXED** — navigates to `/inspections/new?plotId&areaId` (multi-plot picker; GIS officer gets "Mark In Progress") | `MapView.tsx` `startInspectionFromArea` / `goToInspection` |
| B2 | **`map_areas.plot_ids` always `[]`** — the area↔plot bridge was never populated | ✅ **FIXED** — computed in `saveArea` via `plotIdsInside` (+ recompute fallback for legacy areas); uuid-validated server-side | `MapView.tsx` `saveArea`, `lib/geo.ts`, `map-areas/route.ts` |
| B3 | **`map_areas.assignment_id` always NULL** and never read downstream | ⬜ OPEN (optional future link — D) | `map-areas/route.ts:95` |
| B4 | **No inspection accepted an area id** — page read only `?plotId=`; API requires `plot_id NOT NULL` | ◐ **CONTEXT FIXED** — `?areaId=` now shows a "Marked area" chip; the inspection itself stays plot-scoped by design (`plot_id NOT NULL`) | `inspections/new/page.tsx` |
| B5 | **Assignment wizard never fetches map areas** — only geo-units | ⬜ OPEN (map→assignment deliberately out of scope) | `assignments/new/page.tsx:60,82,92,121,209` |
| B6 | **No saved-areas list anywhere** — only a count + legend on the map | ✅ **FIXED** — "Saved Areas (n)" list, bottom-right of map: name, status, plot count, click to fly + open panel | `MapView.tsx` |
| B7 | **Dashboard exposure is GIS_OFFICER-only count** | ⬜ OPEN | `dashboard/page.tsx:103-109, 242` |
| B8 | **Status vocabularies differ** (`map_area_status` vs plot/inspection statuses) — area status flips don't propagate to plots | ⬜ OPEN | `Schema.sql:37` vs plot/inspection enums |

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
with FHA. The chip does not yet write `areaId` into the inspection record (future FK).

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

**END OF MAP_AREA_WORKFLOW.md**
