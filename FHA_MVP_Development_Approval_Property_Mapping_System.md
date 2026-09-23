# FHA Development Approval & Property Mapping System
## MVP Specification & Prototype Data Pack

**Status:** MVP / Prototype Specification  
**Prepared For:** Federal Housing Authority (FHA) – Engineering / Development Control  
**Version:** 0.1  
**Date:** 31 August 2026  

> **IMPORTANT:** This is a proposed MVP based on our initial discussion and prototype concepts. It is not an official FHA specification. FHA procedures, terminology, GIS boundaries, approval rules, statuses, and workflows must be reviewed and corrected by FHA before production use.

---

## 1. MVP Objective

The MVP should demonstrate one practical workflow:

> **An authorized FHA engineer/officer can locate a property on a map, identify its plot, view its development/approval information, and record a site inspection against that property.**

### MVP success criteria

The prototype should allow an FHA reviewer to:

1. Open a selected prototype estate on an interactive map.
2. See individual plots and plot numbers.
3. Search for a plot.
4. Click a plot and view its details.
5. View its development approval status.
6. View sample approval/property documents.
7. Start an inspection for the selected plot.
8. Capture inspection observations and photographs.
9. Capture/display GPS coordinates where supported.
10. Compare selected approved information against observed site information.
11. Save and submit an inspection record.
12. View inspection history.

---

## 2. Prototype Boundary

### Recommended first area

- One FHA estate
- 1–3 blocks
- Approximately 20–100 plots
- Approximately 10–20 sample property records

The exact area must be selected by FHA.

### Sample data

Until FHA provides real records, use clearly labelled fictional data:

**DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD**

Do not use real personal information without authorization.

---

## 3. MVP User

### Primary role: FHA Engineer / Development Control Officer

The MVP user can:

- Log in
- View the estate map
- Search plots
- View plot details
- View approval information
- View documents
- Start an inspection
- Capture inspection information
- Capture/upload photographs
- Record observations
- Compare approved vs observed values
- Save a draft
- Submit an inspection
- View inspection history

Future roles may include Administrator, Planning Officer, Approval Officer, GIS Officer, Supervisor and Enforcement Officer.

---

# 4. MVP Modules

## Module 1 — Authentication

### MVP

- Login
- Logout
- Basic user profile
- Role identification

### Future

- MFA
- SSO
- Government identity integration
- Advanced permissions

---

## Module 2 — Estate GIS Map

### Purpose

Show the selected FHA estate as an interactive map.

### Map layers

- Estate boundary
- Roads/streets
- Blocks
- Individual plot boundaries
- Plot numbers
- Selected plot
- FHA-approved status indicators, if required

### User actions

- Zoom
- Pan
- Search
- Select a plot
- Open plot details
- Return to estate
- Use current GPS location where supported

### Critical GIS rule

The system must not invent or alter official plot boundaries.

If FHA has not yet supplied GIS data, the prototype may use clearly labelled synthetic/demo geometry. Production must use FHA-approved spatial data.

---

## Module 3 — Plot Search

### Proposed search fields

- Plot Number
- Block
- Estate
- Approval Number
- Application Number

Optional future search:

- Allottee/Owner
- File Number
- Street/Road

### Example

```text
Search: FHA/DEV/2024/1056

Result:
PLOT 003
Block A
FHA Festac Estate
APPROVED
```

---

## Module 4 — Plot Details

When a plot is selected, show:

### Property

- Estate
- Phase
- Block
- Plot Number
- Plot Size
- Street/Road
- Land Use
- Latitude
- Longitude
- Allocation Number
- Allocation Date

### Allottee / Interest

- Name
- Company/Organization, if applicable
- Contact information where FHA authorizes display
- Allocation number
- Allocation date

### Development

- Development type
- Approved floors
- Approved units
- Building coverage
- Front setback
- Side setback
- Rear setback
- Parking requirement
- Other approved parameters

### Approval

- Application number
- Approval number
- Approval date
- Approval status
- Validity/expiry where applicable
- Approval conditions

### Inspection

- Last inspection date
- Inspector
- Construction stage
- Compliance status
- Next inspection date, if applicable

### Documents

- Approval letter
- Approved building plan
- Site plan
- Allocation document
- Inspection report

---

## Module 5 — Approval Verification

### Objective

Allow an authorized user to search for and review an approval record.

### Search by

- Approval number
- Plot number
- Application number
- Estate/block

### Example result

```text
APPROVAL VERIFICATION

Status: APPROVED

Approval No:
FHA/DEV/2024/1056

Plot:
003

Estate:
FHA Festac Estate

Development:
4 Units Townhouse

Approval Date:
10 January 2025

Validity:
09 January 2027

Current Status:
ACTIVE
```

### Important

The prototype must not claim that an approval is legally valid simply because a record exists in the software.

Final verification wording and rules must be approved by FHA.

---

## Module 6 — Engineer Site Inspection

### Objective

Allow an engineer to record what was observed at a property.

### Inspection information

- Inspection date
- Inspection time
- Inspector
- Inspection type
- Weather condition
- GPS latitude
- GPS longitude
- GPS accuracy

### Construction observations

- Construction stage
- Floors observed
- Units observed
- Building use
- Front setback
- Side setback
- Rear setback
- Other measurements required by FHA
- General observations

### Photos

- Camera capture
- Upload
- Multiple photographs
- Caption/description
- Location/time metadata where supported

### Compliance

Possible example categories:

- Compliant
- Minor non-compliant
- Major non-compliant
- Unable to determine

**FHA must define the official categories.**

### Findings

Allow the engineer to record:

- Issue
- Description
- Evidence/photo
- Recommended action
- Follow-up requirement

---

# 5. Approved vs Observed Comparison

This is a key demonstration feature.

| Item | Approved | Observed | Result |
|---|---:|---:|---|
| Floors | 2 | 3 | Exceeded |
| Units | 4 | 6 | Exceeded |
| Building Use | Residential | Residential | Match |
| Front Setback | 6.0 m | 6.2 m | Review* |
| Side Setback | 3.0 m | 3.1 m | Review* |

\*The system must not invent official tolerance rules. FHA must define them.

Example:

```text
POTENTIAL DISCREPANCY

Approved:
2 floors / 4 units

Observed:
3 floors / 6 units

Action:
Flag for FHA review
```

Automated comparison should assist the engineer; official legal/enforcement decisions should remain under FHA's authorized process.

---

# 6. Sample MVP Data

**All records below are fictional demonstration data.**

## Estate

| Field | Sample |
|---|---|
| Estate | FHA Festac Estate |
| Phase | Phase 1 |
| State | Lagos |
| Demo Status | SAMPLE DATA |

## Blocks

| Block | Estate | Sample Plots |
|---|---|---:|
| A | FHA Festac Estate | 20 |
| B | FHA Festac Estate | 18 |
| C | FHA Festac Estate | 22 |

## Sample plots

| Plot | Block | Size | Development | Status |
|---|---|---:|---|---|
| 001 | A | 600 sqm | Residential | Approved |
| 002 | A | 600 sqm | Residential | Pending |
| 003 | A | 650 sqm | 4 Units Townhouse | Approved |
| 004 | A | 700 sqm | Residential | Under Construction |
| 005 | A | 550 sqm | Residential | Completed |
| 006 | A | 600 sqm | Residential | Inspection Required |
| 007 | A | 650 sqm | Residential | Approved |
| 008 | A | 600 sqm | Residential | Pending |

---

# 7. Sample Plot Record

```text
Plot Number: 003
Estate: FHA Festac Estate
Phase: Phase 1
Block: A
Plot Size: 650 sqm
Street: 3rd Avenue
Land Use: Residential

Allocation No: FHA/AL/2020/1478
Development Type: 4 Units Townhouse
Approved Floors: 2
Approved Units: 4

Approval No: FHA/DEV/2024/1056
Approval Date: 10 January 2025
Status: Approved

Last Inspection: 18 May 2025
Inspection Status: Review Required
```

All information above is fictional.

---

# 8. Sample Approval Record

```text
Approval No:
FHA/DEV/2024/1056

Plot:
003
Block:
A
Estate:
FHA Festac Estate

Development:
4 Units Townhouse

Approved Floors:
2
Approved Units:
4

Approval Date:
10 January 2025
Valid Until:
09 January 2027

Status:
Approved / Active
```

Any approval conditions displayed in the prototype must be clearly marked as sample unless supplied by FHA.

---

# 9. Sample Inspection Record

```text
Inspection No:
FHA/INSP/2025/0210

Plot:
003
Estate:
FHA Festac Estate
Block:
A
Approval:
FHA/DEV/2024/1056

Inspection Type:
Routine Inspection

Construction Stage:
Roof Level

Floors Observed:
3

Units Observed:
6

Front Setback:
6.2 m

Side Setback:
3.1 m

Observation:
Building appears to exceed the approved number
of floors and units.

Recommended Action:
Refer for FHA review / appropriate action.
```

Inspector name and all identifiers are fictional.

---

# 10. Sample Document Structure

```text
PLOT 003
│
├── Allocation
│   └── Allocation_Letter.pdf
│
├── Development Approval
│   ├── Approval_Letter.pdf
│   ├── Approved_Building_Plan.pdf
│   └── Site_Plan.pdf
│
└── Inspections
    ├── Inspection_2025-05-18.pdf
    ├── Site_Photo_01.jpg
    ├── Site_Photo_02.jpg
    └── Site_Photo_03.jpg
```

---

# 11. MVP Screen List

## Screen 1 — Login

- FHA branding
- Email
- 6-digit PIN (email OTP — no password)
- Login

## Screen 2 — Dashboard

Cards:

- Total prototype plots
- Approved
- Pending
- Under construction
- Inspections due
- Recent inspections

Quick actions:

- Estate Map
- Search Plot
- New Inspection
- Approval Verification

## Screen 3 — Estate GIS Map

- Interactive map
- Plot boundaries
- Plot numbers
- Search
- Filters
- Legend
- Selected plot panel

## Screen 4 — Plot Details

- Plot identity
- Map preview
- Property information
- Allottee/interest
- Development summary
- Approval summary
- Inspection summary
- Documents
- History
- Quick actions

## Screen 5 — Approval Verification

- Search
- Search type
- Result
- Approval status
- Property information
- Approval summary
- Documents
- Conditions
- Timeline

## Screen 6 — New Inspection

- Property information
- Inspection details
- GPS
- Construction observations
- Site photos
- Approved vs observed
- Compliance
- Recommendations
- Save Draft
- Submit

## Screen 7 — Inspection Details

- Inspection information
- Inspector
- GPS
- Photos
- Observations
- Comparison
- Findings
- Recommendations
- History

---

# 12. Navigation

```text
Dashboard
│
├── Estate Map
│   └── Select Plot
│       └── Plot Details
│           ├── Approval
│           ├── Documents
│           └── Inspections
│
├── Plot Search
│   └── Plot Details
│
├── Approval Verification
│   └── Approval Result
│
└── Inspections
    ├── Inspection List
    ├── New Inspection
    └── Inspection Details
```

---

# 13. Proposed Database Structure

A relational database with GIS support is recommended for the production architecture.

### Estates

```text
id
name
phase
state
boundary_geometry
created_at
updated_at
```

### Blocks

```text
id
estate_id
block_number
geometry
```

### Plots

```text
id
estate_id
block_id
plot_number
plot_size
street
land_use
latitude
longitude
geometry
status
```

### Allottees / Interests

```text
id
plot_id
name
organization
allocation_number
allocation_date
contact_information
```

### Applications

```text
id
plot_id
application_number
application_type
submission_date
status
```

### Approvals

```text
id
plot_id
application_id
approval_number
approval_date
valid_until
status
development_type
approved_floors
approved_units
building_coverage
front_setback
side_setback
rear_setback
conditions
```

### Inspections

```text
id
plot_id
approval_id
inspection_number
inspector_id
inspection_type
inspection_date
inspection_time
latitude
longitude
gps_accuracy
construction_stage
observed_floors
observed_units
observed_front_setback
observed_side_setback
observed_rear_setback
building_use
compliance_status
observations
recommendations
status
created_at
updated_at
```

### Documents

```text
id
plot_id
application_id
approval_id
inspection_id
document_type
file_name
file_url
uploaded_by
uploaded_at
```

### Inspection Photos

```text
id
inspection_id
file_url
caption
latitude
longitude
captured_at
uploaded_at
```

---

# 14. GIS Data Requirements

If FHA already has official spatial data, use it rather than recreating boundaries.

Possible formats:

- Shapefile
- GeoJSON
- KML/KMZ
- GeoPackage
- PostGIS
- CAD/DWG
- Survey data
- Other FHA-approved format

## Required relationship

Each plot feature should have a stable identifier that connects it to the property record.

```text
GIS Plot
   │
   └── plot_id
          │
          ▼
   Property Record
          │
     ┌────┼────┐
     ▼    ▼    ▼
 Approval Docs Inspection
```

This relationship is the core of the GIS/property system.

---

# 15. Security

Even the MVP should include:

- Authenticated access
- Role-based access
- Server-side authorization
- Secure document access
- Input validation
- Audit trail for important changes
- No public exposure of private property information
- No real personal data without authorization
- HTTPS when deployed
- Secure environment variables

Future production requirements may include MFA, fine-grained permissions, encryption, backups, retention policies and full audit logging.

---

# 16. Field / Offline Consideration

Construction sites may have unreliable internet connectivity.

The production system should therefore be evaluated for offline inspection capability:

```text
Download/prepare property
        ↓
Visit site
        ↓
Capture GPS + photos + observations
        ↓
Save offline
        ↓
Internet returns
        ↓
Synchronize
```

Offline mode can be a later phase if it is too large for the first prototype.

---

# 17. MVP Out of Scope

Do not include these in the first MVP unless FHA specifically requests them:

- Nationwide FHA database
- Complete historical digitization
- Nationwide field verification
- Public approval verification
- Online approval application workflow
- Automated approval decisions
- Automated legal/enforcement decisions
- Integration with every government agency
- Full cadastral survey creation
- Nationwide GIS collection
- AI building detection
- Satellite analysis
- Complex analytics
- Advanced administration

---

# 18. Information Required From FHA

For the first prototype, request only the most important materials:

### 1. Map

One map/survey of the selected area.

### 2. Plot information

10–20 sample plot records.

### 3. Approval example

One representative development approval file, with sensitive information removed if necessary.

### 4. Inspection example

One representative inspection form/report.

### 5. Process explanation

A short explanation of:

```text
Find property
    ↓
Check records
    ↓
Check approval
    ↓
Visit site
    ↓
Inspect
    ↓
Record findings
    ↓
Take appropriate action
```

---

# 19. Prototype Demonstration Scenario

Use one fictional property to demonstrate the complete workflow.

### Scenario

An engineer needs to inspect Plot 003.

1. Open the FHA system.
2. Search Plot 003.
3. Select Plot 003 on the map.
4. View the property record.
5. View the development approval.
6. Visit the site.
7. Capture GPS.
8. Take site photographs.
9. Enter observed floors and units.
10. System compares approved vs observed.
11. Engineer records observations.
12. Engineer records a recommendation.
13. Submit the inspection.
14. Inspection becomes part of the property's history.

This single scenario demonstrates the main value of the proposed system.

---

# 20. MVP Acceptance Checklist

- [ ] Login works
- [ ] Estate map opens
- [ ] Plot boundaries display
- [ ] Plot numbers display
- [ ] Plot search works
- [ ] Plot selection works
- [ ] Plot details display
- [ ] Approval information displays
- [ ] Sample documents can be viewed
- [ ] New inspection can be created
- [ ] GPS can be captured/displayed
- [ ] Observations can be recorded
- [ ] Photographs can be attached
- [ ] Approved vs observed comparison works
- [ ] Compliance status can be recorded
- [ ] Inspection can be saved
- [ ] Inspection can be submitted
- [ ] Inspection history can be viewed

---

# 21. Product Principles

### FHA process comes first

The software should adapt to FHA's actual process.

### GIS must be authoritative

Demo boundaries must never be presented as legal/official boundaries.

### Automation assists; it does not replace authorized decisions

The system can flag differences, but FHA should determine official compliance/enforcement actions.

### Records should be traceable

Important changes should record who changed what and when.

### Demo data must remain separate

Fictional records must never be confused with official FHA records.

---

# 22. Next Phase After MVP

After FHA reviews the prototype:

### Phase 2 — Requirements validation

- Confirm workflows
- Confirm fields
- Confirm statuses
- Confirm roles
- Confirm GIS requirements
- Confirm documents
- Confirm inspection process
- Confirm reports
- Confirm integrations

### Phase 3 — Production architecture

- Database
- GIS infrastructure
- Authentication
- Authorization
- File storage
- Audit logging
- Mobile/field application
- Web administration
- Backup/recovery

### Phase 4 — Data preparation

- GIS conversion
- Plot digitization where required
- Data cleansing
- Historical record preparation
- Document indexing
- Property-to-GIS matching

### Phase 5 — Production

- Development
- Testing
- Security review
- User acceptance testing
- Deployment
- Training
- Support

---

# 23. Final MVP Goal

The immediate question the prototype should answer is:

> **“Can this map-based system make it easier for an FHA engineer to locate a property, understand its development approval, conduct an inspection, document what is found on site, and maintain a reliable property history?”**

If FHA confirms that the concept is useful, the prototype becomes the foundation for accurately estimating:

- Software development
- GIS work
- Data preparation
- Plot digitization
- Field labour
- Document digitization
- Deployment
- Training
- Maintenance
- Future integrations

---

## Appendix A — Sample Plot Details

```text
PLOT 003                         APPROVED

FHA FESTAC ESTATE
Block A | Phase 1 | 650 sqm

PROPERTY
Estate: FHA Festac Estate
Block: A
Plot: 003
Street: 3rd Avenue
Land Use: Residential

ALLOCATION
Allocation No: FHA/AL/2020/1478
Date: 12 March 2020

DEVELOPMENT
Type: 4 Units Townhouse
Floors Approved: 2
Units Approved: 4

APPROVAL
Approval No: FHA/DEV/2024/1056
Date: 10 January 2025
Status: Approved

ACTIONS
[View Map] [Verify Approval] [New Inspection] [View Documents]
```

---

## Appendix B — Sample Approval Verification

```text
APPROVAL VERIFICATION

Search by:
[ Approval Number ]

[ FHA/DEV/2024/1056 ]

[ VERIFY APPROVAL ]

--------------------------------

APPROVED

Approval No:
FHA/DEV/2024/1056

Plot:
003

Estate:
FHA Festac Estate

Approved Development:
4 Units Townhouse

Approved Floors:
2

Approval Date:
10 January 2025

Valid Until:
09 January 2027

Status:
ACTIVE

[View Approval Documents]
[View Plot]
[Print]
```

---

## Appendix C — Sample Inspection

```text
NEW SITE INSPECTION

PROPERTY
Plot: 003
Estate: FHA Festac Estate
Block: A
Approval: FHA/DEV/2024/1056

INSPECTION
Date: [20 May 2025]
Time: [10:45 AM]
Inspector: [Engr. __________]
Type: [Routine Inspection]

LOCATION
Latitude: [Captured]
Longitude: [Captured]
Accuracy: [5 m]

OBSERVATION

Construction Stage:
[Roof Level]

Floors Observed:
[3]

Units Observed:
[6]

Front Setback:
[6.2 m]

Side Setback:
[3.1 m]

PHOTOS
[ + Capture Photo ]

COMPARISON

Approved Floors: 2
Observed Floors: 3
Result: POTENTIAL DISCREPANCY

Approved Units: 4
Observed Units: 6
Result: POTENTIAL DISCREPANCY

OBSERVATIONS
[____________________________]

RECOMMENDATION
[____________________________]

[Save Draft]       [Submit Inspection]
```

---

**END OF MVP SPECIFICATION**

**Status:** Draft — Awaiting FHA Engineering / Development Control Review
