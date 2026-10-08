# MAP_TUTORIAL.md
# Estate Map — User Tutorial & Field Guide

**Applies to:** `/map` (Estate Map page)  
**Status:** As-built — matches the running code  
**Date:** 8 October 2026  
**Related:** `SYSTEM_WALKTHROUGH.md`, `MAP_AREA_WORKFLOW.md`, `GIS.md`, `AGENTS.md`

> **DEMO / SAMPLE DATA – NOT AN OFFICIAL FHA RECORD**  
> All plots, coordinates, boundaries and outcomes in this prototype are fictional until FHA supplies official data. Outcomes are field observations / recommendations — **never enforcement decisions**.

---

## 1. WHAT THE MAP IS FOR

The Estate Map is the primary field screen. It connects three things in one place:

```text
Drawn / official geometry  →  Property record (plot)  →  Approval & outcome history
```

You can search for a plot, inspect its approval status, draw an area around a structure,
photograph it, and record a property outcome — without leaving the map.

An in-app version of this guide is available on the map page:
**"How to use this map"** button (top-right of the page header). First-time visitors also see
a one-line hint card with a **Show me** shortcut.

---

## 2. ORIENTATION — WHAT IS ON THE SCREEN

| Control | Location | Purpose |
|---|---|---|
| Search box | Top of map | Plot search (2+ chars) + place search (3+ chars, Nominatim) |
| Draw toolbar | Top-center | `Draw Polygon` · `Draw Box` · `Select` · `My Location` + saved-area count |
| Map View card | Left sidebar | Color-by toggle, drawn-areas legend |
| Plot Legend card | Left sidebar | Approval + inspection status colors, marker anatomy |
| Satellite / Street | Bottom-left | Basemap switch; opacity slider in satellite mode |
| Saved Areas | Bottom-right | List of all drawn areas — click to fly & open |
| Navigation control | Top-right | Zoom in / out / compass (MapLibre built-in) |
| How to use this map | Page header | Opens this tutorial in-app (modal) |

### Marker anatomy

- **Outer ring** = status in the current *Color by* mode (Approval or Inspection).
- **Inner dot** = the other status.
- Switching *Color by* recolors markers instantly.

### Legends

- **Plot Legend** — approval: Approved, Approved with Conditions, Pending, Rejected, Not Reviewed;
  inspection: In Progress, Inspected, Awaiting Review, Reinspection Required, Not Inspected.
- **Drawn Areas** — Zone (Active), Awaiting Outcome, Approved Property,
  Unapproved Property, Empty / Unoccupied, Set for Demolition.

---

## 3. SEARCHING

1. Click the search box (`Search plot or location...`).
2. **Plot search** — type 2+ characters (e.g. `003`). Results are grouped under **Plots** with
   block/estate/street subtitles. Selecting one flies to zoom 17.
3. **Place search** — type 3+ characters. Results are grouped under **Places** (OpenStreetMap
   Nominatim, Nigeria). Selecting one flies to zoom 16.
4. Selecting a result **flies the map there** — it does not open the popup. Click the plot
   marker afterward to see its details.
5. The ✕ button clears the query and results.

---

## 4. INSPECTING A PLOT

Click any plot marker → popup:

1. **Building photo** (latest inspection photo; hidden if none).
2. **Plot number** + **Block — Estate**.
3. **Owner** — fetched when the popup opens; shows `Not recorded` / `Not available` when empty.
4. **Inspection / Approval** status lines with color dots.
5. **View details →** — opens the full plot page (`/plots/{id}`) with approval, documents and history.
6. **Google Maps ↗** — external, view-only link (no API key), shown only when coordinates exist.

---

## 5. DRAWING / MARKING AN AREA

Any active account can draw. Steps:

1. **Pick a tool** in the top toolbar:
   - **Draw Polygon** — click to add vertices (minimum 3), click the first point to close.
   - **Draw Box** — click two opposite corners.
2. **While drawing** a bar appears with a live `N points` counter and hints
   (`Click to add points` / `Click first point to close` / `Click 2 corners`), plus:
   - **Undo** — remove the last vertex (polygons),
   - **Cancel** — discard the shape,
   - **Done** — finish the shape (polygon ≥ 3 points).
3. **Save This Area** modal opens:
   - **Area type** (default *Zone*):

     | Type | Behavior | Status after save | Photo rule |
     |---|---|---|---|
     | **Zone** | Active container — properties/plots drawn inside link to it automatically | `ACTIVE` | — |
     | **Property** | Leaf area taking an outcome | `AWAITING_OUTCOME` | ≥1 photo **required** to record an outcome |
     | **Plot** | Leaf area taking an outcome | `AWAITING_OUTCOME` | Photo optional |

   - A preview line shows where it will nest: `Will be linked inside zone "…"` or
     `Not inside a saved zone — will be saved as a top-level area.`
   - **Name** (required, ≤ 200 chars) — e.g. `Plot 12 — Unapproved structure`.
     Press **Enter** or click **Save Area**.
4. **On save** the server:
   - sets the status per the table above (status cannot be written directly — the API rejects it with `422`),
   - auto-links plots whose centre falls inside the polygon,
   - nests the area under the innermost containing zone,
   - opens the new area's panel and flies the map to it — so you can add a photo immediately.
5. Press **Select** in the toolbar to return to normal browsing.

### Nesting rules

- Zones hold properties/plots (and other zones); children appear in the panel under
  **Contained Areas** / **Sub-areas**.
- Deleting a zone **cascades** — all nested areas are deleted (the confirm dialog states the count).

---

## 6. THE AREA PANEL (click a saved area)

Opening an area shows a panel (top-right) with:

1. **Header** — name, type (Zone / Plot / Property), status dot, optional description.
2. **View location in Google Maps** — external link to the centroid.
3. **Zone note** — zones explain that inner areas link automatically; zones never take an outcome
   (the API returns `NO_OUTCOME_ON_ZONE`).
4. **Actions → Property Photos** (Property/Plot only):
   - **Add Photo** — JPG/PNG only, max 10 MB, magic-byte checked; GPS (lat/lng/time) is captured
     with each photo when permission is available.
   - Thumbnails show GPS on hover; ✕ removes a photo while unlocked.
   - After an outcome is recorded the set is **locked** (read-only): *"An outcome has been
     recorded — photos are now read-only."*
5. **Actions → Property/Plot Outcome** — four buttons:
   - `Approved property`
   - `Unoccupied property`
   - `Unapproved property`
   - `Property set for demolition` → status becomes the matching outcome value in **one step**;
     the pill shows *Recorded* + date.
   - On **Property** areas with no photo the buttons are disabled with:
     *"Add at least one photo of this property before recording a property outcome."*
   - Re-record by picking another option (photos lock once any outcome exists).
   - Disclaimer: *"Field observation / recommendation — not an enforcement decision."*
6. **Activity** — last 6 history events (`Actor — event · date`), from `map_area_status_history`.
7. **Delete Zone / Delete Area** — see permissions below; confirm dialog warns about cascades.
8. **Contained Areas / Sub-areas** — click a child to navigate to it.
9. **Created {date}** footer.

---

## 7. WHO CAN DO WHAT

| Action | ADMIN / SUPERVISOR / GIS_OFFICER | ENGINEER & other roles |
|---|---|---|
| Draw a new area | Yes | Yes (any active account) |
| Record / re-record an outcome | Any area | Only areas **they drew** |
| Edit area fields | Any area | Only areas they drew (RLS backstops) |
| Add / remove photos | While not locked | While not locked; own areas |
| Delete area | Any status (cascades to children) | Own areas, **only while still Awaiting Outcome** |
| Set `status` directly | **No one** — API rejects direct status writes (`422`) | — |

---

## 8. QUICK RECIPES

**“I need to check plot 003”**
Search `003` → click the marker → **View details →**.

**“There is an unapproved structure on Plot 12”**
1. Draw Box around it → type **Property**, name it `Plot 12 — Unapproved structure`, save.
2. **Add Photo** (at least one).
3. Click **Unapproved property** — status updates, photos lock.
4. Reviewers see it on `/approvals`; Activity shows who/when.

**“Mark the whole street as a survey zone”**
Draw Polygon along the street → type **Zone** → save. Structures marked later inside it
auto-nest under the zone and appear in its **Contained Areas**.

**“Compare against satellite imagery”**
Bottom-left → **Satellite** → adjust the opacity slider so plot lines stay visible.

---

## 9. KNOWN LIMITATIONS (as-built)

- **Block dropdown** (left sidebar) currently does not filter the map — reserved, do not rely on it.
- **My Location** fails silently if location permission is denied (no toast yet).
- Saved areas **cannot be reshaped** — there is no vertex-edit tool; delete and redraw instead.
- Search flies to a result but does not auto-open the plot popup — click the marker.
- The historical zone-walk buttons (`Inspect next area`) were removed with the assignments
  feature; outcomes are now recorded one area at a time, one step.
- Plot popups show the **building photo** from inspection history (legacy table) — no new
  inspection photos are created by the current build.

---

## 10. IN-APP HELP SURFACE

| Surface | Where | Behavior |
|---|---|---|
| `How to use this map` button | Page header, top-right | Opens the tutorial modal (4 sections: Explore / Mark an area / Record an outcome / Who can do what). Esc, backdrop click and ✕/Close all dismiss it. |
| First-visit hint card | Anchored below the button | Shown once; **Got it** dismisses permanently, **Show me** dismisses and opens the modal. State kept in `localStorage` key `fha:map-help-dismissed`. |

Implementation: `web/src/components/map/MapHelp.tsx`, wired into
`web/src/app/(dashboard)/map/page.tsx`.

---

**END OF MAP_TUTORIAL.md**
