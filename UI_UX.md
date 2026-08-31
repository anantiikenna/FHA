# UI_UX.md
# FHA Development Approval & Property Mapping System
## MVP UI/UX Specification

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Architecture Reference:** `ARCHITECTURE.md`  
**Database Reference:** `DATABASE.md`  
**GIS Reference:** `GIS.md`  
**API Reference:** `API.md`  
**AI Engineering Instructions:** `AGENTS.md`

---

# 1. PURPOSE

This document defines the proposed user interface and user experience for the FHA Development Approval & Property Mapping System MVP.

The UI should make the core workflow simple:

```text
LOGIN
  ↓
DASHBOARD
  ↓
ESTATE GIS MAP
  ↓
SELECT PLOT
  ↓
PLOT DETAILS
  ↓
APPROVAL VERIFICATION
  ↓
DOCUMENTS
  ↓
ENGINEER INSPECTION
  ↓
GPS + PHOTOS + FINDINGS
  ↓
INSPECTION SUMMARY
```

The interface is a prototype and must remain easy to modify after FHA review.

---

# 2. UX PRINCIPLES

The application should prioritize:

1. Clarity
2. Speed
3. Accuracy
4. Minimal unnecessary clicks
5. Field usability
6. Clear status communication
7. Secure access to sensitive records
8. Traceability
9. Responsive design
10. Professional government/workplace appearance

The application should feel like an operational engineering/property-management tool, not a consumer social-media application.

---

# 3. PRIMARY USERS

The following roles are provisional until FHA confirms them.

### Engineer / Inspector

Primary field user.

Needs:

- Map
- Plot search
- Plot records
- Approval information
- Inspection workflow
- GPS
- Photos
- Findings

### Approval / Development Officer

Needs:

- Property records
- Applications
- Approvals
- Documents
- Verification
- Review workflows

### GIS Officer

Needs:

- Map
- Plot data
- GIS layers
- Data quality information
- Potential GIS administration

### Administrator

Needs:

- Users
- Roles
- System settings
- Audit information

---

# 4. DESIGN DIRECTION

Recommended visual direction:

```text
Professional
Government
Engineering
Geospatial
Data-focused
Clean
Accessible
Trustworthy
```

Avoid:

- Excessive animations
- Decorative gradients
- Overly rounded consumer-app styling
- Unnecessary illustrations
- Large empty hero sections
- Complex visual effects

The map and operational information should dominate the experience.

---

# 5. RESPONSIVE BREAKPOINTS

The UI should support:

### Desktop

Primary workstation environment.

Recommended layout:

```text
Sidebar + Header + Main Content
```

### Tablet

Useful for engineers.

Recommended:

```text
Collapsible Sidebar + Main Content
```

### Mobile

Useful for field inspections.

Recommended:

```text
Top Header
Full-width Map/Form
Bottom Sheet
Sticky Action Controls
```

---

# 6. APPLICATION SHELL

Desktop structure:

```text
┌─────────────────────────────────────────────────────┐
│ FHA Logo     Search                  User / Profile │
├──────────────┬──────────────────────────────────────┤
│              │                                      │
│ Dashboard    │                                      │
│ Map          │              MAIN CONTENT             │
│ Properties   │                                      │
│ Approvals    │                                      │
│ Inspections  │                                      │
│ Documents    │                                      │
│              │                                      │
│ Admin        │                                      │
│              │                                      │
└──────────────┴──────────────────────────────────────┘
```

The sidebar should show only functions available to the current user.

---

# 7. HEADER

The header should contain:

- FHA/system identity
- Current page context
- Global search where appropriate
- Notifications if implemented
- User/profile menu

Avoid placing too many controls in the header.

---

# 8. SIDEBAR NAVIGATION

Suggested MVP navigation:

```text
Dashboard

Map
Properties
Applications
Approvals
Inspections
Documents

Administration
```

Administration should only appear for authorized roles.

---

# 9. LOGIN PAGE

Purpose:

Allow authorized FHA users to securely access the application.

Suggested layout:

```text
┌────────────────────────────────────┐
│                                    │
│              FHA                   │
│  Development & Property System     │
│                                    │
│  Email / Staff ID                  │
│  [____________________________]    │
│                                    │
│  Password                          │
│  [____________________________]    │
│                                    │
│           [ Sign In ]              │
│                                    │
└────────────────────────────────────┘
```

Do not implement self-registration unless FHA specifically requests it.

---

# 10. DASHBOARD

The dashboard should provide an operational overview.

Possible cards:

```text
Total Properties
Pending Approvals
Approved Developments
Inspections Due
Recent Inspections
```

These values must come from actual authorized data.

For the prototype, clearly mark synthetic/demo values.

---

# 11. DASHBOARD QUICK ACTIONS

Useful MVP actions:

```text
[Open Map]

[Search Plot]

[Start Inspection]
```

The Engineer role should reach the map quickly.

---

# 12. GIS MAP SCREEN

This is the most important MVP screen.

Recommended structure:

```text
┌─────────────────────────────────────────────────────────┐
│ Development Map                                         │
│ [Search plot / approval...]                             │
├───────────────┬─────────────────────────────────────────┤
│ Filters       │                                         │
│               │                                         │
│ Estate        │                 MAP                     │
│ Block         │                                         │
│ Status        │       ┌────┐ ┌────┐                    │
│               │       │001 │ │002 │                    │
│ Layers        │       └────┘ └────┘                    │
│ ☑ Plots       │       ┌────┐ ┌────┐                    │
│ ☑ Blocks      │       │003 │ │004 │                    │
│ ☑ Labels      │       └────┘ └────┘                    │
│               │                                         │
└───────────────┴─────────────────────────────────────────┘
```

---

# 13. MAP SEARCH

Search field:

```text
Search plot, block, application or approval...
```

Results should be categorized.

Example:

```text
Plots
  Plot 003 — Block A

Approvals
  FHA/DEV/2024/1056
```

Selecting a result should center and highlight the relevant map feature.

---

# 14. MAP FILTERS

MVP filters:

```text
Estate
Block
Approval Status
```

Additional filters can be added after FHA confirmation.

Filters should be easy to clear.

---

# 15. MAP LAYER CONTROL

Example:

```text
Layers

☑ Estate Boundary
☑ Blocks
☑ Plots
☑ Plot Numbers
☐ Inspection Locations
☐ Current GPS
```

The final list depends on available GIS data.

---

# 16. SELECTED PLOT STATE

When the engineer selects a plot:

```text
Plot polygon
      ↓
Highlighted
      ↓
Details panel appears
```

The selected state must be visually obvious.

Do not rely only on color; use a boundary/outline or other visual cue as well.

---

# 17. PLOT MAP POPUP

Compact popup:

```text
PLOT 003

Block A
650 sqm

Approval
Approved

[View Details]
```

The popup is only a quick summary.

---

# 18. PLOT DETAILS PAGE

Purpose:

Present the complete authorized record for the selected plot.

Suggested structure:

```text
← Back to Map

Plot 003
Block A • FHA Demo Estate

[Approved]

PROPERTY
────────────────────
Plot Size: 650 sqm
Development Type: Residential

APPROVAL
────────────────────
Approval No: FHA/DEV/2024/1056
Approval Date: 12/03/2024
Status: Approved

ACTIONS
[Verify Approval]
[View Documents]
[Start Inspection]
```

---

# 19. PLOT DETAILS TABS

If the record is large, use tabs:

```text
Overview
Property
Applications
Approvals
Documents
Inspections
```

Avoid placing all information in one extremely long page.

---

# 20. APPROVAL VERIFICATION PAGE

Purpose:

Allow an authorized user to review the approval record and its verification state.

Suggested UI:

```text
Approval Verification

Approval Number
FHA/DEV/2024/1056

Plot
003

Status
APPROVED

Approval Date
12 March 2024

Development
Residential

[View Approval Document]

Verification Result
RECORD FOUND

[View Full Record]
```

---

# 21. VERIFICATION LANGUAGE

The MVP should use neutral system language.

Preferred:

```text
Record Found
Record Not Found
Review Required
```

Avoid automatically displaying:

```text
Illegal
Fraudulent
Fake
Unauthorized
```

unless FHA officially defines the system's authority to make those determinations.

---

# 22. DOCUMENTS PAGE

Documents may be displayed as:

```text
Approval Letter
12 Mar 2024
PDF

Approved Building Plan
12 Mar 2024
PDF

Inspection Report
20 Jun 2024
PDF
```

Actions:

```text
[View]
[Download]
```

Only authorized actions should be displayed.

---

# 23. DOCUMENT PREVIEW

Where possible, show documents in a secure preview.

Example:

```text
┌─────────────────────────────┐
│ Approval Letter             │
├─────────────────────────────┤
│                             │
│        DOCUMENT             │
│        PREVIEW              │
│                             │
├─────────────────────────────┤
│ [Close]       [Download]    │
└─────────────────────────────┘
```

Do not expose sensitive documents through public URLs.

---

# 24. ENGINEER INSPECTION PAGE

The inspection form should be optimized for field use.

Suggested sections:

```text
Inspection
────────────────────────

Property
Plot 003

Inspection Type
Site Inspection

Date / Time
[Automatic]

Engineer
[Current User]

LOCATION
[Capture GPS]

OBSERVATION
Construction Stage
[Select]

Number of Floors
[   ]

Number of Units
[   ]

PHOTOS
[Take Photo]

FINDINGS
[Add Finding]

[Save Draft]
[Submit Inspection]
```

---

# 25. GPS CAPTURE

Button:

```text
[Capture Current Location]
```

After capture:

```text
GPS Captured

Latitude: ...
Longitude: ...
Accuracy: 8m
Time: ...
```

The user should be able to recapture if necessary.

---

# 26. GPS STATUS

Use clear states:

```text
Waiting for location
Location captured
Low accuracy
Location unavailable
Permission denied
```

Provide useful recovery instructions.

---

# 27. PHOTO CAPTURE

Field users should have a prominent:

```text
[Take Photo]
```

Photos can appear as thumbnails:

```text
┌──────┐ ┌──────┐ ┌──────┐
│ IMG1 │ │ IMG2 │ │ IMG3 │
└──────┘ └──────┘ └──────┘
```

Each photo may optionally have:

```text
Caption
Location
Timestamp
```

---

# 28. INSPECTION FINDINGS

Example:

```text
Finding

Category
[Development ▼]

Title
[________________]

Description
[________________________]

Severity
[Review Required ▼]

[Add Finding]
```

FHA should define the final finding categories and severity values.

---

# 29. APPROVED VS OBSERVED

If enabled, show a comparison card:

```text
APPROVED              OBSERVED

Floors: 2             Floors: 3
Units: 4              Units: 6

Potential Difference Detected
```

The system should call this a:

```text
Potential Difference
```

or FHA-approved terminology.

It should not automatically make an enforcement/legal decision.

---

# 30. INSPECTION SUMMARY

Before submission:

```text
Inspection Summary

Plot
003

Engineer
Demo Engineer

GPS
Captured

Photos
4

Findings
2

Potential Differences
1

[Edit]
[Submit Inspection]
```

The user should confirm before final submission.

---

# 31. SUBMISSION CONFIRMATION

Use a confirmation dialog:

```text
Submit Inspection?

After submission, editing may be restricted
depending on FHA workflow.

[Cancel] [Submit]
```

The exact post-submission behavior must be confirmed by FHA.

---

# 32. INSPECTION SUCCESS

After successful submission:

```text
✓ Inspection Submitted

Inspection ID
INS-000012

Plot
003

Status
Submitted

[View Inspection]
[Return to Map]
```

Do not imply approval merely because an inspection was submitted.

---

# 33. PROPERTIES PAGE

Table/list view:

```text
Plot | Estate | Block | Status | Approval | Action
---------------------------------------------------
001  | Demo   | A     | Active | Approved | View
002  | Demo   | A     | Active | Pending  | View
003  | Demo   | A     | Active | Approved | View
```

Actions:

```text
View
Open on Map
```

---

# 34. APPROVALS PAGE

Suggested columns:

```text
Approval No.
Plot
Development
Date
Status
Action
```

Filters:

```text
Status
Estate
Date
Search
```

---

# 35. INSPECTIONS PAGE

Suggested columns:

```text
Inspection ID
Plot
Engineer
Date
Type
Status
Action
```

Possible statuses:

```text
Draft
Submitted
Under Review
Completed
```

Only use statuses confirmed by FHA in the final system.

---

# 36. EMPTY STATES

Do not show blank screens.

Example:

```text
No inspections found.

There are no inspections matching your current filters.

[Clear Filters]
```

---

# 37. LOADING STATES

Use skeleton/loading indicators for:

- Map data
- Plot details
- Approval records
- Documents
- Inspection records

Avoid freezing the interface.

---

# 38. ERROR STATES

Example:

```text
Unable to load plot information.

Please try again.

[Retry]
```

Do not expose technical stack traces.

---

# 39. MOBILE MAP

Recommended:

```text
┌───────────────────────────┐
│ Search...                 │
├───────────────────────────┤
│                           │
│           MAP             │
│                           │
│      ┌────┐ ┌────┐        │
│      │001 │ │002 │        │
│      └────┘ └────┘        │
│                           │
│          ● GPS            │
│                           │
├───────────────────────────┤
│ Plot 003                  │
│ Approved                  │
│ [View Details]            │
└───────────────────────────┘
```

The details panel can be a bottom sheet.

---

# 40. MOBILE INSPECTION

Field inspection should minimize typing.

Prefer:

- Dropdowns
- Number fields
- Quick-select options
- Camera button
- GPS button
- Short observation fields

Long forms should be divided into sections.

---

# 41. ACCESSIBILITY

The UI should support:

- Keyboard navigation
- Visible focus states
- Readable text
- Adequate contrast
- Clear labels
- Accessible buttons
- Non-color-only status indicators
- Screen-reader-friendly form labels where practical

---

# 42. STATUS COMPONENTS

Use consistent badges.

Example:

```text
[APPROVED]
[PENDING]
[REVIEW REQUIRED]
[NO RECORD]
```

The final status vocabulary must be confirmed by FHA.

---

# 43. CONFIRMATION / DANGER ACTIONS

Potentially irreversible actions should require confirmation.

Examples:

```text
Submit Inspection
Delete Document
Archive Record
Change Approval Status
```

Deletion/archival rules require FHA confirmation.

---

# 44. BREADCRUMBS

Useful on desktop:

```text
Map
  >
FHA Demo Estate
  >
Block A
  >
Plot 003
  >
Inspection
```

This helps users understand where they are.

---

# 45. NOTIFICATIONS

If implemented:

```text
Notifications
────────────────────
Inspection submitted
Approval updated
Document available
```

Do not add notifications unless there is a real workflow behind them.

---

# 46. ROLE-BASED UI

The interface should adapt to permissions.

Example:

### Engineer

```text
Map
Properties
Approvals (view)
Inspections
Documents (authorized view)
```

### Administrator

Additional:

```text
Users
Roles
Audit Logs
System Settings
```

The frontend hiding a button is not the security mechanism. Backend authorization remains mandatory.

---

# 47. AUDIT VISIBILITY

Authorized administrators may see:

```text
User
Action
Record
Date/Time
```

Example:

```text
Demo Engineer
Submitted Inspection
INS-000012
31 Aug 2026 12:30
```

---

# 48. DESIGN SYSTEM

The AI agent should create reusable components for:

```text
Button
Input
Select
Search
Badge
Card
Table
Modal
Drawer
Tabs
Toast
Map Container
Map Layer Control
Status Badge
File List
Photo Gallery
Inspection Form
```

Avoid duplicating components across pages.

---

# 49. MAP COMPONENTS

Create reusable map components such as:

```text
<MapContainer />
<PlotLayer />
<PlotLabelLayer />
<SelectedPlot />
<MapControls />
<MapSearch />
<MapLegend />
<GPSMarker />
<InspectionLocation />
```

Exact implementation depends on the selected mapping library/provider.

---

# 50. FORM COMPONENTS

Create reusable:

```text
<PlotSearch />
<ApprovalStatus />
<DocumentUpload />
<GPSCapture />
<PhotoCapture />
<InspectionFindingForm />
<InspectionSummary />
```

---

# 51. FRONTEND DATA RULE

The UI must use the API layer.

Do not:

```text
Browser
  ↓
Direct database connection
```

Use:

```text
Browser
  ↓
API/server action
  ↓
Authorization
  ↓
Database
```

---

# 52. DEMO DATA LABELING

Because the prototype may use fictional records:

Display a subtle but clear indicator:

```text
PROTOTYPE / DEMO DATA
```

This should be visible wherever necessary to prevent confusion with official FHA records.

---

# 53. MAP DEMO LABEL

The prototype map may display:

```text
FHA DEVELOPMENT MAP
Prototype Area

DEMO DATA
```

Do not use real property owners' names in demonstration data unless FHA authorizes their use.

---

# 54. PROTOTYPE PAGES

Minimum MVP pages:

```text
1. Login
2. Dashboard
3. GIS Map
4. Plot Details
5. Approval Verification
6. Documents
7. Inspection
8. Inspection Summary
9. Properties
10. Approvals
11. Inspections
```

Administration pages may be added if required for the demo.

---

# 55. MVP DEMONSTRATION FLOW

The preferred live demonstration should be:

```text
Login
 ↓
Dashboard
 ↓
Open Map
 ↓
Select Plot 003
 ↓
View Plot Details
 ↓
Open Approval
 ↓
Verify Record
 ↓
Open Approval Document
 ↓
Start Inspection
 ↓
Capture GPS
 ↓
Take Photo
 ↓
Record Finding
 ↓
Compare Approved vs Observed
 ↓
Submit Inspection
 ↓
View Updated Inspection Record
```

This gives the FHA engineer a complete end-to-end demonstration.

---

# 56. UI ACCEPTANCE CHECKLIST

### Navigation

- [ ] Login works
- [ ] Dashboard works
- [ ] Sidebar navigation works
- [ ] Role-based visibility works

### GIS

- [ ] Map loads
- [ ] Estate displays
- [ ] Plot polygons display
- [ ] Plot labels display
- [ ] Plot can be selected
- [ ] Selected plot highlights
- [ ] Search centers map

### Property

- [ ] Plot details load
- [ ] Approval information is visible
- [ ] Documents are accessible to authorized users

### Inspection

- [ ] Inspection can start
- [ ] GPS can be captured
- [ ] Photos can be captured/uploaded
- [ ] Findings can be added
- [ ] Comparison can be viewed where enabled
- [ ] Inspection can be submitted

### UX

- [ ] Desktop works
- [ ] Tablet works
- [ ] Mobile inspection flow works
- [ ] Loading states exist
- [ ] Error states exist
- [ ] Empty states exist
- [ ] Statuses are understandable

---

# 57. DESIGN IMPLEMENTATION RULES FOR AI AGENT

The AI coding agent must:

1. Build reusable components.
2. Avoid duplicating page-level UI.
3. Keep GIS logic separate from property/business logic.
4. Keep API calls separate from presentation components.
5. Use typed data models.
6. Validate form inputs.
7. Handle loading/error/empty states.
8. Make the map responsive.
9. Keep field inspection touch-friendly.
10. Never invent official FHA business rules.
11. Clearly label synthetic/demo data.
12. Keep uncertain requirements configurable.
13. Do not expose sensitive data unnecessarily.
14. Do not create public document URLs for sensitive records.
15. Do not treat GPS as official cadastral surveying.
16. Do not label missing approval records as illegal unless FHA explicitly defines that rule.

---

# 58. UI REQUIREMENTS STILL REQUIRING FHA CONFIRMATION

The AI agent must maintain these as configurable/TODO requirements until confirmed:

- Official user roles
- Official terminology
- Official approval statuses
- Official inspection statuses
- Required property fields
- Required approval fields
- Required inspection fields
- Required finding categories
- Required document types
- GPS requirements
- Photo requirements
- Public vs internal access
- Official map/GIS provider
- Official map data
- Official status colors
- Submission/finalization rules

---

# 59. FINAL UX PRINCIPLE

The application should make the engineer's central task as simple as possible:

```text
WHERE IS THE PROPERTY?
        ↓
WHAT PROPERTY IS IT?
        ↓
WHAT APPROVAL EXISTS?
        ↓
WHAT WAS APPROVED?
        ↓
WHAT IS OBSERVED ON SITE?
        ↓
IS THERE A DIFFERENCE REQUIRING REVIEW?
        ↓
WHAT DID THE ENGINEER RECORD?
```

The GIS map provides the location context.

The property record provides the identity/context.

The approval record provides the administrative record.

The inspection provides the field observation.

These four parts should remain connected throughout the user experience.

---

**END OF UI_UX.md**
