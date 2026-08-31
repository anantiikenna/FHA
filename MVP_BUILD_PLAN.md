# MVP_BUILD_PLAN.md
# FHA Development Approval & Property Mapping System
## AI Coding Agent Build Plan

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  

**Primary specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**AI instructions:** `AGENTS.md`  
**Architecture:** `ARCHITECTURE.md`  
**Database:** `DATABASE.md`  
**GIS:** `GIS.md`  
**API:** `API.md`  
**UI/UX:** `UI_UX.md`  
**Security:** `SECURITY.md`  
**Authorization:** `AUTHORIZATION_RBAC.md`  
**Data Dictionary:** `DATA_DICTIONARY.md`  
**Workflows:** `WORKFLOWS.md`

---

# 1. PURPOSE

This document converts the existing MVP/product documentation into an actionable implementation order for the AI coding agent.

The objective is not to build the complete FHA production system.

The objective is to build a **small, functional and convincing prototype** that demonstrates the core value of the proposed system.

The prototype should make the following workflow work end-to-end:

```text
LOGIN
  ↓
ESTATE GIS MAP
  ↓
SEARCH / SELECT PLOT
  ↓
PLOT DETAILS
  ↓
APPROVAL INFORMATION
  ↓
DOCUMENT VIEW
  ↓
START INSPECTION
  ↓
GPS + PHOTOS + OBSERVATIONS
  ↓
APPROVED VS OBSERVED
  ↓
FINDING
  ↓
SUBMIT INSPECTION
  ↓
INSPECTION HISTORY
```

---

# 2. MVP BUILD PHILOSOPHY

The AI agent must build for **demonstration quality**, not feature count.

The MVP must be:

- Functional
- Visually professional
- Easy to understand
- Secure by default
- GIS-aware
- Mobile-responsive
- Easy to modify after FHA feedback
- Clearly separated from production data

Do not build large enterprise features that do not contribute to the first demonstration.

---

# 3. MVP DEMONSTRATION TARGET

The ideal demonstration should take an FHA engineer through one realistic scenario.

Example:

```text
Engineer logs in
    ↓
Opens FHA Development Map
    ↓
Searches Plot 003
    ↓
Map highlights Plot 003
    ↓
Engineer opens Plot Details
    ↓
Views approval
    ↓
Views approval document
    ↓
Starts site inspection
    ↓
Captures GPS
    ↓
Captures a site photo
    ↓
Enters observed floors/units
    ↓
System compares approved vs observed
    ↓
Potential discrepancy appears
    ↓
Engineer records finding
    ↓
Submits inspection
    ↓
Inspection appears in property history
```

This is the primary MVP acceptance scenario.

---

# 4. WHAT MUST BE REAL VS MOCKED

## Must be functional

These should actually work:

- Login
- Navigation
- Estate map
- Plot selection
- Plot search
- Plot details
- Approval retrieval
- Document viewing
- Inspection creation
- GPS capture where device/browser supports it
- Photo upload/capture
- Observation entry
- Approved-vs-observed comparison
- Finding entry
- Inspection submission
- Inspection history

## May be simplified

These can use simplified implementations:

- Dashboard statistics
- User administration
- Status filtering
- Document categorization
- Inspection categories
- Audit display

## May be mocked/configurable

Until FHA provides official information:

- Official GIS dataset
- Official plot boundaries
- Official approval numbers
- Official property names
- Official approval statuses
- Official compliance thresholds
- Official inspection rules
- Official user hierarchy

All mocked content must be clearly labelled as demo/sample data.

---

# 5. DEMO DATA POLICY

Until FHA supplies authorized data, use only fictional sample records.

Every relevant prototype area should show:

```text
DEMO / PROTOTYPE DATA
NOT AN OFFICIAL FHA RECORD
```

Do not use:

- Real people's personal information
- Real private property records
- Real approval documents containing personal information
- Real survey data presented as official unless FHA authorizes it

---

# 6. PROTOTYPE DATASET

Create a small synthetic dataset.

Recommended:

```text
Estate: FHA Demo Estate

Blocks:
A
B
C

Plots:
001–020
```

A smaller set is acceptable.

Include varied scenarios:

```text
Plot 001 → Approved
Plot 002 → Pending
Plot 003 → Approved + Inspection
Plot 004 → Under Construction
Plot 005 → Completed
Plot 006 → Inspection Required
Plot 007 → Approved
Plot 008 → No Approval Record in Demo Dataset
```

Use synthetic data consistently throughout the entire application.

---

# 7. DEMO GIS DATA

Create synthetic map geometry for the prototype.

Recommended structure:

```text
Estate boundary
    ↓
Block polygons
    ↓
Plot polygons
```

Every demo plot must have:

```text
plot_id
plot_number
block_id
estate_id
geometry
```

Do not generate random coordinates on every application start.

The geometry must be deterministic so that:

- Search works
- Selection works
- Inspection works
- Demonstration is repeatable

---

# 8. DEMO PLOT IDENTIFIERS

Use stable internal IDs.

Example:

```text
plot_id:
demo-fha-estate-A-003
```

Display:

```text
Plot 003
```

The exact identifier format is implementation-specific and is not an official FHA identifier.

---

# 9. DEMO APPROVAL DATA

At least one plot should have a complete sample approval.

Example:

```text
Plot:
003

Approval:
FHA/DEV/2024/1056

Development:
4 Units Townhouse

Approved Floors:
2

Approved Units:
4

Status:
APPROVED
```

Clearly label the record as demo data.

---

# 10. DEMO INSPECTION DATA

Plot 003 should have either:

- No inspection initially, allowing the engineer to create one during demonstration; OR
- One historical inspection plus a new inspection.

For the main demonstration, prefer creating a new inspection live.

---

# 11. BUILD ORDER

Implement in this order.

---

## PHASE 0 — REPOSITORY DISCOVERY

Before changing code:

1. Inspect the repository.
2. Identify framework.
3. Identify package manager.
4. Identify TypeScript/JavaScript setup.
5. Identify database technology.
6. Identify authentication.
7. Identify existing UI library.
8. Identify map/GIS library if any.
9. Identify storage solution.
10. Review environment variables.
11. Review folder structure.
12. Identify existing working features.

Do not replace the stack unnecessarily.

Document important findings before major changes.

---

# 12. PHASE 1 — APPLICATION FOUNDATION

Set up:

- Global application shell
- Routing
- Shared layout
- Theme/design tokens
- Error boundary strategy
- Loading states
- Environment configuration
- Basic API/server structure

Deliverable:

```text
Application launches
↓
Shared layout works
↓
Pages can be navigated
```

---

# 13. PHASE 2 — AUTHENTICATION

Implement:

```text
/login
```

and authenticated application access.

Minimum:

- Login
- Logout
- Current-user state
- Protected routes
- Basic role

For MVP, a simple Engineer role and Administrator role may be sufficient.

Do not implement self-registration unless required.

---

# 14. PHASE 3 — DATABASE FOUNDATION

Implement the minimum database entities:

```text
users
estates
blocks
plots
property_interests
applications
approvals
documents
inspections
inspection_photos
inspection_findings
audit_logs
```

Do not create unnecessary future tables simply because they were mentioned in documentation.

Use migrations.

---

# 15. PHASE 4 — DEMO SEED DATA

Create a deterministic seed process.

Seed:

```text
1 demo estate
3 demo blocks
20 demo plots
sample property interests
sample applications
sample approvals
sample documents metadata
sample inspection history
sample findings
demo users
```

The seed must be repeatable.

---

# 16. PHASE 5 — APPLICATION SHELL

Build:

```text
Sidebar
Header
User/Profile
Main Content
Breadcrumbs where useful
```

MVP navigation:

```text
Dashboard
Map
Properties
Approvals
Inspections
Documents
```

Administration may be included only where useful for the prototype.

---

# 17. PHASE 6 — DASHBOARD

Build a simple operational dashboard.

Display demo data such as:

```text
Total Plots
Approved
Pending
Inspections
Potential Review Items
```

Quick actions:

```text
Open Map
Search Plot
Start Inspection
Verify Approval
```

The dashboard should not become the main focus of the MVP.

---

# 18. PHASE 7 — GIS MAP

This is the most important visual feature.

Build:

```text
Estate Map
Plot layer
Plot labels
Search
Zoom
Pan
Selection
Legend
Basic filters
```

Map requirements:

- Plot polygons visible
- Plot numbers visible at useful zoom
- Selected plot clearly highlighted
- Search result centers map
- Plot selection opens details

---

# 19. PHASE 8 — MAP ↔ DATABASE

Connect GIS features to property records.

Flow:

```text
Map polygon
     ↓
plot_id
     ↓
GET plot record
     ↓
Property details
```

Do not place full property information in every map feature.

Map payload should remain lightweight.

---

# 20. PHASE 9 — PLOT SEARCH

Implement search for:

```text
Plot Number
Estate
Block
Approval Number
Application Number
```

Flow:

```text
Search
 ↓
Results
 ↓
Select result
 ↓
Map centers
 ↓
Plot highlights
 ↓
Details available
```

Search should be server-backed where appropriate.

---

# 21. PHASE 10 — PLOT DETAILS

Build the central property record page.

Sections:

```text
Overview
Property
Development
Approval
Documents
Inspections
History
```

Primary actions:

```text
Verify Approval
View Documents
Start Inspection
Open on Map
```

The page must remain readable and not become one giant unstructured form.

---

# 22. PHASE 11 — APPROVAL DISPLAY

Connect Plot Details to Approval records.

Display:

```text
Approval Number
Application Number
Approval Date
Status
Development Type
Approved Floors
Approved Units
Conditions where available
```

Keep official approval values separate from inspection observations.

---

# 23. PHASE 12 — APPROVAL VERIFICATION

Build the verification screen.

Input:

```text
Approval Number
```

or:

```text
Plot Number
```

Return a clear result.

Example:

```text
APPROVAL RECORD FOUND

Approval No:
FHA/DEV/2024/1056

Plot:
003

Status:
APPROVED
```

Use system language such as:

```text
Record Found
Record Not Found
Review Required
```

Do not invent legal conclusions.

---

# 24. PHASE 13 — DOCUMENTS

Implement secure document listing/viewing.

For demo:

```text
Approval Letter
Approved Building Plan
Site Plan
Inspection Report
```

Actual file storage can use a suitable private development storage solution.

Do not create public permanent document URLs.

---

# 25. PHASE 14 — INSPECTION CREATION

From Plot Details:

```text
[Start Inspection]
```

Create:

```text
DRAFT
```

Load:

```text
Plot
Estate
Block
Approval
Engineer
```

Then show inspection sections.

---

# 26. PHASE 15 — GPS

Provide:

```text
[Capture Current Location]
```

Store:

```text
Latitude
Longitude
Accuracy
Timestamp
```

Handle:

```text
Permission denied
Unavailable
Low accuracy
Captured
```

Do not fabricate GPS data.

For desktop demos without GPS, provide a clearly labelled demo/manual fallback only if needed for demonstration.

---

# 27. PHASE 16 — PHOTO CAPTURE

Provide:

```text
[Take / Upload Photo]
```

Store:

```text
inspection_id
storage reference
caption
timestamp
location where available
```

For desktop prototype testing, allow file upload.

For mobile, use the device camera where supported.

---

# 28. PHASE 17 — OBSERVATIONS

Create an inspection form with:

```text
Construction Stage
Observed Floors
Observed Units
Observed Building Use
Setbacks where required
General Observations
```

Do not make all proposed fields mandatory unless the MVP specification or FHA confirms them.

---

# 29. PHASE 18 — APPROVED VS OBSERVED

Create a reusable comparison service.

Input:

```text
Approval
+
Inspection observations
```

Output:

```text
Approved Floors: 2
Observed Floors: 3

Approved Units: 4
Observed Units: 6

Potential Difference Detected
```

The service should produce structured data rather than UI-specific strings where possible.

---

# 30. PHASE 19 — FINDINGS

Allow the engineer to add a finding.

Example:

```text
Category:
Development

Title:
Floor count differs

Description:
Approved = 2
Observed = 3

Severity:
Review Required
```

Do not hard-code final FHA enforcement classifications.

---

# 31. PHASE 20 — INSPECTION SUMMARY

Before submission, show:

```text
Plot
Engineer
Date
GPS
Photo count
Findings
Approved values
Observed values
Potential differences
```

Actions:

```text
Edit
Submit Inspection
```

---

# 32. PHASE 21 — SUBMISSION

Submit through a protected server operation.

Sequence:

```text
Validate
 ↓
Authorize
 ↓
Save final inspection state
 ↓
Save findings
 ↓
Create audit event
 ↓
Return confirmation
```

Do not show success unless the server confirms successful submission.

---

# 33. PHASE 22 — INSPECTION HISTORY

Add the new inspection to the selected plot.

Show:

```text
Inspection Number
Date
Engineer
Status
Summary
```

Selecting an item opens the full inspection.

---

# 34. PHASE 23 — AUDIT LOGGING

Implement basic auditing for important actions:

```text
Login
View approval
View protected document
Create inspection
Update inspection
Submit inspection
```

At minimum:

```text
User
Action
Entity
Timestamp
```

Do not log passwords/tokens.

---

# 35. PHASE 24 — RESPONSIVE FIELD UI

Verify the main inspection workflow on:

```text
Desktop
Tablet
Android phone
```

Prioritize:

```text
Capture GPS
Take Photo
Add Observation
Save Draft
Submit
```

Large touch targets are preferred.

---

# 36. PHASE 25 — ERROR / EMPTY / LOADING STATES

Every major screen must have:

### Loading

```text
Loading property...
```

### Empty

```text
No inspections found.
```

### Error

```text
Unable to load property information.
[Retry]
```

Avoid blank or broken screens.

---

# 37. PHASE 26 — SECURITY PASS

Before demonstration verify:

- Protected routes
- Server-side authorization
- Secure document access
- Input validation
- Safe errors
- No secrets in repository
- Demo data separated from production
- GIS endpoints do not expose sensitive information
- File uploads are validated
- Direct object access is protected

---

# 38. PHASE 27 — DEMO POLISH

The final prototype should look coherent.

Check:

- Typography
- Spacing
- Status badges
- Map styling
- Empty states
- Responsive layouts
- Button labels
- Confirmation messages
- Loading feedback
- Error messages

Do not spend excessive time on decorative effects.

---

# 39. RECOMMENDED DEMO DATA RELATIONSHIP

Use Plot 003 as the main demonstration:

```text
FHA Demo Estate
     ↓
Block A
     ↓
Plot 003
     ↓
Sample Property Record
     ↓
Sample Approval
     ↓
Approval Document
     ↓
New Inspection
     ↓
GPS
     ↓
Photo
     ↓
Observed:
3 Floors / 6 Units
     ↓
Approved:
2 Floors / 4 Units
     ↓
Potential Difference
     ↓
Finding
     ↓
Submitted Inspection
```

---

# 40. PROTOTYPE DEMO SCRIPT

The person demonstrating should say/show:

### 1.

“This is the FHA development map.”

### 2.

“I can search for a plot.”

### 3.

“I'll search for Plot 003.”

### 4.

“The system locates the plot and highlights it.”

### 5.

“I can open the complete plot record.”

### 6.

“Here I can see the development approval.”

### 7.

“I can view the supporting approval document.”

### 8.

“Now I will start an inspection.”

### 9.

“The system records the inspection location.”

### 10.

“I can capture site photographs and observations.”

### 11.

“The approved development is compared with what was observed.”

### 12.

“The system identifies a potential difference for review.”

### 13.

“I can add the engineer's finding and recommendation.”

### 14.

“I submit the inspection.”

### 15.

“The inspection is now preserved in the property's history.”

This is the strongest MVP demonstration.

---

# 41. DO NOT BUILD THESE BEFORE THE CORE DEMO WORKS

Do not prioritize:

```text
Public verification
QR codes
Payments
Nationwide GIS
Mass document digitization
AI document extraction
Satellite building detection
Automated enforcement
Complex analytics
Full approval application workflow
Government integrations
```

They belong to later phases unless FHA specifically requests them for the demo.

---

# 42. CODING AGENT OUTPUT EXPECTATIONS

At each implementation stage, the AI agent should be able to report:

```text
Implemented
Not implemented
Assumption made
Blocked by missing requirement
```

Example:

```text
Implemented:
Plot selection

Assumption:
Demo geometry used because FHA GIS data is not yet available

Blocked:
Official approval status vocabulary not provided
```

Do not hide uncertainty.

---

# 43. REQUIREMENTS TRACEABILITY

Each significant implementation should map back to one or more specification documents.

Example:

```text
GIS plot selection
→ GIS.md
→ UI_UX.md
→ API.md
→ DATABASE.md

Approval verification
→ WORKFLOWS.md
→ API.md
→ DATA_DICTIONARY.md

Inspection
→ WORKFLOWS.md
→ UI_UX.md
→ DATABASE.md
→ SECURITY.md
```

This reduces feature drift.

---

# 44. WHEN FHA FEEDBACK ARRIVES

Do not immediately rewrite the whole system.

Instead:

```text
FHA feedback
   ↓
Identify affected requirement
   ↓
Update relevant specification
   ↓
Assess database/API/UI impact
   ↓
Implement controlled change
   ↓
Preserve existing working functionality
```

---

# 45. PROTOTYPE HANDOFF

The MVP should eventually be able to provide:

```text
Working application
+
Demo dataset
+
Prototype documentation
+
Known assumptions
+
Known limitations
+
FHA questions still pending
```

This package is what should be demonstrated to the engineer.

---

# 46. KNOWN LIMITATIONS TO DISPLAY

If still applicable at demonstration time:

```text
Prototype uses synthetic GIS data.
Prototype uses fictional property records.
Prototype approval records are sample records.
Final FHA approval statuses are not yet configured.
Final GIS boundaries require FHA source data.
Production security/hosting requirements require FHA IT confirmation.
```

The prototype must not pretend these limitations do not exist.

---

# 47. MVP DEFINITION OF DONE

The MVP is ready for demonstration when the following end-to-end journey works:

```text
[ ] Login
[ ] Dashboard
[ ] Estate map
[ ] Plot search
[ ] Plot selection
[ ] Plot details
[ ] Approval display
[ ] Approval verification
[ ] Document viewing
[ ] Start inspection
[ ] GPS capture or clearly labelled demo fallback
[ ] Photo capture/upload
[ ] Observation entry
[ ] Approved-vs-observed comparison
[ ] Finding
[ ] Inspection summary
[ ] Inspection submission
[ ] Inspection history
[ ] Basic audit logging
[ ] Responsive layout
[ ] Safe error handling
[ ] Demo data clearly labelled
```

---

# 48. AFTER THE MVP

Once the engineer reviews the prototype, collect feedback in four categories:

### Keep

Features that are useful and correct.

### Change

Features that need to follow FHA's actual workflow.

### Remove

Features that are unnecessary.

### Add

Features that FHA actually needs.

Then update the relevant project documents before expanding the system.

---

# 49. FINAL BUILD PRINCIPLE

The AI coding agent should remember:

> **The goal of the MVP is not to prove that we can build a large government platform. The goal is to prove that the map-based property, approval and inspection workflow is useful to FHA and to establish a reliable foundation for the full system.**

The strongest prototype is therefore:

```text
SMALL
     +
FUNCTIONAL
     +
REALISTIC
     +
CLEAR
     +
SECURE
     +
EASY TO EXPAND
```

---

**END OF MVP_BUILD_PLAN.md**
