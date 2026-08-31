# SECURITY.md
# FHA Development Approval & Property Mapping System
## MVP Security Specification

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Architecture Reference:** `ARCHITECTURE.md`  
**Database Reference:** `DATABASE.md`  
**GIS Reference:** `GIS.md`  
**API Reference:** `API.md`  
**UI/UX Reference:** `UI_UX.md`  
**AI Engineering Instructions:** `AGENTS.md`

---

# 1. PURPOSE

This document defines the minimum security requirements for the FHA Development Approval & Property Mapping System MVP.

The system may handle sensitive information including:

- Property records
- Allottee/property-interest information
- Development applications
- Approval records
- Approval documents
- Inspection reports
- Inspection photographs
- GPS/location information
- Staff accounts
- Audit records
- GIS/property geometry

The security model must therefore follow a **security-first** approach.

---

# 2. SECURITY PRINCIPLE

The core principle is:

> A user should only be able to access or modify information that their authenticated identity and assigned permissions allow.

Do not rely on the frontend to enforce security.

The backend/server must enforce authorization.

---

# 3. SECURITY ARCHITECTURE

Recommended:

```text
USER DEVICE
    ↓
HTTPS
    ↓
AUTHENTICATION
    ↓
SESSION / TOKEN VALIDATION
    ↓
AUTHORIZATION
    ↓
INPUT VALIDATION
    ↓
BUSINESS RULES
    ↓
DATABASE / GIS / FILE STORAGE
    ↓
AUDIT LOG
```

Sensitive operations should remain server-side.

---

# 4. THREAT MODEL

The MVP should consider at least:

### Unauthorized user

Attempts to access the system.

### Authenticated but unauthorized user

A valid user attempts to access records outside their permissions.

### Malicious request

A user manipulates API requests directly rather than using the UI.

### Document abuse

A user attempts to access another user's sensitive files.

### GIS data exposure

Sensitive property information is unintentionally exposed through map endpoints.

### File upload attack

A malicious or oversized file is uploaded.

### Account compromise

A valid staff account is stolen.

### Data modification

A user attempts to alter an official record without permission.

### Audit bypass

A sensitive change occurs without a traceable record.

---

# 5. AUTHENTICATION

The application must require authentication for internal FHA functions unless FHA explicitly approves a public workflow.

Authentication should use a trusted authentication mechanism.

Do not implement custom password storage unnecessarily.

If passwords are used:

- Never store plaintext passwords.
- Use a strong password hashing algorithm.
- Enforce appropriate password policies.
- Protect login endpoints from brute-force attempts.

---

# 6. SESSION SECURITY

Sessions/tokens must be handled securely.

Requirements:

- HTTPS only in production
- Secure cookies where cookies are used
- HttpOnly cookies where appropriate
- SameSite protection where appropriate
- Session expiration
- Session revocation capability
- No sensitive tokens in URLs
- No authentication tokens in ordinary logs

---

# 7. AUTHORIZATION

Authentication answers:

```text
Who are you?
```

Authorization answers:

```text
What are you allowed to do?
```

Both are required.

---

# 8. ROLE-BASED ACCESS CONTROL

The MVP should support role-based access control.

Provisional roles:

```text
ENGINEER
APPROVAL_OFFICER
GIS_OFFICER
ADMIN
```

These must be confirmed by FHA.

---

# 9. ENGINEER PERMISSIONS

Potential permissions:

```text
View assigned/authorized properties
View approval information
View authorized documents
Create inspection
Capture GPS
Upload inspection photos
Record findings
Submit inspection
```

The exact scope must be confirmed by FHA.

---

# 10. APPROVAL OFFICER PERMISSIONS

Potential permissions:

```text
View property records
View applications
View approvals
Review documents
Perform authorized approval operations
```

Final permissions require FHA confirmation.

---

# 11. GIS OFFICER PERMISSIONS

Potential permissions:

```text
View GIS layers
Import GIS data
Validate GIS data
Manage GIS datasets
```

Production GIS editing must be tightly controlled.

---

# 12. ADMIN PERMISSIONS

Potential permissions:

```text
Manage users
Manage roles
View audit logs
Manage system settings
Manage selected reference data
```

Administrative privileges should be minimized.

---

# 13. LEAST PRIVILEGE

Users should receive the minimum permissions required to perform their work.

Do not give:

```text
ENGINEER → ADMIN
```

permissions simply because the engineer needs access to inspections.

---

# 14. SERVER-SIDE AUTHORIZATION

Every protected API operation must check authorization server-side.

Incorrect:

```text
Frontend:
if user.role === "ADMIN"
```

as the only protection.

Correct:

```text
Request
 ↓
Server authenticates user
 ↓
Server loads trusted role/permissions
 ↓
Server checks permission
 ↓
Operation allowed/denied
```

---

# 15. OBJECT-LEVEL AUTHORIZATION

The server must check access to the specific record.

Example:

```text
GET /api/v1/plots/123
```

must verify that the current user is permitted to access Plot 123.

Do not assume that knowing an ID grants access.

This protects against IDOR-style attacks.

---

# 16. API SECURITY

All protected APIs should:

- Require authentication
- Validate input
- Authorize the operation
- Limit returned information
- Return safe errors
- Log important mutations

Never create unrestricted endpoints for internal databases.

---

# 17. INPUT VALIDATION

Validate all external input.

Examples:

```text
plotId
estateId
approvalId
inspectionId
coordinates
dates
status values
search terms
pagination
file metadata
```

Use typed schemas where supported.

Frontend validation is helpful for UX but is not a security boundary.

---

# 18. SQL / DATABASE INJECTION

Use:

- Parameterized queries
- ORM/query-builder protections
- Validated input

Never concatenate raw user input into SQL.

Do not provide arbitrary SQL endpoints.

---

# 19. XSS PROTECTION

User-entered text may appear in:

- Findings
- Notes
- Captions
- Search results
- Property records

Escape/render untrusted content safely.

If rich text is eventually supported, sanitize it using a trusted sanitizer.

---

# 20. CSRF PROTECTION

Where cookie-based authentication is used, implement appropriate CSRF protection for state-changing operations.

Particularly protect:

```text
POST
PATCH
PUT
DELETE
```

operations.

---

# 21. CORS

Restrict cross-origin access.

Do not use unrestricted production configuration such as:

```text
Access-Control-Allow-Origin: *
```

for sensitive authenticated APIs unless there is a specific justified architecture.

---

# 22. HTTPS

Production communication must use HTTPS.

Sensitive information must never be transmitted over plain HTTP.

Redirect HTTP to HTTPS where appropriate.

---

# 23. SECURITY HEADERS

Consider appropriate headers such as:

```text
Strict-Transport-Security
Content-Security-Policy
X-Content-Type-Options
Referrer-Policy
Permissions-Policy
```

Exact policy values should be tested against the application.

Do not blindly copy a CSP that breaks required functionality.

---

# 24. FILE UPLOAD SECURITY

Documents and photos are high-risk inputs.

Validate:

- File size
- MIME type
- File extension
- Filename
- Upload authorization
- Associated record
- Storage destination

Do not trust the file extension alone.

---

# 25. MALICIOUS FILES

The system should prevent dangerous uploads where appropriate.

The final allowed file types must be confirmed by FHA.

Likely document types may include:

```text
PDF
JPG/JPEG
PNG
```

Other formats may be required for engineering/GIS workflows.

---

# 26. FILE STORAGE

Sensitive files should not be stored in publicly accessible directories.

Preferred:

```text
Private object storage
       ↓
Server authorization
       ↓
Short-lived secure access
```

The browser should not receive permanent public links to sensitive FHA documents.

---

# 27. DOCUMENT ACCESS

Before serving a document:

```text
Authenticate
 ↓
Authorize document access
 ↓
Confirm document exists
 ↓
Generate controlled access
```

A user must not be able to change:

```text
/document/123
```

to:

```text
/document/124
```

and obtain another user's document.

---

# 28. PHOTO SECURITY

Inspection photos may contain:

- Property information
- People
- Vehicle plates
- Location information
- Construction details

Access should therefore be permission-controlled.

---

# 29. GPS PRIVACY

Inspection GPS data should be treated as sensitive operational information.

Store only what is required.

Do not expose engineer location histories to users who do not need them.

The system should not continuously track an engineer unless FHA explicitly requires and authorizes continuous tracking.

---

# 30. GPS PERMISSIONS

Mobile users should explicitly grant location permission.

The application should explain why location is required.

Example:

```text
Location is required to record the inspection site location.
```

Do not request background location when foreground capture is sufficient.

---

# 31. GIS SECURITY

GIS endpoints must not accidentally expose sensitive property records.

Map responses should contain only necessary fields.

Example lightweight map feature:

```json
{
  "plotId": "...",
  "plotNumber": "003",
  "geometry": "...",
  "status": "APPROVED"
}
```

Detailed owner/property information should be loaded separately and authorization-checked.

---

# 32. PUBLIC VS INTERNAL MAP

The MVP is primarily an internal system.

Do not create a public map containing internal FHA information unless FHA explicitly approves it.

If a future public verification portal is required, create a separate public-facing data model.

---

# 33. APPROVAL SECURITY

Approval information may be authoritative government records.

Therefore:

- Restrict modification
- Audit changes
- Preserve history where required
- Restrict document replacement
- Do not allow ordinary engineers to modify approvals unless authorized

---

# 34. OFFICIAL RECORD PROTECTION

The system must distinguish between:

```text
Official record
```

and:

```text
Inspection observation
```

An engineer's observation must not silently overwrite the official approval.

Example:

```text
APPROVED
Floors: 2

OBSERVED
Floors: 3
```

These are separate facts.

---

# 35. AUDIT LOGGING

Important actions should be logged.

At minimum consider:

```text
Login
Logout
Failed login
Record viewed where sensitive
Approval viewed
Document accessed
Document uploaded
Inspection created
Inspection submitted
Property modified
Approval modified
User/role changed
GIS dataset changed
```

Final audit policy requires FHA confirmation.

---

# 36. AUDIT LOG IMMUTABILITY

Users should not be able to casually edit or delete audit records.

Where practical:

```text
Application
    ↓
Audit service
    ↓
Append-only audit record
```

Administrative audit-log retention and archival rules must be confirmed.

---

# 37. AUDIT INFORMATION

An audit record should ideally capture:

```text
actor
action
entity type
entity ID
timestamp
result
request/context metadata where appropriate
```

Avoid storing unnecessary sensitive request payloads.

---

# 38. DATA ENCRYPTION

Sensitive data should be protected:

### In transit

HTTPS/TLS.

### At rest

Use encryption provided by the chosen database/storage infrastructure where appropriate.

Highly sensitive application secrets must never be stored in source code.

---

# 39. SECRETS MANAGEMENT

Never commit:

```text
DATABASE_PASSWORD
API_SECRET
AUTH_SECRET
STORAGE_SECRET
MAP_PROVIDER_SECRET
```

to Git.

Use environment variables or an approved secrets manager.

Do not expose server secrets to client-side bundles.

---

# 40. ENVIRONMENT SEPARATION

Maintain separate:

```text
Development
Staging
Production
```

credentials and resources.

Never connect the prototype directly to a production FHA database.

---

# 41. DEMO DATA SAFETY

The prototype should use synthetic or properly anonymized records.

Do not place real sensitive property records into the demo repository.

Demo accounts must not have production access.

---

# 42. DATABASE SECURITY

Use:

- Least-privilege database credentials
- Separate application credentials where appropriate
- Parameterized queries
- Backups
- Access controls
- Connection encryption where supported

The application should not use a database superuser for ordinary runtime operations.

---

# 43. BACKUP SECURITY

Backups may contain the same sensitive information as the live database.

Protect backups with:

- Access controls
- Encryption
- Retention policy
- Monitoring

Backup restoration should be tested.

---

# 44. DATA RETENTION

Do not invent government retention periods.

FHA must determine:

- How long approvals are retained
- How long inspection records are retained
- How long photographs are retained
- How long audit logs are retained
- When documents may be archived/deleted

Until confirmed, make retention configurable.

---

# 45. DATA DELETION

Do not add destructive delete operations simply because CRUD is convenient.

For official records, prefer controlled workflows such as:

```text
Archive
Deactivate
Supersede
Void
```

only where FHA defines them.

Permanent deletion should require explicit policy.

---

# 46. RECORD HISTORY

Where an official record changes, consider preserving:

```text
previous value
new value
changed by
changed at
reason
```

The exact historical-record requirements must be confirmed.

---

# 47. CONCURRENCY

Two users may attempt to edit the same record.

Production should consider optimistic concurrency or versioning.

Example:

```text
Record version: 5
```

If a user attempts to update an outdated version:

```text
CONFLICT
Record has changed.
Refresh before saving.
```

---

# 48. BRUTE FORCE PROTECTION

Protect authentication endpoints using:

- Rate limiting
- Progressive delays where appropriate
- Account protections
- Monitoring

Do not reveal whether an email/staff ID exists through overly specific login errors.

---

# 49. SESSION TIMEOUT

The final timeout should be determined by FHA/security policy.

The application should support configurable:

```text
Idle timeout
Absolute session lifetime
Session revocation
```

---

# 50. LOGGING SECURITY

Application logs must not contain:

- Passwords
- Authentication tokens
- Private keys
- Sensitive document contents
- Unnecessary personal information

Logs themselves may require access control.

---

# 51. ERROR SECURITY

User-facing errors should be useful but safe.

Bad:

```text
PostgreSQL error:
relation "fha_internal_approval_table"...
```

Good:

```text
Unable to retrieve approval information.
Please try again.
```

Detailed technical errors belong in protected server logs.

---

# 52. DEPENDENCY SECURITY

Keep dependencies maintained.

The AI agent should:

- Avoid unnecessary packages
- Review security advisories
- Remove unused dependencies
- Lock dependency versions appropriately
- Update vulnerable packages

Do not add a library simply because it is convenient.

---

# 53. SUPPLY-CHAIN SECURITY

Prefer established packages.

Review:

- Package publisher
- Maintenance status
- Known vulnerabilities
- Dependency tree

Avoid obscure packages for simple functionality.

---

# 54. GIS DATA SECURITY

GIS source files may themselves be sensitive.

Protect:

```text
Raw GIS files
Converted datasets
Database spatial tables
Export files
```

Do not expose raw GIS downloads to ordinary users unless authorized.

---

# 55. EXPORT SECURITY

Future export features may include:

```text
CSV
PDF
GIS files
Reports
```

Exports can bypass normal UI restrictions if implemented poorly.

Every export must:

1. Authenticate
2. Authorize
3. Filter allowed fields
4. Log sensitive exports where required

---

# 56. SEARCH SECURITY

Search must not become an information-disclosure mechanism.

For example, an unauthorized user must not be able to search:

```text
owner name
approval number
plot number
```

and retrieve sensitive records they cannot normally access.

---

# 57. RATE LIMITING

Consider rate limits for:

```text
Login
Search
Map queries
Document access
Uploads
Verification
```

The exact thresholds should be tuned during testing.

---

# 58. SECURITY MONITORING

Production should eventually monitor:

- Repeated failed logins
- Unusual document access
- Large exports
- Excessive GIS queries
- Permission changes
- Repeated failed authorization
- Unexpected administrative activity

The MVP may implement basic logging first.

---

# 59. INCIDENT RESPONSE

The production system should have a procedure for:

```text
Security incident detected
       ↓
Contain
       ↓
Investigate
       ↓
Revoke compromised access
       ↓
Restore/repair
       ↓
Document incident
       ↓
Review controls
```

The operational incident-response process must be established by FHA.

---

# 60. SECURITY TESTING

Before production, test:

### Authentication

- Invalid credentials
- Session expiration
- Session revocation

### Authorization

- Role restrictions
- Object-level access
- Direct API manipulation

### Files

- Unauthorized download
- Malicious file
- Oversized file
- Invalid MIME type

### GIS

- Unauthorized map access
- Excessive viewport queries
- Sensitive field exposure

### Input

- SQL injection
- XSS
- Invalid IDs
- Invalid coordinates
- Oversized input

### API

- Rate limits
- CORS
- CSRF where applicable
- Error leakage

---

# 61. SECURITY ACCEPTANCE CHECKLIST

### Authentication

- [ ] Internal pages require authentication
- [ ] Sessions are secure
- [ ] Logout works
- [ ] Sessions can expire/revoke

### Authorization

- [ ] Roles are enforced server-side
- [ ] Object-level authorization exists
- [ ] Least privilege is used
- [ ] Admin access is restricted

### Data

- [ ] Sensitive records are protected
- [ ] Approval records cannot be casually modified
- [ ] Inspection observations are separate from official approvals
- [ ] Backups are protected

### GIS

- [ ] Map API does not expose unnecessary information
- [ ] Plot records are authorization-checked
- [ ] GPS is treated as sensitive
- [ ] Official GIS geometry is protected

### Files

- [ ] Uploads are validated
- [ ] Sensitive files are private
- [ ] Document access is authorized
- [ ] Photos are protected

### Application

- [ ] Inputs are validated
- [ ] SQL injection protections exist
- [ ] XSS protections exist
- [ ] CSRF protections are appropriate
- [ ] CORS is restricted
- [ ] Security headers are configured

### Audit

- [ ] Important mutations are audited
- [ ] Audit logs are protected
- [ ] User identity is recorded
- [ ] Timestamps are recorded

---

# 62. AI AGENT SECURITY RULES

The AI coding agent must follow these rules:

1. Never expose secrets in source code.
2. Never connect the prototype to unknown production credentials.
3. Never bypass server-side authorization.
4. Never trust frontend role values.
5. Never expose unrestricted database endpoints.
6. Never expose private documents publicly.
7. Never treat GPS as official survey data.
8. Never overwrite official approval data with inspection observations.
9. Never invent security-sensitive government rules.
10. Never add public verification without explicit product requirements.
11. Never disable security controls just to make development easier.
12. Never commit `.env` secrets.
13. Never log passwords or tokens.
14. Never allow arbitrary SQL through APIs.
15. Never silently delete official records.
16. Clearly mark prototype/demo data.
17. Keep security decisions documented.
18. Prefer deny-by-default access.

---

# 63. MVP SECURITY PRIORITY

For the prototype, prioritize:

```text
1. Authentication
2. Server-side authorization
3. Secure API boundaries
4. Private document access
5. Input validation
6. Secure GIS endpoints
7. Audit logging
8. Secure file uploads
9. HTTPS
10. Secrets protection
```

Advanced enterprise security can be expanded after the workflow is validated.

---

# 64. SECURITY DECISIONS REQUIRING FHA CONFIRMATION

The following should remain requirements/TODO items until FHA provides policy:

- Official roles
- Staff authentication method
- Public access policy
- Property-owner privacy requirements
- Document access policy
- Data retention
- Audit retention
- GIS access levels
- GPS retention
- Photo retention
- Export permissions
- Approval modification permissions
- Record archival/deletion
- Security incident procedures
- Government hosting requirements
- Data residency requirements

---

# 65. FINAL SECURITY MODEL

The intended security relationship is:

```text
              USER
                │
                ▼
        AUTHENTICATION
                │
                ▼
          USER / ROLE
                │
                ▼
        AUTHORIZATION
                │
                ▼
           API LAYER
                │
       ┌────────┼────────┐
       ▼        ▼        ▼
   DATABASE    GIS     STORAGE
       │        │        │
       └────────┼────────┘
                ▼
           AUDIT LOG
```

Security must be applied across the entire chain rather than only at the login screen.

---

# 66. FINAL PRINCIPLE

The most important security rule for this system is:

> **Do not assume that because a user can see a map, they are entitled to see every property record, approval document, GPS record, or inspection record associated with that map.**

Every sensitive operation must be authenticated, authorized, validated and appropriately audited.

---

**END OF SECURITY.md**
