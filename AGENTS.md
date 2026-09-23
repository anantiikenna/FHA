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

**This app uses email verification PIN/token (OTP) for login. It does NOT use passwords.**

- User enters email → receives 6-digit PIN → verifies PIN to log in
- No password change, password reset, or leaked password protection features
- Supabase Auth `signInWithOtp` + `verifyOtp` flow
- Session managed via httpOnly cookies (not localStorage)

When working on auth-related code:
- Never implement password-based flows
- Never add password fields to the UI
- Never enable leaked password protection — it is not applicable
- All auth goes through Supabase Auth OTP

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

## 36. FINAL INSTRUCTION TO THE AI AGENT

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
