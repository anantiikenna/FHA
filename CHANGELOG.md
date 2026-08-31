# CHANGELOG.md
# FHA Development Approval & Property Mapping System

All notable changes to this project are documented here. Format follows **Keep a Changelog** (https://keepachangelog.com) and **Semantic Versioning**.

**Primary Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**AI Instructions:** `AGENTS.md`  
**Architecture:** `ARCHITECTURE.md`  
**Database:** `DATABASE.md`  
**GIS:** `GIS.md`  
**API:** `API.md`  
**Security:** `SECURITY.md`  
**Authorization:** `AUTHORIZATION_RBAC.md`  
**Data Dictionary:** `DATA_DICTIONARY.md`  
**Workflows:** `WORKFLOWS.md`  
**UI/UX:** `UI_UX.md`  
**Testing:** `TESTING.md`  
**Deployment:** `DEPLOYMENT.md`  
**Build Plan:** `MVP_BUILD_PLAN.md`

> **Demo-data rule — every version:** `AGENTS.md:4`, `DATABASE.md:25`
> ```text
> DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD
> ```
> Real personal data, official GIS boundaries, and official approval records must never be invented or mixed with demo data.

---

## [Unreleased]

### Planned — per `MVP_BUILD_PLAN.md:11-27` build order
- **Phase 0 — Repository discovery** — framework/package-manager/DB/auth/map/storage audit
- **Phase 1 — Application foundation** — shell, routing, theme, error boundaries, env config (`ARCHITECTURE.md:51`)
- **Phase 2 — Authentication** — `/login`, protected routes, `ENGINEER`/`ADMIN` roles (`WORKFLOWS.md:4`)
- **Phase 3 — Database foundation** — migrations for `users, estates, blocks, plots, property_interests, applications, approvals, documents, inspections, inspection_photos, inspection_findings, audit_logs` (`DATABASE.md:4-5`)
- **Phase 4 — Demo seed** — deterministic seed: 1 estate → 3 blocks → 20 plots → Plot 003 with approval `FHA/DEV/2024/1056` (`DATABASE.md:26-27,38`)
- **Phase 5-10 — Map & Plot** — `Estate GIS Map`, plot selection, search (`GIS.md:52,61`; `API.md:11-15`; `WORKFLOWS.md:5-8`)
- **Phase 11-14 — Approvals & Documents** — approval display/verification, private storage + signed URLs (`WORKFLOWS.md:9-10`; `SECURITY.md:26-27`)
- **Phase 15-19 — Inspections** — GPS capture, photo upload, observations, `Approved vs Observed` comparison service, findings (`WORKFLOWS.md:12-16`; `ARCHITECTURE.md:23`)
- **Phase 20-23 — Submission & History** — draft/submit, history, audit logging (`WORKFLOWS.md:17-19,34`)
- **Phase 24-27 — Hardening** — responsive field UI, error/empty/loading states, security pass, demo polish (`UI_UX.md:32,52`; `TESTING.md:43`)

### Known limitations carried forward (`MVP_BUILD_PLAN.md:46`, `TESTING.md:45`)
- Synthetic GIS geometry only — no official FHA boundaries yet (`GIS.md:8`)
- Fictional property/approval records only (`AGENTS.md:4`)
- Approval/GIS statuses are provisional (`AGENTS.md:23`)
- Hosting/auth provider not yet confirmed by FHA IT (`ARCHITECTURE.md:49`)
- Offline inspection deferred to post-MVP (`AGENTS.md:20`)

---

## [0.1.0] — 2026-08-31 — MVP / Prototype Specification Baseline

**Status:** Draft — Awaiting FHA Engineering / Development Control Review (`FHA_MVP_...:1`, `AGENTS.md:35`)  
**Tag:** `v0.1.0-mvp-spec`  
**Milestone:** Core workflow defined end-to-end — `LOGIN → MAP → SELECT PLOT 003 → PLOT DETAILS → APPROVAL → DOCUMENTS → NEW INSPECTION → GPS + PHOTO + OBSERVATIONS → APPROVED VS OBSERVED → POTENTIAL DISCREPANCY → SUBMIT → INSPECTION HISTORY` (`AGENTS.md:2,33`; `WORKFLOWS.md:1,35`; `MVP_BUILD_PLAN.md:1,39`)

### Added

#### Product & Planning
- `FHA_MVP_Development_Approval_Property_Mapping_System.md` v0.1 — MVP objective, 12 success criteria, modules 1-6, `Approved vs Observed` table (`:5`), sample estate/blocks/plots (`:6`), sample plot/approval/inspection records (`:7-9`), 7-screen list + navigation (`:11-12`), proposed DB structure (`:13`), GIS requirements (`:14`), acceptance checklist 18 items (`:20`)
- `MVP_BUILD_PLAN.md` — 49 sections: demonstration target, real vs mocked, demo dataset (Estate FHA Demo Estate, Blocks A/B/C, 20 plots), 27 build phases, demo script, traceability, hand-off package (`:45`)

#### Architecture & System Design
- `ARCHITECTURE.md` v0.1 (52 sections) — high-level app → server → domain → DB/GIS/storage diagram (`:3`), 12 major components, frontend principles, domain modules (Property/Approval/Inspection/Document/Audit), GIS core relationship `plot_id → Property Record` (`:14`), data flows for map→plot→approval→inspection, deployment architecture, implementation order
- `AGENTS.md` v0.1 — 35 sections: core workflow, 4 priority tiers, demo-data rule, GIS/approval/approved-vs-observed/GPS/photo/authorization/audit rules, `DEPLOYMENT.md` in documentation roadmap (`:34`)

#### Data & GIS
- `DATABASE.md` v0.1 (51 sections) — 12 entities, ER diagram, per-table schemas (`estates, blocks, plots, property_interests, applications, approvals, inspections, inspection_photos, inspection_findings, documents, audit_logs`), `is_demo` flag (`:25`), FK relationships (`:20`), seeding + GIS import pipeline (`:38,41`), PostGIS recommendation
- `GIS.md` v0.1 (63 sections) — estate → block → plot hierarchy, plot polygon + stable `plot_id`, basemap vs FHA property layer distinction, CRS/import pipeline, layer visibility, GPS vs official survey, map→database connection, demo scenarios, acceptance checklist
- `DATA_DICTIONARY.md` v0.1 (61 sections) — field-level definitions for all 12 entities, identifier discipline (internal UUID vs `plotNumber`/`approvalNumber`), GPS/photo/finding/GIS dataset schemas, sensitive-data classification, FHA confirmation questions

#### API & Workflows
- `API.md` v0.1 (59 sections) — `/api/v1` versioned design, auth/authorization principle, common response format, 57-endpoint summary (estates/blocks/plots/search/approvals/documents/inspections/photos/findings/audit/map viewport), verification `RECORD_FOUND/NOT_FOUND/REQUIRES_REVIEW`, file/GIS security
- `WORKFLOWS.md` v0.1 (49 sections) — 35 workflows (login → map → search → select → details → approval verification → documents → start inspection → GPS → photos → observations → comparison → findings → draft → submit → history → error/edge cases), complete demo scenario for Plot 003 (`:35`)

#### Security & Authorization
- `SECURITY.md` v0.1 (66 sections) — threat model (9 threats), auth/session/RBAC, least privilege, server-side + object-level authorization, input/SQL/XSS/CSRF/CORS, file/photo/GPS/GIS security, audit immutability, secrets/env separation, 4-environment acceptance checklist, AI agent security rules (`:62`)
- `AUTHORIZATION_RBAC.md` v0.1 (47 sections) — 4 provisional roles (`ENGINEER, APPROVAL_OFFICER, GIS_OFFICER, ADMIN`), permission catalog (`plot.read`, `inspection.submit`, `gis.data.import` …), permission matrix with `TBD = DENY` (`:8`), record-level scope, inspection state rules, test matrix

#### UI/UX & Testing
- `UI_UX.md` v0.1 (59 sections) — UX principles, 4 user types, shell (sidebar+header+main), 7 MVP screens with wireframes, map/search/plot-details/approval-verification/documents/inspection flows, GPS/photo/finding components, `DEMO DATA` labeling (`:52-53`), responsive breakpoints (desktop/tablet/mobile)
- `TESTING.md` v0.1 (47 sections) — 8 test levels, deterministic demo data, unit→GIS→API→security→responsive matrix, critical test: `approved vs observed` logic never overwrites approval, Plot 003 end-to-end regression, FHA demonstration test 14 steps (`:43`), P0-P3 defect priority

#### Tooling & Standards
- `AGENTS.template.md` — generic template for project-agnostic AI agent configuration (used as source for `AGENTS.md`)

### Fixed
- N/A — initial specification baseline.

### Security
- Documented security-first baseline per `SECURITY.md:2-3` and `ARCHITECTURE.md:33` — auth → session → authorization → validation → business logic → DB/storage → audit — with private document/photo storage and server-side authorization required for every sensitive endpoint (`AGENTS.md:13,21`).

### Deprecated / Removed
- None.

### Notes for reviewers
- All statuses, roles, approval conditions, finding categories, and GIS boundaries are **provisional** and require FHA confirmation before production (`AGENTS.md:23,31,34`; `AUTHORIZATION_RBAC.md:43`).
- The strongest validation of this release is the live demo sequence in `MVP_BUILD_PLAN.md:40` / `WORKFLOWS.md:35` — if `Plot 003` flows without data inconsistency or unauthorized access, the MVP has met its objective (`TESTING.md:47`).

---

## Versioning & Process

- **Versioning:** SemVer. `0.1.x` = MVP specification; `0.2.x` = prototype implementation; `1.0.0` = FHA-validated production baseline (per `MVP_BUILD_PLAN.md:48` Keep/Change/Remove/Add).
- **Changelog process:**
  1. Every user-facing or security-relevant change adds an entry under `[Unreleased]`.
  2. On release, move entries to a new version section with date and tag.
  3. Follow `AGENTS.md:27` change discipline — focused changes, no unrelated refactoring, no deletion without justification.
  4. Reference the spec section that motivated the change (e.g., `TESTING.md:23`, `GIS.md:16`).
- **Categories:** `Added` / `Changed` / `Fixed` / `Security` / `Deprecated` / `Removed`.
- **Commit convention:** `type(scope): description` — `feat(map): ...`, `fix(inspection): ...`, `docs(deployment): ...` (`AGENTS.template.md`).

---

## Links

- [Unreleased]: ../../compare/v0.1.0...HEAD
- [0.1.0]: https://github.com/<org>/FHA/releases/tag/v0.1.0-mvp-spec

**END OF CHANGELOG.md**
