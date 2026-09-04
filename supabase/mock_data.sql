-- ============================================================================
-- FHA MVP — Mock / Demo Data
-- ============================================================================
-- NOTICE: This file contains FICTIONAL data for development and testing only.
--
--   DEMO / SAMPLE DATA — NOT AN OFFICIAL FHA RECORD
--
-- This data is:
--   - Synthetic and intentionally fictional
--   - Not derived from any real FHA records
--   - Not to be used for any official purpose
--   - Clearly distinguishable from production data
--
-- Run AFTER Schema.sql. Safe to re-run (uses DO blocks with cleanup).
-- ============================================================================

-- ============================================================================
-- USERS (via auth.users — requires service_role or Supabase Dashboard)
-- ============================================================================
-- Note: Profiles are auto-created by the handle_new_user() trigger.
-- Create auth users through Supabase Dashboard → Authentication → Users
-- or use the Supabase CLI: supabase auth signup
--
-- Demo accounts to create manually:
--   Email: engineer@demo.fha  | Password: Demo1234!
--   Email: admin@demo.fha     | Password: Demo1234!
--
-- After signup, update their roles:
--   UPDATE public.profiles SET role = 'ADMIN' WHERE email = 'admin@demo.fha';
--   UPDATE public.profiles SET role = 'ENGINEER' WHERE email = 'engineer@demo.fha';

-- ============================================================================
-- ESTATE
-- ============================================================================

do $$
declare
  v_estate_id uuid := 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
  v_block_a   uuid := 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
  v_block_b   uuid := 'b1b2c3d4-e5f6-7890-abcd-ef1234567892';
  v_block_c   uuid := 'b1b2c3d4-e5f6-7890-abcd-ef1234567893';
  v_plot_003  uuid := 'c1b2c3d4-e5f6-7890-abcd-ef1234567803';
  v_app_id    uuid := 'd1b2c3d4-e5f6-7890-abcd-ef1234567801';
  v_approval_id uuid := 'e1b2c3d4-e5f6-7890-abcd-ef1234567801';
  v_inspection_id uuid := 'f1b2c3d4-e5f6-7890-abcd-ef1234567801';
  i int;
begin
  -- Clean existing demo data (safe re-run)
  delete from public.inspection_photos where inspection_id in (select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));
  delete from public.inspection_findings where inspection_id in (select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));
  delete from public.inspections where plot_id in (select id from public.plots where is_demo = true);
  delete from public.documents where plot_id in (select id from public.plots where is_demo = true);
  delete from public.approvals where plot_id in (select id from public.plots where is_demo = true);
  delete from public.applications where plot_id in (select id from public.plots where is_demo = true);
  delete from public.property_interests where plot_id in (select id from public.plots where is_demo = true);
  delete from public.plots where is_demo = true;
  delete from public.blocks where is_demo = true;
  delete from public.estates where is_demo = true;

  -- Estate: FHA Festac Estate (synthetic — not a real estate)
  insert into public.estates (id, name, phase, state, is_demo)
  values (v_estate_id, 'FHA Festac Estate', 'Phase 1', 'Lagos', true);

  -- Blocks
  insert into public.blocks (id, estate_id, block_number, is_demo) values
    (v_block_a, v_estate_id, 'A', true),
    (v_block_b, v_estate_id, 'B', true),
    (v_block_c, v_estate_id, 'C', true);

  -- Plots 001–020 (synthetic geometry — GIS.md:53)
  for i in 1..20 loop
    insert into public.plots (
      id, estate_id, block_id, plot_number, plot_reference,
      plot_size, plot_size_unit, street, land_use,
      latitude, longitude, status, is_demo, geometry
    ) values (
      case when i = 3 then v_plot_003 else gen_random_uuid() end,
      v_estate_id,
      case when i <= 7 then v_block_a when i <= 14 then v_block_b else v_block_c end,
      lpad(i::text, 3, '0'),
      'FHA/PLOT/2024/' || lpad(i::text, 4, '0'),
      600 + (i % 3) * 50,
      'sqm',
      '3rd Avenue',
      'Residential',
      6.45 + (i * 0.0005),
      3.28 + (i * 0.0005),
      case i % 6
        when 0 then 'PENDING'::public.plot_status
        when 1 then 'APPROVED'::public.plot_status
        when 2 then 'UNDER_CONSTRUCTION'::public.plot_status
        when 3 then 'COMPLETED'::public.plot_status
        when 4 then 'INSPECTION_REQUIRED'::public.plot_status
        else 'REVIEW_REQUIRED'::public.plot_status
      end,
      true,
      ST_SetSRID(ST_MakeEnvelope(
        3.28 + i * 0.0005,
        6.45 + i * 0.0005,
        3.28 + i * 0.0005 + 0.0003,
        6.45 + i * 0.0005 + 0.0004
      ), 4326)
    );
  end loop;

  -- Ensure Plot 003 is APPROVED for demo workflow
  update public.plots set status = 'APPROVED', plot_size = 650 where id = v_plot_003;

  -- Property interest for Plot 003
  insert into public.property_interests (plot_id, name, interest_type, allocation_number, allocation_date, is_current)
  values (v_plot_003, 'Demo Allottee', 'ALLOTTEE', 'FHA/AL/2020/1478', '2020-03-12', true);

  -- Application + Approval for Plot 003
  insert into public.applications (id, plot_id, application_number, application_type, submission_date, status)
  values (v_app_id, v_plot_003, 'FHA/APP/2024/1056', 'NEW_DEVELOPMENT', '2024-12-10', 'APPROVED');

  insert into public.approvals (
    id, plot_id, application_id, approval_number, approval_date, valid_until,
    status, development_type, approved_floors, approved_units,
    front_setback, side_setback, rear_setback, conditions
  ) values (
    v_approval_id, v_plot_003, v_app_id, 'FHA/DEV/2024/1056',
    '2025-01-10', '2027-01-09', 'APPROVED', '4 Units Townhouse',
    2, 4, 6.0, 3.0, 3.0,
    'Sample conditions — DEMO DATA only. Not an official FHA condition.'
  );

  -- Sample approval documents
  insert into public.documents (plot_id, approval_id, document_type, file_name, storage_key, mime_type, file_size)
  values
    (v_plot_003, v_approval_id, 'APPROVAL_LETTER', 'Approval_Letter.pdf',
     'properties/demo-fha-estate-A-003/Approval_Letter.pdf', 'application/pdf', 320000),
    (v_plot_003, v_approval_id, 'BUILDING_PLAN', 'Approved_Building_Plan.pdf',
     'properties/demo-fha-estate-A-003/Building_Plan.pdf', 'application/pdf', 850000);

  -- Sample inspection for Plot 003
  insert into public.inspections (
    id, plot_id, approval_id, inspection_number, inspection_type,
    inspection_date, latitude, longitude, gps_accuracy,
    construction_stage, observed_floors, observed_units,
    observed_front_setback, observed_side_setback, observed_rear_setback,
    compliance_status, observations, recommendations, status
  ) values (
    v_inspection_id, v_plot_003, v_approval_id, 'FHA/INSP/2025/0001', 'ROUTINE',
    '2025-06-15', 6.4515, 3.2815, 5.0,
    'FOUNDATION', 1, 0,
    6.0, 3.0, 3.0,
    'COMPLIANT', 'Foundation stage. Matches approved plan.',
     'Continue construction per approved plan.', 'SUBMITTED'
  );

  -- Sample inspection photo
  insert into public.inspection_photos (inspection_id, storage_key, file_name, mime_type, file_size, caption, latitude, longitude, captured_at)
  values (
    v_inspection_id,
    'inspections/demo-photo-001.jpg',
    'foundation_photo.jpg',
    'image/jpeg',
    2400000,
    'Foundation work in progress',
    6.4515, 3.2815,
    '2025-06-15T10:30:00Z'
  );

end $$;

-- ============================================================================
-- END OF MOCK DATA
-- ============================================================================
