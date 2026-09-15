-- FHA MVP — Live Update v3.0
-- Safe to run on existing database.
-- Run this AFTER Schema.sql has already been applied.

-- ============================================================================
-- 1. NEW ENUM TYPES
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE public.plot_inspection_status AS ENUM ('NOT_INSPECTED','INSPECTION_IN_PROGRESS','INSPECTED','AWAITING_REVIEW','REINSPECTION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.plot_approval_status AS ENUM ('NOT_REVIEWED','PENDING','APPROVED','APPROVED_WITH_CONDITIONS','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.unit_type AS ENUM ('DEVELOPMENT','ESTATE','SUB_ESTATE','SCHEME','PHASE','SECTION','ZONE','BLOCK','PARCEL','PLOT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.assignment_status AS ENUM ('DRAFT','ACTIVE','IN_PROGRESS','COMPLETED','CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.assignment_priority AS ENUM ('LOW','NORMAL','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. ADD COLUMNS TO PLOTS
-- ============================================================================

ALTER TABLE public.plots ADD COLUMN IF NOT EXISTS inspection_status public.plot_inspection_status NOT NULL DEFAULT 'NOT_INSPECTED';
ALTER TABLE public.plots ADD COLUMN IF NOT EXISTS approval_status   public.plot_approval_status   NOT NULL DEFAULT 'NOT_REVIEWED';

-- ============================================================================
-- 2b. ADD COLUMNS TO PROFILES
-- ============================================================================

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- ============================================================================
-- 3. STATUS HISTORY TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.plot_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plot_id    uuid NOT NULL REFERENCES public.plots(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  field      text NOT NULL CHECK (field IN ('inspection_status', 'approval_status')),
  old_value  text,
  new_value  text NOT NULL,
  reason     text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_status_history_plot ON public.plot_status_history(plot_id);

ALTER TABLE public.plot_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "status_history_select_auth"
    ON public.plot_status_history FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Insert: any authenticated user can record status changes
DO $$
BEGIN
  CREATE POLICY "status_history_insert_auth"
    ON public.plot_status_history FOR INSERT TO authenticated
    WITH CHECK (changed_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. GEOGRAPHICAL UNITS (hierarchical tree)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geographical_units (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id         uuid REFERENCES public.geographical_units(id) ON DELETE SET NULL,
  unit_type         public.unit_type NOT NULL,
  name              text NOT NULL,
  code              text,
  description       text,
  latitude          double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude         double precision CHECK (longitude BETWEEN -180 AND 180),
  geometry          geometry(Geometry, 4326),
  area_size         numeric,
  area_size_unit    text DEFAULT 'sqm',
  street            text,
  land_use          text,
  inspection_status public.plot_inspection_status NOT NULL DEFAULT 'NOT_INSPECTED',
  approval_status   public.plot_approval_status NOT NULL DEFAULT 'NOT_REVIEWED',
  is_demo           boolean NOT NULL DEFAULT true,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gu_parent   ON public.geographical_units(parent_id);
CREATE INDEX IF NOT EXISTS idx_gu_type     ON public.geographical_units(unit_type);
CREATE INDEX IF NOT EXISTS idx_gu_geometry ON public.geographical_units USING gist(geometry);

ALTER TABLE public.geographical_units ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "gu_select_auth"
    ON public.geographical_units FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 5. INSPECTION ASSIGNMENTS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.inspection_assignments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_number text UNIQUE NOT NULL,
  title             text NOT NULL,
  description       text,
  geo_unit_id       uuid NOT NULL REFERENCES public.geographical_units(id) ON DELETE CASCADE,
  assigned_to       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status            public.assignment_status NOT NULL DEFAULT 'DRAFT',
  priority          public.assignment_priority NOT NULL DEFAULT 'NORMAL',
  target_date       date,
  started_at        timestamptz,
  completed_at      timestamptz,
  total_areas       integer NOT NULL DEFAULT 0,
  completed_areas   integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assign_geo     ON public.inspection_assignments(geo_unit_id);
CREATE INDEX IF NOT EXISTS idx_assign_engineer ON public.inspection_assignments(assigned_to);
CREATE INDEX IF NOT EXISTS idx_assign_status  ON public.inspection_assignments(status);

ALTER TABLE public.inspection_assignments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "assign_select_auth"
    ON public.inspection_assignments FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop permissive policies and recreate with role checks
DROP POLICY IF EXISTS "assign_insert_auth" ON public.inspection_assignments;
DROP POLICY IF EXISTS "assign_update_auth" ON public.inspection_assignments;

DO $$
BEGIN
  CREATE POLICY "assign_insert_auth"
    ON public.inspection_assignments FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('ADMIN','SUPERVISOR')
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "assign_update_auth"
    ON public.inspection_assignments FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('ADMIN','SUPERVISOR')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('ADMIN','SUPERVISOR')
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 6. ASSIGNMENT AREAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assignment_areas (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  uuid NOT NULL REFERENCES public.inspection_assignments(id) ON DELETE CASCADE,
  geo_unit_id    uuid NOT NULL REFERENCES public.geographical_units(id) ON DELETE CASCADE,
  sort_order     integer NOT NULL DEFAULT 0,
  status         public.plot_inspection_status NOT NULL DEFAULT 'NOT_INSPECTED',
  inspection_id  uuid REFERENCES public.inspections(id) ON DELETE SET NULL,
  completed_at   timestamptz,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, geo_unit_id)
);

CREATE INDEX IF NOT EXISTS idx_aa_assignment ON public.assignment_areas(assignment_id);
CREATE INDEX IF NOT EXISTS idx_aa_status     ON public.assignment_areas(status);

ALTER TABLE public.assignment_areas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "aa_select_auth"
    ON public.assignment_areas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Drop permissive policies and recreate with role checks
DROP POLICY IF EXISTS "aa_insert_auth" ON public.assignment_areas;
DROP POLICY IF EXISTS "aa_update_auth" ON public.assignment_areas;

DO $$
BEGIN
  CREATE POLICY "aa_insert_auth"
    ON public.assignment_areas FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('ADMIN','SUPERVISOR')
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "aa_update_auth"
    ON public.assignment_areas FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.role IN ('ADMIN','SUPERVISOR')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspection_assignments ia
        WHERE ia.id = assignment_id AND ia.assigned_to = auth.uid()
      )
    )
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 7. TRIGGERS for new tables
-- ============================================================================

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.geographical_units
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.inspection_assignments
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 8. MIGRATE EXISTING DATA into geographical_units
-- ============================================================================

INSERT INTO public.geographical_units (id, unit_type, name, code, latitude, longitude, geometry, is_demo)
SELECT id, 'ESTATE', name, phase, NULL, NULL, boundary_geometry, is_demo
FROM public.estates
ON CONFLICT DO NOTHING;

INSERT INTO public.geographical_units (id, parent_id, unit_type, name, code, latitude, longitude, geometry, is_demo)
SELECT b.id, b.estate_id, 'BLOCK', b.block_number, b.block_number, NULL, NULL, b.geometry, b.is_demo
FROM public.blocks b
ON CONFLICT DO NOTHING;

INSERT INTO public.geographical_units (id, parent_id, unit_type, name, code, latitude, longitude, geometry, area_size, area_size_unit, street, land_use, inspection_status, approval_status, is_demo)
SELECT p.id, p.block_id, 'PLOT', 'Plot ' || p.plot_number, p.plot_number, p.latitude, p.longitude, p.geometry, p.plot_size, p.plot_size_unit, p.street, p.land_use, p.inspection_status, p.approval_status, p.is_demo
FROM public.plots p
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 9. MIGRATE EXISTING PLOT STATUS to dual-status columns
-- ============================================================================

UPDATE public.plots SET approval_status = 'APPROVED' WHERE status = 'APPROVED' AND approval_status = 'NOT_REVIEWED';
UPDATE public.plots SET approval_status = 'PENDING' WHERE status = 'PENDING' AND approval_status = 'NOT_REVIEWED';
UPDATE public.plots SET inspection_status = 'INSPECTED' WHERE status IN ('UNDER_CONSTRUCTION', 'COMPLETED') AND inspection_status = 'NOT_INSPECTED';
UPDATE public.plots SET inspection_status = 'AWAITING_REVIEW' WHERE status = 'INSPECTION_REQUIRED' AND inspection_status = 'NOT_INSPECTED';
UPDATE public.plots SET inspection_status = 'INSPECTED', approval_status = 'PENDING' WHERE status = 'REVIEW_REQUIRED' AND inspection_status = 'NOT_INSPECTED';

-- ============================================================================
-- 10. HELPER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_all_descendant_plots(p_unit_id uuid)
RETURNS SETOF public.geographical_units AS $$
  WITH RECURSIVE descendants AS (
    SELECT * FROM public.geographical_units WHERE id = p_unit_id
    UNION ALL
    SELECT gu.* FROM public.geographical_units gu
    INNER JOIN descendants d ON gu.parent_id = d.id
  )
  SELECT * FROM descendants WHERE unit_type = 'PLOT';
$$ LANGUAGE sql STABLE
SET search_path = public;

-- ============================================================================
-- 11. MAP AREAS — drawn polygons for inspection workflow
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE public.map_area_type AS ENUM ('INSPECTION_ZONE','INSPECTED_AREA','REVIEW_AREA');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE public.map_area_status AS ENUM ('DRAFT','MARKED','IN_PROGRESS','INSPECTED','AWAITING_REVIEW','APPROVED','REJECTED','REINSPECTION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.map_areas (
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

CREATE INDEX IF NOT EXISTS idx_map_areas_drawn_by   ON public.map_areas(drawn_by);
CREATE INDEX IF NOT EXISTS idx_map_areas_status     ON public.map_areas(status);
CREATE INDEX IF NOT EXISTS idx_map_areas_area_type  ON public.map_areas(area_type);
CREATE INDEX IF NOT EXISTS idx_map_areas_assignment ON public.map_areas(assignment_id);
CREATE INDEX IF NOT EXISTS idx_map_areas_geometry   ON public.map_areas USING gist(geometry);

ALTER TABLE public.map_areas ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "map_areas_select_auth"
    ON public.map_areas FOR SELECT TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "map_areas_insert_auth"
    ON public.map_areas FOR INSERT TO authenticated WITH CHECK (drawn_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "map_areas_update_auth"
    ON public.map_areas FOR UPDATE TO authenticated
    USING (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role IN ('ADMIN','SUPERVISOR')
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "map_areas_delete_auth"
    ON public.map_areas FOR DELETE TO authenticated
    USING (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'ADMIN'
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.map_areas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add missing trigger for assignment_areas
DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assignment_areas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Prevent users from escalating their own role via direct Supabase client calls
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger as $$
BEGIN
  IF old.role <> new.role AND current_setting('role') <> 'service_role' THEN
    RAISE EXCEPTION 'Cannot change your own role. Admin action required.';
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DO $$
BEGIN
  CREATE TRIGGER prevent_self_role_change BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 12. SECURITY HARDENING
-- ============================================================================

-- Revoke access on PostGIS system table (no RLS needed — read-only reference data)
REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;

-- ============================================================================
-- 13. RLS POLICIES FOR PLOTS, APPROVALS, INSPECTIONS (missing write policies)
-- ============================================================================

-- Plots: allow authenticated users to update (API routes do their own role checks)
DO $$
BEGIN
  CREATE POLICY "plots_update_auth"
    ON public.plots FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Approvals: allow authenticated users to insert/update (API routes do their own role checks)
DO $$
BEGIN
  CREATE POLICY "approvals_insert_auth"
    ON public.approvals FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "approvals_update_auth"
    ON public.approvals FOR UPDATE TO authenticated USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Inspections: add role-based update policy for supervisor/admin/approval_officer transitions
-- (the existing "inspections_update_own_draft" only allows inspector to update DRAFT inspections)
DO $$
BEGIN
  CREATE POLICY "inspections_update_role"
    ON public.inspections FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Done.
