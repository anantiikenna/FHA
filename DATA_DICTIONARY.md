# DATA_DICTIONARY.md
# FHA Development Approval & Property Mapping System
## MVP Data Dictionary & Information Model

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Related Documents:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`, `ARCHITECTURE.md`, `DATABASE.md`, `GIS.md`, `API.md`, `UI_UX.md`, `SECURITY.md`, `AUTHORIZATION_RBAC.md`, `AGENTS.md`

---

# 1. PURPOSE

This document defines the proposed information model for the FHA Development Approval & Property Mapping System MVP.

It answers:

> **What information does the system need to store, display, search, verify, inspect and audit?**

This is a working specification for the prototype.

Where FHA's actual data structure is not yet known, the field is marked:

```text
TBD / FHA CONFIRMATION REQUIRED
```

The AI agent must not treat proposed fields as official FHA requirements until they are confirmed.

---

# 2. CORE DATA MODEL

The MVP revolves around these major entities:

```text
Estate
   │
   └── Block
          │
          └── Plot
                 │
                 ├── Property Interest / Allottee
                 │
                 ├── Application
                 │       │
                 │       └── Approval
                 │              │
                 │              └── Documents
                 │
                 └── Inspections
                        │
                        ├── GPS
                        ├── Photos
                        └── Findings
```

Additional system entities:

```text
User
Role
Audit Log
GIS Dataset / Layer
```

---

# 3. DATA PRINCIPLES

The system should:

1. Give every major record a stable unique ID.
2. Keep human-readable identifiers separate from internal IDs.
3. Preserve relationships between records.
4. Separate official approval information from field observations.
5. Keep GIS geometry separate from descriptive property information.
6. Record timestamps for important events.
7. Avoid collecting information that FHA does not require.
8. Protect sensitive personal information.
9. Keep uncertain fields configurable.
10. Avoid hard-coding government terminology before FHA confirms it.

---

# 4. IDENTIFIERS

Each entity should have:

### Internal ID

System-generated unique identifier.

Example:

```text
plotId = UUID
```

### Human-readable identifier

Example:

```text
Plot Number: 003
```

These are not necessarily the same thing.

Do not use plot numbers as database primary keys.

---

# 5. ESTATE

## Purpose

Represents an FHA estate/development area.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal identifier |
| name | string | Yes | Estate name |
| code | string | TBD | FHA estate code if one exists |
| description | text | No | Optional description |
| boundary | geometry | TBD | Estate boundary |
| status | enum | TBD | FHA confirmation required |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

### Example

```text
Estate:
FHA Demo Estate
```

---

# 6. BLOCK

## Purpose

Represents a block or subdivision within an estate where applicable.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal identifier |
| estateId | UUID/string | Yes | Parent estate |
| name | string | Yes/TBD | Block name/number |
| code | string | TBD | Official code if applicable |
| boundary | geometry | TBD | Block geometry |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

---

# 7. PLOT

## Purpose

Represents the mapped property/plot.

This is one of the most important entities in the system.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal ID |
| estateId | UUID/string | Yes | Parent estate |
| blockId | UUID/string | TBD | Parent block |
| plotNumber | string | Yes | Human-readable plot identifier |
| plotCode | string | TBD | Official FHA identifier if available |
| areaSqm | decimal | TBD | Plot area |
| landUse | string/enum | TBD | Residential/commercial/etc. |
| geometry | polygon | TBD | Official plot boundary |
| centroid | point | TBD | Derived/map point |
| addressDescription | string | TBD | Human-readable location |
| status | enum | TBD | FHA-defined status |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

---

# 8. PLOT STATUS

Do not invent final FHA statuses.

Possible prototype examples:

```text
ACTIVE
INACTIVE
REVIEW_REQUIRED
```

These are placeholders only.

FHA must confirm official plot statuses.

---

# 9. PROPERTY INTEREST / ALLOTTEE

## Purpose

Represents the person/entity associated with the property.

The exact legal terminology must be confirmed by FHA.

Possible naming:

```text
Allottee
Property Holder
Applicant
Beneficiary
Property Interest
```

Do not assume these terms are legally interchangeable.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal ID |
| plotId | UUID/string | Yes | Related plot |
| name | string | TBD | Personal/entity name |
| referenceNumber | string | TBD | FHA reference if available |
| contactInformation | structured | TBD | Only if required |
| relationshipType | enum | TBD | FHA confirmation |
| startDate | date | TBD | If applicable |
| endDate | date | TBD | If applicable |
| status | enum | TBD | FHA confirmation |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

---

# 10. PERSONAL DATA RULE

Do not collect unnecessary personal information.

The prototype should use:

```text
Demo Allottee
```

or another synthetic identity unless FHA authorizes real records.

Do not use real people's information merely to make the prototype look realistic.

---

# 11. APPLICATION

## Purpose

Represents a development/application record submitted to FHA.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal ID |
| applicationNumber | string | TBD | Official reference |
| plotId | UUID/string | Yes/TBD | Related plot |
| applicantName | string | TBD | May reference property-interest record |
| applicationType | enum/string | TBD | FHA confirmation |
| submittedAt | datetime | TBD | Application submission |
| status | enum | TBD | FHA-defined status |
| description | text | TBD | Development description |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

---

# 12. APPLICATION TYPES

Do not assume the final list.

Potential examples for prototype discussion:

```text
NEW DEVELOPMENT
ALTERATION
AMENDMENT
RENEWAL
OTHER
```

These require FHA confirmation.

---

# 13. APPROVAL

## Purpose

Represents an official development approval record.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal ID |
| applicationId | UUID/string | TBD | Related application |
| plotId | UUID/string | Yes/TBD | Related plot |
| approvalNumber | string | TBD | Official approval reference |
| approvalDate | date | TBD | Date issued |
| status | enum | TBD | FHA-defined status |
| developmentType | string/enum | TBD | Approved use/type |
| numberOfFloors | integer | TBD | Approved floors |
| numberOfUnits | integer | TBD | Approved units |
| conditions | text | TBD | Approval conditions |
| expiryDate | date | TBD | If applicable |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

---

# 14. APPROVAL STATUS

Do not hard-code final values before FHA confirmation.

Prototype examples:

```text
PENDING
APPROVED
REJECTED
EXPIRED
CANCELLED
UNDER_REVIEW
```

The final vocabulary and meanings must come from FHA.

---

# 15. APPROVAL DOCUMENT

An approval may have one or more associated documents.

Possible documents:

```text
Approval Letter
Approved Building Plan
Conditions
Supporting Plan
Other Supporting Document
```

Exact document types require FHA confirmation.

---

# 16. DOCUMENT

## Purpose

Represents a stored digital file.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal ID |
| recordType | enum | Yes | Parent record type |
| recordId | UUID/string | Yes | Parent record ID |
| documentType | string/enum | TBD | FHA-defined |
| title | string | Yes | Display title |
| originalFilename | string | Yes | Original filename |
| mimeType | string | Yes | File type |
| sizeBytes | integer | Yes | File size |
| storageKey | string | Yes | Private storage reference |
| uploadedBy | UUID/string | Yes | User |
| uploadedAt | datetime | Yes | Upload timestamp |
| status | enum | TBD | Document state |
| checksum | string | TBD | Integrity verification |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

---

# 17. DOCUMENT SECURITY

The database should store a storage reference, not necessarily the file itself.

Sensitive files should be stored privately.

Do not put permanent public URLs into property records.

---

# 18. INSPECTION

## Purpose

Represents a site inspection performed by an authorized engineer/officer.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal ID |
| inspectionNumber | string | TBD | Human-readable reference |
| plotId | UUID/string | Yes | Inspected plot |
| engineerId | UUID/string | Yes | Inspecting user |
| inspectionType | enum/string | TBD | FHA confirmation |
| status | enum | Yes | Workflow status |
| startedAt | datetime | Yes | Start time |
| submittedAt | datetime | TBD | Submission time |
| notes | text | TBD | General observations |
| createdAt | datetime | Yes | System timestamp |
| updatedAt | datetime | Yes | System timestamp |

---

# 19. INSPECTION STATUS

Provisional MVP values:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
COMPLETED
```

FHA must confirm the actual workflow.

---

# 20. INSPECTION OBSERVATION

Observed information should be separate from official approval data.

Possible fields:

| Field | Type | Required |
|---|---|---:|
| constructionStage | string/enum | TBD |
| observedFloors | integer | TBD |
| observedUnits | integer | TBD |
| observedUse | string/enum | TBD |
| generalCondition | text | TBD |
| complianceObservation | text | TBD |

---

# 21. APPROVED VS OBSERVED DATA

Do not overwrite:

```text
approval.numberOfFloors
```

with:

```text
inspection.observedFloors
```

Instead:

```text
APPROVED
numberOfFloors = 2

OBSERVED
observedFloors = 3
```

This distinction is critical.

---

# 22. GPS RECORD

## Purpose

Stores location captured during inspection.

### Proposed fields

| Field | Type | Required | Notes |
|---|---|---:|---|
| id | UUID/string | Yes | Internal ID |
| inspectionId | UUID/string | Yes | Related inspection |
| latitude | decimal | Yes | Captured latitude |
| longitude | decimal | Yes | Captured longitude |
| accuracyMeters | decimal | TBD | Device accuracy |
| capturedAt | datetime | Yes | Capture time |
| source | enum | TBD | GPS/device source |

---

# 23. GPS VALIDATION

The system may calculate:

```text
Distance from captured GPS point
to selected plot geometry
```

This may produce:

```text
Within expected area
Near boundary
Outside expected area
```

These labels are **system observations**, not legal determinations.

Final thresholds require technical/FHA confirmation.

---

# 24. INSPECTION PHOTO

## Purpose

Stores a photo/evidence reference associated with an inspection.

### Proposed fields

| Field | Type | Required |
|---|---|---:|
| id | UUID/string | Yes |
| inspectionId | UUID/string | Yes |
| storageKey | string | Yes |
| filename | string | Yes |
| mimeType | string | Yes |
| sizeBytes | integer | Yes |
| caption | text | TBD |
| latitude | decimal | TBD |
| longitude | decimal | TBD |
| capturedAt | datetime | TBD |
| uploadedAt | datetime | Yes |
| uploadedBy | UUID/string | Yes |

---

# 25. FINDING

## Purpose

Represents a specific issue/observation recorded during an inspection.

### Proposed fields

| Field | Type | Required |
|---|---|---:|
| id | UUID/string | Yes |
| inspectionId | UUID/string | Yes |
| category | string/enum | TBD |
| title | string | TBD |
| description | text | Yes |
| severity | enum | TBD |
| status | enum | TBD |
| createdAt | datetime | Yes |
| updatedAt | datetime | Yes |

---

# 26. FINDING CATEGORIES

Potential prototype categories:

```text
DEVELOPMENT
SETBACK
FLOOR_COUNT
UNIT_COUNT
LAND_USE
DOCUMENTATION
LOCATION
OTHER
```

These are examples only.

FHA must provide official categories.

---

# 27. FINDING SEVERITY

Do not assume legal/enforcement meanings.

Possible prototype values:

```text
INFO
REVIEW_REQUIRED
HIGH_PRIORITY
```

FHA must define the official severity model.

---

# 28. GIS DATASET

## Purpose

Represents a source or managed GIS dataset.

### Proposed fields

| Field | Type | Required |
|---|---|---:|
| id | UUID/string | Yes |
| name | string | Yes |
| sourceType | string/enum | TBD |
| format | string | TBD |
| coordinateReferenceSystem | string | TBD |
| importedAt | datetime | TBD |
| importedBy | UUID/string | TBD |
| version | string | TBD |
| status | enum | TBD |

---

# 29. GIS LAYER

Potential layers:

```text
Estate Boundary
Blocks
Plots
Roads
Plot Labels
Inspection Locations
```

The final layers depend on FHA's available GIS data and requirements.

---

# 30. COORDINATE REFERENCE SYSTEM

The system must not assume a CRS for official FHA GIS data.

Before importing production GIS data, confirm:

```text
Coordinate Reference System
Datum
Projection
Units
Accuracy requirements
```

The prototype may use a known test CRS appropriate to the sample data.

---

# 31. USER

## Purpose

Represents an authenticated system user.

### Proposed fields

| Field | Type | Required |
|---|---|---:|
| id | UUID/string | Yes |
| staffIdentifier | string | TBD |
| name | string | Yes |
| email | string | TBD |
| department | string | TBD |
| status | enum | Yes |
| createdAt | datetime | Yes |
| updatedAt | datetime | Yes |
| lastLoginAt | datetime | TBD |

Do not store authentication passwords in this application database unless the chosen authentication architecture explicitly requires it.

---

# 32. ROLE

Possible roles:

```text
ENGINEER
APPROVAL_OFFICER
GIS_OFFICER
ADMIN
```

See `AUTHORIZATION_RBAC.md`.

These names remain provisional.

---

# 33. AUDIT LOG

## Purpose

Tracks important system activity.

### Proposed fields

| Field | Type | Required |
|---|---|---:|
| id | UUID/string | Yes |
| actorUserId | UUID/string | Yes |
| action | string | Yes |
| entityType | string | Yes |
| entityId | UUID/string | Yes |
| result | enum | Yes |
| timestamp | datetime | Yes |
| metadata | JSON | TBD |

Avoid putting passwords, tokens or unnecessary personal information into metadata.

---

# 34. RECORD RELATIONSHIPS

Recommended relationships:

```text
Estate 1 ──── * Block

Block 1 ──── * Plot

Plot 1 ──── * Application

Plot 1 ──── * Approval

Application 1 ──── * Approval

Plot 1 ──── * Inspection

Inspection 1 ──── * Photo

Inspection 1 ──── * Finding

Inspection 1 ──── * GPS Record

Any authorized record 1 ──── * Document
```

The exact cardinality must be adjusted if FHA confirms a different business model.

---

# 35. SEARCHABLE FIELDS

The MVP should support search using fields FHA confirms.

Likely candidates:

```text
Estate name
Block
Plot number
Application number
Approval number
Inspection number
```

Personal-name search should only be included if required and authorized.

---

# 36. MAP SEARCH DATA

Map endpoints should use a lightweight representation.

Example:

```text
plotId
estateId
blockId
plotNumber
geometry
approved/status summary where authorized
```

Do not return complete personal records for every visible map polygon.

---

# 37. DETAILS DATA

When a plot is opened, the application may retrieve:

```text
Plot
Property interest
Applications
Approvals
Documents
Inspections
```

Each related resource must still respect authorization.

---

# 38. REQUIRED VS OPTIONAL DATA

For the prototype, distinguish:

### Required for technical operation

```text
id
parent IDs
timestamps
plot number
```

### Required for demonstration

Fields needed to make the prototype understandable.

### FHA-dependent

Business fields whose necessity is not yet confirmed.

Do not make every proposed field mandatory.

---

# 39. NULL / UNKNOWN VALUES

Do not insert fake information merely to avoid nulls.

Use:

```text
null
```

or an explicit system state where appropriate.

Bad:

```text
approvalNumber = "N/A"
```

when the record simply has no known approval number.

---

# 40. ENUMS

Statuses and categories should be centralized.

Example:

```text
InspectionStatus
ApprovalStatus
FindingSeverity
DocumentStatus
```

Do not scatter strings throughout the application.

---

# 41. DATES AND TIMES

Store timestamps consistently.

Recommended:

```text
UTC in backend/storage
```

Display in the user's/application's appropriate local timezone.

For Nigeria-based FHA operations, display can use:

```text
Africa/Lagos
```

where appropriate.

---

# 42. NUMERIC PRECISION

Potential precision requirements:

### Plot area

Use decimal rather than floating-point text.

### GPS

Use sufficient decimal precision for coordinates.

### Distance

Store/compute in an explicit unit.

Never silently mix:

```text
meters
feet
kilometers
```

---

# 43. MONEY

If future modules contain financial values, store monetary amounts using fixed-precision numeric values and an explicit currency.

Do not use binary floating-point for official financial calculations.

This is outside the current MVP unless FHA requires it.

---

# 44. DOCUMENT VERSIONING

If approval documents can change, consider:

```text
Document
   ↓
Version 1
Version 2
Version 3
```

Do not silently replace an official document without preserving the required history.

Final versioning requirements must be confirmed.

---

# 45. APPROVAL HISTORY

If an approval can be amended, renewed or superseded, the model should preserve the relationship between records.

Possible conceptual model:

```text
Original Approval
       ↓
Amended Approval
       ↓
Current Approval
```

Do not overwrite historical approvals if FHA requires historical preservation.

---

# 46. INSPECTION HISTORY

Multiple inspections should be allowed for the same plot.

Example:

```text
Plot 003
 ├── Inspection 001
 ├── Inspection 002
 └── Inspection 003
```

Do not assume one inspection per plot.

---

# 47. PROPERTY HISTORY

The system should be capable of representing changes over time.

Potentially:

```text
Plot
 ↓
Property interest history
 ↓
Application history
 ↓
Approval history
 ↓
Inspection history
```

The exact historical model requires FHA confirmation.

---

# 48. DATA IMPORT

Potential import sources may include:

```text
CSV
Excel
GIS
GeoJSON
Shapefile
KML/KMZ
AutoCAD/DWG
```

Not every format should be implemented in the MVP.

The first prototype should use the format FHA can actually provide.

---

# 49. DATA VALIDATION

Before importing official GIS/property data, validate:

- Unique plot identifiers
- Missing plot numbers
- Duplicate plot numbers
- Invalid geometry
- Invalid coordinates
- Geometry overlaps
- Missing estate/block relationships
- Unsupported CRS
- Invalid dates

---

# 50. DEMO DATASET

The prototype should ideally contain:

```text
1 Estate
2–5 Blocks
10–20 Plots
Several approval scenarios
Several sample documents
2–5 sample inspections
Sample GPS records
Sample photographs
Sample findings
```

Exact quantity can be reduced if the engineer provides a smaller sample area.

---

# 51. DEMO RECORD EXAMPLE

Example synthetic record:

```text
Estate:
FHA Demo Estate

Block:
Block A

Plot:
003

Plot Size:
650 sqm

Development:
Residential

Approval:
FHA/DEV/2024/1056

Approved Floors:
2

Approved Units:
4

Inspection:
INS-000012

Observed Floors:
3

Observed Units:
6

Finding:
Potential Difference
```

This is fictional demonstration data and must not be represented as an actual FHA record.

---

# 52. SENSITIVE DATA CLASSIFICATION

The following may require restricted access:

```text
Personal information
Approval documents
Inspection photographs
GPS coordinates
Internal notes
Audit logs
Staff information
Raw GIS datasets
```

Final classification must be supplied by FHA.

---

# 53. DATA MINIMIZATION

If the UI only needs:

```text
Plot Number
Status
Approval Number
```

the map endpoint should not return:

```text
Owner address
phone number
personal identifiers
complete documents
inspection history
```

unless required.

---

# 54. SOURCE OF TRUTH

The final system must identify which record is authoritative for each field.

Example:

```text
Approved floor count
→ Approval record

Observed floor count
→ Inspection record

Plot geometry
→ Authorized GIS/cadastral source
```

Do not create conflicting duplicate values without identifying their source.

---

# 55. DATA OWNERSHIP

FHA must determine:

- Who owns each dataset
- Who can modify it
- Who can approve changes
- Who can export it
- Who can archive it

The AI agent must not invent these governance rules.

---

# 56. DATA QUALITY FLAGS

The system may eventually support:

```text
Verified
Unverified
Needs Review
Incomplete
Conflicting
```

These are proposed concepts only.

FHA must confirm whether such flags are useful.

---

# 57. MVP DATA PRIORITY

For the first prototype, prioritize:

### Tier 1

```text
Estate
Block
Plot
Plot geometry
Approval
Approval status
Approval number
Document
Inspection
GPS
Photo
Finding
User
```

### Tier 2

```text
Application
Property interest
Approval history
Inspection history
GIS dataset metadata
```

### Tier 3

Potential future modules:

```text
Payments
Land allocation workflow
Enforcement
Public verification
Notifications
Advanced reporting
```

Do not implement Tier 3 unless FHA expands the MVP.

---

# 58. FHA QUESTIONS ARISING FROM THE DATA MODEL

The engineer/team should eventually confirm:

1. What is the official identifier for a plot?
2. Is there an official estate/block/plot hierarchy?
3. What is the official term for the person/entity associated with a plot?
4. What fields identify a development application?
5. What fields identify an approval?
6. Can one plot have multiple approvals?
7. Can an approval be amended or renewed?
8. What approval statuses exist?
9. What documents are authoritative?
10. What information must an inspection capture?
11. Is GPS required?
12. Are inspection photographs mandatory?
13. What finding categories exist?
14. How many inspections can a plot have?
15. What GIS data does FHA currently maintain?
16. What coordinate reference system is used?
17. Which fields are confidential?
18. Which records can engineers edit?
19. Which records are read-only?
20. What information may be exported?

---

# 59. AI AGENT DATA RULES

The AI coding agent must:

1. Use stable internal IDs.
2. Keep human-readable IDs separate.
3. Keep official approval data separate from observations.
4. Never invent official status values as final requirements.
5. Treat `TBD` fields as optional/configurable.
6. Validate all foreign-key relationships.
7. Protect personal data.
8. Protect document references.
9. Store GPS with explicit precision and units.
10. Preserve timestamps.
11. Avoid unnecessary duplicate data.
12. Keep GIS geometry in spatially appropriate fields.
13. Never use fake real-world records in production.
14. Label prototype records as demo data.
15. Keep data migrations reversible where practical.

---

# 60. FINAL DATA RELATIONSHIP

The MVP should make this chain possible:

```text
ESTATE
   ↓
BLOCK
   ↓
PLOT
   ↓
APPLICATION
   ↓
APPROVAL
   ↓
DOCUMENTS

PLOT
   ↓
INSPECTION
   ├── GPS
   ├── PHOTOS
   └── FINDINGS
```

This relationship is the foundation of the prototype.

---

# 61. FINAL PRINCIPLE

The system should answer four fundamental questions:

```text
1. WHERE IS THE PROPERTY?
        → GIS / Plot

2. WHAT PROPERTY IS IT?
        → Plot / Property Record

3. WHAT WAS APPROVED?
        → Application / Approval / Documents

4. WHAT WAS OBSERVED?
        → Inspection / GPS / Photos / Findings
```

The data model should keep these concepts connected without confusing one with another.

---

**END OF DATA_DICTIONARY.md**
