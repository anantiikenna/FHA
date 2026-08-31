# API.md
# FHA Development Approval & Property Mapping System
## MVP API Specification

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Architecture Reference:** `ARCHITECTURE.md`  
**Database Reference:** `DATABASE.md`  
**GIS Reference:** `GIS.md`  
**AI Engineering Instructions:** `AGENTS.md`

---

# 1. PURPOSE

This document defines the proposed API boundaries and endpoint behavior for the FHA Development Approval & Property Mapping System MVP.

The API connects the user interface to:

- Authentication
- Estates
- Blocks
- Plots
- Property records
- Applications
- Approvals
- Documents
- Inspections
- GPS/location data
- Inspection photos
- Inspection findings
- Audit logs
- GIS map data

The API is a proposed MVP technical specification.

FHA must confirm official business terminology, workflows and authorization rules before production.

---

# 2. CORE API PRINCIPLE

The frontend must not communicate directly with the database.

Use:

```text
Browser / Mobile UI
       ↓
Authenticated API / Server
       ↓
Business Logic
       ↓
Database / GIS / File Storage
```

Sensitive operations must remain server-side.

---

# 3. API DESIGN PRINCIPLES

The API should be:

- Authenticated
- Authorized
- Validated
- Predictable
- Versioned where appropriate
- Auditable
- Error-safe
- Consistent
- Minimal in returned data
- Designed for GIS queries
- Suitable for mobile field inspection

---

# 4. PROPOSED API BASE PATH

Use a versioned API namespace:

```text
/api/v1
```

Example:

```text
GET /api/v1/plots/123
```

If the chosen framework has a different routing convention, preserve the logical API structure.

---

# 5. AUTHENTICATION

All protected endpoints require an authenticated user.

Conceptually:

```text
Request
   ↓
Authentication
   ↓
User identified
   ↓
Authorization
   ↓
Validation
   ↓
Business operation
```

Do not trust a role sent by the frontend.

The server must obtain the authenticated user's actual role from the trusted authentication/session system.

---

# 6. AUTHORIZATION

Authorization must be checked server-side.

Example:

```text
ENGINEER
   ↓
Can access inspection functionality

APPROVAL_OFFICER
   ↓
Can access approval workflow

GIS_OFFICER
   ↓
Can manage GIS operations if authorized

ADMIN
   ↓
Administrative permissions
```

These roles are provisional and require FHA confirmation.

Do not assume every authenticated user can access every record.

---

# 7. COMMON RESPONSE FORMAT

A consistent response structure is recommended.

### Success

```json
{
  "success": true,
  "data": {}
}
```

### Error

```json
{
  "success": false,
  "error": {
    "code": "PLOT_NOT_FOUND",
    "message": "Plot could not be found."
  }
}
```

Do not expose:

- SQL errors
- Database credentials
- Internal stack traces
- Sensitive infrastructure details

---

# 8. HTTP STATUS CODES

Use appropriate status codes.

```text
200 OK
201 Created
204 No Content
400 Bad Request
401 Unauthorized
403 Forbidden
404 Not Found
409 Conflict
422 Validation Error
429 Too Many Requests
500 Internal Server Error
```

Do not return `200` for every error.

---

# 9. AUTHENTICATION ENDPOINTS

Actual authentication routes depend on the chosen authentication provider.

Logical operations:

```text
POST /api/v1/auth/login
POST /api/v1/auth/logout
GET  /api/v1/auth/me
```

If authentication is handled entirely by an external provider, avoid duplicating provider functionality unnecessarily.

---

# 10. CURRENT USER

### GET

```text
GET /api/v1/auth/me
```

Returns the authenticated user's permitted profile information.

Example:

```json
{
  "success": true,
  "data": {
    "id": "user-id",
    "displayName": "Demo Engineer",
    "role": "ENGINEER"
  }
}
```

Do not return sensitive authentication data.

---

# 11. ESTATE ENDPOINTS

### List estates

```text
GET /api/v1/estates
```

Optional filters:

```text
?search=
?status=
?page=
?limit=
```

### Get estate

```text
GET /api/v1/estates/{estateId}
```

### Get estate map

```text
GET /api/v1/estates/{estateId}/map
```

The map endpoint should return only data required for the current map view.

---

# 12. BLOCK ENDPOINTS

### List blocks

```text
GET /api/v1/estates/{estateId}/blocks
```

### Get block

```text
GET /api/v1/blocks/{blockId}
```

### Get block plots

```text
GET /api/v1/blocks/{blockId}/plots
```

---

# 13. PLOT ENDPOINTS

Plots are central to the system.

### List/search plots

```text
GET /api/v1/plots
```

Possible query parameters:

```text
estateId
blockId
plotNumber
plotReference
status
applicationNumber
approvalNumber
search
page
limit
```

Example:

```text
GET /api/v1/plots?estateId=estate-1&blockId=block-a
```

---

# 14. GET PLOT DETAILS

```text
GET /api/v1/plots/{plotId}
```

Response should contain authorized information such as:

```json
{
  "success": true,
  "data": {
    "id": "plot-id",
    "plotNumber": "003",
    "estate": {
      "id": "estate-id",
      "name": "FHA Demo Estate"
    },
    "block": {
      "id": "block-id",
      "name": "A"
    },
    "plotSize": 650,
    "plotSizeUnit": "sqm",
    "status": "ACTIVE"
  }
}
```

Do not automatically return all documents and inspection photos.

---

# 15. PLOT MAP FEATURE

A map-specific endpoint may return lightweight geographic features.

```text
GET /api/v1/plots/map
```

Possible parameters:

```text
estateId
blockId
bbox
zoom
status
```

`bbox` represents the current map viewport.

Example conceptual request:

```text
GET /api/v1/plots/map?estateId=estate-1&bbox=...
```

Return:

```text
plot_id
plot_number
geometry
minimal display metadata
```

---

# 16. WHY MAP DATA SHOULD BE SEPARATE

Do not return the complete property record for every plot visible on the map.

Instead:

```text
Map
 ↓
Lightweight plot features
 ↓
User selects plot
 ↓
GET /plots/{plotId}
 ↓
Detailed authorized record
```

This improves:

- Performance
- Security
- Bandwidth usage
- Mobile performance

---

# 17. SEARCH API

A unified search endpoint may be useful.

```text
GET /api/v1/search
```

Possible query:

```text
?q=FHA/DEV/2024/1056
```

Search may return categorized matches:

```json
{
  "plots": [],
  "applications": [],
  "approvals": []
}
```

Do not make global search expose records the user cannot access.

---

# 18. PROPERTY INTEREST ENDPOINTS

### Get property interests

```text
GET /api/v1/plots/{plotId}/property-interests
```

### Create/update

Only authorized roles should be able to modify this information.

Example logical operations:

```text
POST /api/v1/plots/{plotId}/property-interests
PATCH /api/v1/property-interests/{interestId}
```

The exact permission rules require FHA confirmation.

---

# 19. APPLICATION ENDPOINTS

### List applications for plot

```text
GET /api/v1/plots/{plotId}/applications
```

### Get application

```text
GET /api/v1/applications/{applicationId}
```

### Create application

```text
POST /api/v1/plots/{plotId}/applications
```

### Update application

```text
PATCH /api/v1/applications/{applicationId}
```

MVP may keep application creation/update limited if the prototype is primarily for verification and inspection.

---

# 20. APPROVAL ENDPOINTS

### Get approvals for plot

```text
GET /api/v1/plots/{plotId}/approvals
```

### Get approval

```text
GET /api/v1/approvals/{approvalId}
```

### Verify approval

```text
GET /api/v1/approvals/{approvalId}/verification
```

The verification endpoint should return a system-defined result based on the available FHA records.

---

# 21. APPROVAL VERIFICATION

Example response:

```json
{
  "success": true,
  "data": {
    "approvalId": "approval-id",
    "approvalNumber": "FHA/DEV/2024/1056",
    "status": "APPROVED",
    "verification": {
      "result": "RECORD_FOUND",
      "checkedAt": "2026-08-31T12:00:00Z"
    }
  }
}
```

Possible technical results:

```text
RECORD_FOUND
RECORD_NOT_FOUND
RECORD_REQUIRES_REVIEW
```

Do not automatically return:

```text
ILLEGAL
FRAUD
FORGED
```

unless FHA formally defines those determinations and the system is authorized to make them.

---

# 22. APPROVAL DOCUMENTS

### List approval documents

```text
GET /api/v1/approvals/{approvalId}/documents
```

### Get document metadata

```text
GET /api/v1/documents/{documentId}
```

### Secure document access

```text
GET /api/v1/documents/{documentId}/access
```

The server should verify authorization before providing access to the file.

---

# 23. DOCUMENT UPLOAD

For authorized users:

```text
POST /api/v1/documents
```

Recommended upload process:

```text
Client
  ↓
Authenticated upload request
  ↓
Validate file
  ↓
Upload to secure storage
  ↓
Create document metadata
  ↓
Audit action
```

Validate:

- File type
- File size
- Filename
- Content where practical
- Associated record
- User permissions

---

# 24. DOCUMENT SECURITY

Do not expose storage buckets or internal file paths publicly if documents are sensitive.

Use:

- Authorized server access
- Short-lived signed URLs where appropriate
- Access control
- Audit logging

Do not place sensitive documents in public static directories.

---

# 25. INSPECTION ENDPOINTS

### List inspections for plot

```text
GET /api/v1/plots/{plotId}/inspections
```

### Get inspection

```text
GET /api/v1/inspections/{inspectionId}
```

### Start inspection

```text
POST /api/v1/plots/{plotId}/inspections
```

### Update inspection

```text
PATCH /api/v1/inspections/{inspectionId}
```

### Submit inspection

```text
POST /api/v1/inspections/{inspectionId}/submit
```

---

# 26. START INSPECTION

Example request:

```json
{
  "approvalId": "approval-id",
  "inspectionType": "SITE_INSPECTION"
}
```

The server should:

1. Authenticate user.
2. Confirm inspection permission.
3. Confirm plot exists.
4. Confirm approval if supplied.
5. Create draft inspection.
6. Record audit event.

---

# 27. GPS ENDPOINT / DATA

GPS may be submitted as part of inspection updates.

Example:

```text
PATCH /api/v1/inspections/{inspectionId}/location
```

Request:

```json
{
  "latitude": 6.000000,
  "longitude": 3.000000,
  "accuracy": 8,
  "capturedAt": "2026-08-31T12:30:00Z"
}
```

The actual coordinates are illustrative.

Do not use fictional coordinates as real FHA data.

---

# 28. GPS VALIDATION

Server must validate:

```text
Latitude: -90 to +90
Longitude: -180 to +180
Accuracy: >= 0 where provided
Timestamp: valid date/time
```

Do not trust client-provided values blindly.

---

# 29. GPS SPATIAL CHECK

Future/optional endpoint:

```text
POST /api/v1/inspections/{inspectionId}/location-check
```

Conceptually:

```text
Inspection GPS point
        ↓
Spatial query
        ↓
Selected plot polygon
        ↓
Result
```

Possible technical result:

```text
WITHIN_SELECTED_PLOT
OUTSIDE_SELECTED_PLOT
UNABLE_TO_DETERMINE
```

This is a spatial observation, not a legal conclusion.

---

# 30. INSPECTION PHOTOS

### List photos

```text
GET /api/v1/inspections/{inspectionId}/photos
```

### Upload photo

```text
POST /api/v1/inspections/{inspectionId}/photos
```

### Delete photo

```text
DELETE /api/v1/inspection-photos/{photoId}
```

Deletion must be permission-controlled and audited.

Retention/deletion policy must be confirmed by FHA.

---

# 31. PHOTO METADATA

Where available:

```text
filename
mimeType
fileSize
latitude
longitude
capturedAt
caption
```

Do not assume all devices provide reliable metadata.

The application should treat device-supplied GPS/photo metadata as field information.

---

# 32. INSPECTION FINDINGS

### List findings

```text
GET /api/v1/inspections/{inspectionId}/findings
```

### Add finding

```text
POST /api/v1/inspections/{inspectionId}/findings
```

### Update finding

```text
PATCH /api/v1/inspection-findings/{findingId}
```

### Example

```json
{
  "category": "DEVELOPMENT",
  "title": "Number of floors differs",
  "description": "Approved: 2. Observed: 3.",
  "severity": "REVIEW_REQUIRED"
}
```

---

# 33. APPROVED VS OBSERVED COMPARISON

The server may provide:

```text
GET /api/v1/inspections/{inspectionId}/comparison
```

Example result:

```json
{
  "approved": {
    "floors": 2,
    "units": 4
  },
  "observed": {
    "floors": 3,
    "units": 6
  },
  "differences": [
    "FLOOR_COUNT",
    "UNIT_COUNT"
  ]
}
```

The comparison engine must not automatically make legal/enforcement conclusions.

---

# 34. INSPECTION SUBMISSION

When an engineer submits an inspection:

```text
POST /api/v1/inspections/{inspectionId}/submit
```

Server should:

1. Authenticate user.
2. Authorize submission.
3. Validate required fields.
4. Validate status.
5. Save final inspection state.
6. Create audit event.
7. Return result.

Do not allow an already-finalized inspection to be modified without an explicit authorized workflow.

---

# 35. AUDIT API

Audit logs are primarily internal.

Possible:

```text
GET /api/v1/audit-logs
```

Access should be highly restricted.

Filters:

```text
userId
entityType
entityId
action
dateFrom
dateTo
```

Do not expose audit logs to ordinary users.

---

# 36. MAP VIEWPORT API

For larger GIS datasets:

```text
GET /api/v1/map/plots?bbox=...
```

The server should query only the relevant spatial area.

Conceptual:

```text
Current viewport
      ↓
Bounding box
      ↓
Spatial query
      ↓
Relevant plots
```

---

# 37. SPATIAL QUERY SECURITY

Do not allow arbitrary unrestricted GIS queries from unauthenticated clients.

The server should enforce:

- Maximum bounding-box size
- Authorization
- Result limits
- Rate limits where appropriate

---

# 38. PAGINATION

List endpoints should support pagination where results may become large.

Example:

```text
?page=1&limit=25
```

Use reasonable maximum limits.

Do not allow:

```text
?limit=1000000
```

to force the server to return massive datasets.

---

# 39. FILTERING

Use predictable filters.

Example:

```text
GET /api/v1/plots
    ?estateId=
    &blockId=
    &status=
    &plotNumber=
```

Validate all filter values.

---

# 40. SORTING

Where needed:

```text
?sort=plotNumber
&direction=asc
```

Do not directly inject user-provided sort values into SQL.

Map client sort fields to an approved server-side whitelist.

---

# 41. RATE LIMITING

Consider rate limiting for:

- Login
- Search
- Document access
- Upload
- GIS queries
- Public/future verification endpoints

Exact thresholds should be established during implementation/testing.

---

# 42. IDEMPOTENCY

For operations that may be retried by mobile clients, consider idempotency.

This is especially useful for:

```text
Inspection submission
Photo upload
Document upload
```

The MVP can use simpler handling, but the architecture should not make future idempotency impossible.

---

# 43. MOBILE NETWORK FAILURE

Field engineers may have unreliable connectivity.

The API should return clear errors that allow the client to determine whether to:

```text
Retry
Save locally
Ask user
```

Do not treat every network error as a successful submission.

---

# 44. ERROR CODES

Use stable machine-readable codes.

Examples:

```text
AUTH_REQUIRED
ACCESS_DENIED
PLOT_NOT_FOUND
ESTATE_NOT_FOUND
APPROVAL_NOT_FOUND
INSPECTION_NOT_FOUND
INVALID_COORDINATES
INVALID_STATUS
VALIDATION_ERROR
DOCUMENT_NOT_FOUND
UPLOAD_FAILED
GIS_DATA_UNAVAILABLE
CONFLICT
```

Error messages may be user-friendly, but the code should remain stable.

---

# 45. VALIDATION

Use schema validation at the API boundary.

Validate:

- IDs
- Numbers
- Dates
- Statuses
- Coordinates
- File metadata
- Text lengths
- Required fields

Do not rely solely on frontend validation.

---

# 46. INPUT SANITIZATION

All untrusted input must be treated as untrusted.

Protect against:

- SQL injection
- XSS
- Path traversal
- Malicious filenames
- Oversized requests
- Unexpected JSON
- Invalid GIS geometry

Use parameterized database access and established security libraries.

---

# 47. API + GIS SECURITY

Never allow the client to submit arbitrary SQL-like spatial expressions.

For example, do not expose:

```text
/raw-sql
```

or an unrestricted GIS query language.

Use predefined server-side spatial operations.

---

# 48. API + DOCUMENT STORAGE

Database:

```text
document metadata
```

Object storage:

```text
actual file
```

API:

```text
authorization + controlled access
```

This separation is preferred.

---

# 49. API + AUDIT

Important mutations should produce audit events.

Examples:

```text
CREATE_INSPECTION
UPDATE_INSPECTION
SUBMIT_INSPECTION
UPLOAD_DOCUMENT
VIEW_SENSITIVE_DOCUMENT
UPDATE_APPROVAL
UPDATE_PROPERTY_RECORD
```

The final audit policy requires FHA confirmation.

---

# 50. API + TRANSACTIONS

Use transactions for operations involving multiple database changes.

Example:

```text
Submit inspection
    ↓
Update inspection
    ↓
Save findings
    ↓
Create audit event
    ↓
Commit
```

If one critical step fails, do not leave the database in an inconsistent state.

---

# 51. API + DATABASE IDs

Use stable internal IDs.

Example:

```text
plotId
approvalId
inspectionId
documentId
```

Do not expose database implementation details unnecessarily.

Public/display identifiers may be separate:

```text
plotNumber
approvalNumber
inspectionNumber
```

---

# 52. API + OFFICIAL REFERENCES

Where FHA uses official numbers such as:

```text
Approval Number
Application Number
File Number
Plot Reference
```

store them separately from internal IDs.

Example:

```text
id:
UUID

approvalNumber:
FHA/DEV/2024/1056
```

---

# 53. API VERSIONING

The MVP may begin with:

```text
/api/v1
```

Breaking changes should result in a versioning strategy rather than silently changing existing behavior.

---

# 54. API DOCUMENTATION

The implementation should generate or maintain machine-readable API documentation where practical.

Recommended future direction:

```text
OpenAPI
```

This allows frontend/mobile developers to understand:

- Endpoints
- Request schemas
- Response schemas
- Authentication
- Errors

---

# 55. API TESTING

At minimum, test:

### Authentication

- Unauthorized request
- Authorized request

### Authorization

- Correct role
- Incorrect role

### Plot

- Existing plot
- Missing plot
- Unauthorized plot

### Approval

- Existing approval
- Missing approval
- Verification result

### Inspection

- Create
- Update
- Submit
- Invalid submission

### GIS

- Valid map query
- Empty map result
- Invalid bounding box

### Files

- Valid upload
- Invalid file
- Oversized file
- Unauthorized access

---

# 56. API ACCEPTANCE CHECKLIST

- [ ] Protected endpoints require authentication
- [ ] Authorization is enforced server-side
- [ ] Frontend cannot directly access database
- [ ] Plot search works
- [ ] Plot details work
- [ ] Map endpoint returns lightweight GIS data
- [ ] Plot selection can retrieve plot record
- [ ] Approval information can be retrieved
- [ ] Approval verification can be demonstrated
- [ ] Documents can be securely accessed
- [ ] Inspection can be created
- [ ] GPS can be captured
- [ ] Photos can be associated with inspections
- [ ] Findings can be recorded
- [ ] Approved-vs-observed comparison can be generated
- [ ] Inspection submission is validated
- [ ] Important actions are audited
- [ ] Errors are safe and consistent
- [ ] API input is validated
- [ ] GIS queries are restricted
- [ ] Large datasets are paginated/viewport-limited

---

# 57. MVP ENDPOINT SUMMARY

```text
AUTH
GET    /api/v1/auth/me

ESTATES
GET    /api/v1/estates
GET    /api/v1/estates/{estateId}
GET    /api/v1/estates/{estateId}/map

BLOCKS
GET    /api/v1/estates/{estateId}/blocks
GET    /api/v1/blocks/{blockId}
GET    /api/v1/blocks/{blockId}/plots

PLOTS
GET    /api/v1/plots
GET    /api/v1/plots/{plotId}
GET    /api/v1/plots/map

SEARCH
GET    /api/v1/search

PROPERTY
GET    /api/v1/plots/{plotId}/property-interests

APPLICATIONS
GET    /api/v1/plots/{plotId}/applications
GET    /api/v1/applications/{applicationId}

APPROVALS
GET    /api/v1/plots/{plotId}/approvals
GET    /api/v1/approvals/{approvalId}
GET    /api/v1/approvals/{approvalId}/verification

DOCUMENTS
GET    /api/v1/approvals/{approvalId}/documents
GET    /api/v1/documents/{documentId}
GET    /api/v1/documents/{documentId}/access
POST   /api/v1/documents

INSPECTIONS
GET    /api/v1/plots/{plotId}/inspections
POST   /api/v1/plots/{plotId}/inspections
GET    /api/v1/inspections/{inspectionId}
PATCH  /api/v1/inspections/{inspectionId}
POST   /api/v1/inspections/{inspectionId}/submit
PATCH  /api/v1/inspections/{inspectionId}/location
POST   /api/v1/inspections/{inspectionId}/location-check
GET    /api/v1/inspections/{inspectionId}/comparison

PHOTOS
GET    /api/v1/inspections/{inspectionId}/photos
POST   /api/v1/inspections/{inspectionId}/photos

FINDINGS
GET    /api/v1/inspections/{inspectionId}/findings
POST   /api/v1/inspections/{inspectionId}/findings
PATCH  /api/v1/inspection-findings/{findingId}

AUDIT
GET    /api/v1/audit-logs
```

---

# 58. FINAL API FLOW

The central application workflow should be:

```text
USER
 │
 ▼
AUTHENTICATION
 │
 ▼
MAP API
 │
 ▼
PLOT
 │
 ├──────────────► PROPERTY
 │
 ├──────────────► APPLICATION
 │                    │
 │                    ▼
 │                 APPROVAL
 │                    │
 │                    ▼
 │                 DOCUMENT
 │
 └──────────────► INSPECTION
                      │
                      ├── GPS
                      ├── PHOTOS
                      ├── FINDINGS
                      └── COMPARISON
                              │
                              ▼
                          AUDIT LOG
```

The API should make this workflow explicit and predictable for the AI coding agent.

---

# 59. IMPORTANT IMPLEMENTATION RULE

The AI agent must not invent business rules when the FHA requirement is unknown.

If a workflow is not confirmed:

```text
Mark as configurable
or
Mark as TODO / REQUIREMENT
```

Do not silently convert an assumption into an official FHA rule.

Examples:

```text
Approval status
Ownership terminology
Inspection approval thresholds
Enforcement status
Document retention
User hierarchy
```

must remain subject to FHA confirmation.

---

**END OF API.md**
