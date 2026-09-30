# WORKFLOWS.md
# FHA Development Approval & Property Mapping System
## MVP Business & User Workflows — Updated Geographic Inspection Model

**Project Status:** MVP / Prototype  
**Version:** 0.2  
**Date:** 30 September 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Architecture:** `ARCHITECTURE.md`  
**Database:** `DATABASE.md`  
**GIS:** `GIS.md`  
**API:** `API.md`  
**UI/UX:** `UI_UX.md`  
**Security:** `SECURITY.md`  
**Authorization:** `AUTHORIZATION_RBAC.md`  
**Data Dictionary:** `DATA_DICTIONARY.md`  
**AI Instructions:** `AGENTS.md`

---

# 1. PURPOSE

This document defines the proposed user and business workflows for the FHA Development Approval & Property Mapping System MVP.

The purpose is to make the intended user journey explicit so that the AI coding agent does not invent unrelated workflows.

The central MVP workflow is now geography-first:

```text
LOGIN
  ↓
GIS MAP
  ↓
NAVIGATE FHA GEOGRAPHICAL HIERARCHY
  ↓
CREATE / SELECT INSPECTION ZONE
  ↓
ASSIGN ZONE TO ENGINEER / TEAM
  ↓
ENGINEER OPENS ASSIGNED ZONE
  ↓
SELECT / DRAW INSPECTION SECTION
  ↓
GPS / PHOTOS / OBSERVATIONS
  ↓
COMPARE APPROVED VS OBSERVED WHERE APPLICABLE
  ↓
RECORD FINDINGS
  ↓
SUBMIT SECTION
  ↓
AWAITING REVIEW
  ↓
APPROVAL OFFICER REVIEW
  ↓
APPROVE / REJECT / REQUEST REINSPECTION
  ↓
MAP STATUS UPDATE
  ↓
NEXT SECTION / AREA
  ↓
HISTORY / AUDIT
```

**Important:** not all geographical areas are estates. Use **Geographical Unit / Area** as the neutral concept and allow FHA-defined unit types and nesting.

All proposed workflows remain subject to FHA review.

---

# 2. WORKFLOW PRINCIPLES

The system should:

- Keep each workflow clear and traceable.
- Minimize unnecessary steps.
- Preserve historical records.
- Prevent unauthorized changes.
- Separate official records from field observations.
- Keep GIS and property records connected.
- Allow the user to understand the current state of a process.
- Avoid making legal decisions automatically unless FHA authorizes them.

---

# 3. ACTOR TYPES

Provisional actors:

```text
Engineer / Inspector
Approval Officer
GIS Officer
Supervisor
Administrator
```

### Responsibility summary

| Role | Primary responsibility in the geographic inspection workflow |
|---|---|
| GIS Officer | Geographic structure, official spatial data, geometry validation, inspection-zone preparation |
| Supervisor | Decide/organize what geographic areas are to be inspected, assign work, monitor progress |
| Engineer / Inspector | Inspect assigned sections, capture evidence, submit results |
| Approval Officer | Review submitted sections and make the authorized decision |
| Administrator | Users, configuration, technical/system oversight; not automatically an approval authority |

All roles and authorities remain subject to FHA confirmation.

---

# 4. MVP WORKFLOW 1 — USER LOGIN

## Objective

Allow an authorized FHA user to access the system.

### Flow

```text
Open application
      ↓
Login page
      ↓
Enter credentials
      ↓
Authentication
      ↓
Authorization / role resolution
      ↓
Dashboard
```

### Success

User is authenticated and taken to the authorized dashboard.

### Failure

Display a safe authentication error.

Do not reveal whether a particular staff account exists.

---

# 5. MVP WORKFLOW 2 — OPEN GIS MAP & NAVIGATE GEOGRAPHICAL UNITS

## Objective

Allow authorized users to navigate the FHA map through whatever geographical structure FHA supplies. The system must not assume every area is an estate.

### Flow

```text
Dashboard
  ↓
Open GIS Map
  ↓
Select / search geographical unit
  ↓
Load parent boundary and available child units
  ↓
Drill down / zoom to child area
  ↓
View inspection zones, sections, progress and statuses
```

### Example

```text
Development A
  > Phase 2
    > Block C
      > Plot 014
```

Another valid structure might be:

```text
Estate A
  > Sub-Estate B
    > Section 1
      > Zone 4
```

The actual unit types and nesting are defined by FHA data.

### Map may show

- Geographical units at the current map level
- Child geographical units
- Official plot/parcel boundaries where available
- Roads/basemap
- Inspection Zones
- Inspection Sections
- Inspection progress/status
- Inspector GPS location when permitted

### Important

The map must use demo GIS data until official FHA spatial data is supplied.

---

# 5A. MVP WORKFLOW 2A — CREATE AN INSPECTION ZONE

## Objective

Allow an authorized coordinator/GIS Officer/Supervisor to mark a larger geographical work area that is to be inspected.

### Two supported methods

**Method A — Select existing spatial units**

```text
Select current geographical unit
  ↓
Select one or more child units / plots
  ↓
Create Inspection Zone
```

**Method B — Draw a zone on the map**

```text
Click Draw Inspection Zone
  ↓
Draw polygon / rectangle
  ↓
Validate geometry
  ↓
Save Inspection Zone
```

A zone may contain multiple plots or multiple child geographical units. It is not required to equal one property.

### Zone states

```text
DRAFT → MARKED → ASSIGNED → IN_PROGRESS → COMPLETED / CANCELLED / ARCHIVED
```

Final vocabulary is subject to FHA confirmation.

---

# 5B. MVP WORKFLOW 2B — ASSIGN INSPECTION ZONE

## Objective

Assign a marked geographical work zone to the field officer or inspection team responsible for the field inspection.

### Flow

```text
Marked Inspection Zone
  ↓
Authorized Supervisor / GIS Officer opens Assign
  ↓
Select Engineer(s) / Field Officer(s) / Team
  ↓
Define each officer's inspection scope
  ↓
Optionally divide the zone into work packages / Inspection Sections
  ↓
Set priority / target date if required by FHA
  ↓
Create assignment(s)
  ↓
Each officer sees only the zone/sections within their permitted scope
```

### Multiple officers working in one zone

A single Inspection Zone may be worked by multiple field officers.

The system must **not** assume that every assigned officer is responsible for every section in the zone.

Example:

```text
ZONE A — 100 Inspection Sections

Engineer A → Sections 001–030
Engineer B → Sections 031–070
Engineer C → Sections 071–100
```

Each officer has an independent progress bar:

```text
Engineer A → 12 / 30 = 40%
Engineer B → 28 / 40 = 70%
Engineer C →  5 / 30 = 17%
```

The zone also has an overall progress bar:

```text
45 / 100 = 45%
```

Overall zone progress must be calculated from the underlying unique section counts, not by adding or averaging officer percentages.

### Assignment ownership

Every Inspection Section must have a clear responsible assignment/officer/team.

The server must enforce assignment ownership and permitted geographic scope.

---

# 5C. MVP WORKFLOW 2C — CREATE / MARK AN INSPECTION SECTION

## Objective

Allow the assigned field officer to mark the specific geographical part of the Inspection Zone that they are about to inspect.

An Inspection Section is a **field-work area**. It is not automatically an official cadastral boundary and it is not automatically an official approval.

### Method A — Select an existing geographical unit

```text
Engineer opens assigned Inspection Zone
  ↓
Select existing child geographical unit / plot / parcel where applicable
  ↓
Confirm selection
  ↓
Create Inspection Section
```

### Method B — Draw an Inspection Section

```text
Engineer opens assigned Inspection Zone
  ↓
Click DRAW INSPECTION SECTION
  ↓
Draw polygon / rectangle
  ↓
Server checks every vertex is within the engineer's assigned zone/scope
  ↓
Check for conflicting active section coverage
  ↓
Save Inspection Section
  ↓
Status = DRAFT / IN_PROGRESS
```

### Geographic distinction

The system must maintain these as separate concepts:

```text
OFFICIAL GIS BOUNDARY
        ≠
INSPECTION ZONE
        ≠
INSPECTION SECTION
        ≠
INSPECTOR GPS POINT
        ≠
OFFICIAL PROPERTY / DEVELOPMENT APPROVAL
```

The engineer's drawn section represents the geographical work area of the field inspection. It must not silently replace official GIS boundaries.

### Section identity

Every Inspection Section must have a stable identifier, for example:

```text
IZ-001 / SEC-001
IZ-001 / SEC-002
IZ-001 / SEC-003
```

The section should retain links to:

```text
Parent Inspection Zone
Assignment
Responsible officer/team
Parent geographical unit where applicable
Related plot/parcel records where applicable
Inspection record
Current workflow state
Geometry
Created / submitted / reviewed timestamps
```

### Section state

Recommended workflow:

```text
DRAFT
  ↓
IN_PROGRESS
  ↓
SUBMITTED
  ↓
AWAITING_REVIEW
  ↓
REVIEWED / APPROVED / REJECTED / REINSPECTION_REQUIRED
```

Final status names remain subject to FHA confirmation.


# 6. MVP WORKFLOW 3 — SEARCH FOR A PLOT

## Objective

Allow the user to find a specific property quickly.

### Flow

```text
Map
 ↓
Search
 ↓
Enter plot/approval/application identifier
 ↓
Server validates request
 ↓
Search authorized records
 ↓
Return results
 ↓
User selects result
 ↓
Map centers on plot
 ↓
Plot highlighted
```

### Search examples

```text
Plot 003
```

or:

```text
FHA/DEV/2024/1056
```

### Search must respect permissions.

---

# 7. MVP WORKFLOW 4 — SELECT PLOT FROM MAP

## Objective

Allow the user to use the GIS map as the starting point.

### Flow

```text
Map
 ↓
Click plot polygon
 ↓
Get plot_id
 ↓
Request plot details
 ↓
Server authorization
 ↓
Return authorized record
 ↓
Open plot details panel/page
```

### Important

The map feature should not contain the entire sensitive property record.

Use a lightweight map feature and retrieve detailed information after selection.

---

# 8. MVP WORKFLOW 5 — VIEW PLOT DETAILS

## Objective

Allow the engineer to understand the selected property.

### Flow

```text
Plot selected
 ↓
Plot Details
 ↓
Overview
 ↓
Property information
 ↓
Property interest/allottee
 ↓
Development information
 ↓
Approval summary
 ↓
Documents
 ↓
Inspection history
```

### Primary actions

```text
[Verify Approval]
[View Documents]
[Start Inspection]
[Open Map]
```

---

# 9. MVP WORKFLOW 6 — VERIFY APPROVAL

## Objective

Allow an authorized user to review whether an approval record exists and view its status.

### Flow

```text
Plot Details
     ↓
Verify Approval
     ↓
Retrieve approval record
     ↓
Check authorized record/status data
     ↓
Display result
```

### Example result

```text
APPROVAL RECORD FOUND

Approval No:
FHA/DEV/2024/1056

Plot:
003

Development:
4 Units Townhouse

Status:
APPROVED
```

### Possible technical results

```text
RECORD_FOUND
RECORD_NOT_FOUND
REVIEW_REQUIRED
```

These are system concepts, not legal conclusions.

### Important

Do not automatically state:

```text
LEGAL
ILLEGAL
FRAUD
FAKE
```

unless FHA explicitly defines and authorizes those determinations.

---

# 10. MVP WORKFLOW 7 — VIEW APPROVAL DOCUMENTS

## Objective

Allow an authorized user to inspect associated documents.

### Flow

```text
Approval
 ↓
Documents
 ↓
Select document
 ↓
Authorization check
 ↓
Secure access
 ↓
Preview/view
```

Possible documents:

```text
Approval Letter
Approved Plan
Site Plan
Other Approved Document
```

The final document list is determined by FHA.

---

# 11. MVP WORKFLOW 8 — START INSPECTION

## Objective

Start an inspection against the current Inspection Section. Where the section maps to one or more plots/properties, those records are loaded as inspection context.

### Flow

```text
My Assignment / Inspection Zone
 ↓
Select Inspection Section
 ↓
Start Inspection
 ↓
Create Draft Inspection
 ↓
Load related geographical-unit/property context
 ↓
Load approved information where applicable
 ↓
Inspection form
```

### Draft should contain

```text
Inspection Section
Inspection Zone / Assignment
Geographical Unit path
Related Plot / Parcel / Property records where applicable
Approval context where applicable
Inspector
Inspection Type
Date/Time
```

---

# 12. MVP WORKFLOW 9 — CAPTURE GPS

## Objective

Record the engineer's inspection location.

### Flow

```text
Inspection
 ↓
Capture GPS
 ↓
Request location permission
 ↓
Device returns coordinates
 ↓
Validate coordinates
 ↓
Store:
    Latitude
    Longitude
    Accuracy
    Timestamp
```

### Possible states

```text
Location unavailable
Permission denied
Capturing
Captured
Low accuracy
```

The system should explain how the user can retry.

---

# 13. MVP WORKFLOW 10 — CAPTURE SITE PHOTOGRAPHS

## Objective

Record visual inspection evidence.

### Flow

```text
Inspection
 ↓
Take Photo
 ↓
Device camera
 ↓
Capture
 ↓
Validate
 ↓
Upload/store
 ↓
Associate with inspection
```

Possible metadata:

```text
Caption
Latitude
Longitude
Captured At
```

Do not expose inspection photos publicly.

---

# 14. MVP WORKFLOW 11 — RECORD OBSERVATIONS

## Objective

Allow the engineer to record what was observed.

Potential fields:

```text
Construction Stage
Floors Observed
Units Observed
Building Use
Front Setback
Side Setback
Rear Setback
General Observation
```

These fields remain subject to FHA confirmation.

---

# 15. MVP WORKFLOW 12 — APPROVED VS OBSERVED COMPARISON

## Objective

Help the engineer identify potential differences.

### Flow

```text
Approved data
      +
Observed data
      ↓
Comparison service
      ↓
Differences identified
      ↓
Display potential discrepancies
```

Example:

```text
APPROVED
Floors: 2
Units: 4

OBSERVED
Floors: 3
Units: 6

RESULT
Potential difference detected
```

### Important

The system should not automatically decide that a legal violation exists.

The result is an aid for FHA review.

---

# 16. MVP WORKFLOW 13 — RECORD A FINDING

## Objective

Allow the engineer to describe a relevant site issue.

### Flow

```text
Inspection
 ↓
Add Finding
 ↓
Select category
 ↓
Enter title
 ↓
Enter description
 ↓
Set provisional severity/status
 ↓
Attach evidence if necessary
 ↓
Save
```

Example:

```text
Category:
Development

Title:
Floor count differs

Description:
Approved = 2
Observed = 3
```

Final categories and severity definitions must be confirmed by FHA.

---

# 17. MVP WORKFLOW 14 — SAVE INSPECTION DRAFT

## Objective

Allow the engineer to continue later.

### Flow

```text
Inspection form
 ↓
Save Draft
 ↓
Validate basic fields
 ↓
Save
 ↓
Status = DRAFT
```

The engineer can reopen an authorized draft later.

---

# 18. MVP WORKFLOW 15 — SUBMIT INSPECTION

## Objective

Finalize the engineer's inspection submission.

### Flow

```text
Draft Inspection
 ↓
Review Summary
 ↓
Submit Inspection
 ↓
Server validation
 ↓
Authorization
 ↓
Save final submission
 ↓
Create audit event
 ↓
Status = SUBMITTED
  ↓
Confirmation
```

> **Status mapping (MVP):** the inspection record becomes `SUBMITTED`; the
> linked Inspection Section becomes `AWAITING_REVIEW` (see §18A). There is no
> separate section-level `SUBMITTED` state. Mapping subject to FHA confirmation.

### Confirmation

```text
Inspection Submitted

Inspection No:
INS-000012
```

Exact post-submission editing rules require FHA confirmation.

---


---

# 18A. MVP WORKFLOW 15A — SUBMITTED SECTION → AWAITING REVIEW

## Objective

Move a completed field Inspection Section into the authorized review queue and update the map.

### Flow

```text
Engineer reviews Section Summary
  ↓
Submit Section
  ↓
Server validates:
  - authenticated user
  - assignment ownership
  - section is within assigned scope
  - current section state
  - required inspection information
  - required evidence where applicable
  ↓
Inspection Section = AWAITING_REVIEW
  ↓
Map shows the awaiting-review state
  ↓
Approval Officer receives it in the review queue
```

### Meaning of AWAITING_REVIEW

`AWAITING_REVIEW` means:

> The field inspection work has been successfully submitted and is waiting for authorized review/decision.

It does **not** mean:

> The property or development has been officially approved.

That distinction must be visible in the UI and reflected in the database state, API behavior, map legend and audit trail.

---

# 18B. MVP WORKFLOW 15B — REVIEW & DECISION ON INSPECTION SECTION

## Objective

Allow the authorized reviewer to review one submitted Inspection Section and record a controlled decision.

### Review screen

The reviewer should be able to see:

```text
Inspection Zone
Inspection Section
Full geographical hierarchy path
Assigned officer/team
Inspection date/time
GPS location + accuracy where captured
Photos
Observations
Findings
Relevant approval context
Relevant documents
Previous inspection/review history
```

Opening a submitted section should center/highlight that section on the map.

### Review decisions

Subject to FHA confirmation:

```text
APPROVE
REJECT
REQUEST REINSPECTION
```

### Results

```text
APPROVE
  ↓
Map section shows the approved/reviewed state

REJECT
  ↓
Map section shows the rejected state

REQUEST REINSPECTION
  ↓
Section = REINSPECTION_REQUIRED
  ↓
New/returned inspection work is created according to the confirmed FHA workflow
```

### Approval separation rule

An Inspection Section decision must not automatically change the official property/development approval status unless FHA explicitly confirms that linkage.

For example:

```text
Inspection Section = APPROVED
```

does not automatically mean:

```text
Property Approval = APPROVED
```

unless the official FHA workflow establishes that relationship.

---

# 18C. MVP WORKFLOW 15C — MOVE TO NEXT INSPECTION SECTION / AREA

## Objective

Allow field officers to work efficiently through a large geographical assignment without repeatedly searching for every next section.

### Primary flow

```text
Current Inspection Section
  ↓
Complete and submit field work
  ↓
Submission succeeds
  ↓
Recalculate officer progress
  ↓
Recalculate zone progress
  ↓
Find next uncompleted section in officer's assigned scope
  ↓
Show NEXT SECTION
  ↓
Engineer taps NEXT SECTION
  ↓
Map pans + zooms to next section
  ↓
Next section is highlighted
  ↓
Engineer starts next inspection
```

### Example

```text
ASSIGNMENT #0045

Section 01   ✓ Submitted
Section 02   ✓ Submitted
Section 03   🟦 Current
Section 04   ⬜ Next
Section 05   ⬜
Section 06   ⬜
```

Suggested controls:

```text
[ FINISH & NEXT ]
[ SAVE & EXIT ]
[ VIEW ASSIGNMENT ]
[ BACK TO MAP ]
```

### Manual map navigation

Automatic navigation is an aid, not a restriction.

The engineer must still be able to:

```text
Pan map
Zoom map
Search permitted geographical units
Jump to another assigned section
Return to current section
Use GPS location to orient themselves
```

The engineer must not be allowed to modify an unassigned section just because it is visible on the map.

---

# 18D. MVP WORKFLOW 15D — INDIVIDUAL FIELD-OFFICER PROGRESS

## Objective

Show each field officer exactly how much of their assigned inspection scope has been successfully submitted.

### Formula

```text
Officer Progress
=
submitted assigned Inspection Sections
÷
total Inspection Sections assigned to that officer
× 100
```

Example:

```text
Engineer A
Assigned: 30 sections
Submitted: 12 sections

Progress = 12 / 30 = 40%
```

### Progress behavior

```text
NOT_STARTED
  → does not count

IN_PROGRESS
  → does not count

DRAFT
  → does not count

SUBMITTED
  → counts

AWAITING_REVIEW
  → counts

REVIEWED / APPROVED / REJECTED
  → remains counted

REINSPECTION_REQUIRED
  → original work remains recorded; new reinspection work is tracked separately
```

The exact status names can later be aligned with FHA terminology.

### Important

The field officer's progress is independent of the approval officer's review progress.

Example:

```text
Engineer A
30 assigned
30 submitted
Progress = 100%

Approval Officer
0 reviewed

Engineer A still has 100% field-inspection progress.
```

This is intentional because field inspection completion and approval review are different workflows.

---

# 18E. MVP WORKFLOW 15E — OVERALL INSPECTION-ZONE PROGRESS

## Objective

Show management how much of the entire Inspection Zone's inspection scope has been successfully submitted.

### Formula

```text
Zone Progress
=
unique submitted Inspection Sections
÷
total Inspection Sections in the zone's inspection scope
× 100
```

### Example

```text
ZONE A
Total scope = 100 sections

Engineer A → 12 submitted
Engineer B → 28 submitted
Engineer C → 5 submitted

Overall progress:
45 / 100 = 45%
```

The same Inspection Section must never be counted twice.

### Display

```text
ZONE A
Overall Inspection Progress: 45%

Engineer A
12 / 30 — 40%

Engineer B
28 / 40 — 70%

Engineer C
5 / 30 — 17%
```

### Completion rule

Do not use:

```text
70% = COMPLETED
```

Instead:

```text
Progress = automatic measurement
Completion = controlled workflow state
```

Recommended behavior:

```text
Progress reaches 100%
  ↓
All assigned inspection scope has been submitted
  ↓
Assignment / zone = READY_FOR_COMPLETION
  ↓
Responsible authorized user reviews the coverage
  ↓
MARK ASSIGNMENT / ZONE COMPLETE
  ↓
Status = COMPLETED
```

If FHA later defines a formal automatic completion rule, it should be explicitly confirmed and configured rather than assumed by the AI coding agent.

---

# 18F. MVP WORKFLOW 15F — MULTIPLE OFFICERS AND SHARED ZONE PROGRESS

## Objective

Prevent progress confusion when several officers work in different parts of the same zone.

### Rule

Each officer has an explicit assigned scope.

```text
ZONE A — 100 sections

Engineer A → 30
Engineer B → 40
Engineer C → 30
```

Their progress is independent:

```text
A: 12 / 30 = 40%
B: 28 / 40 = 70%
C:  5 / 30 = 17%
```

The zone overall is:

```text
45 / 100 = 45%
```

Do not:

```text
average officer percentages
```

and do not:

```text
add officer percentages
```

Always calculate from the actual underlying section counts.

### Duplicate/shared work rule

A section must have a clear authoritative assignment/inspection record.

The same section must not silently produce two completion counts in the overall zone progress.

Where FHA explicitly allows shared inspection work, the data model must still identify the responsible officer(s) and the authoritative inspection record.

---


# 19. MVP WORKFLOW 16 — VIEW INSPECTION HISTORY

## Objective

Allow authorized users to review past inspections for a plot.

### Flow

```text
Plot Details
 ↓
Inspections
 ↓
List previous inspections
 ↓
Select inspection
 ↓
View details
```

Each inspection should preserve:

- Inspector
- Date/time
- Observations
- GPS
- Photos
- Findings
- Recommendations
- Status

---

# 20. MVP WORKFLOW 17 — RETURN TO MAP

From a geographical unit, inspection zone, inspection section or inspection record:

```text
Current record
 ↓
Open Map
 ↓
Map centers on related geographical context
 ↓
Relevant zone/section/unit highlighted
```

The map should preserve the user's position/level where practical and allow drill-down or movement to other areas.

---

# 21. MVP WORKFLOW 18 — PROPERTY HISTORY

If historical records are available:

```text
Plot
 ↓
History
 ├── Allocation/Interest
 ├── Applications
 ├── Approvals
 └── Inspections
```

The MVP may show a simplified history.

Do not create historical events that do not exist in the source data.

---

# 22. MVP WORKFLOW 19 — DOCUMENT ACCESS

For any sensitive document:

```text
User selects document
 ↓
Authentication
 ↓
Authorization
 ↓
Document exists?
 ↓
Secure access
 ↓
Preview/download if permitted
```

Never bypass authorization because the user knows the document ID.

---

# 23. MVP WORKFLOW 20 — UNAUTHORIZED ACTION

Example:

```text
Engineer attempts restricted approval modification
```

System:

```text
Authenticate
 ↓
Check permission
 ↓
Permission denied
 ↓
403 / safe response
```

UI:

```text
You do not have permission to perform this action.
```

---

# 24. MVP WORKFLOW 21 — NO RECORD FOUND

Example:

```text
Search Plot 999
```

Result:

```text
No matching property record found.
```

Do not automatically state:

```text
Plot is illegal.
```

The absence of a record is not necessarily proof of non-existence or illegality.

---

# 25. MVP WORKFLOW 22 — APPROVAL RECORD NOT FOUND

Example:

```text
Plot 003
```

No approval record exists in the prototype database.

Display:

```text
NO MATCHING APPROVAL RECORD FOUND

This result reflects records available
in the current system.
```

This distinction is important.

---

# 26. MVP WORKFLOW 23 — GPS OUTSIDE PLOT

If an optional spatial comparison is implemented:

```text
GPS captured
 ↓
Compare with selected plot polygon
 ↓
Outside polygon
```

Display:

```text
LOCATION REVIEW

The captured GPS point appears outside
the selected plot boundary.

Please verify the location.
```

Do not automatically identify a boundary dispute or violation.

---

# 27. MVP WORKFLOW 24 — PHOTO UPLOAD FAILURE

If a photo fails:

```text
Capture
 ↓
Upload
 ↓
Failure
```

User sees:

```text
Photo upload failed.

[Retry]
```

Do not mark the photo as successfully stored unless the server confirms it.

---

# 28. MVP WORKFLOW 25 — NETWORK FAILURE

If connectivity fails during inspection:

```text
Network unavailable
```

The MVP should either:

### Option A

Clearly inform the user and require reconnection.

### Option B

Use implemented offline storage.

Do not claim offline support unless it is actually implemented and tested.

---

# 29. MVP WORKFLOW 26 — SESSION EXPIRATION

If the user's session expires:

```text
Protected page
 ↓
Session check fails
 ↓
Redirect to login
```

Unsaved data should be handled carefully.

Where practical:

```text
Your session expired.
Please sign in again.
```

Do not silently discard important inspection work.

---

# 30. MVP WORKFLOW 27 — ROLE-BASED NAVIGATION

After login:

```text
Authenticate
 ↓
Resolve role
 ↓
Load permitted navigation
```

Engineer may see:

```text
Dashboard
GIS Map
My Assignments
Inspections
Properties / related records
Documents
```

Supervisor / GIS Officer may additionally see assignment and map-management tools.

Approval Officer may additionally see review queue and decision tools.

Admin may additionally see:

```text
Users
Roles
Audit
Settings
All Assignments
```

Exact navigation is subject to FHA confirmation.

---

# 31. MVP WORKFLOW 28 — ADMIN USER MANAGEMENT

This is optional for the first prototype.

Potential workflow:

```text
Admin
 ↓
Users
 ↓
Select user
 ↓
Assign/remove role
 ↓
Confirm
 ↓
Save
 ↓
Audit event
```

Do not allow ordinary users to modify their own privileges.

---

# 32. MVP WORKFLOW 29 — GIS DATA IMPORT

This is primarily a future/controlled workflow.

Concept:

```text
GIS Officer
 ↓
Select source dataset
 ↓
Upload/import
 ↓
Validate format
 ↓
Validate CRS
 ↓
Validate geometry
 ↓
Validate identifiers
 ↓
Match with property records
 ↓
Report errors
 ↓
Review
 ↓
Publish
```

Do not let ordinary users edit official plot geometry.

---

# 33. MVP WORKFLOW 30 — DATA QUALITY ISSUE

Example:

```text
GIS plot exists
but no matching property record
```

System may display:

```text
GIS / PROPERTY MATCH ISSUE

Plot Reference:
003

Property Record:
Not Found

Status:
REVIEW REQUIRED
```

Do not automatically delete or modify the GIS feature.

---

# 34. MVP WORKFLOW 31 — AUDIT EVENT

For important mutations:

```text
User action
 ↓
Operation
 ↓
Successful mutation
 ↓
Audit event
```

Example:

```text
Engineer
Submitted Inspection
INS-000012
31 Aug 2026 12:30
```

Exact audit requirements must be confirmed by FHA.

---

# 35. COMPLETE DEMO SCENARIO

The main MVP demonstration should prove the geographic inspection workflow rather than a single plot-only journey. Use fictional demo data.

## Scenario

An authorized coordinator needs to inspect part of a geographically hierarchical FHA development. The hierarchy may be: Development → Phase → Block, or another FHA-defined structure.

### Step 1

Login as an authorized Supervisor/GIS Officer.

### Step 2

Open the GIS Map.

### Step 3

Navigate through the available geographical units until the intended work area is visible.

### Step 4

Create an Inspection Zone by selecting existing spatial units and/or drawing a polygon.

### Step 5

Assign the Inspection Zone to Engineer A.

### Step 6

Engineer A opens My Assignments and selects the assigned zone.

### Step 7

Engineer A selects or draws Inspection Section 01 inside the assigned zone.

### Step 8

Start inspection. Capture GPS, photographs, observations and findings.

### Step 9

Submit Section 01.

### Step 10

The map shows Section 01 as **AWAITING REVIEW**.

### Step 11

Engineer A moves to Section 02. The application pans/zooms to the next uncompleted assigned section.

### Step 12

Section 02 is inspected while Section 01 remains awaiting review.

### Step 13

Approval Officer opens the Review Map / Approval Queue and selects Section 01.

### Step 14

The Approval Officer reviews GPS, photographs, observations, findings and relevant approval context.

### Step 15

The Approval Officer chooses **APPROVE** (or another permitted decision).

### Step 16

Section 01 changes to the approved inspection/review state on the map. Section 02 remains **AWAITING REVIEW**.

### Step 17

The map continues to show overall inspection progress and the engineer can continue to the next assigned section.

### Step 18

History/audit records show who created the zone, assigned it, marked the section, submitted the inspection and made the review decision.

# 36. SUCCESSFUL END-TO-END RESULT

At the end of the demonstration, the map should visibly communicate the state of the work:

```text
INSPECTION ZONE
│
├── Section 01  🟩 Reviewed / Approved
├── Section 02  🟨 Awaiting Review
├── Section 03  🔵 In Progress
├── Section 04  ⬜ Not Started
└── Section 05  🟪 Reinspection Required
```

The user should be able to drill into any section and see the linked inspection, evidence, decision history and related geographical units.

**The map is the visual progress and review surface; the database remains the authoritative source of workflow state.**

# 37. FAILURE / EXCEPTION DESIGN

The AI agent must design predictable handling for:

```text
Invalid login
No geographical unit / plot found
Unauthorized geographical unit
Inspection zone outside permitted geography
Inspection section outside assigned zone
Duplicate/overlapping active section
No approval found
Document unavailable
GPS unavailable
GPS permission denied
Photo upload failure
Network failure
Invalid inspection
Unauthorized submission
Invalid workflow transition
Concurrent section claim
Session expired
Duplicate submission
```

Each should have a clear user-facing response and safe technical logging.

---

# 38. NO SILENT FAILURES

Do not silently ignore:

- Failed uploads
- Failed submissions
- GPS failure
- Database failures
- Authorization failures
- Missing required data

The user must know whether an action succeeded.

---

# 39. TRANSACTIONAL SUBMISSION WORKFLOW

Inspection submission should be treated as one controlled operation.

Conceptually:

```text
Validate
 ↓
Check permission
 ↓
Save final inspection state
 ↓
Save findings
 ↓
Create audit event
 ↓
Commit
```

If critical processing fails, do not present the submission as successful.

---

# 40. WORKFLOW STATE VISIBILITY

Where a workflow has statuses, show the current state clearly.

Examples:

```text
Assignment: Assigned / In Progress / Completed
Section: Draft / In Progress / Awaiting Review / Rejected / Reinspection Required / Reviewed
Approval: Pending / Approved / Approved with Conditions / Rejected
```

The final status vocabulary and exact transition rules come from FHA. Keep assignment, inspection-section and official-approval states separate.

---

# 41. WORKFLOW HISTORY

Where useful, show a timeline:

```text
Created
  ↓
Updated
  ↓
Submitted
  ↓
Reviewed
  ↓
Completed
```

Do not invent historical events.

---

# 42. WORKFLOW OWNERSHIP

Every important workflow action should have an identifiable actor.

Examples:

```text
Created by
Submitted by
Reviewed by
Modified by
```

Use authenticated user IDs rather than manually typed names.

---

# 43. WORKFLOW SECURITY

Every workflow transition must check:

```text
Current state
+
User permission
+
Record scope
+
Input validity
```

Do not allow arbitrary status changes through the API.

---

# 44. WORKFLOW CONFIGURATION

Because FHA processes are not fully confirmed, keep these configurable where practical:

```text
Geographical unit types
Geographical hierarchy rules
Inspection-zone rules
Inspection-section rules
Assignment statuses
Inspection statuses
Official approval statuses
Finding categories
Inspection types
Required fields
Required documents
Role permissions
Map/status display rules
Assignment navigation order
Progress calculation rules
```

Do not build rigid logic around unconfirmed assumptions.

---

# 45. OUT-OF-SCOPE WORKFLOWS FOR MVP

Do not implement unless FHA specifically requests them:

```text
Full online development application submission
Payment processing
Nationwide property registration
Full ownership transfer workflow
Automated legal enforcement
Public verification portal
Complete approval lifecycle automation
Nationwide GIS import
Mass historical digitization
Government-agency integrations
```

---

# 46. FHA WORKFLOW CONFIRMATION QUESTIONS

Before production, FHA should confirm the exact business process. The highest-priority questions are:

1. What geographical unit types does FHA actually use, and can one unit contain another unit?
2. Who is responsible for creating/selecting an Inspection Zone?
3. Who assigns the zone to an engineer/team?
4. Does an Inspection Zone need to follow official plot boundaries, or can it span multiple areas/plots?
5. Who is allowed to draw or select an Inspection Section inside an assigned zone?
6. What happens when two engineers need to work in the same zone? Can sections be claimed separately?
7. Who reviews a submitted Inspection Section?
8. Who has the authority to approve, reject or request reinspection?
9. Does approval of an Inspection Section affect the official property/development approval status, or are they separate?
10. Can a parent geographical unit ever be considered complete/approved based on child units, and what rule applies?
11. What is the official sequence for moving through sections/areas during field work?
12. What statuses and map colors does FHA want for assigned, in-progress, awaiting review, approved, rejected and reinspection work?
13. What must happen when the engineer cannot inspect part of an assigned area?
14. What actions must remain auditable, and how long should historical geographic work be retained?
15. Which workflow steps must be available on mobile/tablet?

All answers should be recorded in the final FHA requirements specification before production deployment.

# 47. WORKFLOW ACCEPTANCE CHECKLIST

### Map

- [ ] User can open the GIS map
- [ ] User can search
- [ ] User can select plot
- [ ] Selected plot opens details

### Property

- [ ] Property information loads
- [ ] Approval summary loads
- [ ] Documents load
- [ ] Inspection history loads

### Approval

- [ ] Approval can be retrieved
- [ ] Verification result displays
- [ ] Missing approval is handled safely

### Inspection

- [ ] Inspection can be started
- [ ] GPS can be captured
- [ ] Photos can be captured/uploaded
- [ ] Observations can be recorded
- [ ] Comparison can be displayed
- [ ] Findings can be added
- [ ] Draft can be saved
- [ ] Inspection can be submitted

### Geographic Inspection Workflow

- [ ] User can navigate a flexible geographical hierarchy without assuming all areas are estates
- [ ] Authorized user can create/select an Inspection Zone
- [ ] Zone can be assigned to one or more engineers/field officers where authorized
- [ ] Each officer has an explicit assigned inspection scope
- [ ] Engineer sees only assigned zones/sections within permitted scope
- [ ] Engineer can select or draw an Inspection Section inside assigned scope
- [ ] Server blocks sections outside assigned scope
- [ ] System prevents unintended duplicate active section ownership
- [ ] Engineer can submit an Inspection Section
- [ ] Submitted section becomes AWAITING_REVIEW
- [ ] Approval Officer can review the submitted section
- [ ] Approval Officer can approve/reject/request reinspection according to permissions
- [ ] Map status updates after the review decision
- [ ] Official property/development approval remains separate unless FHA defines a linkage
- [ ] Engineer can move to the next uncompleted assigned section
- [ ] Map automatically pans/zooms to the next section
- [ ] Engineer can manually pan/zoom/search another permitted area
- [ ] Each assigned field officer has an individual progress bar
- [ ] Individual progress uses only that officer's assigned scope
- [ ] The zone has an overall progress bar
- [ ] Overall progress counts unique sections and does not double-count shared work
- [ ] Progress updates after successful server-side submission
- [ ] 70% is not hard-coded as completion
- [ ] 100% progress can place an assignment/zone into READY_FOR_COMPLETION
- [ ] Authorized responsible user can explicitly complete the assignment/zone
- [ ] Progress never automatically changes official property/development approval
- [ ] Parent-area progress does not automatically change parent approval status

### Security

- [ ] Unauthorized actions are blocked
- [ ] Sensitive documents are protected
- [ ] Important actions are audited

---

# 48. FINAL MVP WORKFLOW MAP

```text
                             LOGIN
                               │
                               ▼
                           DASHBOARD
                               │
                               ▼
                         GIS MAP / SEARCH
                               │
                    NAVIGATE GEOGRAPHICAL UNITS
                               │
                               ▼
                    CREATE / SELECT ZONE
                               │
                               ▼
                     ASSIGN TO ENGINEER
                               │
                               ▼
                    ENGINEER OPENS ZONE
                               │
                               ▼
                 SELECT / DRAW INSPECTION SECTION
                               │
                               ▼
                    GPS + PHOTOS + OBSERVATIONS
                               │
                               ▼
                  APPROVED VS OBSERVED (WHEN APPLICABLE)
                               │
                               ▼
                           FINDINGS
                               │
                               ▼
                         SUBMIT SECTION
                               │
                               ▼
                      AWAITING REVIEW 🟨
                               │
                               ▼
                    APPROVAL OFFICER REVIEW
                               │
                ┌──────────────┼──────────────┐
                ▼              ▼              ▼
             APPROVE        REJECT       REINSPECT
                │              │              │
                └──────────────┼──────────────┘
                               ▼
                         MAP STATUS UPDATE
                               │
                               ▼
                     NEXT SECTION / AREA
                               │
                               ▼
                         HISTORY / AUDIT
```

The system must preserve the distinction between:

- geographical structure;
- inspection assignment;
- inspection section;
- field evidence;
- review decision; and
- official property/development approval.

# 49. FINAL PRINCIPLE

The MVP should make the field workflow feel natural and map-first:

> **Navigate the FHA geographical structure → create/receive an inspection zone → assign the work → mark and inspect section by section → capture evidence → submit → await review → record the authorized decision → update the map → continue to the next section/area → track individual and zone progress.**

The application should make geographic progress obvious while keeping official approval authority, field observation and GIS data integrity separate. It must support FHA work without inventing FHA policy or replacing authorized FHA decisions.

---

**END OF WORKFLOWS.md**
