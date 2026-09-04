-- ============================================================================
-- FHA MVP — Drop Mock / Demo Data
-- ============================================================================
-- Removes all demo data created by mock_data.sql.
-- Safe to run — only deletes rows where is_demo = true or linked to demo plots.
-- Run BEFORE switching to real data.
-- ============================================================================

-- Delete in reverse dependency order

delete from public.inspection_photos
  where inspection_id in (select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));

delete from public.inspection_findings
  where inspection_id in (select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));

delete from public.inspections
  where plot_id in (select id from public.plots where is_demo = true);

delete from public.documents
  where plot_id in (select id from public.plots where is_demo = true);

delete from public.approvals
  where plot_id in (select id from public.plots where is_demo = true);

delete from public.applications
  where plot_id in (select id from public.plots where is_demo = true);

delete from public.property_interests
  where plot_id in (select id from public.plots where is_demo = true);

delete from public.plots where is_demo = true;
delete from public.blocks where is_demo = true;
delete from public.estates where is_demo = true;

-- ============================================================================
-- Done. Database is clean of demo data.
-- ============================================================================
