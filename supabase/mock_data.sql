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
-- (email OTP / PIN only — this app has NO password login).
--
-- Demo accounts to create manually:
--   Email: engineer@demo.fha
--   Email: admin@demo.fha
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
  -- Full demo cleanup so re-runs are idempotent (mirrors drop_mock_data.sql)
  delete from public.audit_logs
    where entity_id in (select id::text from public.plots where is_demo = true);
  delete from public.plot_status_history
    where plot_id in (select id from public.plots where is_demo = true);
  delete from public.inspection_photos where inspection_id in (
    select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));
  delete from public.inspection_findings where inspection_id in (
    select id from public.inspections where plot_id in (select id from public.plots where is_demo = true));
  delete from public.inspections where plot_id in (select id from public.plots where is_demo = true);
  delete from public.assignment_areas where assignment_id in (
    select id from public.inspection_assignments
    where assignment_number in ('FHA/ASGN/2025/0001', 'FHA/ASGN/2025/0002')
       or title like '%DEMO DATA%');
  delete from public.inspection_assignments
    where assignment_number in ('FHA/ASGN/2025/0001', 'FHA/ASGN/2025/0002')
       or title like '%DEMO DATA%';
  delete from public.map_areas where is_demo = true;
  delete from public.geographical_units where is_demo = true;
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
      case when i = 3 then v_plot_003
           else ('c1b2c3d4-e5f6-7890-abcd-' || lpad(to_hex(i), 12, '0'))::uuid end,
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
  update public.plots set status = 'APPROVED', approval_status = 'APPROVED', inspection_status = 'INSPECTED', plot_size = 650 where id = v_plot_003;

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

  -- Plot status history for Plot 003
  insert into public.plot_status_history (plot_id, changed_by, field, old_value, new_value, reason)
  values (v_plot_003, null, 'inspection_status', 'NOT_INSPECTED', 'INSPECTED', 'Initial demo inspection');

end $$;

-- ============================================================================
-- GEOGRAPHICAL UNITS (seeded from demo estates/blocks/plots — AGENTS §35)
-- ============================================================================
-- Fresh install path is Schema.sql → mock_data.sql. live_update.sql also migrates
-- GUs for existing databases; these inserts are idempotent (ON CONFLICT DO NOTHING).

-- ============================================================================
-- SAMPLE ASSIGNMENT (demo)
-- ============================================================================

do $$
declare
  v_block_a   uuid := 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
  v_assignment_id uuid := 'a2b2c3d4-e5f6-7890-abcd-ef1234567801';
begin
  -- Seed ALL geographical_units from demo estates/blocks/plots (fresh-install path)
  insert into public.geographical_units (id, unit_type, name, code, geometry, is_demo)
  select e.id, 'ESTATE', e.name, e.phase, e.boundary_geometry, e.is_demo
  from public.estates e
  where e.is_demo = true
  on conflict (id) do nothing;

  insert into public.geographical_units (id, parent_id, unit_type, name, code, geometry, is_demo)
  select b.id, b.estate_id, 'BLOCK', b.block_number, b.block_number, b.geometry, b.is_demo
  from public.blocks b
  where b.is_demo = true
  on conflict (id) do nothing;

  insert into public.geographical_units (
    id, parent_id, unit_type, name, code, latitude, longitude, geometry,
    area_size, area_size_unit, street, land_use, inspection_status, approval_status, is_demo
  )
  select p.id, p.block_id, 'PLOT', 'Plot ' || p.plot_number, p.plot_number,
    p.latitude, p.longitude, p.geometry, p.plot_size, p.plot_size_unit,
    p.street, p.land_use, p.inspection_status, p.approval_status, p.is_demo
  from public.plots p
  where p.is_demo = true
  on conflict (id) do nothing;

  insert into public.inspection_assignments (
    id, assignment_number, title, description, geo_unit_id,
    assigned_to, status, priority, target_date, total_areas, completed_areas
  ) values (
    v_assignment_id,
    'FHA/ASGN/2025/0001',
    'Block A Routine Inspection — DEMO DATA',
    'Routine inspection of all plots in Block A — DEMO DATA only.',
    v_block_a,
    (
      select p.id from public.profiles p
      where p.role in ('ENGINEER','SUPERVISOR')
        and p.is_active = true
      order by (p.email = 'engineer@demo.fha') desc, p.created_at
      limit 1
    ),
    'ACTIVE',
    'NORMAL',
    current_date + interval '14 days',
    7, 0
  );

  insert into public.assignment_areas (assignment_id, geo_unit_id, sort_order, status)
  select v_assignment_id, p.id, row_number() over (order by p.plot_number)::int, 'NOT_INSPECTED'::public.plot_inspection_status
  from public.plots p
  where p.block_id = v_block_a and p.is_demo = true
  on conflict (assignment_id, geo_unit_id) do nothing;

end $$;

-- ============================================================================
-- SAMPLE MAP AREA (demo)
-- ============================================================================

do $$
declare
  v_block_a   uuid := 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
begin
  -- Skip if already exists
  if exists (select 1 from public.map_areas where name = 'Block A Inspection Zone') then
    return;
  end if;
  if not exists (select 1 from public.profiles where role in ('ADMIN','SUPERVISOR','GIS_OFFICER')) then
    return;
  end if;

  insert into public.map_areas (
    drawn_by, name, description, area_type, status, geometry, geojson, color, is_demo
  )
  select
    (select id from public.profiles where role in ('ADMIN','SUPERVISOR','GIS_OFFICER') limit 1),
    'Block A Inspection Zone',
    'Demo inspection zone for Block A — DEMO DATA only.',
    'INSPECTION_ZONE',
    'MARKED',
    ST_SetSRID(ST_MakeEnvelope(3.28, 6.45, 3.29, 6.47), 4326),
    '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[3.28,6.45],[3.29,6.45],[3.29,6.47],[3.28,6.47],[3.28,6.45]]]},"properties":{}}'::jsonb,
    '#3b82f6',
    true
  where not exists (select 1 from public.map_areas where name = 'Block A Inspection Zone');

end $$;

-- ============================================================================
-- SAMPLE ZONE ASSIGNMENT + FIELD AREA (demo)
-- ============================================================================
-- Demonstrates the zone → officer → field-area workflow
-- (SYSTEM_WALKTHROUGH §6, MAP_AREA_WORKFLOW §6).
-- Requires the demo users above (engineer@demo.fha + an admin/GIS account).

do $$
declare
  v_block_a     uuid := 'b1b2c3d4-e5f6-7890-abcd-ef1234567891';
  v_zone_unit   uuid := 'a3b2c3d4-e5f6-7890-abcd-ef1234567801';
  v_zone_asgn   uuid := 'a2b2c3d4-e5f6-7890-abcd-ef1234567802';
  v_child_area  uuid := 'f2b2c3d4-e5f6-7890-abcd-ef1234567801';
  v_zone_geom   geometry;
  v_zone_id     uuid;
  v_engineer_id uuid;
  v_admin_id    uuid;
begin
  select id, geometry into v_zone_id, v_zone_geom
  from public.map_areas
  where name = 'Block A Inspection Zone' and is_demo = true;

  select id into v_admin_id from public.profiles
  where role in ('ADMIN','SUPERVISOR','GIS_OFFICER') and is_active = true
  order by (email = 'gis@demo.fha') desc, (email = 'admin@demo.fha') desc, created_at
  limit 1;

  if v_zone_id is null or v_admin_id is null or v_zone_geom is null then
    return; -- demo zone or an admin/GIS profile not present yet
  end if;

  -- ZONE geo-unit (required by inspection_assignments.geo_unit_id)
  insert into public.geographical_units (id, unit_type, name, description, geometry, is_demo)
  values (
    v_zone_unit, 'ZONE', 'Block A Inspection Zone',
    'Created from demo map area — DEMO DATA only.',
    v_zone_geom, true
  )
  on conflict (id) do nothing;

  select id into v_engineer_id from public.profiles
  where role in ('ENGINEER','SUPERVISOR') and is_active = true
  order by (email = 'engineer@demo.fha') desc, created_at
  limit 1;

  if v_engineer_id is null then
    return; -- demo engineer not created yet; zone stays MARKED/unassigned
  end if;

  -- Zone assignment to the demo engineer (multiple officers per zone supported)
  insert into public.inspection_assignments (
    id, assignment_number, title, description, geo_unit_id,
    assigned_to, created_by, status, priority, target_date, total_areas, completed_areas
  ) values (
    v_zone_asgn,
    'FHA/ASGN/2025/0002',
    'Block A Zone Field Assignment — DEMO DATA',
    'Officer draws field areas inside the assigned zone — DEMO DATA only.',
    v_zone_unit,
    v_engineer_id,
    v_admin_id,
    'ACTIVE',
    'NORMAL',
    current_date + interval '14 days',
    (select count(*) from public.plots where block_id = v_block_a and is_demo = true),
    0
  )
  on conflict (id) do nothing;

  insert into public.assignment_areas (assignment_id, geo_unit_id, sort_order, status)
  select v_zone_asgn, p.id,
         row_number() over (order by p.plot_number)::int,
         'NOT_INSPECTED'::public.plot_inspection_status
  from public.plots p
  where p.block_id = v_block_a and p.is_demo = true
  on conflict (assignment_id, geo_unit_id) do nothing;

  -- Link the zone: plot_ids, geo-unit, assignment, status MARKED → IN_PROGRESS
  update public.map_areas
  set plot_ids = (
        select coalesce(array_agg(p.id), '{}')
        from public.plots p
        where p.block_id = v_block_a and p.is_demo = true
      ),
      metadata = metadata || jsonb_build_object(
        'geo_unit_id', v_zone_unit, 'drawn_by_role', 'GIS_OFFICER'
      ),
      assignment_id = v_zone_asgn,
      status = 'IN_PROGRESS',
      updated_at = now()
  where id = v_zone_id;

  -- Officer's field area inside the zone (DRAFT — ready to start/submit)
  insert into public.map_areas (
    id, drawn_by, name, description, area_type, status,
    geometry, geojson, color, parent_area_id, assignment_id, plot_ids, is_demo
  )
  select
    v_child_area,
    v_engineer_id,
    'Field Check A-002/003',
    'Demo field area inside the assigned zone — DEMO DATA only.',
    'INSPECTED_AREA',
    'DRAFT',
    ST_SetSRID(ST_MakeEnvelope(3.281, 6.451, 3.282, 6.4518), 4326),
    '{"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[3.281,6.451],[3.282,6.451],[3.282,6.4518],[3.281,6.4518],[3.281,6.451]]]},"properties":{}}'::jsonb,
    '#94a3b8',
    v_zone_id,
    v_zone_asgn,
    (
      select coalesce(array_agg(p.id), '{}')
      from public.plots p
      where p.is_demo = true
        and ST_Contains(
          ST_SetSRID(ST_MakeEnvelope(3.281, 6.451, 3.282, 6.4518), 4326),
          ST_Centroid(p.geometry)
        )
    ),
    true
  where not exists (select 1 from public.map_areas where id = v_child_area);

  -- Link the demo inspection to the demo field area so the map -> inspection link shows
  update public.inspections
  set map_area_id = v_child_area
  where inspection_number = 'FHA/INSP/2025/0001'
    and exists (select 1 from public.map_areas where id = v_child_area);

end $$;

-- ============================================================================
-- END OF MOCK DATA
-- ============================================================================
