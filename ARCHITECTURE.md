# ARCHITECTURE.md
# FHA Development Approval & Property Mapping System
## MVP Technical Architecture

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**AI Engineering Instructions:** `AGENTS.md`

---

## 1. PURPOSE

This document defines the proposed technical architecture for the FHA Development Approval & Property Mapping System MVP.

The architecture is designed around the core requirement:

> Allow an authorized FHA engineer/officer to locate a property on a GIS map, identify its plot, view associated property and development approval information, access relevant documents, conduct/record an inspection, and maintain inspection history.

This is a technical proposal for the prototype.

It is **not an official FHA IT architecture** and must be adjusted when FHA confirms its existing infrastructure, GIS standards, security requirements, integrations and deployment environment.

---

# 2. ARCHITECTURAL OBJECTIVES

The system should be:

- Secure
- Maintainable
- Modular
- GIS-aware
- Mobile/field friendly
- Auditable
- Responsive
- Easy to demonstrate
- Easy to expand after FHA requirements are validated

The MVP should avoid unnecessary enterprise complexity while keeping the core data model suitable for future production development.

---

# 3. HIGH-LEVEL ARCHITECTURE

Recommended conceptual architecture:

```text
                         USERS
                           │
              ┌────────────┴────────────┐
              │                         │
          Desktop/Web              Mobile/Tablet
              │                         │
              └────────────┬────────────┘
                           │
                           ▼
                  APPLICATION FRONTEND
                           │
                           ▼
                 SERVER / APPLICATION API
                           │
        ┌──────────────────┼──────────────────┐
        │                  │                  │
        ▼                  ▼                  ▼
   Property Domain    Approval Domain    Inspection Domain
        │                  │                  │
        └──────────────────┼──────────────────┘
                           │
             ┌─────────────┼─────────────┐
             │             │             │
             ▼             ▼             ▼
        GIS / Spatial   Database      File Storage
           Service
             │             │             │
             └─────────────┼─────────────┘
                           │
                           ▼
                     Audit / Logs
```

---

# 4. MAJOR COMPONENTS

The MVP consists of these major components:

1. Frontend application
2. Authentication
3. Application/server layer
4. Property management domain
5. Approval domain
6. Inspection domain
7. GIS/map layer
8. Relational database
9. Document/file storage
10. Audit logging
11. Optional notification layer
12. Deployment/infrastructure

---

# 5. FRONTEND ARCHITECTURE

The frontend is responsible for:

- User interface
- Navigation
- Map interaction
- Forms
- Search
- Property display
- Approval display
- Inspection entry
- Photo capture/upload
- User feedback

The frontend must not be trusted with security decisions.

---

## 5.1 Recommended UI Structure

```text
Application Shell
│
├── Authentication
│
├── Dashboard
│
├── Estate Map
│
├── Plot Search
│
├── Plot Details
│   ├── Property
│   ├── Allocation/Interest
│   ├── Development
│   ├── Approval
│   ├── Documents
│   └── Inspections
│
├── Approval Verification
│
└── Inspections
    ├── Inspection List
    ├── New Inspection
    └── Inspection Details
```

---

# 6. FRONTEND PRINCIPLES

### Server-side security

Sensitive operations must be performed through protected server operations.

### Reusable components

Build reusable components for:

- Status badges
- Data cards
- Tables
- Search controls
- Map panels
- Document lists
- Photo galleries
- Inspection fields
- Comparison displays

### Business logic separation

Do not place important business rules directly inside visual components.

---

# 7. APPLICATION SERVER

The server/application layer coordinates:

- Authentication
- Authorization
- Database access
- GIS data retrieval
- Approval retrieval
- Inspection creation
- Document authorization
- File operations
- Comparison logic
- Audit logging

Conceptually:

```text
Frontend
   ↓
Server/Application Layer
   ↓
Domain Services
   ↓
Data Access Layer
   ↓
Database / GIS / Storage
```

---

# 8. DOMAIN MODULES

Organize the backend by business domains.

## Property Domain

Responsible for:

- Estates
- Blocks
- Plots
- Property records
- Allottee/interest information

## Approval Domain

Responsible for:

- Applications
- Approvals
- Approval status
- Development parameters
- Approval documents

## Inspection Domain

Responsible for:

- Inspection records
- GPS
- Observations
- Photos
- Comparison
- Findings
- Recommendations
- Inspection history

## Document Domain

Responsible for:

- Document metadata
- Secure access
- Upload
- Download/view authorization

## Audit Domain

Responsible for:

- Important user actions
- Record changes
- Submission events

---

# 9. RECOMMENDED PROJECT ORGANIZATION

The exact folders should adapt to the existing repository.

A conceptual structure:

```text
src/
├── app/
│   ├── (auth)/
│   ├── dashboard/
│   ├── map/
│   ├── plots/
│   ├── approvals/
│   └── inspections/
│
├── components/
│   ├── ui/
│   ├── map/
│   ├── property/
│   ├── approval/
│   └── inspection/
│
├── server/
│   ├── auth/
│   ├── properties/
│   ├── approvals/
│   ├── inspections/
│   ├── documents/
│   └── audit/
│
├── lib/
│   ├── db/
│   ├── gis/
│   ├── storage/
│   ├── validation/
│   └── security/
│
├── types/
└── config/
```

This is conceptual and must be adapted to the actual framework.

---

# 10. DATA FLOW

## 10.1 Map → Plot

```text
User opens map
      ↓
Frontend requests map/plot data
      ↓
Server authorizes request
      ↓
GIS/database queried
      ↓
Plot geometry + metadata returned
      ↓
Map renders plot
      ↓
User selects plot
      ↓
Plot ID sent to server
      ↓
Property record retrieved
```

---

# 11. PROPERTY DATA FLOW

```text
Plot Selection
      ↓
Stable Plot ID
      ↓
Property Service
      ↓
Plot Record
      ↓
Related Allocation/Interest
      ↓
Related Development
      ↓
Related Approval
      ↓
Related Documents
      ↓
Related Inspection History
```

---

# 12. APPROVAL DATA FLOW

```text
Search
  ↓
Approval/Application/Plot identifier
  ↓
Server validation
  ↓
Authorization
  ↓
Approval Service
  ↓
Database
  ↓
Approval Record
  ↓
Related Plot
  ↓
Related Documents
```

The result must distinguish database information from any official legal determination.

---

# 13. INSPECTION DATA FLOW

```text
Plot Details
      ↓
Start Inspection
      ↓
Load approved information
      ↓
Capture GPS
      ↓
Enter observations
      ↓
Capture/upload photos
      ↓
Comparison Service
      ↓
Potential discrepancies
      ↓
Engineer observations
      ↓
Recommendation
      ↓
Save Draft
      ↓
Submit
      ↓
Inspection History
      ↓
Audit Event
```

---

# 14. GIS ARCHITECTURE

GIS should be treated as a first-class system component.

The map must connect spatial features to property records.

Core relationship:

```text
Estate
  ↓
Block
  ↓
Plot Polygon
  ↓
Stable Plot Identifier
  ↓
Property Record
```

The spatial layer must not become a separate disconnected map.

---

# 15. GIS RESPONSIBILITIES

The GIS component should provide:

- Map display
- Plot polygons
- Estate boundaries
- Block boundaries where available
- Plot labels
- Search/location
- Plot selection
- Highlighting
- Coordinate display
- Optional current GPS location

Advanced GIS analysis is outside MVP scope unless specifically requested.

---

# 16. GIS DATA SOURCE

Priority order:

1. Official FHA GIS data
2. Official FHA survey/spatial data that can be converted
3. FHA-approved third-party spatial data
4. Synthetic demo data for prototype only

Do not create unofficial boundaries and present them as FHA cadastral data.

---

# 17. DATABASE ARCHITECTURE

A relational database is recommended.

If production GIS functionality is required, use a database with mature spatial support.

Conceptually:

```text
Database
│
├── Estates
├── Blocks
├── Plots
├── Interests
├── Applications
├── Approvals
├── Inspections
├── Documents
├── Inspection Photos
├── Users
└── Audit Logs
```

Spatial columns should be used for relevant geographic entities.

---

# 18. CORE RELATIONSHIPS

```text
Estate
  │
  └──< Block
          │
          └──< Plot
                  │
                  ├──< Interest
                  ├──< Application
                  │       │
                  │       └──< Approval
                  │
                  ├──< Document
                  │
                  └──< Inspection
                           │
                           ├──< Inspection Photo
                           └──< Findings
```

The exact relationship between allocation, ownership/interest and FHA records must be confirmed by FHA.

---

# 19. IDENTIFIERS

Use internal immutable IDs, preferably UUIDs where appropriate.

Example:

```text
estate_id
block_id
plot_id
approval_id
inspection_id
document_id
user_id
```

Official FHA numbers remain separate fields.

Example:

```text
plot_id = internal UUID

plot_number = "003"

approval_number = "FHA/DEV/2024/1056"
```

Do not use human-readable numbers as the sole database primary key.

---

# 20. DOCUMENT STORAGE ARCHITECTURE

Keep document metadata in the database and binary files in secure object/file storage.

```text
Database
    │
    └── Document Metadata
              │
              └── storage_key
                       │
                       ▼
                Secure File Storage
```

Example logical paths:

```text
properties/{plotId}/documents/...
inspections/{inspectionId}/photos/...
```

Storage implementation can change without changing the domain model.

---

# 21. AUTHENTICATION

MVP authentication should support:

- Login
- Logout
- Session management
- User identity
- Role identification

Production may later require:

- MFA
- SSO
- Government identity integration
- Enterprise directory integration

Do not assume the final FHA authentication provider before FHA IT requirements are known.

---

# 22. AUTHORIZATION

Use role-based and, where necessary, record-level authorization.

Conceptual roles:

```text
Administrator
Engineer / Development Control Officer
Planning/Approval Officer
Supervisor
GIS Officer
```

These are proposed roles and must be confirmed by FHA.

Example:

```text
Can View Plot
Can View Approval
Can Create Inspection
Can Submit Inspection
Can Edit Approval
Can Manage Users
```

Permissions should be centralized rather than scattered through the UI.

---

# 23. INSPECTION COMPARISON SERVICE

Create a dedicated service for comparing approved and observed values.

Conceptually:

```text
Approved Record
      +
Inspection Observation
      ↓
Comparison Service
      ↓
Comparison Results
```

Example output:

```text
{
  item: "floors",
  approved: 2,
  observed: 3,
  result: "POTENTIAL_DISCREPANCY"
}
```

Do not embed legal conclusions in this service.

---

# 24. AUDIT ARCHITECTURE

Audit events should be generated for important actions.

Example:

```text
AuditEvent
├── id
├── user_id
├── action
├── entity_type
├── entity_id
├── timestamp
└── metadata
```

Examples:

```text
VIEW_PLOT
VIEW_APPROVAL
VIEW_DOCUMENT
CREATE_INSPECTION
UPDATE_INSPECTION
SUBMIT_INSPECTION
```

Production may require stronger tamper resistance and retention policies.

---

# 25. API / SERVER BOUNDARIES

Conceptual services:

```text
PropertyService
ApprovalService
InspectionService
DocumentService
GISService
AuditService
UserService
```

Example operations:

```text
PropertyService.getPlot()
PropertyService.searchPlots()

ApprovalService.getApproval()
ApprovalService.verifyApprovalRecord()

InspectionService.create()
InspectionService.updateDraft()
InspectionService.submit()
InspectionService.getHistory()

DocumentService.getAuthorizedDocument()

GISService.getEstateMap()
GISService.getPlots()
```

These are conceptual contracts, not final API names.

---

# 26. CACHING

The MVP should not introduce complex caching unless needed.

Potentially cache:

- Estate map data
- Static configuration
- Read-heavy reference data

Do not cache sensitive information in insecure client storage.

Map tile caching depends on the selected map provider and licensing.

---

# 27. SEARCH ARCHITECTURE

MVP search can use database queries.

Search targets:

- Plot number
- Block
- Estate
- Application number
- Approval number

Future search may include:

- Allottee/interest name
- File number
- Address/street

Search must respect authorization.

---

# 28. PHOTO / FILE UPLOAD FLOW

Recommended:

```text
User selects/captures photo
       ↓
Client validation
       ↓
Secure upload request
       ↓
Server authorization
       ↓
File validation
       ↓
Storage
       ↓
Metadata saved
       ↓
Inspection linked to photo
```

Never trust the filename or MIME type supplied by the client alone.

---

# 29. NOTIFICATION ARCHITECTURE

Notifications are not required for the first MVP.

Future possibilities:

- Inspection assigned
- Inspection submitted
- Review required
- Approval status update
- Follow-up inspection
- Supervisor notification

Keep notification logic separate from the inspection domain so it can be added later.

---

# 30. REPORTING

MVP reporting should remain simple.

Possible:

- Plot summary
- Approval summary
- Inspection report
- Inspection history

Future:

- Estate-level analytics
- Compliance trends
- Inspection workload
- Geographic dashboards
- Management reports

---

# 31. OFFLINE FIELD ARCHITECTURE

If offline functionality is added later:

```text
Server
  ↓
Assigned/selected property data
  ↓
Device local database
  ↓
Offline inspection
  ↓
Local inspection queue
  ↓
Connectivity restored
  ↓
Sync service
  ↓
Conflict handling
  ↓
Server
```

The system must assign client-generated IDs to offline records and use idempotent synchronization.

Do not implement partial offline support that creates uncertainty about whether an inspection was successfully submitted.

---

# 32. CONFLICT HANDLING

Potential conflicts include:

- Same inspection submitted twice
- Approval updated while an inspection is offline
- Property data changed while device is offline
- Photo upload interrupted
- Inspection edited by two users

MVP can avoid most conflicts by limiting concurrent editing.

Production requires explicit conflict policies.

---

# 33. SECURITY ARCHITECTURE

Minimum layers:

```text
User
 ↓
Authentication
 ↓
Authorization
 ↓
Input Validation
 ↓
Business Logic
 ↓
Database Access
 ↓
Secure Storage
 ↓
Audit
```

Security must not depend on frontend controls.

---

# 34. PRIVACY

The architecture should support protection of:

- Personal names
- Contact information
- Property documents
- Inspection photographs
- Internal FHA records

Do not expose personal/property data unnecessarily.

The final data classification and retention rules must be confirmed by FHA.

---

# 35. DEPLOYMENT ARCHITECTURE

Conceptual production deployment:

```text
Internet / FHA Network
        ↓
Secure Web Application
        ↓
Application Server
   ┌────┼────┐
   ↓    ↓    ↓
 DB   GIS  Storage
        │
        ↓
     Backups
```

Actual hosting must be selected based on FHA IT/security requirements.

Do not assume public cloud deployment is automatically acceptable for production.

---

# 36. ENVIRONMENTS

Use separate environments:

```text
Development
    ↓
Staging / Demonstration
    ↓
Production
```

Demo data must never accidentally enter production.

Environment variables must remain separate.

---

# 37. BACKUPS

Production should eventually include:

- Database backups
- Document backups
- GIS data backups
- Backup verification
- Recovery procedures
- Retention policy

The MVP can use a simpler backup strategy but should not be designed in a way that makes future backup/recovery difficult.

---

# 38. OBSERVABILITY

Production should monitor:

- Application errors
- Authentication failures
- API errors
- Database errors
- File upload failures
- GIS service failures
- Performance
- Availability

Do not log sensitive personal information unnecessarily.

---

# 39. PERFORMANCE TARGETS

The MVP should feel responsive under normal demo usage.

Priorities:

- Fast initial dashboard
- Fast plot search
- Fast plot selection
- Efficient map rendering
- Efficient image loading
- Pagination for large lists
- Lazy loading for documents/photos where appropriate

Do not load every document and inspection record when opening the map.

---

# 40. MAP PERFORMANCE

Avoid rendering thousands of complex polygons unnecessarily.

Potential future techniques:

- Spatial indexing
- Viewport-based loading
- Clustering
- Simplified geometries
- Vector tiles
- Server-side spatial filtering

For the MVP, keep the dataset small enough for reliable demonstration.

---

# 41. API SECURITY

Every protected operation should validate:

```text
Authentication
Authorization
Input
Record ownership/access
```

Do not accept arbitrary database IDs and assume the user is allowed to access them.

Example:

```text
GET /plots/{plotId}
```

must verify that the authenticated user has permission to view that plot.

---

# 42. TRANSACTIONAL OPERATIONS

Operations that modify multiple related records should use transactions where appropriate.

Example inspection submission:

```text
Validate inspection
      ↓
Validate required fields
      ↓
Save final inspection state
      ↓
Save findings
      ↓
Save audit event
      ↓
Commit
```

If the transaction fails, avoid leaving a partially submitted inspection.

---

# 43. INSPECTION STATE MACHINE

Proposed demo states:

```text
DRAFT
  ↓
SUBMITTED
  ↓
UNDER_REVIEW
  ↓
COMPLETED
```

Possible future states may include:

```text
REQUIRES_ACTION
FOLLOW_UP_REQUIRED
CLOSED
```

These must be confirmed by FHA.

Do not invent the final workflow.

---

# 44. APPROVAL STATE MACHINE

Do not hard-code legal approval logic.

The system should support configurable statuses.

Example demo statuses:

```text
PENDING
APPROVED
REJECTED
EXPIRED
CANCELLED
```

These are illustrative only.

FHA must define the authoritative approval lifecycle.

---

# 45. GIS + INSPECTION RELATIONSHIP

The inspection location should be connected to the property being inspected.

```text
Selected Plot
     ↓
Plot Geometry
     ↓
Inspection
     ├── GPS Location
     └── Photos
```

If the captured GPS point differs from the plot geometry, the system may flag it for review.

It must not automatically conclude that the property is incorrectly located.

---

# 46. FUTURE INTEGRATION ARCHITECTURE

Possible future integrations:

```text
FHA Property System
      │
      ├── Existing FHA records
      ├── GIS systems
      ├── Document management
      ├── Identity/authentication
      ├── Government systems
      └── Notification services
```

Do not build integrations without confirmed interfaces and authorization.

---

# 47. MVP VS PRODUCTION

## MVP

Focus on:

- One estate
- Demo GIS
- Sample records
- Basic authentication
- Plot search
- Plot details
- Approval display
- Document display
- Inspection
- GPS
- Photos
- Comparison
- History

## Production

Eventually consider:

- Full FHA dataset
- Official GIS
- Advanced permissions
- Enterprise authentication
- Offline field operations
- Data migration
- Audit compliance
- Backup/recovery
- Monitoring
- Integrations
- Training
- Support
- Scalability

---

# 48. ARCHITECTURAL DECISION RULES

When the AI coding agent must choose between two implementation approaches:

### Prefer

- Simpler maintainable architecture
- Clear domain boundaries
- Secure server-side operations
- Replaceable GIS provider
- Replaceable storage provider
- Replaceable authentication provider
- Reusable business logic
- Strong data relationships

### Avoid

- Vendor lock-in where unnecessary
- Hard-coded FHA assumptions
- Business logic in UI
- Unrestricted database access
- Public document storage
- Hard-coded GIS boundaries
- Over-engineering the MVP

---

# 49. CRITICAL DEPENDENCIES TO CONFIRM WITH FHA

Before production architecture is finalized, confirm:

1. Existing FHA database/system
2. Existing GIS platform
3. Available spatial formats
4. Existing property identifiers
5. Existing approval identifiers
6. Existing document management
7. User roles
8. Authentication requirements
9. Hosting/network requirements
10. Data privacy/security requirements
11. Inspection workflow
12. Official approval status definitions
13. Required integrations
14. Data retention requirements
15. Backup requirements

---

# 50. ARCHITECTURE VALIDATION CHECKLIST

Before calling the MVP architecture ready:

- [ ] Frontend structure defined
- [ ] Backend/domain boundaries defined
- [ ] Authentication planned
- [ ] Authorization planned
- [ ] Database relationships defined
- [ ] GIS relationship defined
- [ ] Secure document storage planned
- [ ] Inspection workflow defined
- [ ] Approved-vs-observed comparison isolated
- [ ] Audit approach defined
- [ ] Demo data separated
- [ ] Error handling planned
- [ ] Testing approach considered
- [ ] Deployment environments separated
- [ ] Future GIS replacement supported
- [ ] Future FHA integration supported

---

# 51. IMPLEMENTATION ORDER

The AI agent should implement approximately in this order:

```text
1. Project inspection / foundation
        ↓
2. Authentication
        ↓
3. Database schema
        ↓
4. Demo estate + plots
        ↓
5. GIS map
        ↓
6. Plot search
        ↓
7. Plot details
        ↓
8. Approval records
        ↓
9. Documents
        ↓
10. Inspection creation
        ↓
11. GPS
        ↓
12. Photos
        ↓
13. Approved vs observed comparison
        ↓
14. Inspection submission
        ↓
15. Inspection history
        ↓
16. Audit logging
        ↓
17. Testing
        ↓
18. UX polish
```

---

# 52. FINAL ARCHITECTURAL GOAL

The system should ultimately establish a reliable chain:

```text
MAP
 ↓
PLOT
 ↓
PROPERTY RECORD
 ↓
APPLICATION
 ↓
APPROVAL
 ↓
DOCUMENTS
 ↓
INSPECTION
 ↓
OBSERVATION
 ↓
EVIDENCE
 ↓
HISTORY
```

This relationship is more important than adding a large number of unrelated features.

The architecture must remain flexible because the first prototype is intended to be reviewed and corrected by FHA Engineering/Development Control before the complete production system is scoped.

---

**END OF ARCHITECTURE.md**
