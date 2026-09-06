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

DO $$
BEGIN
  CREATE POLICY "status_history_insert_auth"
    ON public.plot_status_history FOR INSERT TO authenticated
    WITH CHECK (true);
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

DO $$
BEGIN
  CREATE POLICY "assign_insert_auth"
    ON public.inspection_assignments FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "assign_update_auth"
    ON public.inspection_assignments FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
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

DO $$
BEGIN
  CREATE POLICY "aa_insert_auth"
    ON public.assignment_areas FOR INSERT TO authenticated WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "aa_update_auth"
    ON public.assignment_areas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
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

-- Done.
