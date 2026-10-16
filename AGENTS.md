# AGENTS.md
# FHA Development Approval & Property Mapping System

**Project Status:** MVP / Prototype  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Version:** 0.1  
**Date:** 31 August 2026

---

## 1. PURPOSE

You are the primary AI software engineering agent for the FHA Development Approval & Property Mapping System.

Your responsibility is to implement the MVP described in the primary product specification while producing clean, secure, maintainable and extensible code.

Before making major implementation decisions:

1. Read the relevant section of the MVP specification.
2. Inspect the existing repository and its current technology stack.
3. Reuse the existing architecture where practical.
4. Do not invent official FHA rules, approval procedures, legal decisions or GIS boundaries.
5. Clearly distinguish demo/sample data from official FHA data.

---

## 1.1 AUTHENTICATION METHOD

> **OVERRIDE (owner decision, Oct 2026):** This app now uses a **shared username/password
> login** — username `admin`, password `passadmin` (seeded account `admin@demo.fha` in
> `mock_data.sql` / `live_update.sql` §29). This supersedes the original email-OTP rule
> below for the demo/MVP. Revisit before any production deployment.

- User enters username + password → Supabase Auth `signInWithPassword`
- The shared account is used by **all** field users simultaneously (demo trade-off:
  per-user attribution in audit/history rows is lost — every actor shows as `admin`)
- No password change, password reset, or leaked password protection features
- Session managed via Supabase SSR cookies (not localStorage)
- Original OTP flow is retired; do not re-add PIN steps to the UI

When working on auth-related code:
- Password fields are allowed **only** for the shared demo login described above
- Never implement password change/reset flows
- Never enable leaked password protection — it is not applicable
- User management stays **disabled/hidden** (owner decision): keep it out of the UI

---

## 2. CORE MVP WORKFLOW

The MVP must demonstrate this workflow:

```text
Engineer Login
      ↓
Estate GIS Map
      ↓
Search / Select Plot
      ↓
Plot Details
      ↓
View Approval
      ↓
View Documents
      ↓
Start Inspection
      ↓
Capture GPS / Photos / Observations
      ↓
Compare Approved vs Observed
      ↓
Record Finding
      ↓
Submit Inspection
      ↓
Inspection History
```

Do not expand the MVP unnecessarily before this workflow works reliably.

---

## 3. IMPLEMENTATION PRIORITY

### Priority 1
- Project foundation
- Authentication
- Dashboard
- GIS estate map
- Plot selection
- Plot search
- Plot details

### Priority 2
- Approval information
- Approval verification
- Documents

### Priority 3
- Inspection creation
- GPS capture
- Photo upload/capture
- Observations
- Approved-vs-observed comparison
- Inspection submission
- Inspection history

### Priority 4
- Audit logging
- Basic reporting
- Demo-data management
- Error handling
- UX polish
- Responsive/mobile field experience

Do not build advanced features before the core workflow is functional.

---

## 4. DEMO DATA RULE

Until FHA supplies official records, all records are fictional.

Clearly label demo environments:

**DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD**

Never:
- Invent real FHA records.
- Invent real property owners.
- Claim fictional coordinates are official.
- Claim fictional plot boundaries are legal boundaries.
- Present sample approval conditions as actual FHA conditions.

Demo data must remain clearly separate from production data.

---

## 5. GIS RULES

GIS is a core MVP feature.

The map may contain:

- Estate boundary
- Roads/streets
- Blocks
- Individual plot polygons
- Plot numbers
- Selected plot
- FHA-approved status indicators, if required

The core relationship is:

```text
GIS Plot Polygon
       ↓
Stable Plot ID
       ↓
Property Record
       ↓
Approval / Documents / Inspections
```

### Critical rule

Never invent or alter official plot boundaries.

If FHA GIS data is unavailable, use synthetic/demo geometry and label it clearly as demo data.

Do not hard-code demo polygons into business logic. Keep them replaceable through seed/import data.

---

## 6. PLOT IDENTIFICATION

Use an internal stable database ID/UUID.

Official identifiers should remain separate fields.

Do not assume that plot number alone is globally unique.

The production identifier format must be confirmed by FHA.

---

## 7. APPROVAL RULE

Distinguish between:

### Stored information
What the database contains.

### System verification result
What the application can determine from stored records.

### Official FHA decision
What an authorized FHA officer/process determines.

Never automatically turn the existence of a database record into a legal conclusion.

Prefer:

```text
Approval record found
Status: ACTIVE
```

rather than unsupported language such as:

```text
This property is legally approved.
```

Final verification wording must be configurable after FHA review.

---

## 8. APPROVED VS OBSERVED

The system should compare approved information with inspection observations.

Example:

```text
Approved Floors: 2
Observed Floors: 3

Result:
POTENTIAL DISCREPANCY
```

The system may flag differences.

It must not automatically declare a property illegal, issue an enforcement order, cancel an approval or make another legal decision unless FHA explicitly defines and authorizes that automation.

---

## 9. INSPECTION DESIGN

Keep approved values and observed values separate.

Example:

```text
Approved:
Floors = 2
Units = 4

Observed:
Floors = 3
Units = 6
```

Never overwrite approved information with inspection observations.

Every inspection must remain historically traceable.

---

## 10. GPS

GPS is inspection evidence/data, not a replacement for official surveying.

Where supported, capture:

- Latitude
- Longitude
- Accuracy
- Timestamp

Do not fabricate coordinates.

Do not represent normal phone GPS accuracy as a legal cadastral survey.

If location permission is denied, show a clear message and follow the configured FHA workflow.

---

## 11. PHOTOGRAPHS

Inspection photos must be associated with an inspection.

Recommended metadata:

```text
photo_id
inspection_id
file
caption
latitude
longitude
captured_at
uploaded_at
uploaded_by
```

Validate:

- File type
- File size
- Upload authorization
- Storage location
- Access permissions

Private inspection photographs must never be publicly exposed.

---

## 12. DOCUMENT SECURITY

Approval, allocation and inspection documents may contain sensitive information.

Never put protected documents in a public static folder.

Use authenticated and authorized document access.

Do not expose unrestricted storage URLs where the storage system does not enforce access control.

---

## 13. AUTHORIZATION

Authentication is not authorization.

Every sensitive server operation must enforce permissions.

Examples:

- View property
- View documents
- Create inspection
- Edit inspection
- Submit inspection
- Edit approval
- Manage users

Do not rely on hidden frontend buttons for security.

The server/API/database must enforce authorization.

---

## 14. AUDITABILITY

Important actions should be traceable.

At minimum plan for:

```text
who
what
record
action
when
```

Examples:

```text
USER A
VIEWED
PLOT 003
2026-08-31 10:20
```

```text
USER B
SUBMITTED INSPECTION
FHA/INSP/...
2026-08-31 11:05
```

Implement a basic audit trail where practical for the MVP.

---

## 15. DATABASE PRINCIPLES

Core entities:

```text
Estate
Block
Plot
Allottee / Interest
Application
Approval
Inspection
Document
Inspection Photo
User
Audit Log
```

Use normalized relationships, foreign keys and stable IDs.

GIS geometry should be associated with the correct spatial entity.

Do not duplicate the same business data unnecessarily across tables.

---

## 16. VALIDATION

All user-controlled input must be validated.

Validate:

- Required fields
- IDs
- Numbers
- Dates
- Coordinates
- Enum/status values
- Text lengths
- File types
- File sizes

Never rely only on frontend validation.

---

## 17. ERROR HANDLING

User-facing errors should be understandable.

Avoid exposing raw technical errors such as:

```text
Postgres error: relation public.inspections...
```

Prefer:

```text
We couldn't save the inspection.
Please try again.
```

Technical details should be logged securely for developers.

---

## 18. UI/UX PRINCIPLES

The application is intended for engineers/officers working with property information.

Prioritize:

- Clarity
- Speed
- Readability
- Strong visual hierarchy
- Large touch targets
- Responsive design
- Useful loading states
- Useful empty states
- Useful error states
- Minimal unnecessary animation

The map and property record should feel like one connected workflow.

Use a professional government/engineering-oriented visual language.

---

## 19. FIELD-FIRST RESPONSIVENESS

The inspection interface must work well on:

- Desktop
- Tablet
- Android phone

Field users may have poor connectivity, small screens and bright outdoor conditions.

Important actions should remain easy to reach:

```text
Capture GPS
Take Photo
Add Observation
Save Draft
Submit
```

---

## 20. OFFLINE CONSIDERATION

Offline inspection is a production consideration.

Do not claim the MVP is fully offline unless it is actually implemented and tested.

A future offline workflow may be:

```text
Load property data
      ↓
Visit site
      ↓
Capture GPS + photos + observations
      ↓
Save locally
      ↓
Connectivity returns
      ↓
Synchronize
      ↓
Server confirmation
```

Synchronization must prevent duplicate inspections and data loss.

---

## 21. API / SERVER RULES

Organize server operations by business capability.

Conceptually:

```text
/api/estates
/api/plots
/api/approvals
/api/inspections
/api/documents
```

Each sensitive endpoint should include:

- Authentication
- Authorization
- Input validation
- Error handling
- Consistent responses
- Appropriate logging

Do not place all business operations into one oversized route.

---

## 22. BUSINESS LOGIC

Business rules must not be scattered throughout UI components.

For example, do not duplicate comparison logic in multiple React components.

Prefer a reusable domain/service layer:

```text
Approved Data + Observed Data
          ↓
Comparison Service
          ↓
Comparison Result
          ↓
UI
```

This makes future FHA rule changes easier.

---

## 23. STATUS VALUES

Possible demo statuses include:

```text
APPROVED
PENDING
UNDER_CONSTRUCTION
COMPLETED
INSPECTION_REQUIRED
REVIEW_REQUIRED
```

These are examples only.

Do not permanently treat them as official FHA statuses until FHA confirms them.

Keep statuses centralized and configurable.

---

## 24. SAMPLE DATA SEEDING

Create a repeatable demo seed process containing:

- One estate
- Several blocks
- Multiple plots
- Sample approvals
- Sample inspections
- Sample document metadata

The demo environment should be resettable/reseedable.

Never mix demo records with production records.

---

## 25. TESTING

At minimum, test:

### Unit
- Plot lookup
- Approval lookup
- Approved-vs-observed comparison
- Validation
- Status transitions

### Integration
- Login
- Plot retrieval
- Approval retrieval
- Inspection creation
- Inspection submission

### UI
- Map → plot → details
- Plot → approval
- Plot → inspection
- Inspection → submit

### Security
- Unauthorized property access
- Unauthorized document access
- Unauthorized inspection modification
- Invalid IDs
- Malicious file upload

### End-to-End (Playwright)

Automated E2E suite lives in `web/e2e/` and runs against the production
build (localhost:3100) + the live demo database:

```bash
cd web && npm run test:e2e
```

CI job **E2E (map & core flows)** gates every promotion. Required coverage:

- Map rendering: MapLibre worker loads (no `Worker failed to load` errors),
  basemap tiles fetch, canvas visible
- Markings & naming: on-map area labels render (glyph font requests fire);
  Saved Areas list and page counts match `/api/v1/map-areas` (data parity)
- Drawing: draw → name modal → save → area appears in the list AND via the
  API → the test deletes its own records afterward
- Deep links: `?area=` from Properties opens the correct named panel
- Evidence photos: multi-file upload (batch, progress + "n of max" cap)
  → full-screen lightbox inspection (zoom +
  provenance metadata: captured/uploaded/GPS/uploader, `1 / N` navigation)
  → the same evidence opens from the Properties list (cross-view parity)
  → server-side per-area photo cap (`422 PHOTO_LIMIT` at 20) →
  delete + cleanup
- Core flows: login success + friendly failure, dashboard stat cards vs API
  counts, sidebar navigation, properties list count vs API

**Data-parity rule:** E2E tests must never hard-code record counts — fetch
the count from the API inside the test and compare with what the UI shows.

**New-feature rule:** any new feature ships with E2E coverage of its core
action AND every place its result is reflected (lists, counts, labels,
links, deep-link params). A UI without a regression test is not done (§32).

---

## 26. DEVELOPMENT WORKFLOW

Before coding:

1. Inspect the repository.
2. Identify the existing framework.
3. Identify the database.
4. Identify authentication.
5. Identify current GIS/map technology.
6. Review environment variables.
7. Review existing components.
8. Review existing folder structure.
9. Reuse existing architecture where appropriate.

Do not replace the project's stack merely because another stack is preferred.

Work happens on **`develop`**; `master` receives only CI-green promotions
(`.github/workflows/ci.yml` — see §36 Step 7).

---

## 27. CHANGE DISCIPLINE

When changing the project:

- Keep changes focused.
- Avoid unrelated refactoring.
- Do not delete working features without justification.
- Avoid unnecessary dependencies.
- Keep business logic reusable.
- Document major architectural decisions.
- Preserve working functionality.

---

## 28. ENVIRONMENT VARIABLES

Never commit:

- API keys
- Passwords
- Database credentials
- Storage secrets
- Private tokens

Use environment variables.

Maintain:

```text
.env.example
```

with placeholders only.

---

## 29. SECURITY RED FLAGS

Stop and review before implementing:

- Public owner information
- Public property records
- Public approval verification
- Automatic enforcement decisions
- Bulk personal-data exports
- Unrestricted document downloads
- Administrative privilege escalation
- Direct database access from the browser
- Unvalidated file uploads
- Client-only authorization

These require explicit product/security decisions.

---

## 30. DO NOT BUILD YET

Unless explicitly requested, do not include in the MVP:

- Nationwide FHA deployment
- Complete historical digitization
- Public verification portal
- Payment system
- Online approval application workflow
- Automated legal decisions
- AI satellite building detection
- Full cadastral surveying
- Nationwide GIS collection
- Integration with every government agency
- Complex enterprise analytics

Document these as future scope.

---

## 31. HANDLING UNCLEAR REQUIREMENTS

### Cosmetic decision
Use a sensible professional default.

### Data-field meaning
Do not invent the official meaning.

### Approval/legal logic
Do not invent the rule.

### GIS accuracy
Do not invent official geometry.

### Security decision
Choose the safer design and document the assumption.

### MVP-blocking ambiguity
Ask for clarification or create a clearly labelled configurable placeholder.

---

## 32. DEFINITION OF DONE

A feature is not complete merely because its UI exists.

Where applicable, completion requires:

- UI works
- Server/domain logic works
- Database interaction works
- Validation exists
- Authorization exists
- Errors are handled
- Loading states exist
- Empty states exist
- Mobile layout works
- Important logic has tests
- Demo data supports the feature
- Sensitive information is protected

---

## 33. FIRST DEMO TARGET

The most important end-to-end demonstration is:

```text
LOGIN
  ↓
MAP
  ↓
SELECT PLOT 003
  ↓
PLOT DETAILS
  ↓
APPROVAL
  ↓
NEW INSPECTION
  ↓
GPS + PHOTO + OBSERVATION
  ↓
APPROVED VS OBSERVED
  ↓
POTENTIAL DISCREPANCY
  ↓
SUBMIT
  ↓
INSPECTION HISTORY
```

If this workflow works reliably, the MVP has demonstrated its primary value.

---

## 34. DOCUMENTATION ROADMAP

As the project progresses, maintain these documents:

```text
AGENTS.md
FHA_MVP_Development_Approval_Property_Mapping_System.md
SYSTEM_WALKTHROUGH.md      ← as-built system details (pages, APIs, roles, demo path)
MAP_TUTORIAL.md            ← as-built map user tutorial / field guide

ARCHITECTURE.md
DATABASE.md
GIS.md
API.md
SECURITY.md
UI_UX.md
TESTING.md
DEPLOYMENT.md
```

`SYSTEM_WALKTHROUGH.md` must stay aligned with the running code (routes, permissions, role behaviour). Design intent belongs in the other documents.

Create the next documents only when their requirements are sufficiently defined.

---

## 35. SQL FILE MANAGEMENT RULE

**Only two SQL files are maintained for schema management:**

```text
supabase/Schema.sql       → Fresh install (full schema from scratch)
supabase/live_update.sql  → Existing DB  (safe incremental migration)
```

### Schema.sql
- Contains the complete database schema for a new installation
- Includes: extensions, enums, tables, indexes, RLS policies, triggers, functions
- Run once when setting up a new database
- After running, execute `mock_data.sql` for demo data

### live_update.sql
- Safe to re-run on an existing database
- Uses `IF NOT EXISTS`, `ON CONFLICT DO NOTHING`, and exception handling (`EXCEPTION WHEN duplicate_object THEN NULL`)
- Adds new enums, columns, tables, RLS, triggers, indexes
- Migrates existing data when adding new columns
- Create a helper function if needed

### Mock data files
```text
supabase/mock_data.sql     → Demo/seed data (run after Schema.sql)
supabase/drop_mock_data.sql → Removes demo data (keeps schema)
```

### What NOT to do
- Do NOT create standalone migration files (e.g., `003_add_dual_status.sql`)
- Do NOT create numbered migration files (e.g., `001_initial.sql`, `002_rls.sql`)
- Do NOT create temporary migration files for individual features
- Every schema change goes into **Schema.sql** (fresh) AND **live_update.sql** (incremental)

### Pattern for adding a new feature to SQL

When adding a new table/column/enum:

1. **Schema.sql** — add the full definition in the correct section (enums, tables, RLS, triggers)
2. **live_update.sql** — add the incremental version with `IF NOT EXISTS`, `DO $$ BEGIN ... EXCEPTION` blocks, and data migration
3. **mock_data.sql** — add demo data if applicable
4. **drop_mock_data.sql** — add cleanup if applicable

### Example: adding a new table

**In Schema.sql:**
```sql
-- Enum
create type public.new_status as enum ('A','B','C');

-- Table
create table public.new_table (
  id uuid primary key default gen_random_uuid(),
  ...
);
create index idx_new_table_id on public.new_table(id);

-- RLS
alter table public.new_table enable row level security;
create policy "new_table_select_auth"
  on public.new_table for select to authenticated using (true);

-- Trigger
create trigger set_updated_at before update on public.new_table
  for each row execute function public.handle_updated_at();
```

**In live_update.sql:**
```sql
DO $$
BEGIN
  CREATE TYPE public.new_status AS ENUM ('A','B','C');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.new_table (...);

ALTER TABLE public.new_table ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "new_table_select_auth"
    ON public.new_table FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.new_table
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

---

## 36. CONTINUOUS DATA-REFLECTION AUDIT PROCEDURE

Run this procedure for every change that touches data — queries, schemas,
statuses, APIs, derived counts, labels — and for every UI change.
Nothing ships until Step 5 is green.

### Step 1 — Find the source of truth

Before writing code:

1. Identify which table/endpoint actually holds the entity the user's words
   refer to (e.g. "Properties" → which table has the rows?).
2. Verify with row counts against the live database — never assume.
3. Record the result:
   - Authoritative source: `<table/endpoint>` (rows: N)
   - Empty / seed / legacy sources: `<table>` (rows: 0 — do not read)
4. When two tables could hold the same concept, the one with live rows wins.
   State the choice in the commit message.

### Step 2 — Continuous hierarchy audit (every change)

Before editing, build the blast-radius map: the changed field/data at the
center, every consumer radiating outward. Grep the whole repo for each name:

```text
<old-field-name>   <old-table-name>   <old-status-enum>   <old-label>
hrefs/links containing the route   ·   API routes   ·   shared lib functions
tests   ·   docs (*.md)   ·   SQL files
```

Audit checklist — fill for EVERY change (for each row: the file(s), then
either "updated" or `N/A — reason`):

```text
1. Database / schema      (Schema.sql + live_update.sql — both, per §35)
2. API / server routes
3. Shared lib / domain logic
4. Parent pages           (lists, dashboards, counts, cards, stats)
5. Child/detail pages     (by id, tabs, panels, modals)
6. Sibling pages          (any page showing the same entity: badges, filters,
                           legends, empty states, exports)
7. Navigation             (quick actions, links, redirects, deep-link params)
8. Tests                  (unit + integration + fixtures)
9. Documentation          (walkthrough, tutorials, spec, roadmap)
10. Audit log             (action instrumentation for the change)
```

Propagation rules, in order:

- **Count changed** → update EVERY card, stat and label that displays it.
- **Status/enum changed** → update EVERY status→label map, status→color map,
  badge-variant map, legend, filter option and sort order. One new enum value
  means N map entries, not one.
- **Field/table renamed** → all queries, selects, joins, embeds, exports.
- **Hierarchy (parent ↔ child)** → the parent shows child counts/names; the
  child shows parent name/ID; both must agree. If a child type splits into
  subtypes, the parent's grouping/filter logic changes too.
- **Route/param added** → wire it through every component layer until it
  reaches the leaf, and update every entry point that should link into it
  (list → detail → deep link `?param=`).

Rules of engagement:

- Never delete a working feature to satisfy the audit — replace its input.
- Retired features: remove UI/code references only; keep DB tables/columns
  unless a destructive change is explicitly ordered.
- Fix every checklist row, or mark `N/A — reason`. The completed checklist
  goes in the final report.

### Step 3 — Implement

- Match the existing style, libraries and patterns of the repo.
- Business logic lives in one shared module (§22) — never duplicated in
  components.
- Focused changes only (§27). No comments unless the file already comments
  that kind of line.

### Step 4 — Get the UI/UX test skill online (before writing UI tests)

Tooling changes fast — search the web first; do not trust training-data
test tooling.

1. Search: `<framework> <version> UI testing best practices <current year>`
   (e.g. `Next.js 16 Playwright responsive dark mode visual regression 2026`).
2. Read 1–2 authoritative results (official docs first) and note: the correct
   locator strategy, the correct runner invocation for this repo's versions,
   and the viewports/device profiles to cover.
3. If an available skill fits, load it; otherwise follow the freshly fetched
   guidance. Record the source URL in the report so the choice is auditable.

### Step 5 — Verify (all three must pass; fix → re-run until green)

```text
npm run lint    → 0 errors
npm run build   → exit 0
npm run test    → 100% green
npm run test:e2e → 100% green  (UI/data changes — map markings/drawing/naming,
                                 deep links, UI↔API parity; CI always runs it)
```

If a shell command hangs: retry once, then redirect output to a temp file
and read it (`cmd *> out.txt`).

### Step 6 — UI/UX test (live app, per the skill fetched in Step 4)

- **Automated baseline first:** run `npm run test:e2e` (web/) — it covers
  map markings/rendering/drawing/naming, `?area=` deep links, and UI↔API
  data parity. The manual skill-based checks below run on top of it.
- **E2E happy path** against the production build (not dev): login →
  navigate → select record → verify detail → perform action → verify the
  record appears. Assert on user-visible text, not internals.
- **Data-parity assertion (critical):** for each dashboard/list number, fetch
  the same count from the database/API inside the test and assert equality.
  This is what catches "page reads the empty legacy table" bugs.
- **Responsive matrix:** 320, 360, 768, 1280 px — no overflow, no clipped
  controls, touch targets ≥ 40 px, primary actions reachable one-handed.
- **Theme:** test light AND dark, including reload with a stored dark
  preference (client-rendered hosts re-apply the theme after render).
- **States:** loading, empty, and error states (user-friendly wording, §17).
- **Visual diff:** screenshots at fixed viewports vs baselines; review the
  diffs — never bulk-approve snapshot updates.
- **AuthZ sanity:** a lower-privilege role must not reach admin-only actions —
  hidden in the UI AND blocked server-side (§13).
- Project-specific: shared login `admin`/`passadmin` (§1.1); localhost test
  scripts send `-UserAgent "fha-diag/1.0"`; the live host serves via
  client-side render — re-verify hydration-sensitive behaviour on the
  deployed URL, not only locally.

### Step 7 — Report, commit, ship (develop → master flow)

All work happens on **`develop`** (branched from `master`); `master` is the
production branch and receives only CI-green promotions.

1. Report the completed audit checklist, test results and any `N/A` reasons.
2. Commit only the intended files (never `.env*`, keys, untracked junk):
   `fix: <what> — reflects <source> across <pages touched>`
3. Push to **`develop`**. CI (`.github/workflows/ci.yml`) runs three jobs on
   every push/PR:
   - **Lint, build & test** — Step 5's gates on Node 20 (matches Netlify).
   - **E2E (map & core flows)** — Playwright suite: map markings/drawing/
     naming, `?area=` deep links, UI↔API data parity (live demo DB).
   - **Security** — dependency audit against the committed baseline
     (`.github/security-baseline.json`: NEW advisories fail the gate; after
     fixing advisories shrink the baseline with
     `node .github/scripts/security-gate.mjs --update`) plus a
     committed-secret scan (tracked `.env*` files, key patterns).
4. **If any check fails → the change stays on `develop`.** Nothing reaches
   `master`; fix, re-run locally (Step 5), and push again.
5. **If all checks pass → the `promote` job fast-forwards `master` to
   `develop`** (`git push origin develop:master` — atomic; it fails safely
   if `master` has diverged). `develop` and `master` then point at the same
   commit, so the next promotion diffs cleanly.
6. Deploy gate: pushes made with the workflow token do not trigger further
   workflow runs, so the promote job itself fires the Netlify build hook
   (secret `NETLIFY_BUILD_HOOK`) right after its checks passed. Human
   pushes to `master` run the `deploy` job, which fires the same hook only
   after its own checks pass. While the hook is unset, Netlify's
   auto-deploy remains the deploy path — promotion checks still gate what
   reaches `master`. Once the hook is configured, disable Netlify's
   auto-deploy on push so the hook is the only trigger.
7. Repo-settings hardening (once, manually): Settings → Branches → protect
   `master` — allow only the `github-actions` bot to push (or require the
   status checks `Lint, build & test` and `Security` before any push).
   Without protection the workflow still self-gates automated promotions,
   but nothing stops a manual direct push.
8. Confirm the deploy picked it up; smoke-test one page on the live URL.
9. Update the walkthrough/spec docs if pages, routes or roles changed.

---

## 37. FINAL INSTRUCTION TO THE AI AGENT

Build a serious prototype that can evolve into a production government property/GIS platform.

Do not optimize for the largest number of features.

Optimize for:

```text
Correctness
Security
Traceability
GIS ↔ Property relationship
Engineer usability
Clear demonstration
Future extensibility
```

The MVP should make the value of the system obvious within a few minutes of use.

**END OF AGENTS.md**
