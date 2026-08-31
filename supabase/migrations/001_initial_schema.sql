-- FHA MVP — Initial schema (DATABASE.md:4-5, ARCHITECTURE.md:17)
-- Enable PostGIS
create extension if not exists "postgis";
create extension if not exists "pgcrypto";

-- users (extends auth.users)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  display_name text not null,
  role text not null check (role in ('ADMIN','ENGINEER','APPROVAL_OFFICER','GIS_OFFICER','SUPERVISOR')),
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- estates
create table public.estates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phase text,
  state text,
  boundary_geometry geometry(MultiPolygon, 4326),
  is_demo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- blocks
create table public.blocks (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  block_number text not null,
  geometry geometry(Polygon, 4326),
  is_demo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(estate_id, block_number)
);

-- plots (core — DATABASE.md:10)
create table public.plots (
  id uuid primary key default gen_random_uuid(),
  estate_id uuid not null references public.estates(id) on delete cascade,
  block_id uuid references public.blocks(id) on delete set null,
  plot_number text not null,
  plot_reference text,
  plot_size numeric,
  plot_size_unit text default 'sqm',
  street text,
  land_use text,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  geometry geometry(Polygon, 4326),
  status text not null default 'APPROVED' check (status in ('APPROVED','PENDING','UNDER_CONSTRUCTION','COMPLETED','INSPECTION_REQUIRED','REVIEW_REQUIRED')),
  is_demo boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_plots_geometry on public.plots using gist(geometry);
create index idx_plots_plot_number on public.plots(plot_number);
create index idx_plots_block on public.plots(block_id);
create index idx_plots_estate on public.plots(estate_id);

-- property_interests
create table public.property_interests (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  name text not null,
  organization_name text,
  interest_type text check (interest_type in ('ALLOTTEE','ORGANIZATION','OTHER')),
  allocation_number text,
  allocation_date date,
  is_current boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- applications
create table public.applications (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  application_number text unique not null,
  application_type text,
  submission_date date,
  status text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- approvals (DATABASE.md:14)
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  approval_number text unique not null,
  approval_date date,
  valid_until date,
  status text check (status in ('PENDING','APPROVED','REJECTED','EXPIRED','CANCELLED')),
  development_type text,
  approved_floors integer check (approved_floors >= 0),
  approved_units integer check (approved_units >= 0),
  building_coverage numeric,
  front_setback numeric,
  side_setback numeric,
  rear_setback numeric,
  conditions text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_approvals_number on public.approvals(approval_number);
create index idx_approvals_plot on public.approvals(plot_id);

-- inspections (DATABASE.md:15)
create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid not null references public.plots(id) on delete cascade,
  approval_id uuid references public.approvals(id) on delete set null,
  inspection_number text unique not null,
  inspector_id uuid references public.profiles(id) on delete set null,
  inspection_type text check (inspection_type in ('ROUTINE','FOLLOW_UP','COMPLIANCE')),
  inspection_date date not null,
  inspection_time time,
  latitude double precision check (latitude between -90 and 90),
  longitude double precision check (longitude between -180 and 180),
  gps_accuracy numeric,
  construction_stage text,
  observed_floors integer,
  observed_units integer,
  observed_front_setback numeric,
  observed_side_setback numeric,
  observed_rear_setback numeric,
  observed_building_use text,
  compliance_status text check (compliance_status in ('COMPLIANT','MINOR_NON_COMPLIANT','MAJOR_NON_COMPLIANT','UNABLE_TO_DETERMINE')),
  observations text,
  recommendations text,
  status text not null default 'DRAFT' check (status in ('DRAFT','SUBMITTED','UNDER_REVIEW','COMPLETED')),
  submitted_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
create index idx_inspections_plot on public.inspections(plot_id);
create index idx_inspections_inspector on public.inspections(inspector_id);

-- inspection_photos
create table public.inspection_photos (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  storage_key text not null,
  file_name text not null,
  mime_type text not null,
  file_size integer check (file_size >= 0),
  caption text,
  latitude double precision,
  longitude double precision,
  captured_at timestamptz,
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- inspection_findings (DATABASE.md:17)
create table public.inspection_findings (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  category text,
  title text not null,
  description text,
  severity text check (severity in ('INFO','REVIEW_REQUIRED','HIGH_PRIORITY')),
  recommendation text,
  status text default 'OPEN',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- documents
create table public.documents (
  id uuid primary key default gen_random_uuid(),
  plot_id uuid references public.plots(id) on delete cascade,
  application_id uuid references public.applications(id) on delete set null,
  approval_id uuid references public.approvals(id) on delete set null,
  inspection_id uuid references public.inspections(id) on delete set null,
  document_type text check (document_type in ('ALLOCATION_LETTER','APPROVAL_LETTER','BUILDING_PLAN','SITE_PLAN','INSPECTION_REPORT','OTHER')),
  file_name text not null,
  storage_key text not null,
  mime_type text not null,
  file_size integer check (file_size >= 0),
  uploaded_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- audit_logs
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text not null,
  metadata jsonb,
  created_at timestamptz default now()
);
create index idx_audit_entity on public.audit_logs(entity_type, entity_id);
create index idx_audit_user on public.audit_logs(user_id);

-- Enable RLS (SECURITY.md:32) — policies added per table in next migration
alter table public.profiles enable row level security;
alter table public.estates enable row level security;
alter table public.blocks enable row level security;
alter table public.plots enable row level security;
alter table public.approvals enable row level security;
alter table public.inspections enable row level security;
alter table public.documents enable row level security;
