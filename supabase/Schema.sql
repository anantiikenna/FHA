-- ============================================================================
-- FHA Development Approval & Property Mapping System
-- Schema.sql — Complete database schema
-- Version: 1.0
-- Date: 2026-09-04
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
create type public.approval_status as enum ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED');
create type public.inspection_status as enum ('DRAFT','SUBMITTED','UNDER_REVIEW','COMPLETED');
create type public.inspection_type as enum ('ROUTINE','FOLLOW_UP','COMPLIANCE');
create type public.compliance_status as enum ('COMPLIANT','MINOR_NON_COMPLIANT','MAJOR_NON_COMPLIANT','UNABLE_TO_DETERMINE');
create type public.interest_type as enum ('ALLOTTEE','ORGANIZATION','OTHER');
create type public.document_type as enum ('ALLOCATION_LETTER','APPROVAL_LETTER','BUILDING_PLAN','SITE_PLAN','INSPECTION_REPORT','OTHER');
create type public.finding_severity as enum ('INFO','REVIEW_REQUIRED','HIGH_PRIORITY');

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
  id            uuid primary key default gen_random_uuid(),
  estate_id     uuid not null references public.estates(id) on delete cascade,
  block_id      uuid references public.blocks(id) on delete set null,
  plot_number   text not null,
  plot_reference text,
  plot_size     numeric,
  plot_size_unit text not null default 'sqm',
  street        text,
  land_use      text,
  latitude      double precision check (latitude between -90 and 90),
  longitude     double precision check (longitude between -180 and 180),
  geometry      geometry(Polygon, 4326),
  status        public.plot_status not null default 'APPROVED',
  is_demo       boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
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

-- Users can update their own profile (limited fields)
create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ---------------------------------------------------------------------------
-- ESTATES / BLOCKS / PLOTS — authenticated read, writes via API/service_role
-- ---------------------------------------------------------------------------

create policy "estates_select_auth"
  on public.estates for select to authenticated using (true);

create policy "blocks_select_auth"
  on public.blocks for select to authenticated using (true);

create policy "plots_select_auth"
  on public.plots for select to authenticated using (true);

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

-- ---------------------------------------------------------------------------
-- INSPECTION PHOTOS / FINDINGS
-- ---------------------------------------------------------------------------

create policy "inspection_photos_select_auth"
  on public.inspection_photos for select to authenticated using (true);

create policy "inspection_photos_insert_auth"
  on public.inspection_photos for insert to authenticated with check (true);

create policy "inspection_findings_select_auth"
  on public.inspection_findings for select to authenticated using (true);

create policy "inspection_findings_insert_auth"
  on public.inspection_findings for insert to authenticated with check (true);

-- ---------------------------------------------------------------------------
-- DOCUMENTS
-- ---------------------------------------------------------------------------

create policy "documents_select_auth"
  on public.documents for select to authenticated using (true);

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
  on public.audit_logs for insert to authenticated with check (true);

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
$$ language plpgsql;

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
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================
