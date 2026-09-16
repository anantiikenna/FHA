-- ============================================================================
-- FHA Development Approval & Property Mapping System
-- Schema.sql — Complete database schema
-- Version: 3.0
-- Date: 2026-09-05
--
-- Run this file to set up the database from scratch.
-- After schema, run mock_data.sql for demo/seed data.
-- ============================================================================

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

create extension if not exists "postgis";
create extension if not exists "pgcrypto";

-- ============================================================================
-- ENUM TYPES
-- ============================================================================

create type public.user_role as enum ('ADMIN','ENGINEER','APPROVAL_OFFICER','GIS_OFFICER','SUPERVISOR');
create type public.plot_status as enum ('APPROVED','PENDING','UNDER_CONSTRUCTION','COMPLETED','INSPECTION_REQUIRED','REVIEW_REQUIRED');
create type public.plot_inspection_status as enum ('NOT_INSPECTED','INSPECTION_IN_PROGRESS','INSPECTED','AWAITING_REVIEW','REINSPECTION_REQUIRED');
create type public.plot_approval_status as enum ('NOT_REVIEWED','PENDING','APPROVED','APPROVED_WITH_CONDITIONS','REJECTED');
create type public.approval_status as enum ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED');
create type public.inspection_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','COMPLETED');
create type public.inspection_type as enum ('ROUTINE','FOLLOW_UP','COMPLIANCE');
create type public.compliance_status as enum ('COMPLIANT','MINOR_NON_COMPLIANT','MAJOR_NON_COMPLIANT','UNABLE_TO_DETERMINE');
create type public.interest_type as enum ('ALLOTTEE','ORGANIZATION','OTHER');
create type public.document_type as enum ('ALLOCATION_LETTER','APPROVAL_LETTER','BUILDING_PLAN','SITE_PLAN','INSPECTION_REPORT','OTHER');
create type public.finding_severity as enum ('INFO','REVIEW_REQUIRED','HIGH_PRIORITY');
create type public.unit_type as enum ('DEVELOPMENT','ESTATE','SUB_ESTATE','SCHEME','PHASE','SECTION','ZONE','BLOCK','PARCEL','PLOT');
create type public.assignment_status as enum ('DRAFT','ACTIVE','IN_PROGRESS','COMPLETED','CANCELLED');
create type public.assignment_priority as enum ('LOW','NORMAL','HIGH','URGENT');
create type public.map_area_type as enum ('INSPECTION_ZONE','INSPECTED_AREA','REVIEW_AREA');
create type public.map_area_status as enum ('DRAFT','MARKED','IN_PROGRESS','INSPECTED','AWAITING_REVIEW','APPROVED','REJECTED','REINSPECTION_REQUIRED');

-- ============================================================================
-- TABLES
-- ============================================================================

-- ---------------------------------------------------------------------------
-- PROFILES (extends auth.users)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users(id) on delete cascade,
  email        text not null,
  display_name text not null,
  role         public.user_role not null default 'ENGINEER',
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- ESTATES
-- ---------------------------------------------------------------------------
create table public.estates (
  id                uuid primary key default gen_random_uuid(),
  name              text not null,
  phase             text,
  state             text,
  boundary_geometry geometry(MultiPolygon, 4326),
  is_demo           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- BLOCKS
-- ---------------------------------------------------------------------------
create table public.blocks (
  id           uuid primary key default gen_random_uuid(),
  estate_id    uuid not null references public.estates(id) on delete cascade,
  block_number text not null,
  geometry     geometry(Polygon, 4326),
  is_demo      boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique(estate_id, block_number)
);

-- ---------------------------------------------------------------------------
-- PLOTS (core entity)
-- ---------------------------------------------------------------------------
create table public.plots (
  id                uuid primary key default gen_random_uuid(),
  estate_id         uuid not null references public.estates(id) on delete cascade,
  block_id          uuid references public.blocks(id) on delete set null,
  plot_number       text not null,
  plot_reference    text,
  plot_size         numeric,
  plot_size_unit    text not null default 'sqm',
  street            text,
  land_use          text,
  latitude          double precision check (latitude between -90 and 90),
  longitude         double precision check (longitude between -180 and 180),
  geometry          geometry(Polygon, 4326),
  status            public.plot_status not null default 'APPROVED',
  inspection_status public.plot_inspection_status not null default 'NOT_INSPECTED',
  approval_status   public.plot_approval_status not null default 'NOT_REVIEWED',
  is_demo           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_plots_geometry    on public.plots using gist(geometry);
create index idx_plots_plot_number on public.plots(plot_number);
create index idx_plots_block       on public.plots(block_id);
create index idx_plots_estate      on public.plots(estate_id);

-- ---------------------------------------------------------------------------
-- PROPERTY INTERESTS (allottees / owners)
-- ---------------------------------------------------------------------------
create table public.property_interests (
  id                uuid primary key default gen_random_uuid(),
  plot_id           uuid not null references public.plots(id) on delete cascade,
  name              text not null,
  organization_name text,
  interest_type     public.interest_type,
  allocation_number text,
  allocation_date   date,
  is_current        boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- APPLICATIONS
-- ---------------------------------------------------------------------------
create table public.applications (
  id                 uuid primary key default gen_random_uuid(),
  plot_id            uuid not null references public.plots(id) on delete cascade,
  application_number text unique not null,
  application_type   text,
  submission_date    date,
  status             text,
  created_by         uuid references public.profiles(id),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- APPROVALS
-- ---------------------------------------------------------------------------
create table public.approvals (
  id                  uuid primary key default gen_random_uuid(),
  plot_id             uuid not null references public.plots(id) on delete cascade,
  application_id      uuid references public.applications(id) on delete set null,
  approval_number     text unique not null,
  approval_date       date,
  valid_until         date,
  status              public.approval_status,
  development_type    text,
  approved_floors     integer check (approved_floors >= 0),
  approved_units      integer check (approved_units >= 0),
  building_coverage   numeric,
  front_setback       numeric,
  side_setback        numeric,
  rear_setback        numeric,
  conditions          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index idx_approvals_number on public.approvals(approval_number);
create index idx_approvals_plot   on public.approvals(plot_id);

-- ---------------------------------------------------------------------------
-- INSPECTIONS
-- ---------------------------------------------------------------------------
create table public.inspections (
  id                       uuid primary key default gen_random_uuid(),
  plot_id                  uuid not null references public.plots(id) on delete cascade,
  approval_id              uuid references public.approvals(id) on delete set null,
  inspection_number        text unique not null,
  inspector_id             uuid references public.profiles(id) on delete set null,
  inspection_type          public.inspection_type,
  inspection_date          date not null,
  inspection_time          time,
  latitude                 double precision check (latitude between -90 and 90),
  longitude                double precision check (longitude between -180 and 180),
  gps_accuracy             numeric,
  construction_stage       text,
  observed_floors          integer,
  observed_units           integer,
  observed_front_setback   numeric,
  observed_side_setback    numeric,
  observed_rear_setback    numeric,
  observed_building_use    text,
  compliance_status        public.compliance_status,
  observations             text,
  recommendations          text,
  status                   public.inspection_status not null default 'DRAFT',
  submitted_at             timestamptz,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create index idx_inspections_plot     on public.inspections(plot_id);
create index idx_inspections_inspector on public.inspections(inspector_id);

-- ---------------------------------------------------------------------------
-- INSPECTION PHOTOS
-- ---------------------------------------------------------------------------
create table public.inspection_photos (
  id           uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  storage_key  text not null,
  file_name    text not null,
  mime_type    text not null,
  file_size    integer check (file_size >= 0),
  caption      text,
  latitude     double precision,
  longitude    double precision,
  captured_at  timestamptz,
  uploaded_by  uuid references public.profiles(id),
  created_at   timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- INSPECTION FINDINGS
-- ---------------------------------------------------------------------------
create table public.inspection_findings (
  id            uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  category      text,
  title         text not null,
  description   text,
  severity      public.finding_severity,
  recommendation text,
  status        text not null default 'OPEN',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- DOCUMENTS
-- ---------------------------------------------------------------------------
create table public.documents (
  id             uuid primary key default gen_random_uuid(),
  plot_id        uuid references public.plots(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  approval_id    uuid references public.approvals(id) on delete set null,
  inspection_id  uuid references public.inspections(id) on delete set null,
  document_type  public.document_type,
  file_name      text not null,
  storage_key    text not null,
  mime_type      text not null,
  file_size      integer check (file_size >= 0),
  uploaded_by    uuid references public.profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- PLOT STATUS HISTORY (tracks every inspection/approval status change)
-- ---------------------------------------------------------------------------
create table public.plot_status_history (
  id         uuid primary key default gen_random_uuid(),
  plot_id    uuid not null references public.plots(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  field      text not null check (field in ('inspection_status', 'approval_status')),
  old_value  text,
  new_value  text not null,
  reason     text,
  created_at timestamptz not null default now()
);

create index idx_status_history_plot on public.plot_status_history(plot_id);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   text not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_user   on public.audit_logs(user_id);

-- ---------------------------------------------------------------------------
-- GEOGRAPHICAL UNITS (flexible hierarchical tree)
-- ---------------------------------------------------------------------------
create table public.geographical_units (
  id                uuid primary key default gen_random_uuid(),
  parent_id         uuid references public.geographical_units(id) on delete set null,
  unit_type         public.unit_type not null,
  name              text not null,
  code              text,
  description       text,
  latitude          double precision check (latitude between -90 and 90),
  longitude         double precision check (longitude between -180 and 180),
  geometry          geometry(Geometry, 4326),
  area_size         numeric,
  area_size_unit    text default 'sqm',
  street            text,
  land_use          text,
  inspection_status public.plot_inspection_status not null default 'NOT_INSPECTED',
  approval_status   public.plot_approval_status not null default 'NOT_REVIEWED',
  is_demo           boolean not null default true,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_gu_parent   on public.geographical_units(parent_id);
create index idx_gu_type     on public.geographical_units(unit_type);
create index idx_gu_geometry on public.geographical_units using gist(geometry);

-- ---------------------------------------------------------------------------
-- INSPECTION ASSIGNMENTS (supervisor assigns area to engineer)
-- ---------------------------------------------------------------------------
create table public.inspection_assignments (
  id                uuid primary key default gen_random_uuid(),
  assignment_number text unique not null,
  title             text not null,
  description       text,
  geo_unit_id       uuid not null references public.geographical_units(id) on delete cascade,
  assigned_to       uuid references public.profiles(id) on delete set null,
  created_by        uuid references public.profiles(id) on delete set null,
  status            public.assignment_status not null default 'DRAFT',
  priority          public.assignment_priority not null default 'NORMAL',
  target_date       date,
  started_at        timestamptz,
  completed_at      timestamptz,
  total_areas       integer not null default 0,
  completed_areas   integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_assign_geo     on public.inspection_assignments(geo_unit_id);
create index idx_assign_engineer on public.inspection_assignments(assigned_to);
create index idx_assign_status  on public.inspection_assignments(status);

-- ---------------------------------------------------------------------------
-- ASSIGNMENT AREAS (individual plots/units within an assignment)
-- ---------------------------------------------------------------------------
create table public.assignment_areas (
  id             uuid primary key default gen_random_uuid(),
  assignment_id  uuid not null references public.inspection_assignments(id) on delete cascade,
  geo_unit_id    uuid not null references public.geographical_units(id) on delete cascade,
  sort_order     integer not null default 0,
  status         public.plot_inspection_status not null default 'NOT_INSPECTED',
  inspection_id  uuid references public.inspections(id) on delete set null,
  completed_at   timestamptz,
  created_at     timestamptz not null default now(),
  unique(assignment_id, geo_unit_id)
);

create index idx_aa_assignment on public.assignment_areas(assignment_id);
create index idx_aa_status     on public.assignment_areas(status);

-- ---------------------------------------------------------------------------
-- MAP AREAS (drawn polygons on the map for inspection workflow)
-- ---------------------------------------------------------------------------
create table public.map_areas (
  id              uuid primary key default gen_random_uuid(),
  drawn_by        uuid not null references public.profiles(id) on delete cascade,
  assignment_id   uuid references public.inspection_assignments(id) on delete set null,
  name            text not null,
  description     text,
  area_type       public.map_area_type not null default 'INSPECTION_ZONE',
  status          public.map_area_status not null default 'MARKED',
  geometry        geometry(Polygon, 4326) not null,
  geojson         jsonb not null,
  color           text,
  parent_area_id  uuid references public.map_areas(id) on delete set null,
  plot_ids        uuid[] default '{}',
  metadata        jsonb default '{}',
  is_demo         boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_map_areas_drawn_by   on public.map_areas(drawn_by);
create index idx_map_areas_status     on public.map_areas(status);
create index idx_map_areas_area_type  on public.map_areas(area_type);
create index idx_map_areas_assignment on public.map_areas(assignment_id);
create index idx_map_areas_geometry   on public.map_areas using gist(geometry);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table public.profiles            enable row level security;
alter table public.estates             enable row level security;
alter table public.blocks              enable row level security;
alter table public.plots               enable row level security;
alter table public.property_interests  enable row level security;
alter table public.applications        enable row level security;
alter table public.approvals           enable row level security;
alter table public.inspections         enable row level security;
alter table public.inspection_photos   enable row level security;
alter table public.inspection_findings enable row level security;
alter table public.documents           enable row level security;
alter table public.audit_logs          enable row level security;
alter table public.plot_status_history enable row level security;
alter table public.geographical_units    enable row level security;
alter table public.inspection_assignments enable row level security;
alter table public.assignment_areas       enable row level security;
alter table public.map_areas             enable row level security;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------

-- Users can read their own profile
create policy "profiles_select_own"
  on public.profiles for select to authenticated
  using (auth.uid() = id);

-- Admin can read all profiles
create policy "profiles_select_admin"
  on public.profiles for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  ));

-- Users can update their own profile (limited fields — NOT role)
-- Role changes must go through the admin API with service_role
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Prevent users from escalating their own role via direct Supabase client calls
create or replace function public.prevent_self_role_change()
returns trigger as $$
begin
  if old.role <> new.role and current_setting('role') <> 'service_role' then
    raise exception 'Cannot change your own role. Admin action required.';
  end if;
  return new;
end;
$$ language plpgsql
set search_path = public;

create trigger prevent_self_role_change before update on public.profiles
  for each row execute function public.prevent_self_role_change();

-- ---------------------------------------------------------------------------
-- ESTATES / BLOCKS / PLOTS — authenticated read, writes via API/service_role
-- ---------------------------------------------------------------------------

create policy "estates_select_auth"
  on public.estates for select to authenticated using (true);

create policy "blocks_select_auth"
  on public.blocks for select to authenticated using (true);

create policy "plots_select_auth"
  on public.plots for select to authenticated using (true);

create policy "plots_update_auth"
  on public.plots for update to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- PROPERTY INTERESTS / APPLICATIONS
-- ---------------------------------------------------------------------------

create policy "property_interests_select_auth"
  on public.property_interests for select to authenticated using (true);

create policy "applications_select_auth"
  on public.applications for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- APPROVALS
-- ---------------------------------------------------------------------------

create policy "approvals_select_auth"
  on public.approvals for select to authenticated using (true);

create policy "approvals_insert_auth"
  on public.approvals for insert to authenticated
  with check (true);

create policy "approvals_update_auth"
  on public.approvals for update to authenticated
  using (true);

-- ---------------------------------------------------------------------------
-- INSPECTIONS — creator can read/update own drafts; all auth can read
-- ---------------------------------------------------------------------------

create policy "inspections_select_auth"
  on public.inspections for select to authenticated using (true);

create policy "inspections_insert_engineer"
  on public.inspections for insert to authenticated
  with check (auth.uid() = inspector_id);

create policy "inspections_update_own_draft"
  on public.inspections for update to authenticated
  using (auth.uid() = inspector_id and status = 'DRAFT')
  with check (auth.uid() = inspector_id);

create policy "inspections_update_role"
  on public.inspections for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
  ));

-- ---------------------------------------------------------------------------
-- INSPECTION PHOTOS / FINDINGS
-- ---------------------------------------------------------------------------

create policy "inspection_photos_select_auth"
  on public.inspection_photos for select to authenticated using (true);

create policy "inspection_photos_insert_auth"
  on public.inspection_photos for insert to authenticated
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ));

create policy "inspection_findings_select_auth"
  on public.inspection_findings for select to authenticated using (true);

create policy "inspection_findings_insert_auth"
  on public.inspection_findings for insert to authenticated
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ));

-- ---------------------------------------------------------------------------
-- DOCUMENTS
-- ---------------------------------------------------------------------------

create policy "documents_select_auth"
  on public.documents for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- PLOT STATUS HISTORY — auth read only (writes via API/service_role)
-- ---------------------------------------------------------------------------

create policy "status_history_select_auth"
  on public.plot_status_history for select to authenticated using (true);

-- Insert: any authenticated user can record status changes
create policy "status_history_insert_auth"
  on public.plot_status_history for insert to authenticated
  with check (changed_by = auth.uid());

-- ---------------------------------------------------------------------------
-- GEOGRAPHICAL UNITS — auth read, writes via API/service_role
-- ---------------------------------------------------------------------------

create policy "gu_select_auth"
  on public.geographical_units for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- INSPECTION ASSIGNMENTS — auth read, supervisor/admin write
-- ---------------------------------------------------------------------------

create policy "assign_select_auth"
  on public.inspection_assignments for select to authenticated using (true);

create policy "assign_insert_auth"
  on public.inspection_assignments for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR')
  ));

create policy "assign_update_auth"
  on public.inspection_assignments for update to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR')
  ))
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR')
  ));

-- ---------------------------------------------------------------------------
-- ASSIGNMENT AREAS — auth read, supervisor/admin insert, assigned engineer update
-- ---------------------------------------------------------------------------

create policy "aa_select_auth"
  on public.assignment_areas for select to authenticated using (true);

create policy "aa_insert_auth"
  on public.assignment_areas for insert to authenticated
  with check (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR')
  ));

create policy "aa_update_auth"
  on public.assignment_areas for update to authenticated
  using (
    exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR')
    )
    or exists (
      select 1 from public.inspection_assignments ia
      where ia.id = assignment_id and ia.assigned_to = auth.uid()
    )
  )
  with check (true);

-- ---------------------------------------------------------------------------
-- AUDIT LOGS — admin read, auth insert
-- ---------------------------------------------------------------------------

create policy "audit_select_admin"
  on public.audit_logs for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'ADMIN'
  ));

create policy "audit_insert_auth"
  on public.audit_logs for insert to authenticated
  with check (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- MAP AREAS — authenticated read all, creator full control
-- ---------------------------------------------------------------------------

create policy "map_areas_select_auth"
  on public.map_areas for select to authenticated
  using (true);

create policy "map_areas_insert_auth"
  on public.map_areas for insert to authenticated
  with check (drawn_by = auth.uid());

create policy "map_areas_update_auth"
  on public.map_areas for update to authenticated
  using (drawn_by = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR','GIS_OFFICER')
  ));

create policy "map_areas_delete_auth"
  on public.map_areas for delete to authenticated
  using (drawn_by = auth.uid() or exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.role in ('ADMIN','SUPERVISOR')
  ));

-- ============================================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================================

-- Auto-update updated_at on row change
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql
set search_path = public;

create trigger set_updated_at before update on public.profiles
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.estates
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.blocks
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.plots
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.property_interests
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.applications
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.approvals
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.inspections
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.inspection_findings
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.documents
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.geographical_units
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.inspection_assignments
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.assignment_areas
  for each row execute function public.handle_updated_at();
create trigger set_updated_at before update on public.map_areas
  for each row execute function public.handle_updated_at();

-- Auto-create profile on user signup (email OTP creates auth.users row)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    coalesce((new.raw_user_meta_data ->> 'role')::public.user_role, 'ENGINEER')
  );
  return new;
end;
$$ language plpgsql security definer
set search_path = public;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Revoke EXECUTE from anon/authenticated — only the trigger should call this
revoke execute on function public.handle_new_user() from anon, authenticated;

-- Revoke access on PostGIS system table (no RLS needed — read-only reference data)
revoke all on table public.spatial_ref_sys from anon, authenticated;

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Count all descendant plot-level units under a given geographical unit
create or replace function public.get_all_descendant_plots(p_unit_id uuid)
returns setof public.geographical_units as $$
  with recursive descendants as (
    select * from public.geographical_units where id = p_unit_id
    union all
    select gu.* from public.geographical_units gu
    inner join descendants d on gu.parent_id = d.id
  )
  select * from descendants where unit_type = 'PLOT';
$$ language sql stable
set search_path = public;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
