-- FHA MVP — Hierarchical Geographical Units + Inspection Assignments
-- Version: 3.0 — 2026-09-05
-- Run AFTER Schema.sql and live_update.sql

-- ============================================================================
-- 1. GEOGRAPHICAL UNIT TYPES (flexible hierarchy)
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE public.unit_type AS ENUM (
    'DEVELOPMENT',
    'ESTATE',
    'SUB_ESTATE',
    'SCHEME',
    'PHASE',
    'SECTION',
    'ZONE',
    'BLOCK',
    'PARCEL',
    'PLOT'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 2. GEOGRAPHICAL UNITS (self-referencing tree)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.geographical_units (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id        uuid REFERENCES public.geographical_units(id) ON DELETE SET NULL,
  unit_type        public.unit_type NOT NULL,
  name             text NOT NULL,
  code             text,
  description      text,
  latitude         double precision CHECK (latitude BETWEEN -90 AND 90),
  longitude        double precision CHECK (longitude BETWEEN -180 AND 180),
  geometry         geometry(Geometry, 4326),
  area_size        numeric,
  area_size_unit   text DEFAULT 'sqm',
  street           text,
  land_use         text,
  inspection_status public.plot_inspection_status NOT NULL DEFAULT 'NOT_INSPECTED',
  approval_status   public.plot_approval_status NOT NULL DEFAULT 'NOT_REVIEWED',
  is_demo          boolean NOT NULL DEFAULT true,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
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
-- 3. INSPECTION ASSIGNMENTS
-- ============================================================================

DO $$
BEGIN
  CREATE TYPE public.assignment_status AS ENUM ('DRAFT','ACTIVE','IN_PROGRESS','COMPLETED','CANCELLED');
  CREATE TYPE public.assignment_priority AS ENUM ('LOW','NORMAL','HIGH','URGENT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.inspection_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_number text UNIQUE NOT NULL,
  title            text NOT NULL,
  description      text,
  geo_unit_id      uuid NOT NULL REFERENCES public.geographical_units(id) ON DELETE CASCADE,
  assigned_to      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_by       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  status           public.assignment_status NOT NULL DEFAULT 'DRAFT',
  priority         public.assignment_priority NOT NULL DEFAULT 'NORMAL',
  target_date      date,
  started_at       timestamptz,
  completed_at     timestamptz,
  total_areas      integer NOT NULL DEFAULT 0,
  completed_areas  integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_assign_geo    ON public.inspection_assignments(geo_unit_id);
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
    ON public.inspection_assignments FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "assign_update_auth"
    ON public.inspection_assignments FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. ASSIGNMENT AREAS (individual plots/units within an assignment)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.assignment_areas (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   uuid NOT NULL REFERENCES public.inspection_assignments(id) ON DELETE CASCADE,
  geo_unit_id     uuid NOT NULL REFERENCES public.geographical_units(id) ON DELETE CASCADE,
  sort_order      integer NOT NULL DEFAULT 0,
  status          public.plot_inspection_status NOT NULL DEFAULT 'NOT_INSPECTED',
  inspection_id   uuid REFERENCES public.inspections(id) ON DELETE SET NULL,
  completed_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
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
    ON public.assignment_areas FOR INSERT TO authenticated
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "aa_update_auth"
    ON public.assignment_areas FOR UPDATE TO authenticated
    USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 5. TRIGGERS
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
-- 6. MIGRATE EXISTING DATA into geographical_units
-- ============================================================================

-- Estates
INSERT INTO public.geographical_units (id, unit_type, name, code, latitude, longitude, geometry, is_demo)
SELECT id, 'ESTATE', name, phase, NULL, NULL, boundary_geometry, is_demo
FROM public.estates
ON CONFLICT DO NOTHING;

-- Blocks (link to parent estate)
INSERT INTO public.geographical_units (id, parent_id, unit_type, name, code, latitude, longitude, geometry, is_demo)
SELECT b.id, b.estate_id, 'BLOCK', b.block_number, b.block_number, NULL, NULL, b.geometry, b.is_demo
FROM public.blocks b
ON CONFLICT DO NOTHING;

-- Plots (link to parent block)
INSERT INTO public.geographical_units (id, parent_id, unit_type, name, code, latitude, longitude, geometry, area_size, area_size_unit, street, land_use, inspection_status, approval_status, is_demo)
SELECT
  p.id,
  p.block_id,
  'PLOT',
  'Plot ' || p.plot_number,
  p.plot_number,
  p.latitude,
  p.longitude,
  p.geometry,
  p.plot_size,
  p.plot_size_unit,
  p.street,
  p.land_use,
  p.inspection_status,
  p.approval_status,
  p.is_demo
FROM public.plots p
ON CONFLICT DO NOTHING;

-- ============================================================================
-- 7. HELPER FUNCTION: count descendant units of a given type
-- ============================================================================

CREATE OR REPLACE FUNCTION public.count_descendant_plots(p_unit_id uuid)
RETURNS integer AS $$
  WITH RECURSIVE descendants AS (
    SELECT id FROM public.geographical_units WHERE id = p_unit_id
    UNION ALL
    SELECT gu.id FROM public.geographical_units gu
    INNER JOIN descendants d ON gu.parent_id = d.id
  )
  SELECT count(*)::integer FROM descendants WHERE unit_type = 'PLOT';
$$ LANGUAGE sql STABLE
SET search_path = public;

-- ============================================================================
-- 7. HELPER FUNCTION: get all descendant plot-level units
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
-- Done.
-- ============================================================================
