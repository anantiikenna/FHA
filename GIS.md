# GIS.md
# FHA Development Approval & Property Mapping System
## MVP GIS / Mapping Specification

**Project Status:** MVP / Prototype  
**Version:** 0.1  
**Date:** 31 August 2026  
**Primary Product Specification:** `FHA_MVP_Development_Approval_Property_Mapping_System.md`  
**Architecture Reference:** `ARCHITECTURE.md`  
**Database Reference:** `DATABASE.md`  
**AI Engineering Instructions:** `AGENTS.md`

---

# 1. PURPOSE

This document defines the GIS and mapping requirements for the FHA Development Approval & Property Mapping System MVP.

The core idea is:

> An authorized FHA user should be able to open a map, locate an estate/area, see relevant plots, select a plot, and retrieve the FHA property/development information associated with that plot.

The GIS component is therefore not merely a decorative map.

It is the geographic interface connecting:

```text
REAL-WORLD LOCATION
        ↓
ESTATE
        ↓
BLOCK
        ↓
PLOT
        ↓
FHA PROPERTY RECORD
        ↓
APPROVAL
        ↓
INSPECTION
```

This document is a technical proposal for the prototype. Official FHA GIS standards, survey data, coordinate systems and data ownership rules must be confirmed before production.

---

# 2. WHAT GIS MEANS IN THIS PROJECT

GIS means **Geographic Information System**.

For this application, GIS allows FHA officers to work with information according to geographic location.

Instead of only searching:

```text
Plot Number: 003
```

an officer could visually see:

```text
        ROAD
────────────────────────

 [001] [002] [003] [004]

 [005] [006] [007] [008]

────────────────────────
        ROAD
```

The officer can select Plot 003 on the map and open its associated record.

That is the main GIS value for this MVP.

---

# 3. MVP GIS OBJECTIVES

The prototype should demonstrate:

1. Estate map
2. Plot boundaries
3. Plot numbers
4. Map navigation
5. Plot selection
6. Plot highlighting
7. Plot search
8. Plot information panel
9. Connection between map and database
10. Optional engineer GPS location
11. Basic inspection location capture

---

# 4. GIS IS NOT THE SAME AS GOOGLE MAPS

The application may use a normal online basemap such as roads/satellite imagery where appropriate.

However:

```text
Basemap
```

and

```text
FHA cadastral/property GIS data
```

are different things.

Example:

### Basemap

Shows:

- Roads
- Buildings
- General geographic context
- Satellite imagery

### FHA property layer

Shows:

- Estate
- Block
- Plot boundaries
- Plot numbers
- FHA property identifiers

The property layer is the important part for the FHA workflow.

---

# 5. CORE GIS DATA MODEL

The fundamental spatial hierarchy should be:

```text
Estate
   │
   └── Block
          │
          └── Plot
                 │
                 └── Property Record
```

Every plot displayed on the map should have a stable relationship to its database record.

Conceptually:

```text
GIS Feature
     │
     └── plot_id
            │
            ▼
       plots table
            │
            ├── Property Interest
            ├── Application
            ├── Approval
            └── Inspection
```

---

# 6. PLOT POLYGONS

The preferred representation of an individual plot is a polygon.

Example:

```text
       Plot 001
     ┌───────────┐
     │           │
     │           │
     │           │
     └───────────┘
```

A polygon represents the spatial boundary of the plot.

The application should not create official plot boundaries from a simple point unless FHA specifically provides point-only data.

---

# 7. PLOT IDENTIFIER

Each map plot feature must contain a stable identifier linking it to the database.

Example:

```text
plot_id = 7b9c...UUID
```

Display information:

```text
Plot 003
```

The application should use the internal `plot_id` for system relationships.

Do not rely only on:

```text
plot_number = 003
```

because numbering can potentially repeat across estates or blocks.

---

# 8. OFFICIAL GIS DATA

Priority for production data:

1. FHA official GIS data
2. FHA official survey/spatial data
3. FHA-approved converted spatial data
4. Other approved authoritative sources
5. Synthetic demo data

The prototype may use synthetic data.

Synthetic/demo geometry must be clearly identified and must never be presented as an official FHA cadastral boundary.

---

# 9. ACCEPTABLE GIS DATA FORMATS

The system may eventually receive spatial information in formats such as:

```text
GeoJSON
Shapefile
GeoPackage
KML
KMZ
PostGIS
CAD/DWG
Survey data
```

The exact formats available from FHA must be confirmed.

The application should use an import/conversion process rather than forcing officers to manually redraw plots.

---

# 10. GIS DATA IMPORT PIPELINE

Recommended:

```text
FHA Source Data
      ↓
Source Validation
      ↓
Coordinate System Identification
      ↓
Format Conversion
      ↓
Geometry Validation
      ↓
Plot Identifier Validation
      ↓
Database Matching
      ↓
Duplicate / Error Detection
      ↓
Review
      ↓
Publish to GIS Layer
```

Never directly publish unvalidated spatial data to production.

---

# 11. COORDINATE REFERENCE SYSTEM

A GIS dataset has a coordinate reference system (CRS).

The application must not assume that every FHA source file uses the same CRS.

Before importing official data, identify:

- CRS name
- EPSG code where applicable
- Units
- Datum
- Source
- Transformation requirements

The production CRS must be selected based on the authoritative FHA survey/GIS data and system requirements.

---

# 12. DEMO CRS

For the prototype, a documented CRS can be selected for the demo dataset.

The AI agent must record the chosen CRS in the project's GIS configuration/documentation.

Do not silently mix coordinates from different coordinate systems.

---

# 13. MAP LAYERS

The MVP should use a layered map architecture.

Recommended conceptual layers:

```text
BASE MAP
   │
   ├── Roads
   ├── Satellite/imagery where available
   └── Geographic context

FHA GIS LAYERS
   │
   ├── Estate Boundary
   ├── Block Boundaries
   └── Plot Boundaries

OPTIONAL
   │
   ├── Plot Labels
   ├── Inspection Locations
   └── Current GPS Location
```

---

# 14. LAYER VISIBILITY

The user should eventually be able to toggle relevant layers.

Example:

```text
☑ Estate Boundary
☑ Blocks
☑ Plots
☑ Plot Numbers
☐ Inspection Locations
☐ GPS Location
```

For the MVP, layer controls can be simplified.

---

# 15. MAP USER INTERACTION

Minimum interactions:

### Pan

Move around the map.

### Zoom

Zoom in/out.

### Select

Click/tap a plot.

### Highlight

Selected plot becomes visually distinct.

### Search

Search for a plot and move the map to it.

### Reset

Return to the selected estate/area.

---

# 16. PLOT SELECTION WORKFLOW

```text
User opens map
      ↓
Selects estate
      ↓
Map displays plots
      ↓
User clicks plot
      ↓
GIS feature returns plot_id
      ↓
Application requests plot record
      ↓
Server checks authorization
      ↓
Plot details returned
      ↓
Details panel opens
```

The map should not directly query sensitive database information from the browser.

---

# 17. MAP + DATABASE CONNECTION

The critical relationship is:

```text
Map Polygon
     ↓
plot_id
     ↓
Database Plot
     ↓
Property Record
     ↓
Approval
     ↓
Inspection History
```

This is the foundation of the system.

---

# 18. MAP SEARCH

MVP search should support at least:

```text
Plot Number
Block
Estate
Application Number
Approval Number
```

When a plot is found:

```text
Search
 ↓
Matching plot
 ↓
Map flies/zooms to location
 ↓
Plot highlighted
 ↓
Plot details available
```

Search must respect user authorization.

---

# 19. SEARCH RESULT EXAMPLE

Example:

```text
Search: Plot 003

Result:

FHA Festac Estate
Block A
Plot 003
```

Selecting the result should:

1. Center the map.
2. Highlight the plot.
3. Open the plot details panel.

---

# 20. PLOT LABELS

Plot labels can display:

```text
003
004
005
```

Labels should be visible at appropriate zoom levels.

Do not display thousands of labels simultaneously at low zoom.

Use zoom-dependent rendering where necessary.

---

# 21. MAP POPUP

When a plot is selected, a compact popup can show:

```text
Plot 003

Block A
650 sqm

Approval:
Approved

[View Details]
```

The popup should not attempt to display the complete property record.

Use the full Plot Details page/panel for detailed information.

---

# 22. MAP SIDE PANEL

Recommended MVP interaction:

```text
┌──────────────────────────────────────────────┐
│ Search plot...                               │
├───────────────┬──────────────────────────────┤
│               │                              │
│   Map         │ Plot Details                 │
│               │                              │
│ [001][002]    │ Plot 003                     │
│ [003][004] ←  │ Block A                      │
│ [005][006]    │ Status: Approved             │
│               │                              │
│               │ [View Full Record]           │
│               │                              │
└───────────────┴──────────────────────────────┘
```

This provides a strong demonstration for the engineer.

---

# 23. PROPERTY STATUS VISUALIZATION

The map may eventually use visual status categories.

For example:

```text
Approved
Pending
No approval record
Inspection required
Under review
```

However, status colors must be approved by FHA.

Do not assume that a missing database record means illegal/unapproved development.

Example:

```text
NO APPROVAL RECORD FOUND
```

is safer than:

```text
ILLEGAL
```

unless FHA defines and authorizes that determination.

---

# 24. MAP LEGEND

If status visualization is used, provide a legend.

Example:

```text
Legend

Approved
Pending
Review Required
No Record Found
```

The exact categories and visual treatment require FHA confirmation.

---

# 25. GPS FUNCTION

The engineer may use a mobile/tablet device during inspection.

The system can request the device's location.

Conceptually:

```text
Engineer presses:
[Capture Current Location]

       ↓

Device GPS
       ↓
Latitude
Longitude
Accuracy
Timestamp
       ↓
Inspection Record
```

The user must grant location permission.

---

# 26. GPS ACCURACY

Where supported, store:

```text
latitude
longitude
accuracy
timestamp
```

Example:

```text
Latitude: 6.xxxxxx
Longitude: 3.xxxxxx
Accuracy: 8m
```

The displayed precision should be appropriate to the actual GPS accuracy.

Do not describe ordinary phone GPS as survey-grade positioning.

---

# 27. GPS VS OFFICIAL SURVEY

This distinction is critical.

### Official plot geometry

May represent authoritative survey/cadastral information.

### Phone GPS

Represents the approximate location captured during field inspection.

They are not automatically interchangeable.

---

# 28. GPS DISCREPANCY

The system may calculate the relationship between:

```text
Inspection GPS point
```

and

```text
Selected plot polygon
```

Possible result:

```text
GPS point appears within selected plot
```

or:

```text
GPS point is outside selected plot
```

This should be treated as an observation/technical flag.

It should not automatically declare a boundary violation or ownership dispute.

---

# 29. INSPECTION MAP

During inspection, the engineer may see:

```text
┌─────────────────────────────┐
│ Current Location            │
│            ●                │
│                             │
│     ┌──────────────┐        │
│     │    PLOT 003  │        │
│     │              │        │
│     └──────────────┘        │
│                             │
└─────────────────────────────┘

[Capture GPS]
[Take Photo]
[Continue Inspection]
```

The exact UI will be defined in `UI_UX.md`.

---

# 30. INSPECTION PHOTOS + LOCATION

Where device capabilities permit, a photo may be associated with:

```text
inspection_id
latitude
longitude
captured_at
```

This provides useful evidence context.

Do not claim that photo GPS metadata is always reliable; device settings and file processing can affect metadata.

---

# 31. BASEMAP PROVIDER

The application should use a map provider that is technically and legally appropriate.

Possible provider categories include:

- Open-source/open-data mapping
- Commercial map services
- Government mapping services
- FHA-provided map services

The final provider must consider:

- Cost
- Licensing
- API limits
- Offline requirements
- Satellite availability
- Data residency/security
- Performance
- Government procurement requirements

Do not hard-code the architecture around one provider unnecessarily.

---

# 32. GIS PROVIDER ABSTRACTION

The application should isolate map-provider-specific functionality.

Conceptually:

```text
Map UI
   ↓
Map Adapter
   ↓
Map Provider
```

This makes it easier to change providers later.

---

# 33. TILE / VECTOR DATA

For the MVP, normal map tiles may be sufficient.

For larger production datasets, consider:

- Vector tiles
- Spatial APIs
- Viewport-based queries
- Geometry simplification
- Tile caching

Do not load the entire national property dataset into the browser.

---

# 34. SPATIAL QUERIES

The production system may need queries such as:

```text
Find plots within current map viewport
```

or:

```text
Find plot containing GPS point
```

or:

```text
Find plots near a location
```

These should be performed using spatial database functionality where appropriate.

---

# 35. POINT-IN-POLYGON

A useful future operation:

```text
GPS Point
    ↓
Which plot polygon contains this point?
```

Conceptually:

```text
GPS ●
     ↓
Spatial query
     ↓
Plot 003
```

This can assist field workflows.

It must not replace official surveying or adjudication.

---

# 36. PLOT BOUNDARY EDITING

### MVP

Do **not** allow ordinary users to edit official plot boundaries.

### Future

A controlled GIS administration workflow may support:

- Geometry correction
- Boundary updates
- Data imports
- Versioning
- Approval workflow

Such functionality should require specific permissions and audit trails.

---

# 37. GIS ADMINISTRATION

Future GIS administration may include:

```text
Import GIS data
Validate
Preview
Compare
Approve publication
Publish
Archive old layer
```

This is outside the basic MVP.

---

# 38. GIS DATA VERSIONING

Official GIS data can change.

Production should eventually support:

```text
GIS Dataset Version 1
       ↓
GIS Dataset Version 2
       ↓
GIS Dataset Version 3
```

The system should preserve enough metadata to identify which dataset/version was used.

Do not implement complex GIS versioning in the MVP unless FHA requires it.

---

# 39. GIS METADATA

For imported datasets, retain metadata such as:

```text
source
source_date
import_date
coordinate_reference_system
data_provider
dataset_version
import_job_id
```

This is important for data provenance.

---

# 40. GIS DATA QUALITY

The system should eventually detect:

- Missing plot numbers
- Duplicate plot identifiers
- Invalid geometry
- Self-intersecting polygons
- Overlapping plots
- Missing estate/block relationships
- Missing coordinates
- Unmatched database records
- Unmatched GIS records

These should generate data-quality warnings rather than silently modifying data.

---

# 41. GEOMETRY VALIDATION

Before publication:

```text
Geometry exists
      ↓
Geometry valid
      ↓
Correct CRS
      ↓
Reasonable extent
      ↓
Correct plot identifier
      ↓
Associated database record
```

Invalid records should be reported for correction.

---

# 42. OVERLAPPING PLOTS

If two plot polygons overlap unexpectedly, the system should flag the condition.

It should not automatically modify either polygon.

Example:

```text
DATA QUALITY ISSUE

Plots 003 and 004 have overlapping geometry.

Action:
Review required.
```

---

# 43. MISSING GIS RECORD

If a database plot exists but no GIS geometry exists:

```text
Plot 003
GIS geometry unavailable
```

Do not create a fake polygon automatically.

---

# 44. GIS RECORD WITHOUT PROPERTY RECORD

If a GIS polygon exists but cannot be matched to a property record:

```text
Unmatched GIS Feature

Plot Reference: 003
Property record: Not found
```

This should be treated as a data integration issue.

---

# 45. SECURITY

GIS data can contain sensitive property information.

The system should distinguish between:

```text
Public map information
```

and:

```text
Internal FHA property information
```

The MVP is intended primarily for authorized users.

Do not expose internal property records through public map endpoints.

---

# 46. API RESPONSE FOR MAP

The map should receive only the fields necessary for map rendering.

Example conceptual response:

```text
{
  "plotId": "...",
  "plotNumber": "003",
  "block": "A",
  "geometry": "...",
  "status": "APPROVED"
}
```

Detailed information should be requested only after selection.

This reduces performance and data exposure.

---

# 47. MAP API SECURITY

Every map/property request must validate:

```text
Authenticated user
      ↓
User role
      ↓
Permission
      ↓
Requested area/record
```

Do not rely on hiding map layers in the frontend as a security mechanism.

---

# 48. MAP PERFORMANCE

The application should:

- Load only relevant map data
- Avoid rendering unnecessary detail
- Use viewport-based loading where appropriate
- Simplify geometry at low zoom
- Lazy-load detailed records
- Avoid loading all photos/documents with map features

The prototype can use a smaller dataset and simpler implementation.

---

# 49. RESPONSIVE GIS UI

The map should work on:

### Desktop

Large map + side panel.

### Tablet

Map + collapsible details.

### Mobile

Map full-screen with bottom sheet/details panel.

Field inspection should prioritize touch-friendly controls.

---

# 50. MOBILE FIELD MODE

A future field mode may provide:

```text
Current location
     ↓
Nearby plots
     ↓
Select plot
     ↓
Property record
     ↓
Approval
     ↓
Start inspection
     ↓
Capture GPS
     ↓
Capture photos
     ↓
Record observations
```

The MVP may demonstrate this flow without full offline capability.

---

# 51. OFFLINE GIS

Offline maps are not required for the first MVP unless FHA specifically requests them.

Future offline capability may require:

- Downloaded map areas
- Local plot data
- Local inspection storage
- Sync
- Conflict handling

Do not implement offline synchronization prematurely.

---

# 52. MAP SCREEN MVP

The initial map screen should ideally include:

```text
┌─────────────────────────────────────────────────┐
│ FHA Development Map                  User Menu  │
├─────────────────────────────────────────────────┤
│ Search plot / approval...                       │
├───────────────┬─────────────────────────────────┤
│ Filters       │                                 │
│               │                                 │
│ Estate        │              MAP                │
│ Block         │                                 │
│ Status        │        ┌────┐ ┌────┐            │
│               │        │001 │ │002 │            │
│               │        └────┘ └────┘            │
│               │        ┌────┐ ┌────┐            │
│               │        │003 │ │004 │            │
│               │        └────┘ └────┘            │
│               │                                 │
└───────────────┴─────────────────────────────────┘
```

Exact design belongs in `UI_UX.md`.

---

# 53. MVP DEMO GIS DATA

The prototype should contain fictional/demo spatial data.

Recommended minimum:

```text
1 Estate
3 Blocks
20–50 Plots
```

Each plot should have:

- Plot number
- Block
- Estate
- Geometry
- Plot ID
- Sample status

A smaller dataset is acceptable if it demonstrates the workflow clearly.

---

# 54. DEMO DATA SCENARIOS

Include different scenarios:

```text
Plot 001
Approved

Plot 002
Pending

Plot 003
Approved + Inspection

Plot 004
No approval record in demo dataset

Plot 005
Approved + potential inspection discrepancy
```

The exact wording should make clear these are demo scenarios, not FHA determinations.

---

# 55. DEMO MAP LABEL

The application should clearly indicate:

```text
DEMO / PROTOTYPE DATA
```

when synthetic data is being displayed.

This prevents the demonstration from being mistaken for an official FHA database.

---

# 56. GIS + APPROVAL VERIFICATION

The ideal workflow is:

```text
Select plot on map
       ↓
View plot record
       ↓
View approval
       ↓
Verify record against FHA database
       ↓
View approval document
```

The map identifies the geographic record.

The approval system provides the administrative record.

They should remain separate but connected.

---

# 57. GIS + INSPECTION

The ideal workflow is:

```text
Select plot
      ↓
Start inspection
      ↓
Map opens selected location
      ↓
Capture GPS
      ↓
Record observations
      ↓
Take photos
      ↓
Save inspection
```

---

# 58. FUTURE SPATIAL ANALYTICS

Not required for MVP.

Potential future features:

- Properties by approval status
- Development density
- Inspection hotspots
- Outstanding inspections
- Spatial compliance analysis
- Development trends
- Estate dashboards
- Construction activity mapping

These should be implemented only after core GIS data quality is reliable.

---

# 59. CRITICAL GIS QUESTIONS FOR FHA

The most important questions to ask FHA regarding GIS are:

### 1.

Does FHA already have a digital GIS map of the estate/plots?

### 2.

Can FHA provide the map data for the prototype?

### 3.

What format is the existing data?

### 4.

Does each plot have an official unique identifier?

### 5.

What coordinate system/CRS is used?

### 6.

Who maintains/updates the GIS data?

### 7.

How often is the GIS data updated?

### 8.

Should engineers see the plot map during field inspection?

### 9.

Should GPS be captured during inspection?

### 10.

Should the system identify the plot automatically from the engineer's GPS location?

These questions should be validated before production GIS implementation.

---

# 60. IMPORTANT GIS ASSUMPTIONS TO AVOID

The AI agent must not assume:

- Google Maps contains FHA plot boundaries.
- Satellite imagery represents legal boundaries.
- Phone GPS is survey-grade.
- A plot number is globally unique.
- Missing GIS data means the plot does not exist.
- Missing approval data means illegal development.
- GIS geometry is automatically legally authoritative.
- All FHA estates use the same coordinate system.
- All FHA property records already have digital GIS equivalents.

---

# 61. GIS ACCEPTANCE CHECKLIST

### Map

- [ ] Estate displays
- [ ] Blocks display where available
- [ ] Plot polygons display
- [ ] Plot labels display
- [ ] User can zoom/pan
- [ ] User can select plot
- [ ] Selected plot highlights

### Database connection

- [ ] Plot feature contains stable plot ID
- [ ] Plot ID retrieves database record
- [ ] Unauthorized data is not exposed
- [ ] Plot details open from map

### Search

- [ ] Plot number search
- [ ] Estate/block filtering
- [ ] Approval/application search where implemented
- [ ] Search result centers map
- [ ] Search result highlights plot

### Inspection

- [ ] GPS permission works
- [ ] GPS coordinates can be captured
- [ ] Accuracy can be stored where available
- [ ] Inspection links to plot
- [ ] Photos can be associated with inspection

### Data integrity

- [ ] Demo data is clearly labelled
- [ ] Official boundaries are not invented
- [ ] CRS is documented
- [ ] Invalid geometry can be detected
- [ ] Unmatched records can be identified

---

# 62. FINAL GIS ARCHITECTURE

The core GIS architecture should be:

```text
                 FHA GIS DATA
                      │
                      ▼
               GIS DATA LAYER
                      │
             ┌────────┴────────┐
             │                 │
             ▼                 ▼
        Estate/Block        Plot Polygons
                                │
                                ▼
                            plot_id
                                │
                                ▼
                         PROPERTY DATABASE
                                │
              ┌─────────────────┼────────────────┐
              │                 │                │
              ▼                 ▼                ▼
          Application        Approval       Inspection
                                │                │
                                ▼                ├── GPS
                           Documents             └── Photos
```

The most important technical principle is:

> **Every authoritative GIS plot feature must be connectable to the corresponding property record through a stable identifier.**

That connection is what transforms the application from a normal property database into an actual **FHA map-based development control system**.

---

# 63. PROTOTYPE SUCCESS CRITERIA

The GIS prototype should be considered successful if an FHA engineer can perform this sequence:

```text
Open application
      ↓
Open estate map
      ↓
See plots
      ↓
Click a plot
      ↓
Identify the plot
      ↓
Open its property record
      ↓
See approval information
      ↓
Open approval document
      ↓
Start inspection
      ↓
Capture location
      ↓
Record observation
      ↓
Attach photo
      ↓
Save inspection
```

If the engineer can perform this workflow successfully, the prototype will provide a strong basis for gathering the requirements for the complete FHA system.

---

**END OF GIS.md**
