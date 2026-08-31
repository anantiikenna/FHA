# AUTHORIZATION_RBAC.md
# FHA Development Approval & Property Mapping System
## Roles, Permissions & Access-Control Specification

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Related Documents:** `SECURITY.md`, `UI_UX.md`, `API.md`, `DATABASE.md`, `GIS.md`, `AGENTS.md`

---

# 1. PURPOSE

This document defines the proposed role-based access control (RBAC) model for the FHA Development Approval & Property Mapping System MVP.

The purpose is to ensure that the AI coding agent does not invent permissions or give every authenticated user unrestricted access.

The roles and permissions in this document are **provisional** and must be reviewed by FHA.

---

# 2. CORE ACCESS PRINCIPLE

The system follows:

> **Deny by default, grant only what is required.**

A user must satisfy all relevant conditions before accessing a protected resource:

```text
Authenticated
     ↓
Role
     ↓
Permission
     ↓
Record-level access
     ↓
Action allowed
```

Being logged in does not automatically grant access to every record.

---

# 3. PROVISIONAL ROLES

The MVP should support these proposed roles:

```text
ENGINEER
APPROVAL_OFFICER
GIS_OFFICER
ADMIN
```

These are working names only.

FHA may rename, merge, remove or add roles.

---

# 4. ROLE DEFINITIONS

## 4.1 ENGINEER

Primary field/inspection user.

Typical responsibilities:

- Locate properties on the map
- View authorized property information
- View approval information
- Review authorized documents
- Conduct inspections
- Capture GPS
- Capture/upload inspection photographs
- Record observations
- Submit inspection reports

An engineer should not automatically be able to modify official approval records.

---

## 4.2 APPROVAL_OFFICER

Responsible for development/application/approval workflows where authorized.

Potential responsibilities:

- Review applications
- Review property records
- Review approval records
- Review supporting documents
- Manage authorized approval workflow
- View inspection information where required

Exact approval powers must be confirmed by FHA.

---

## 4.3 GIS_OFFICER

Responsible for spatial information.

Potential responsibilities:

- View GIS layers
- Review plot geometry
- Manage authorized GIS data
- Import/update spatial datasets
- Resolve GIS data issues
- Validate spatial information

GIS editing must be more restricted than ordinary map viewing.

---

## 4.4 ADMIN

System administrator.

Potential responsibilities:

- Manage users
- Manage roles
- Manage permissions
- View audit logs
- Manage system configuration
- Perform authorized administrative operations

An administrator should not automatically have authority to alter official development approvals unless FHA explicitly assigns that authority.

---

# 5. PERMISSION NAMING

Use explicit permission names rather than relying only on role names.

Recommended format:

```text
resource.action
```

Examples:

```text
plot.read
plot.update
approval.read
approval.update
inspection.create
inspection.submit
document.read
document.upload
gis.read
gis.manage
user.manage
audit.read
```

This makes future roles easier to configure.

---

# 6. PROPOSED PERMISSION CATALOG

## Property / Plot

```text
plot.read
plot.search
plot.update
plot.archive
```

## Applications

```text
application.read
application.create
application.update
application.submit
```

## Approvals

```text
approval.read
approval.create
approval.update
approval.submit
approval.void
```

## Documents

```text
document.read
document.upload
document.replace
document.archive
```

## Inspections

```text
inspection.read
inspection.create
inspection.update
inspection.submit
inspection.review
```

## GPS / Field Evidence

```text
inspection.gps.capture
inspection.photo.upload
inspection.finding.create
```

## GIS

```text
gis.read
gis.layer.read
gis.data.import
gis.data.update
gis.data.export
```

## Users

```text
user.read
user.create
user.update
user.disable
```

## Roles

```text
role.read
role.assign
role.update
```

## Audit

```text
audit.read
audit.export
```

## System

```text
system.settings.read
system.settings.update
```

Not every permission needs to exist in the first prototype.

---

# 7. PROVISIONAL PERMISSION MATRIX

Legend:

```text
R = Read
C = Create
U = Update
S = Submit
M = Manage
- = No access
```

| Resource / Action | Engineer | Approval Officer | GIS Officer | Admin |
|---|---:|---:|---:|---:|
| View map | R | R | R | R |
| Search plots | R | R | R | R |
| View plot | R | R | R | R |
| Modify plot | - | TBD | M | TBD |
| View applications | R | R | TBD | R |
| Create application | - | TBD | - | TBD |
| View approvals | R | R | TBD | R |
| Create approval | - | TBD | - | TBD |
| Modify approval | - | TBD | - | TBD |
| Submit approval | - | TBD | - | TBD |
| View documents | R* | R | TBD | R |
| Upload documents | C* | C/TBD | C | C |
| Start inspection | C | TBD | TBD | TBD |
| Edit own draft inspection | U | TBD | TBD | TBD |
| Submit inspection | S | TBD | TBD | TBD |
| Review inspection | TBD | TBD | TBD | TBD |
| Capture GPS | C | TBD | TBD | TBD |
| Upload inspection photos | C | TBD | TBD | TBD |
| Manage GIS layers | - | - | M | TBD |
| Import GIS data | - | - | M | TBD |
| Manage users | - | - | - | M |
| Manage roles | - | - | - | M |
| View audit logs | - | TBD | TBD | M |
| System settings | - | - | - | M |

`*` Subject to document classification and FHA authorization.

`TBD` means FHA must confirm.

---

# 8. DO NOT TREAT TBD AS ALLOWED

The AI agent must not interpret:

```text
TBD
```

as:

```text
Allowed
```

Until FHA confirms a permission, implementation should use the safer default:

```text
DENY
```

---

# 9. RECORD-LEVEL AUTHORIZATION

Role permissions alone are insufficient.

Example:

```text
Engineer
   ↓
plot.read
   ↓
Plot 003
```

The system may still need to determine whether the engineer is authorized to access Plot 003.

Possible future rules may include:

- Assigned estate
- Assigned district
- Assigned inspection
- Department
- Geographic area
- Supervisory relationship

These rules require FHA confirmation.

---

# 10. RECORD SCOPE

The system should support future access scopes such as:

```text
GLOBAL
ESTATE
BLOCK
ASSIGNED
OWN_CREATED
SPECIFIC_RECORD
```

Example:

```text
Engineer A
→ assigned to Estate X
→ can inspect Estate X
→ cannot automatically inspect Estate Y
```

This is only an example; FHA must define the real organizational structure.

---

# 11. OWN-DRAFT ACCESS

For inspections, a useful provisional rule is:

```text
Engineer
→ create inspection
→ edit own draft
→ submit own draft
```

After submission, editing should be restricted unless FHA's workflow allows correction.

---

# 12. INSPECTION ACCESS

Potential states:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
COMPLETED
```

Possible rule:

```text
DRAFT
→ creator can edit

SUBMITTED
→ creator cannot freely modify

UNDER_REVIEW
→ authorized reviewer can review

COMPLETED
→ record protected
```

Final workflow must be confirmed.

---

# 13. APPROVAL ACCESS

Approval records should be treated as authoritative records.

Provisional principle:

```text
Engineer
→ View

Approval Officer
→ View + authorized workflow

Admin
→ Administrative access
```

Do not automatically grant:

```text
Engineer → approval.update
```

---

# 14. GIS ACCESS

Separate:

```text
gis.read
```

from:

```text
gis.data.update
```

A person who needs to use the map does not necessarily need permission to change plot geometry.

---

# 15. GIS EDITING PROTECTION

Changing a plot boundary can affect:

- Property location
- Plot identity
- Development decisions
- Inspection interpretation

Therefore GIS edits should require specific permission.

Potentially require:

```text
gis.data.update
+
audit record
```

---

# 16. DOCUMENT ACCESS LEVELS

The system should eventually support document classification.

Possible provisional levels:

```text
INTERNAL
RESTRICTED
CONFIDENTIAL
```

These names are examples only.

FHA should define official classifications.

---

# 17. DOCUMENT PERMISSION MODEL

Example:

```text
document.read
```

does not necessarily mean:

```text
all documents.read
```

Access should also consider:

```text
document owner/record
document classification
user role
record authorization
```

---

# 18. PHOTO ACCESS

Inspection photographs should follow the permissions of the inspection record unless FHA specifies another rule.

For example:

```text
Can view inspection
        ↓
Can potentially view inspection photos
```

But this must still respect document/photo classification.

---

# 19. GPS ACCESS

GPS information should not automatically be available to every user who can view a plot.

Separate permissions may eventually be used:

```text
inspection.gps.read
inspection.gps.capture
```

The MVP may simplify this if FHA confirms that GPS is ordinary inspection evidence.

---

# 20. PUBLIC USER

The MVP should have:

```text
PUBLIC = NO ACCESS
```

unless FHA specifically requests a public verification feature.

If a public verification portal is later required, create a separate role/data-access model rather than exposing the internal system.

---

# 21. ADMIN DOES NOT MEAN ALL BUSINESS AUTHORITY

Avoid implementing:

```text
ADMIN = unrestricted everything
```

A system administrator needs technical/system access, but business authority should still follow FHA's organizational policy.

Where required, separate:

```text
System Administration
```

from:

```text
Approval Authority
```

---

# 22. PERMISSION CHECKING

Recommended server-side sequence:

```text
Request
 ↓
Authenticate
 ↓
Load user identity
 ↓
Load roles
 ↓
Resolve permissions
 ↓
Check requested action
 ↓
Check record scope
 ↓
Execute operation
 ↓
Audit sensitive mutation
```

---

# 23. FRONTEND PERMISSION CHECKS

The frontend may use permissions to improve UX.

Example:

```text
if can("inspection.create")
    show Start Inspection
```

But this is only a UI convenience.

It must never replace server authorization.

---

# 24. API EXAMPLE

Request:

```text
POST /api/v1/inspections
```

Server should check:

```text
Authenticated?
        ↓
Has inspection.create?
        ↓
Authorized for selected plot?
        ↓
Input valid?
        ↓
Create inspection
        ↓
Audit event
```

---

# 25. DENIED ACCESS

If access is denied, the system should return a safe response.

Example:

```text
403 Forbidden
```

The frontend can display:

```text
You do not have permission to perform this action.
```

Do not reveal unnecessary information about restricted records.

---

# 26. NOT FOUND VS FORBIDDEN

For sensitive resources, consider returning a generic response where appropriate so that unauthorized users cannot determine whether a restricted record exists.

This should be applied consistently with the chosen API architecture.

---

# 27. ROLE ASSIGNMENT

Only authorized administrators should assign roles.

Role changes should be audited.

Example:

```text
Admin
→ assigns ENGINEER
→ User: Staff 004
→ timestamp
→ audit event
```

---

# 28. ROLE REMOVAL

Removing a user's role should immediately affect future authorization decisions.

Do not rely on stale client-side permissions.

Sessions/tokens should be refreshed or revoked where necessary.

---

# 29. USER DISABLE

A disabled account should not be able to authenticate or continue using an active privileged session beyond the approved session-revocation behavior.

The exact implementation depends on the authentication provider.

---

# 30. TEMPORARY ACCESS

Do not implement temporary elevated access unless there is a real business requirement.

If FHA requests it, support:

```text
Granted by
Reason
Permission
Start
Expiry
Audit
```

---

# 31. BREAK-GLASS / EMERGENCY ACCESS

No emergency/break-glass permission should be assumed for this system.

If FHA requires emergency access, it should be explicitly designed with:

- Reason required
- Limited duration
- Strong audit trail
- Post-event review

---

# 32. SEPARATION OF DUTIES

Where appropriate, separate sensitive actions.

For example:

```text
Person A
→ prepares/reviews application

Person B
→ approves/finalizes
```

Do not assume this rule exists until FHA confirms its workflow.

---

# 33. APPROVAL VS INSPECTION SEPARATION

The system must preserve the distinction:

```text
Approval
=
What FHA authorized

Inspection
=
What engineer observed
```

An engineer's inspection should not change the approval automatically.

---

# 34. POTENTIAL DISCREPANCIES

If:

```text
Approved Floors = 2
Observed Floors = 3
```

the system may create:

```text
Potential Difference
```

But it should not automatically:

```text
Cancel Approval
Declare Illegal
Issue Enforcement
```

unless FHA explicitly defines such automation.

---

# 35. AUDITABLE PERMISSION CHANGES

Audit:

```text
Role assigned
Role removed
Permission changed
User disabled
User enabled
```

At minimum capture:

```text
Actor
Target user
Action
Timestamp
```

---

# 36. PERMISSION CONFIGURATION

Avoid hard-coding every permission throughout the UI.

Prefer centralized definitions such as:

```text
permissions.ts
roles.ts
authorization.ts
```

The exact project location should follow the architecture specification.

---

# 37. TYPE SAFETY

Use a controlled set of roles and permissions.

Example conceptual model:

```text
Role
  ENGINEER
  APPROVAL_OFFICER
  GIS_OFFICER
  ADMIN
```

Avoid arbitrary free-text role values.

---

# 38. DATABASE DESIGN

Roles and permissions should be represented in a way that supports future changes.

Possible conceptual relationships:

```text
User
 ↓
UserRole
 ↓
Role
 ↓
RolePermission
 ↓
Permission
```

Record-level scopes may be added later.

---

# 39. NO HARDCODED USER BYPASS

Never implement code such as:

```text
if email === "engineer@example.com"
    allowAdmin()
```

Never use personal accounts as security exceptions.

---

# 40. DEVELOPMENT BYPASS

If a development bypass is temporarily required:

- Keep it development-only.
- Make it impossible in production configuration.
- Do not commit production credentials.
- Clearly document it.
- Remove it before production.

The prototype should preferably avoid bypasses entirely.

---

# 41. TEST MATRIX

The AI agent should create authorization tests for at least:

### Engineer

- [ ] Can view authorized plot
- [ ] Can search authorized plots
- [ ] Can create inspection
- [ ] Can capture inspection evidence
- [ ] Can submit inspection
- [ ] Cannot modify approval without permission
- [ ] Cannot manage users
- [ ] Cannot manage GIS data

### Approval Officer

- [ ] Can view authorized applications
- [ ] Can view approvals
- [ ] Can perform only confirmed approval actions
- [ ] Cannot perform admin functions without permission

### GIS Officer

- [ ] Can view GIS
- [ ] Can perform confirmed GIS operations
- [ ] Cannot automatically modify approvals

### Admin

- [ ] Can manage authorized users
- [ ] Can manage roles
- [ ] Can view audit logs
- [ ] Does not automatically receive unconfirmed business permissions

---

# 42. UI ACCEPTANCE CHECKLIST

- [ ] Unauthorized actions are hidden where practical
- [ ] Direct API requests are still protected
- [ ] Role changes update access
- [ ] Restricted documents cannot be opened directly
- [ ] Restricted plots cannot be retrieved through manipulated IDs
- [ ] GIS editing is restricted
- [ ] Inspection submission is permission-controlled
- [ ] Approval modification is permission-controlled
- [ ] User management is restricted

---

# 43. FHA CONFIRMATION REQUIRED

The following are intentionally unresolved:

1. Official role names
2. Number of departments
3. Engineer access scope
4. Estate/block assignment rules
5. Approval officer responsibilities
6. GIS officer responsibilities
7. Administrator responsibilities
8. Public verification access
9. Document classifications
10. Approval modification authority
11. Inspection review authority
12. Inspection editing after submission
13. Record archival authority
14. Export permissions
15. GIS import/edit authority
16. Audit-log access
17. Separation-of-duties requirements

These must not be invented by the AI agent.

---

# 44. PROTOTYPE DEFAULT

Until FHA confirms the final permission model:

```text
Authenticated user
        ↓
Basic role
        ↓
Read-only access to relevant demo records
        ↓
Engineer can demonstrate inspection workflow
        ↓
Sensitive administrative mutations remain restricted
```

This is safer for a prototype.

---

# 45. RECOMMENDED MVP ROLE SET

For the first demonstration, use:

```text
1. Engineer
2. Administrator
```

Optionally add:

```text
3. Approval Officer
4. GIS Officer
```

if the prototype needs to demonstrate those workflows.

The exact choice should follow the engineer's requested demonstration scope.

---

# 46. FINAL ACCESS-CONTROL MODEL

```text
                         USER
                           │
                           ▼
                    AUTHENTICATION
                           │
                           ▼
                      USER ROLE
                           │
                           ▼
                     PERMISSION
                           │
                           ▼
                    RECORD SCOPE
                           │
                           ▼
                       ACTION
                           │
                           ▼
                      AUDIT LOG
```

Every layer matters.

---

# 47. FINAL PRINCIPLE

The AI agent must never reason:

> "The user is an FHA employee, therefore the user can access everything."

Instead:

> "The user is authenticated, has a defined role, has the required permission, and is authorized for this particular record and action."

That principle should remain at the center of the authorization implementation.

---

**END OF AUTHORIZATION_RBAC.md**
