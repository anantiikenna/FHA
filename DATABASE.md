# DATABASE.md
# FHA Development Approval & Property Mapping System
## MVP Database Specification

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Architecture Reference:** `ARCHITECTURE.md`  
**AI Engineering Instructions:** `AGENTS.md`

---

# 1. PURPOSE

This document defines the proposed database model for the FHA Development Approval & Property Mapping System MVP.

The database must support the core relationship:

```text
Estate
  ↓
Block
  ↓
Plot
  ↓
Property / Interest
  ↓
Application
  ↓
Approval
  ↓
Documents
  ↓
Inspection
  ↓
Photos / Findings
  ↓
Audit History
```

This is a proposed technical model for the prototype.

It is **not an official FHA database specification**. FHA must confirm the meaning, names, identifiers, statuses and required fields before production implementation.

---

# 2. DATABASE DESIGN PRINCIPLES

The database should be:

- Relational
- Consistent
- Traceable
- Secure
- GIS-capable
- Extensible
- Suitable for historical records
- Designed to prevent accidental data duplication
- Designed to distinguish official records from demo records

Important business information should have stable internal identifiers.

---

# 3. RECOMMENDED DATABASE TECHNOLOGY

For a production GIS-capable implementation, prefer a relational database with strong spatial support.

### Recommended direction

```text
PostgreSQL
     +
PostGIS
```

PostGIS is particularly suitable because the application needs to associate:

- Estates
- Blocks
- Plot polygons
- Coordinates
- Inspection locations

with normal relational records.

However, the final database technology must be confirmed against FHA's existing infrastructure.

---

# 4. ENTITY OVERVIEW

Core MVP entities:

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

Optional/reference entities may be added later.

---

# 5. ENTITY RELATIONSHIP

Conceptually:

```text
USERS
  │
  ├──────────────┐
  │              │
  ▼              ▼
INSPECTIONS    AUDIT_LOGS
  │
  ├──< INSPECTION_PHOTOS
  │
  └──< INSPECTION_FINDINGS


ESTATE
  │
  └──< BLOCK
          │
          └──< PLOT
                  │
                  ├──< PROPERTY_INTEREST
                  │
                  ├──< APPLICATION
                  │       │
                  │       └──< APPROVAL
                  │
                  ├──< DOCUMENT
                  │
                  └──< INSPECTION
```

---

# 6. COMMON COLUMN CONVENTIONS

Unless the project's existing database conventions require otherwise, use:

```text
id
created_at
updated_at
```

for major entities.

Use UTC timestamps at the database/application layer.

Where useful:

```text
created_by
updated_by
```

should reference the user responsible for the action.

Do not use display names as database relationships.

---

# 7. USERS TABLE

## Purpose

Stores authorized application users.

### Proposed structure

```text
users
-----
id
email
display_name
role
is_active
created_at
updated_at
```

### Notes

The actual authentication provider may manage credentials separately.

Do not store passwords in the application database unless there is an explicit and secure reason to do so.

### Proposed demo roles

```text
ADMIN
ENGINEER
APPROVAL_OFFICER
SUPERVISOR
GIS_OFFICER
```

These roles are illustrative and require FHA confirmation.

---

# 8. ESTATES TABLE

## Purpose

Represents an FHA estate or geographic development area.

### Proposed structure

```text
estates
-------
id
name
phase
state
description
boundary_geometry
is_demo
created_at
updated_at
```

### GIS

`boundary_geometry` should use an appropriate spatial type.

Example concept:

```text
MULTIPOLYGON
```

The exact geometry type depends on the official data.

### Important

Do not assume the estate boundary stored in the prototype is legally authoritative.

---

# 9. BLOCKS TABLE

## Purpose

Represents blocks/sections within an estate.

### Proposed structure

```text
blocks
------
id
estate_id
block_number
name
geometry
is_demo
created_at
updated_at
```

### Relationship

```text
estate_id → estates.id
```

### Constraint

A block should normally belong to exactly one estate.

The uniqueness rule must be confirmed if FHA uses another identification system.

---

# 10. PLOTS TABLE

## Purpose

The plot is one of the most important entities in the entire system.

It connects GIS information to property, approval and inspection information.

### Proposed structure

```text
plots
-----
id
estate_id
block_id
plot_number
plot_reference
plot_size
plot_size_unit
street
land_use
latitude
longitude
geometry
status
is_demo
created_at
updated_at
```

### Important fields

#### `id`

Internal immutable identifier.

#### `plot_number`

Human-readable plot number.

#### `plot_reference`

Optional official FHA reference.

#### `plot_size`

Recorded area.

#### `geometry`

Official or demo plot polygon.

#### `latitude / longitude`

Can represent a representative point/centroid where appropriate.

Do not assume these are survey-grade coordinates.

---

# 11.1 PLOT GEOMETRY

The GIS relationship should be:

```text
plots.id
   ↓
plot geometry
   ↓
map feature
```

The plot polygon must be stored independently from its display label.

Example conceptual record:

```text
id:
UUID

plot_number:
003

geometry:
POLYGON(...)
```

Do not encode business data inside geometry coordinates.

---

# 11.2 PLOT SPATIAL INDEX

For production-scale GIS data, use an appropriate spatial index on plot geometry.

Conceptually:

```text
GIST INDEX → plots.geometry
```

The exact database index syntax should be implemented according to the chosen PostgreSQL/PostGIS version.

---

# 12. PROPERTY INTERESTS TABLE

## Purpose

Represents the person, company or other party associated with the property according to the applicable FHA record.

The term **property interest** is intentionally broader than assuming legal ownership.

### Proposed structure

```text
property_interests
------------------
id
plot_id
name
organization_name
interest_type
allocation_number
allocation_date
contact_information
is_current
created_at
updated_at
```

### Important

Do not automatically label a person as the legal owner unless FHA's records and terminology establish that.

Possible `interest_type` values might include:

```text
ALLOTTEE
ORGANIZATION
OTHER
```

Final values require FHA confirmation.

---

# 13. APPLICATIONS TABLE

## Purpose

Represents an application related to development or another FHA process.

### Proposed structure

```text
applications
------------
id
plot_id
application_number
application_type
submission_date
status
description
created_by
created_at
updated_at
```

### Relationship

```text
applications.plot_id → plots.id
```

A plot may have multiple applications over time.

Do not assume there can only ever be one application per plot.

---

# 14. APPROVALS TABLE

## Purpose

Stores development approval information associated with an application/plot.

### Proposed structure

```text
approvals
---------
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
parking_requirement
conditions
created_at
updated_at
```

---

# 14.1 APPROVAL VALUES

Approved development information should be stored separately from observed inspection information.

Example:

```text
approved_floors = 2
approved_units = 4
```

During inspection:

```text
observed_floors = 3
observed_units = 6
```

Never overwrite the approval record with inspection observations.

---

# 14.2 APPROVAL STATUS

Possible demo values:

```text
PENDING
APPROVED
REJECTED
EXPIRED
CANCELLED
```

These are examples only.

The final approval lifecycle must be defined by FHA.

Use a centralized enum/configuration instead of scattering status strings throughout the application.

---

# 15. INSPECTIONS TABLE

## Purpose

Stores engineering/site inspection records.

### Proposed structure

```text
inspections
-----------
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
observed_building_use
compliance_status
observations
recommendations
status
submitted_at
created_at
updated_at
```

---

# 15.1 INSPECTION RELATIONSHIPS

```text
plot_id
   ↓
plots.id
```

and optionally:

```text
approval_id
   ↓
approvals.id
```

The approval relationship allows the inspection to identify which approved development record was being compared.

---

# 15.2 INSPECTION GPS

Store:

```text
latitude
longitude
gps_accuracy
```

Potentially also:

```text
location_captured_at
```

if required.

GPS should be treated as field evidence, not a replacement for official survey data.

---

# 15.3 INSPECTION STATUS

Possible demo values:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
COMPLETED
```

Potential future statuses:

```text
REQUIRES_ACTION
FOLLOW_UP_REQUIRED
CLOSED
```

Final values must be confirmed by FHA.

---

# 16. INSPECTION PHOTOS TABLE

## Purpose

Links photographs to inspection records.

### Proposed structure

```text
inspection_photos
-----------------
id
inspection_id
storage_key
file_name
mime_type
file_size
caption
latitude
longitude
captured_at
uploaded_by
created_at
```

### Relationship

```text
inspection_id → inspections.id
```

The actual image file should be stored in secure file/object storage, not directly in the relational database unless there is a specific requirement.

---

# 17. INSPECTION FINDINGS TABLE

## Purpose

Allows individual findings/issues to be recorded separately from the general inspection narrative.

### Proposed structure

```text
inspection_findings
-------------------
id
inspection_id
category
title
description
severity
recommendation
status
created_at
updated_at
```

### Example

```text
category:
DEVELOPMENT

title:
Number of floors differs

description:
Approved: 2
Observed: 3

severity:
REVIEW_REQUIRED

recommendation:
Refer to appropriate FHA review process.
```

Do not use legal terminology unless FHA provides the approved terminology.

---

# 18. DOCUMENTS TABLE

## Purpose

Stores metadata for approval, allocation, property and inspection documents.

### Proposed structure

```text
documents
---------
id
plot_id
application_id
approval_id
inspection_id
document_type
file_name
storage_key
mime_type
file_size
description
uploaded_by
created_at
updated_at
```

A document should normally be associated with the appropriate parent record.

---

# 18.1 DOCUMENT OWNERSHIP

A document may relate to:

```text
Plot
Application
Approval
Inspection
```

The exact relationship design can be adjusted if the production system requires a more flexible document-association model.

Do not create unrestricted document records that have no clear parent or authorization context.

---

# 18.2 DOCUMENT TYPES

Possible demo types:

```text
ALLOCATION_LETTER
APPROVAL_LETTER
BUILDING_PLAN
SITE_PLAN
INSPECTION_REPORT
OTHER
```

These are examples only.

FHA must confirm official document classifications.

---

# 19. AUDIT LOGS TABLE

## Purpose

Records important actions for traceability.

### Proposed structure

```text
audit_logs
----------
id
user_id
action
entity_type
entity_id
metadata
ip_address
user_agent
created_at
```

### Example actions

```text
LOGIN
VIEW_PLOT
VIEW_APPROVAL
VIEW_DOCUMENT
CREATE_INSPECTION
UPDATE_INSPECTION
SUBMIT_INSPECTION
```

Do not log sensitive information unnecessarily.

---

# 20. FOREIGN KEY RELATIONSHIPS

Recommended relationships:

```text
blocks.estate_id
    → estates.id

plots.estate_id
    → estates.id

plots.block_id
    → blocks.id

property_interests.plot_id
    → plots.id

applications.plot_id
    → plots.id

approvals.plot_id
    → plots.id

approvals.application_id
    → applications.id

inspections.plot_id
    → plots.id

inspections.approval_id
    → approvals.id

inspections.inspector_id
    → users.id

inspection_photos.inspection_id
    → inspections.id

inspection_photos.uploaded_by
    → users.id

inspection_findings.inspection_id
    → inspections.id

documents.plot_id
    → plots.id

documents.application_id
    → applications.id

documents.approval_id
    → approvals.id

documents.inspection_id
    → inspections.id

audit_logs.user_id
    → users.id
```

---

# 21. DELETE STRATEGY

Do not casually hard-delete important government/property records.

Prefer controlled lifecycle states or soft deletion where appropriate.

For example:

```text
is_archived
archived_at
archived_by
```

However, retention/deletion rules must be determined by FHA.

Do not invent legal retention periods.

---

# 22. HISTORICAL DATA

Property and approval records may change over time.

The database should avoid destroying historical context.

Examples:

```text
Old approval
     ↓
New amendment/application
     ↓
New approval
```

and:

```text
Inspection 1
Inspection 2
Inspection 3
```

All should remain historically traceable.

Do not simply update one row repeatedly if doing so would destroy information required to understand past events.

---

# 23. APPROVAL AMENDMENTS

Future development may require approval amendments/revisions.

The MVP may initially represent these through multiple application/approval records.

Production may later introduce explicit entities such as:

```text
approval_versions
approval_amendments
```

Do not build complex versioning unless FHA confirms the need.

---

# 24. PLOT STATUS VS APPROVAL STATUS

Do not mix these concepts.

Example:

### Plot status

Describes the property/record state.

### Approval status

Describes the development approval state.

### Inspection status

Describes the inspection workflow state.

They should remain separate.

---

# 25. DEMO DATA FLAG

All prototype records should have a reliable way to distinguish demo data.

Recommended:

```text
is_demo
```

or a separate demo environment/database.

Production should preferably use completely separate environments rather than relying only on a flag.

---

# 26. SAMPLE DEMO RECORDS

Use fictional records such as:

```text
Estate:
FHA Festac Estate

Block:
A

Plot:
003

Plot Size:
650 sqm

Approval:
FHA/DEV/2024/1056

Development:
4 Units Townhouse

Approved Floors:
2

Approved Units:
4
```

These values are fictional and must remain labelled as demo data.

---

# 27. SAMPLE INSPECTION

```text
Inspection:
FHA/INSP/2025/0210

Plot:
003

Approved Floors:
2

Observed Floors:
3

Approved Units:
4

Observed Units:
6

Result:
POTENTIAL DISCREPANCY
```

The result is a system comparison result, not an official legal determination.

---

# 28. CONSTRAINTS

Implement database constraints where they represent stable technical rules.

Examples:

- Required IDs cannot be null.
- Foreign keys must reference valid records.
- Coordinates must be valid ranges.
- Numeric values cannot be invalid.
- File size cannot be negative.
- Status values should be restricted to configured values.

Avoid creating constraints for assumptions that FHA has not confirmed.

---

# 29. COORDINATE VALIDATION

For latitude/longitude:

```text
Latitude:
-90 to +90

Longitude:
-180 to +180
```

These are technical geographic limits.

Do not infer the correct coordinate reference system for FHA's official GIS data until the GIS data specification is confirmed.

---

# 30. SPATIAL REFERENCE SYSTEM

The production GIS database must use the coordinate reference system appropriate to the authoritative FHA spatial data.

Do not arbitrarily convert official survey data without documenting the transformation.

For demo data, use a documented standard geographic/projected CRS appropriate to the map implementation.

The final production CRS must be confirmed during GIS integration.

---

# 31. DATABASE ACCESS

Do not expose the database directly to the public browser.

Preferred:

```text
Frontend
   ↓
Authorized Server/API
   ↓
Database
```

Database credentials must remain server-side.

---

# 32. ROW-LEVEL ACCESS

If the selected database/authentication architecture supports row-level security, consider using it for sensitive property records.

However, application-level authorization must still be designed correctly.

Do not assume frontend role checks are sufficient.

---

# 33. TRANSACTIONS

Use transactions for multi-record operations where partial completion would create inconsistent records.

Example:

```text
Submit Inspection
      ↓
Validate
      ↓
Update inspection status
      ↓
Save findings
      ↓
Create audit event
      ↓
Commit
```

If the operation fails, avoid leaving the inspection in an ambiguous state.

---

# 34. INDEXING

Important indexes may include:

```text
plots.plot_number
plots.plot_reference
plots.block_id
plots.estate_id

applications.application_number

approvals.approval_number
approvals.plot_id

inspections.inspection_number
inspections.plot_id
inspections.inspector_id

audit_logs.entity_type
audit_logs.entity_id
audit_logs.user_id
```

GIS:

```text
plots.geometry
```

with an appropriate spatial index.

Do not add indexes indiscriminately; review query patterns as the application develops.

---

# 35. SEARCH REQUIREMENTS

MVP searches should support:

```text
Plot Number
Block
Estate
Application Number
Approval Number
```

Future:

```text
Allottee/Interest
File Number
Street
```

All searches must respect user authorization.

---

# 36. DATA INTEGRITY RULES

The following must always remain true:

### Rule 1

A plot belongs to an estate.

### Rule 2

A block belongs to an estate.

### Rule 3

A plot may have multiple historical applications.

### Rule 4

An application may have an associated approval.

### Rule 5

An inspection belongs to a plot.

### Rule 6

An inspection must preserve observed values independently from approved values.

### Rule 7

Inspection photos belong to an inspection.

### Rule 8

Important user actions can be audited.

### Rule 9

Documents must have controlled access.

### Rule 10

Demo data must not be confused with official FHA data.

---

# 37. DATA VALIDATION LAYER

Database constraints are not a replacement for application validation.

Use multiple layers:

```text
UI validation
      ↓
Server validation
      ↓
Business validation
      ↓
Database constraints
```

This reduces invalid data and improves security.

---

# 38. SEEDING

Create a repeatable seed process for the prototype.

The seed should create:

```text
1 Estate
3 Blocks
20+ Plots
Several Applications
Several Approvals
Several Inspections
Several Findings
Sample Document Metadata
Sample Photos where practical
Demo Users
```

The exact number can be smaller for initial development.

---

# 39. RESETTING DEMO DATA

Provide a safe development-only method to:

```text
Clear demo records
      ↓
Recreate demo records
      ↓
Recreate relationships
```

Never provide a publicly accessible reset endpoint.

---

# 40. DATA MIGRATION

When FHA later provides official data:

```text
Source Data
    ↓
Mapping / Transformation
    ↓
Validation
    ↓
Duplicate Detection
    ↓
GIS Matching
    ↓
Import
    ↓
Verification
```

Do not directly import raw FHA data into production without validation.

---

# 41. GIS DATA IMPORT

Official GIS data may arrive as:

```text
Shapefile
GeoJSON
KML/KMZ
GeoPackage
CAD/DWG
PostGIS
Survey data
```

A dedicated GIS import process should:

1. Validate geometry.
2. Validate coordinate system.
3. Validate plot identifiers.
4. Detect duplicates.
5. Match plots to property records.
6. Report unmatched records.
7. Preserve source metadata.
8. Require review before production publication.

---

# 42. DATA QUALITY FLAGS

The production system should eventually support data-quality indicators such as:

```text
GIS_MATCHED
GIS_UNMATCHED
MISSING_APPROVAL
MISSING_DOCUMENT
DUPLICATE_REFERENCE
REQUIRES_REVIEW
```

These are system/data-quality indicators and should not be confused with legal statuses.

---

# 43. PRIVACY

Sensitive fields may include:

- Names
- Contact information
- Documents
- Inspection photos
- Internal notes

The database and application must implement least-privilege access.

Do not expose all property information to every user automatically.

---

# 44. DATABASE BACKUPS

Production must eventually have:

- Automated backups
- Backup verification
- Recovery testing
- Retention policy
- Disaster recovery procedure

The exact retention period must be defined by FHA.

---

# 45. DATABASE PERFORMANCE

Avoid fetching unnecessary data.

For the map:

```text
Map request
   ↓
Plot geometry + minimum display fields
```

When a user selects a plot:

```text
Plot details request
   ↓
Full authorized property information
```

Do not load every document, photo and historical inspection for every plot displayed on the map.

---

# 46. SECURITY REQUIREMENTS

The database layer must protect against:

- SQL injection
- Unauthorized access
- Privilege escalation
- Accidental deletion
- Insecure direct object references
- Sensitive-data leakage

Use parameterized queries/ORM mechanisms appropriately.

Never concatenate untrusted user input into SQL.

---

# 47. DATABASE MIGRATIONS

Schema changes must be version controlled through database migrations.

Do not manually change production schema without recording the migration.

Migration process:

```text
Code change
    ↓
Migration
    ↓
Development
    ↓
Testing
    ↓
Staging
    ↓
Production
```

---

# 48. WHAT NOT TO HARD-CODE

Do not hard-code:

- FHA approval rules
- Official approval statuses
- Official plot numbering rules
- Legal ownership assumptions
- Official GIS boundaries
- Government organization hierarchy
- Data retention periods
- Enforcement rules

Use configuration or database reference tables when appropriate.

---

# 49. FUTURE DATABASE ENTITIES

Potential future entities:

```text
approval_amendments
approval_conditions
development_types
land_use_types
inspection_types
inspection_checklists
enforcement_actions
notifications
work_orders
maintenance_records
gis_layers
gis_import_jobs
data_quality_issues
organizations
departments
```

Do not implement these simply because they are listed here.

Only add them when the product requirements justify them.

---

# 50. MVP DATABASE ACCEPTANCE CHECKLIST

- [ ] Users can be identified
- [ ] Estates can be stored
- [ ] Blocks can be linked to estates
- [ ] Plots can be linked to blocks/estates
- [ ] Plot geometry can be stored
- [ ] Property interests can be associated with plots
- [ ] Applications can be associated with plots
- [ ] Approvals can be associated with applications/plots
- [ ] Approval data is separate from inspection observations
- [ ] Inspections can be associated with plots
- [ ] Inspections can reference approvals
- [ ] GPS data can be stored
- [ ] Inspection photos can be associated
- [ ] Inspection findings can be stored
- [ ] Documents can be associated
- [ ] Audit events can be recorded
- [ ] Demo data can be identified/separated
- [ ] Search fields are indexed appropriately
- [ ] Spatial data has appropriate indexing
- [ ] Sensitive records are not directly exposed
- [ ] Database migrations are version controlled

---

# 51. FINAL DATABASE MODEL

The MVP should establish this reliable chain:

```text
ESTATE
  │
  └── BLOCK
       │
       └── PLOT
            │
            ├── PROPERTY INTEREST
            │
            ├── APPLICATION
            │      │
            │      └── APPROVAL
            │             │
            │             └── DOCUMENTS
            │
            └── INSPECTION
                   │
                   ├── GPS
                   ├── PHOTOS
                   ├── FINDINGS
                   └── AUDIT
```

This structure is the foundation for the map-based property verification and inspection workflow.

The schema must remain flexible until FHA Engineering/Development Control and FHA IT confirm the actual data structure, identifiers, terminology and integration requirements.

---

**END OF DATABASE.md**
