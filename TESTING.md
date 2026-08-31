# TESTING.md
# FHA Development Approval & Property Mapping System
## MVP Testing Strategy & Acceptance Plan

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026

**Primary Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Build Plan:** `MVP_BUILD_PLAN.md`  
**AI Instructions:** `AGENTS.md`  
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

This document defines how the FHA MVP should be tested before it is demonstrated to the FHA engineer/team.

The objective is to confirm that the core workflow actually works:

```text
LOGIN
  ↓
GIS MAP
  ↓
SEARCH / SELECT PLOT
  ↓
PLOT DETAILS
  ↓
APPROVAL
  ↓
DOCUMENT
  ↓
INSPECTION
  ↓
GPS / PHOTO / OBSERVATION
  ↓
APPROVED VS OBSERVED
  ↓
FINDING
  ↓
SUBMIT
  ↓
HISTORY
```

The MVP does not need a large enterprise test program at this stage, but all core paths must be reliable.

---

# 2. TESTING PRINCIPLES

The AI coding agent must:

- Test functionality, not just UI appearance.
- Test the main user journey end-to-end.
- Test failure cases.
- Test authorization server-side.
- Test GIS ↔ plot relationships.
- Test approval ↔ property relationships.
- Test inspection ↔ plot relationships.
- Ensure approved information is not overwritten by observations.
- Clearly distinguish demo data from official FHA data.
- Avoid claiming a feature works unless it has been tested.

---

# 3. MVP TEST LEVELS

Use these test levels:

```text
1. Unit Tests
2. Integration Tests
3. API Tests
4. UI Tests
5. GIS Tests
6. Security / Authorization Tests
7. Responsive / Device Tests
8. End-to-End Demonstration Test
```

Not every component requires all levels.

---

# 4. TEST ENVIRONMENTS

Use separate environments where practical:

```text
Development
    ↓
Demonstration / Staging
```

Do not run prototype testing against a production FHA database.

Use synthetic/demo records unless FHA explicitly authorizes test data.

---

# 5. TEST DATA PRINCIPLES

The test dataset should be deterministic.

Recommended demo records:

```text
Estate:
FHA Demo Estate

Blocks:
A
B
C

Plots:
001–020
```

At least one plot should contain:

```text
Property record
Approval
Document
Inspection
```

Plot 003 should be the primary end-to-end test record.

---

# 6. REQUIRED TEST SCENARIOS

At minimum, include:

```text
Approved plot
Pending plot
Plot under construction
Plot with inspection
Plot with potential discrepancy
Plot without approval record
```

These are demonstration scenarios only.

---

# 7. UNIT TESTS

Unit tests should cover isolated business logic.

Priority examples:

### Plot lookup

Given a valid plot ID, return the correct plot.

### Approval lookup

Given a valid approval ID, return the correct approval.

### Approval comparison

Given:

```text
Approved floors = 2
Observed floors = 3
```

the comparison service should identify a difference.

### No false difference

Given:

```text
Approved floors = 2
Observed floors = 2
```

the service should not create a floor-count difference.

### Validation

Invalid:

```text
latitude = 500
```

must be rejected.

### Status validation

Unsupported status values must be rejected.

---

# 8. DATABASE TESTS

Verify:

- Foreign-key relationships
- Required fields
- Valid IDs
- Stable relationships
- Spatial fields where enabled
- Duplicate handling
- Transaction behavior

Examples:

```text
Plot belongs to Estate
```

```text
Inspection belongs to Plot
```

```text
Inspection approval reference points to valid Approval where provided
```

---

# 9. DATABASE INTEGRITY TESTS

Test that:

### Approval data remains unchanged

Create:

```text
Approval:
2 floors
4 units
```

Create inspection:

```text
Observed:
3 floors
6 units
```

Verify approval remains:

```text
2 floors
4 units
```

### Historical inspections remain

Create two inspections.

Verify both remain available in history.

---

# 10. API TESTS

Every protected endpoint should be tested for:

```text
Valid request
Invalid request
Unauthorized request
Not found
Permission denied
Server failure
```

---

# 11. PLOT API TESTS

Test:

```text
GET plot
GET plot list
GET plot search
GET plot map feature
```

### Examples

Valid:

```text
Plot 003
```

Expected:

```text
Plot record returned
```

Invalid:

```text
Nonexistent plot
```

Expected:

```text
404 / safe not-found response
```

Unauthorized:

Expected:

```text
403 or appropriate safe response
```

---

# 12. APPROVAL API TESTS

Test:

```text
Get approval
List approvals
Verify approval record
```

Test:

```text
Approval exists
Approval does not exist
Approval access denied
Invalid approval ID
```

Do not test or implement unsupported legal claims such as automatic fraud detection unless FHA explicitly requires them.

---

# 13. DOCUMENT API TESTS

Test:

```text
List documents
View authorized document
Attempt unauthorized document access
Upload valid document
Reject invalid file
Reject oversized file
```

Important:

Changing the document ID in a request must not allow access to another protected document.

---

# 14. INSPECTION API TESTS

Test:

```text
Create inspection
Update draft
Save GPS
Upload photo
Create finding
Generate comparison
Submit inspection
View history
```

Also test:

```text
Cannot submit invalid inspection
Cannot submit unauthorized inspection
Cannot modify finalized inspection unless permitted
```

---

# 15. GIS TESTS

GIS is a core component.

Test:

### Estate loading

The selected estate appears.

### Plot rendering

Expected plots appear.

### Plot selection

Clicking a plot returns the correct `plot_id`.

### Plot lookup

Selected `plot_id` returns correct database record.

### Search

Searching Plot 003 centers/highlights the correct plot.

### Map synchronization

Opening Plot Details from the map shows the selected property.

---

# 16. GIS DATA INTEGRITY

Test:

```text
GIS feature plot_id
        ↓
Database plot_id
```

Must resolve to the correct property.

Test for:

- Missing plot ID
- Duplicate plot ID
- GIS feature without property record
- Property record without GIS geometry

The application must report these as data-quality conditions rather than silently creating incorrect relationships.

---

# 17. GIS GEOMETRY TESTS

Where geometry is available, verify:

- Geometry exists
- Geometry can render
- Geometry is valid
- Correct CRS is documented
- Plot is displayed in the expected area

Do not treat demo geometry as official FHA cadastral data.

---

# 18. GPS TESTS

Because ordinary desktop browsers may not provide GPS, use:

### Mobile/device test

Verify:

```text
Permission request
Location capture
Latitude
Longitude
Accuracy
Timestamp
```

### Permission denied

Expected:

```text
Clear error/instruction
```

### GPS unavailable

Expected:

```text
Clear unavailable state
```

Do not fabricate successful GPS capture.

---

# 19. GPS SPATIAL TEST

If point-in-polygon checking is implemented:

### Case A

GPS point inside selected plot.

Expected:

```text
Within expected area
```

### Case B

GPS point outside selected plot.

Expected:

```text
Location review
```

Do not automatically classify it as a legal boundary violation.

---

# 20. PHOTO TESTS

Test:

- Capture/upload photo
- Multiple photos
- Caption if enabled
- Upload success
- Upload failure
- File-size validation
- File-type validation
- Secure retrieval
- Association with correct inspection

Verify that unauthorized users cannot retrieve photos by manipulating IDs.

---

# 21. APPROVED VS OBSERVED TESTS

This is a key business-logic area.

### Test 1 — Match

```text
Approved floors = 2
Observed floors = 2
```

Expected:

```text
No floor difference
```

### Test 2 — Difference

```text
Approved floors = 2
Observed floors = 3
```

Expected:

```text
Potential difference detected
```

### Test 3 — Multiple differences

```text
Approved:
2 floors / 4 units

Observed:
3 floors / 6 units
```

Expected:

```text
Floor difference
Unit difference
```

### Test 4 — Approval remains unchanged

After comparison:

```text
Approval still = 2 floors / 4 units
```

---

# 22. INSPECTION STATE TESTS

If MVP uses:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
COMPLETED
```

test valid transitions.

Example:

```text
DRAFT
 ↓
SUBMITTED
```

Invalid example:

```text
COMPLETED
 ↓
DRAFT
```

should be blocked unless a defined workflow allows it.

---

# 23. WORKFLOW TEST — MAIN DEMO

This is the most important test.

### Preconditions

- Demo user exists.
- Demo estate exists.
- Plot 003 exists.
- Plot 003 has a demo approval.
- Approval has a demo document.
- User can create inspection.

### Steps

1. Open login.
2. Log in.
3. Open dashboard.
4. Open map.
5. Search Plot 003.
6. Select Plot 003.
7. Open Plot Details.
8. View approval.
9. Open document.
10. Start inspection.
11. Capture GPS or use an explicitly labelled demo fallback if GPS is unavailable.
12. Capture/upload photo.
13. Enter observed floors.
14. Enter observed units.
15. Generate comparison.
16. Add finding.
17. Review summary.
18. Submit inspection.
19. Open inspection history.

### Expected result

Every step succeeds without data inconsistency.

---

# 24. NEGATIVE END-TO-END TEST

Test:

```text
Search nonexistent plot
```

Expected:

```text
No matching property found
```

Then:

```text
Attempt to open restricted record
```

Expected:

```text
Access denied / safe response
```

Then:

```text
Attempt invalid inspection submission
```

Expected:

```text
Validation error
```

---

# 25. AUTHORIZATION TESTS

For each important action test:

### Engineer

Should be able to perform approved inspection actions.

Should not automatically be able to:

- Manage users
- Change official GIS geometry
- Modify approval records

### Administrator

Should have the appropriate administrative permissions.

Do not assume admin has business approval authority unless explicitly configured.

---

# 26. OBJECT-LEVEL SECURITY TEST

This is essential.

Example:

```text
User authorized for Plot 003
```

Attempts:

```text
GET /plots/004
```

If Plot 004 is outside the user's authorized scope, access must be denied.

Do not rely on hidden UI buttons.

---

# 27. DOCUMENT OBJECT-LEVEL SECURITY

Test:

```text
Authorized:
Document A → allowed

Unauthorized:
Document B → denied
```

Attempt access by changing the document ID directly.

Expected:

```text
Access denied
```

---

# 28. INPUT SECURITY TESTS

Test malicious/invalid values such as:

```text
' OR 1=1 --
<script>alert(1)</script>
../../../secret
Very long text
Invalid UUID
Invalid coordinates
Invalid dates
Invalid status
```

Expected:

- Validation/rejection
- No SQL injection
- No script execution
- No unauthorized file access
- No application crash

---

# 29. FILE SECURITY TESTS

Test:

```text
Allowed document
Allowed image
Unsupported extension
Incorrect MIME type
Oversized file
Malicious filename
Path traversal filename
```

Expected:

```text
Safe rejection
```

Never trust filename or extension alone.

---

# 30. ERROR HANDLING TESTS

Force:

- API failure
- Database failure
- GIS failure
- Upload failure
- Network failure
- Session expiration

Verify:

- User sees understandable message
- App does not expose stack traces
- No false success appears
- Data is not silently lost
- Retry works where appropriate

---

# 31. SESSION TESTS

Test:

```text
Login
Logout
Expired session
Invalid session
Revoked account
```

Protected pages should not remain accessible after authorization has been invalidated.

---

# 32. RESPONSIVE TESTS

Test at least:

### Desktop

- Large workstation screen

### Tablet

- Touch interface

### Mobile

- Android phone

Minimum mobile test:

```text
Open map
Select plot
Open details
Start inspection
Capture GPS
Capture photo
Enter observation
Submit
```

---

# 33. BROWSER TESTS

Use the primary supported browsers selected for the project.

At minimum test the current development browser and a Chromium-based browser.

Additional browsers should be tested if FHA requires them.

Do not claim broad browser compatibility without testing.

---

# 34. PERFORMANCE CHECKS

For the MVP, verify:

- Dashboard loads reasonably quickly
- Map loads without obvious freezing
- Plot selection responds promptly
- Search returns promptly
- Documents do not block the whole page
- Photo upload shows progress/feedback
- Large images are not unnecessarily loaded in full size

Avoid loading complete inspection/document histories for every map plot.

---

# 35. DATA CONSISTENCY TEST

After an inspection submission:

Verify:

```text
Plot still correct
Approval still correct
Inspection exists
Photos exist
Findings exist
History updated
Audit event exists where implemented
```

---

# 36. AUDIT TESTS

For important actions, verify audit records are created where required.

Example:

```text
Create inspection
→ audit event

Submit inspection
→ audit event
```

Audit logs should identify:

- User
- Action
- Record
- Timestamp

---

# 37. DEMO DATA RESET TEST

If a development-only seed/reset process exists:

```text
Reset
 ↓
Seed
 ↓
Expected demo records restored
```

Do not expose reset functions publicly.

---

# 38. DATA MIGRATION TESTING

Full FHA data migration is outside the MVP.

When it begins later, test:

- Plot identifier matching
- GIS geometry matching
- Duplicate detection
- Missing records
- Document associations
- Source-to-target counts
- Data-quality exceptions

This belongs to a later migration process.

---

# 39. TEST CASE FORMAT

For significant tests, use:

```text
Test ID:
Title:
Purpose:
Preconditions:
Steps:
Expected Result:
Actual Result:
Status:
Notes:
```

Example:

```text
Test ID:
GIS-001

Title:
Select plot from map

Purpose:
Verify map feature connects to correct plot record.

Preconditions:
Demo map loaded.

Steps:
1. Click Plot 003.
2. Open details.

Expected:
Plot 003 record is displayed.

Status:
PASS
```

---

# 40. MVP REGRESSION TEST

Before every major demonstration build, repeat the main flow:

```text
Login
Map
Search
Select Plot
Details
Approval
Document
Inspection
GPS/Photo
Comparison
Finding
Submit
History
```

A change to the map must not accidentally break inspection.

A change to the database must not break approval display.

A change to authorization must not break legitimate engineer actions.

---

# 41. DEFECT PRIORITY

Use:

### P0 — Blocking

Application cannot start or core data is corrupted.

### P1 — Critical

Main MVP workflow cannot be completed.

### P2 — Major

Important feature is broken but workaround exists.

### P3 — Minor

Cosmetic or low-impact issue.

For the first FHA demonstration, all P0 and P1 issues should be resolved.

---

# 42. ACCEPTANCE CRITERIA

The MVP is ready for engineer demonstration when:

### Core

- [ ] Login works
- [ ] Dashboard works
- [ ] Map works
- [ ] Plot search works
- [ ] Plot selection works
- [ ] Plot details work
- [ ] Approval display works
- [ ] Approval verification works
- [ ] Documents work
- [ ] Inspection works
- [ ] GPS works on supported mobile/device or fallback is clearly labelled
- [ ] Photos work
- [ ] Observations work
- [ ] Comparison works
- [ ] Findings work
- [ ] Submission works
- [ ] History works

### Security

- [ ] Protected routes work
- [ ] Server authorization works
- [ ] Unauthorized records are protected
- [ ] Documents are protected
- [ ] Inputs are validated
- [ ] Secrets are not exposed

### UX

- [ ] Loading states work
- [ ] Error states work
- [ ] Empty states work
- [ ] Mobile inspection works
- [ ] Demo data is clearly labelled

---

# 43. FHA DEMONSTRATION TEST

Before showing the prototype to FHA:

1. Reset demo environment.
2. Seed deterministic data.
3. Verify map.
4. Verify Plot 003.
5. Verify approval.
6. Verify document.
7. Perform a new inspection.
8. Test GPS where possible.
9. Add a photo.
10. Enter a deliberate demo discrepancy.
11. Submit.
12. Verify inspection history.
13. Verify no official/demo data was accidentally mixed.
14. Verify no development secrets are exposed.

---

# 44. TEST EVIDENCE

Where practical, retain:

- Screenshots
- Test output
- Error logs
- API test results
- Browser/device results
- Known limitations

Do not store sensitive real FHA information in public test reports.

---

# 45. KNOWN MVP LIMITATIONS

The test report should explicitly state limitations such as:

```text
Prototype uses synthetic GIS data.
Prototype uses fictional property records.
Production FHA GIS data has not yet been integrated.
Official FHA approval statuses have not yet been confirmed.
Production hosting/security requirements have not yet been confirmed.
```

Do not hide limitations from the FHA reviewer.

---

# 46. AI AGENT TESTING RULES

The AI coding agent must:

1. Run relevant tests after significant changes.
2. Fix broken core tests before proceeding.
3. Never mark an untested feature as complete.
4. Add tests for new critical business logic.
5. Test both success and failure paths.
6. Test authorization for protected operations.
7. Test GIS ↔ plot relationships.
8. Test approved-vs-observed logic.
9. Test document access.
10. Test mobile inspection workflows where available.

---

# 47. FINAL TEST PRINCIPLE

The most important test is not whether every screen looks complete.

The most important test is:

```text
Can an FHA engineer
find a property,
see its location,
see its approval,
inspect the site,
record evidence,
compare approved vs observed information,
submit the inspection,
and retrieve the resulting history
without data inconsistency or unauthorized access?
```

If the answer is yes, the MVP has achieved its primary technical objective.

---

**END OF TESTING.md**
