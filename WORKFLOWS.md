# WORKFLOWS.md
# FHA Development Approval & Property Mapping System
## MVP Business & User Workflows

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
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

The central MVP workflow is:

```text
LOGIN
  ↓
ESTATE MAP
  ↓
FIND / SELECT PLOT
  ↓
PLOT DETAILS
  ↓
VIEW APPROVAL
  ↓
VIEW DOCUMENTS
  ↓
START INSPECTION
  ↓
CAPTURE GPS / PHOTOS / OBSERVATIONS
  ↓
COMPARE APPROVED VS OBSERVED
  ↓
RECORD FINDINGS
  ↓
SUBMIT INSPECTION
  ↓
INSPECTION HISTORY
```

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
Administrator
```

These are subject to FHA confirmation.

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

# 5. MVP WORKFLOW 2 — OPEN ESTATE MAP

## Objective

Allow an engineer/officer to visually access the prototype area.

### Flow

```text
Dashboard
    ↓
Open Map
    ↓
Select Estate
    ↓
Load map
    ↓
Display estate boundary
    ↓
Display blocks/plots
```

### Map may show

- Estate boundary
- Roads
- Blocks
- Plots
- Plot numbers
- Status indicators where approved by FHA

### Important

The map must use demo GIS data until official FHA spatial data is supplied.

---

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

Start a new inspection against a selected property.

### Flow

```text
Plot Details
 ↓
Start Inspection
 ↓
Create Draft Inspection
 ↓
Load approved information
 ↓
Inspection form
```

### Draft should contain

```text
Plot
Estate
Block
Approval
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

### Confirmation

```text
Inspection Submitted

Inspection No:
INS-000012
```

Exact post-submission editing rules require FHA confirmation.

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

From a plot or inspection:

```text
Plot Details
 ↓
Open Map
 ↓
Map centers on selected plot
 ↓
Plot highlighted
```

This maintains geographic context.

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
Map
Properties
Approvals
Inspections
Documents
```

Admin may additionally see:

```text
Users
Roles
Audit
Settings
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

Use one fictional property to demonstrate the entire MVP.

## Scenario

Engineer needs to inspect Plot 003.

### Step 1

Login.

### Step 2

Open Estate Map.

### Step 3

Search/select Plot 003.

### Step 4

Open Plot Details.

### Step 5

View approval:

```text
Approved Floors: 2
Approved Units: 4
```

### Step 6

Open approval document.

### Step 7

Start inspection.

### Step 8

Capture GPS.

### Step 9

Take site photographs.

### Step 10

Record:

```text
Floors observed: 3
Units observed: 6
```

### Step 11

System shows:

```text
Potential difference detected
```

### Step 12

Engineer adds finding.

### Step 13

Engineer adds recommendation.

### Step 14

Engineer reviews inspection summary.

### Step 15

Engineer submits.

### Step 16

Inspection appears in Plot 003 history.

---

# 36. SUCCESSFUL END-TO-END RESULT

At the end of the demonstration:

```text
PLOT 003

Map
✓

Property
✓

Approval
✓

Documents
✓

Inspection
✓

GPS
✓

Photos
✓

Approved vs Observed
✓

Finding
✓

Inspection History
✓
```

This is the minimum compelling demonstration.

---

# 37. FAILURE / EXCEPTION DESIGN

The AI agent must design predictable handling for:

```text
Invalid login
No plot found
Unauthorized plot
No approval found
Document unavailable
GPS unavailable
GPS permission denied
Photo upload failure
Network failure
Invalid inspection
Unauthorized submission
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
Draft
Submitted
Under Review
Completed
```

The final status vocabulary comes from FHA.

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
Approval statuses
Inspection statuses
Finding categories
Inspection types
Required fields
Required documents
Role permissions
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

Before production, FHA should confirm:

1. Who starts each workflow?
2. Who reviews it?
3. Who approves it?
4. What statuses exist?
5. What documents are mandatory?
6. What fields are mandatory?
7. What can be edited after submission?
8. What requires supervisor review?
9. What happens when a discrepancy is found?
10. What happens after inspection?
11. What happens when approval information is missing?
12. How are amendments handled?
13. How are historical records handled?
14. What actions must be audited?
15. Which workflows can be performed from mobile?

---

# 47. WORKFLOW ACCEPTANCE CHECKLIST

### Map

- [ ] User can open estate map
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
                      ESTATE GIS MAP
                             │
                ┌────────────┴────────────┐
                ▼                         ▼
          SEARCH PLOT                 SELECT PLOT
                │                         │
                └────────────┬────────────┘
                             ▼
                       PLOT DETAILS
                             │
          ┌──────────────────┼──────────────────┐
          ▼                  ▼                  ▼
       APPROVAL          DOCUMENTS         INSPECTION
          │                                     │
          │                                     ▼
          │                               GPS + PHOTOS
          │                                     │
          │                                     ▼
          │                                OBSERVATIONS
          │                                     │
          └─────────────────┐                   ▼
                            │          APPROVED VS OBSERVED
                            │                   │
                            │                   ▼
                            │                FINDINGS
                            │                   │
                            │                   ▼
                            │                SUBMIT
                            │                   │
                            └───────────────────┘
                                        │
                                        ▼
                                  HISTORY / AUDIT
```

---

# 49. FINAL PRINCIPLE

The MVP should make the engineer's workflow feel natural:

> **Find the property → understand the property → verify the approval → inspect the site → record evidence → identify potential differences → submit → preserve the history.**

The system should support the engineer's work without inventing FHA policy or replacing authorized FHA decisions.

---

**END OF WORKFLOWS.md**
