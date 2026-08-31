-- Deterministic demo seed — MVP_BUILD_PLAN.md:4-6, DATABASE.md:38
-- Estate: FHA Demo Estate (Festac-like), Blocks A/B/C, 20 plots, Plot 003 full scenario

do $$
declare
  estate_id uuid := gen_random_uuid();
  block_a uuid := gen_random_uuid();
  block_b uuid := gen_random_uuid();
  block_c uuid := gen_random_uuid();
  app_id uuid := gen_random_uuid();
  approval_id uuid := gen_random_uuid();
  plot_003 uuid;
  i int;
begin
  -- Estate
  insert into public.estates (id, name, phase, state, is_demo) values (estate_id, 'FHA Festac Estate', 'Phase 1', 'Lagos', true);

  -- Blocks
  insert into public.blocks (id, estate_id, block_number, is_demo) values
    (block_a, estate_id, 'A', true),
    (block_b, estate_id, 'B', true),
    (block_c, estate_id, 'C', true);

  -- Plots 001-020 (grid synthetic geometry — GIS.md:53)
  for i in 1..20 loop
    insert into public.plots (id, estate_id, block_id, plot_number, plot_reference, plot_size, plot_size_unit, street, land_use, latitude, longitude, status, is_demo,
      geometry)
    values (
      gen_random_uuid(),
      estate_id,
      case when i <= 7 then block_a when i <= 14 then block_b else block_c end,
      lpad(i::text, 3, '0'),
      'FHA/PLOT/2024/' || lpad(i::text, 4, '0'),
      600 + (i % 3)*50,
      'sqm',
      '3rd Avenue',
      'Residential',
      6.45 + (i*0.0005),
      3.28 + (i*0.0005),
      case i % 6 when 0 then 'PENDING' when 1 then 'APPROVED' when 2 then 'UNDER_CONSTRUCTION' when 3 then 'COMPLETED' when 4 then 'INSPECTION_REQUIRED' else 'REVIEW_REQUIRED' end,
      true,
      -- synthetic polygon centred near Festac
      ST_SetSRID(ST_MakeEnvelope(3.28 + i*0.0005, 6.45 + i*0.0005, 3.28 + i*0.0005 + 0.0003, 6.45 + i*0.0005 + 0.0004), 4326)
    );
  end loop;

  -- Capture Plot 003 id for relations
  select id into plot_003 from public.plots where plot_number = '003' limit 1;

  -- Ensure Plot 003 is APPROVED for demo
  update public.plots set status='APPROVED', plot_size=650 where id=plot_003;

  -- Property interest for 003
  insert into public.property_interests (plot_id, name, interest_type, allocation_number, allocation_date, is_current)
  values (plot_003, 'Demo Allottee', 'ALLOTTEE', 'FHA/AL/2020/1478', '2020-03-12', true);

  -- Application + Approval for 003 (DATABASE.md:26)
  insert into public.applications (id, plot_id, application_number, application_type, submission_date, status)
  values (app_id, plot_003, 'FHA/APP/2024/1056', 'NEW_DEVELOPMENT', '2024-12-10', 'APPROVED');

  insert into public.approvals (id, plot_id, application_id, approval_number, approval_date, valid_until, status, development_type, approved_floors, approved_units, front_setback, side_setback, rear_setback, conditions)
  values (approval_id, plot_003, app_id, 'FHA/DEV/2024/1056', '2025-01-10', '2027-01-09', 'APPROVED', '4 Units Townhouse', 2, 4, 6.0, 3.0, 3.0, 'Sample conditions — DEMO DATA only. Not an official FHA condition.');

  -- Sample approval documents
  insert into public.documents (plot_id, approval_id, document_type, file_name, storage_key, mime_type, file_size)
  values
    (plot_003, approval_id, 'APPROVAL_LETTER', 'Approval_Letter.pdf', 'properties/demo-fha-estate-A-003/Approval_Letter.pdf', 'application/pdf', 320000),
    (plot_003, approval_id, 'BUILDING_PLAN', 'Approved_Building_Plan.pdf', 'properties/demo-fha-estate-A-003/Building_Plan.pdf', 'application/pdf', 850000);

end $$;
