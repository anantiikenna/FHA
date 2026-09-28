-- ============================================================================
-- FHA MVP — drop_mock_data.sql (removes demo rows only; keeps schema)
-- ============================================================================
-- Removes all demo data created by mock_data.sql.
-- Safe to run — only deletes rows where is_demo = true or linked to demo plots.
-- Run BEFORE switching to real data. Does NOT drop tables or schema objects.
-- ============================================================================

-- Delete in reverse dependency order

-- Audit logs (demo-related)
delete from public.audit_logs
  where entity_id in (
    select id::text from public.plots where is_demo = true
    union all
    select id::text from public.inspections where plot_id in (select id from public.plots where is_demo = true)
  );

-- Plot status history (linked to demo plots)
delete from public.plot_status_history
  where plot_id in (select id from public.plots where is_demo = true);

-- Inspection photos
delete from public.inspection_photos
  where inspection_id in (select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));

-- Inspection findings
delete from public.inspection_findings
  where inspection_id in (select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));

-- Inspections
delete from public.inspections
  where plot_id in (select id from public.plots where is_demo = true);

-- Map areas (demo-related)
delete from public.map_areas where is_demo = true;

-- Assignment areas (linked to demo assignments)
delete from public.assignment_areas
  where assignment_id in (
    select id from public.inspection_assignments
    where title like '%DEMO DATA%'
       or description like '%DEMO DATA%'
       or assignment_number in ('FHA/ASGN/2025/0001', 'FHA/ASGN/2025/0002')
  );

-- Inspection assignments (demo — identified by demo title/description/number)
delete from public.inspection_assignments
  where title like '%DEMO DATA%'
     or description like '%DEMO DATA%'
     or assignment_number in ('FHA/ASGN/2025/0001', 'FHA/ASGN/2025/0002');

-- Geographical units (demo)
delete from public.geographical_units where is_demo = true;

-- Documents
delete from public.documents
  where plot_id in (select id from public.plots where is_demo = true);

-- Approvals
delete from public.approvals
  where plot_id in (select id from public.plots where is_demo = true);

-- Applications
delete from public.applications
  where plot_id in (select id from public.plots where is_demo = true);

-- Property interests
delete from public.property_interests
  where plot_id in (select id from public.plots where is_demo = true);

-- Plots
delete from public.plots where is_demo = true;

-- Blocks
delete from public.blocks where is_demo = true;

-- Estates
delete from public.estates where is_demo = true;

-- ============================================================================
-- Done. Database is clean of demo data.
-- ============================================================================
