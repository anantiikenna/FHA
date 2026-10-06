-- FHA MVP — Live Update v3.1
-- Safe to run on existing database.
-- Run this AFTER Schema.sql has already been applied.
-- Based on patterns from reference SQL for Data API compliance.

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

-- Align approvals.status with plot_approval_status (APPROVED_WITH_CONDITIONS was missing)
DO $$
BEGIN
  ALTER TYPE public.approval_status ADD VALUE IF NOT EXISTS 'APPROVED_WITH_CONDITIONS';
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
    ON public.plot_status_history FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "status_history_select_auth" ON public.plot_status_history;
  CREATE POLICY "status_history_select_auth"
    ON public.plot_status_history FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
  is_demo           boolean NOT NULL DEFAULT false,
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
    ON public.geographical_units FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "gu_select_auth" ON public.geographical_units;
  CREATE POLICY "gu_select_auth"
    ON public.geographical_units FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 5. INSPECTION ASSIGNMENTS
-- ============================================================================
-- assigned_to: normally an ENGINEER (zone assign dropdown) — a higher role
-- (ADMIN/SUPERVISOR/GIS_OFFICER) may also assign a zone to ITSELF
-- (self-assignment; enforced and audited in POST /map-areas/{id}/assign).

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
    ON public.inspection_assignments FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "assign_select_auth" ON public.inspection_assignments;
  CREATE POLICY "assign_select_auth"
    ON public.inspection_assignments FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

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
    ON public.assignment_areas FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "aa_select_auth" ON public.assignment_areas;
  CREATE POLICY "aa_select_auth"
    ON public.assignment_areas FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DROP POLICY IF EXISTS "aa_insert_auth" ON public.assignment_areas;
DROP POLICY IF EXISTS "aa_update_auth" ON public.assignment_areas;

DO $$
BEGIN
  CREATE POLICY "aa_insert_auth"
    ON public.assignment_areas FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER')
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
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspection_assignments ia
        WHERE ia.id = assignment_id
          AND ia.assigned_to = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspection_assignments ia
        WHERE ia.id = assignment_id
          AND ia.assigned_to = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    );
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

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.assignment_areas
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
    ON public.map_areas FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "map_areas_select_auth" ON public.map_areas;
  CREATE POLICY "map_areas_select_auth"
    ON public.map_areas FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "map_areas_insert_auth"
    ON public.map_areas FOR INSERT TO authenticated WITH CHECK (drawn_by = auth.uid());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP POLICY IF EXISTS "map_areas_update_auth" ON public.map_areas;
DROP POLICY IF EXISTS "map_areas_delete_auth" ON public.map_areas;

DO $$
BEGIN
  CREATE POLICY "map_areas_update_auth"
    ON public.map_areas FOR UPDATE TO authenticated
    USING (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
    ))
    WITH CHECK (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "map_areas_update_auth" ON public.map_areas;
  CREATE POLICY "map_areas_update_auth"
    ON public.map_areas FOR UPDATE TO authenticated
    USING (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
    ))
    WITH CHECK (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "map_areas_delete_auth"
    ON public.map_areas FOR DELETE TO authenticated
    USING (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER')
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "map_areas_delete_auth" ON public.map_areas;
  CREATE POLICY "map_areas_delete_auth"
    ON public.map_areas FOR DELETE TO authenticated
    USING (drawn_by = auth.uid() OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.map_areas
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 12. SECURITY: prevent self role escalation
-- ============================================================================

-- Block self role/status/email changes by an authenticated user.
-- Allow postgres/service_role/dashboard (SQL editor, mock_data, admin API).
CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS trigger as $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND auth.uid() = old.id
     AND current_setting('role', true) NOT IN ('service_role','postgres','dashboard') THEN
    IF old.role <> new.role THEN
      RAISE EXCEPTION 'Cannot change your own role. Admin action required.';
    END IF;
    IF new.is_active IS DISTINCT FROM old.is_active
       OR new.email IS DISTINCT FROM old.email THEN
      RAISE EXCEPTION 'Cannot change your own account status or email. Admin action required.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS prevent_self_role_change ON public.profiles;
  CREATE TRIGGER prevent_self_role_change BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.prevent_self_role_change();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Block non-approval roles from changing plots.approval_status / non-inspection roles
-- from changing inspection_status (column grant is shared across `authenticated`).
CREATE OR REPLACE FUNCTION public.protect_plot_approval_status()
RETURNS trigger as $$
BEGIN
  IF new.approval_status IS DISTINCT FROM old.approval_status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
    ) AND current_setting('role', true) NOT IN ('service_role','postgres','dashboard') THEN
      RAISE EXCEPTION 'Insufficient permissions to change approval status.';
    END IF;
  END IF;
  IF new.inspection_status IS DISTINCT FROM old.inspection_status THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','ENGINEER')
    ) AND current_setting('role', true) NOT IN ('service_role','postgres','dashboard') THEN
      RAISE EXCEPTION 'Insufficient permissions to change inspection status.';
    END IF;
  END IF;
  RETURN new;
END;
$$ LANGUAGE plpgsql
SET search_path = public;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS protect_plot_approval_status ON public.plots;
  CREATE TRIGGER protect_plot_approval_status BEFORE UPDATE ON public.plots
    FOR EACH ROW EXECUTE FUNCTION public.protect_plot_approval_status();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP TRIGGER IF EXISTS protect_plot_approval_status ON public.geographical_units;
  CREATE TRIGGER protect_plot_approval_status BEFORE UPDATE ON public.geographical_units
    FOR EACH ROW EXECUTE FUNCTION public.protect_plot_approval_status();
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 13. SECURITY: PostGIS system table
-- ============================================================================

REVOKE ALL ON TABLE public.spatial_ref_sys FROM anon, authenticated;

-- ============================================================================
-- 14. RLS POLICIES FOR PLOTS, APPROVALS, INSPECTIONS (write policies)
-- ============================================================================

-- Own-draft update: may only move DRAFT → SUBMITTED (cannot skip review).
-- DROP first so existing DBs get the WITH CHECK constraint.
DO $$
BEGIN
  DROP POLICY IF EXISTS "inspections_update_own_draft" ON public.inspections;
  CREATE POLICY "inspections_update_own_draft"
    ON public.inspections FOR UPDATE TO authenticated
    USING (
      auth.uid() = inspector_id
      AND status = 'DRAFT'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    )
    WITH CHECK (
      auth.uid() = inspector_id
      AND status IN ('DRAFT','SUBMITTED')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Drop overly-permissive policies if present, then recreate role-gated versions
DO $$
BEGIN
  DROP POLICY IF EXISTS "plots_update_auth" ON public.plots;
  CREATE POLICY "plots_update_auth"
    ON public.plots FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER','ENGINEER','GIS_OFFICER')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER','ENGINEER','GIS_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "approvals_insert_auth" ON public.approvals;
  CREATE POLICY "approvals_insert_auth"
    ON public.approvals FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "approvals_update_auth" ON public.approvals;
  CREATE POLICY "approvals_update_auth"
    ON public.approvals FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "inspections_update_role" ON public.inspections;
  CREATE POLICY "inspections_update_role"
    ON public.inspections FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "inspections_delete_role" ON public.inspections;
  CREATE POLICY "inspections_delete_role"
    ON public.inspections FOR DELETE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Insert: active inspector only; self-complete / skip-review blocked at the row level
DO $$
BEGIN
  DROP POLICY IF EXISTS "inspections_insert_engineer" ON public.inspections;
  CREATE POLICY "inspections_insert_engineer"
    ON public.inspections FOR INSERT TO authenticated
    WITH CHECK (
      auth.uid() = inspector_id
      AND status IN ('DRAFT','SUBMITTED')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- GU update (assignment area progress sync)
DO $$
BEGIN
  DROP POLICY IF EXISTS "gu_update_auth" ON public.geographical_units;
  CREATE POLICY "gu_update_auth"
    ON public.geographical_units FOR UPDATE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','ENGINEER','GIS_OFFICER')
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','ENGINEER','GIS_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Assignments: GIS can create; engineer can update own progress; admin/sup delete
DO $$
BEGIN
  DROP POLICY IF EXISTS "assign_insert_auth" ON public.inspection_assignments;
  CREATE POLICY "assign_insert_auth"
    ON public.inspection_assignments FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "assign_update_auth" ON public.inspection_assignments;
  CREATE POLICY "assign_update_auth"
    ON public.inspection_assignments FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR')
      )
      OR (
        assigned_to = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR')
      )
      OR (
        assigned_to = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "assign_delete_auth" ON public.inspection_assignments;
  CREATE POLICY "assign_delete_auth"
    ON public.inspection_assignments FOR DELETE TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Assignment areas: GIS can insert; active staff only
DO $$
BEGIN
  DROP POLICY IF EXISTS "aa_insert_auth" ON public.assignment_areas;
  CREATE POLICY "aa_insert_auth"
    ON public.assignment_areas FOR INSERT TO authenticated
    WITH CHECK (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "aa_update_auth" ON public.assignment_areas;
  CREATE POLICY "aa_update_auth"
    ON public.assignment_areas FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspection_assignments ia
        WHERE ia.id = assignment_id
          AND ia.assigned_to = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspection_assignments ia
        WHERE ia.id = assignment_id
          AND ia.assigned_to = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Audit: supervisors can read (matches API); active users can insert own
DO $$
BEGIN
  DROP POLICY IF EXISTS "audit_select_admin" ON public.audit_logs;
  CREATE POLICY "audit_select_admin"
    ON public.audit_logs FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.is_active = true
        AND p.role IN ('ADMIN','SUPERVISOR')
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "audit_insert_auth" ON public.audit_logs;
  CREATE POLICY "audit_insert_auth"
    ON public.audit_logs FOR INSERT TO authenticated
    WITH CHECK (
      user_id = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Status history insert: active users only
DO $$
BEGIN
  DROP POLICY IF EXISTS "status_history_insert_auth" ON public.plot_status_history;
  CREATE POLICY "status_history_insert_auth"
    ON public.plot_status_history FOR INSERT TO authenticated
    WITH CHECK (
      changed_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Map areas: active users only on writes
DO $$
BEGIN
  DROP POLICY IF EXISTS "map_areas_insert_auth" ON public.map_areas;
  CREATE POLICY "map_areas_insert_auth"
    ON public.map_areas FOR INSERT TO authenticated
    WITH CHECK (
      drawn_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "map_areas_update_auth" ON public.map_areas;
  CREATE POLICY "map_areas_update_auth"
    ON public.map_areas FOR UPDATE TO authenticated
    USING (
      (
        drawn_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
      )
    )
    WITH CHECK (
      (
        drawn_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "map_areas_delete_auth" ON public.map_areas;
  CREATE POLICY "map_areas_delete_auth"
    ON public.map_areas FOR DELETE TO authenticated
    USING (
      (
        drawn_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR')
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Inspection photos / findings inserts: active inspector, or ADMIN on any inspection
DO $$
BEGIN
  DROP POLICY IF EXISTS "inspection_photos_insert_auth" ON public.inspection_photos;
  CREATE POLICY "inspection_photos_insert_auth"
    ON public.inspection_photos FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.inspections i
        WHERE i.id = inspection_id
          AND i.status IN ('DRAFT','SUBMITTED','UNDER_REVIEW')
          AND (
            i.inspector_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role = 'ADMIN' AND p.is_active = true
            )
          )
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "inspection_findings_insert_auth" ON public.inspection_findings;
  CREATE POLICY "inspection_findings_insert_auth"
    ON public.inspection_findings FOR INSERT TO authenticated
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.inspections i
        WHERE i.id = inspection_id AND i.inspector_id = auth.uid()
      )
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- SELECT scoping: engineers only see their own inspections/photos;
-- privileged review roles see all. Deactivated users see nothing.
DO $$
BEGIN
  DROP POLICY IF EXISTS "inspections_select_auth" ON public.inspections;
  CREATE POLICY "inspections_select_auth"
    ON public.inspections FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER','GIS_OFFICER')
      )
      OR (
        inspector_id = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "inspection_photos_select_auth" ON public.inspection_photos;
  CREATE POLICY "inspection_photos_select_auth"
    ON public.inspection_photos FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspections i
        WHERE i.id = inspection_id
          AND i.inspector_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "inspection_findings_select_auth" ON public.inspection_findings;
  CREATE POLICY "inspection_findings_select_auth"
    ON public.inspection_findings FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspections i
        WHERE i.id = inspection_id
          AND i.inspector_id = auth.uid()
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Documents: active staff only (workflow: View Documents for all roles)
DO $$
BEGIN
  DROP POLICY IF EXISTS "documents_select_auth" ON public.documents;
  CREATE POLICY "documents_select_auth"
    ON public.documents FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Assignments SELECT: supervisors/GIS/admin see all; engineers only their own
DO $$
BEGIN
  DROP POLICY IF EXISTS "assign_select_auth" ON public.inspection_assignments;
  CREATE POLICY "assign_select_auth"
    ON public.inspection_assignments FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
      )
      OR (
        (
          assigned_to = auth.uid()
          OR created_by = auth.uid()
        )
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Assignment areas SELECT: same scoping as parent assignment
DO $$
BEGIN
  DROP POLICY IF EXISTS "aa_select_auth" ON public.assignment_areas;
  CREATE POLICY "aa_select_auth"
    ON public.assignment_areas FOR SELECT TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
      )
      OR EXISTS (
        SELECT 1 FROM public.inspection_assignments ia
        WHERE ia.id = assignment_id
          AND (
            ia.assigned_to = auth.uid()
            OR ia.created_by = auth.uid()
          )
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============================================================================
-- 15. FIX: profiles_select_admin — SECURITY DEFINER function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN' AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- SECURITY DEFINER already protects this function (runs as owner, not caller).
-- Must keep EXECUTE granted to authenticated so RLS policies can invoke it.
GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM anon;

CREATE OR REPLACE FUNCTION public.can_list_users()
RETURNS boolean AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid()
      AND role IN ('ADMIN','SUPERVISOR','GIS_OFFICER')
      AND is_active = true
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

GRANT EXECUTE ON FUNCTION public.can_list_users() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.can_list_users() FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_list_users() FROM PUBLIC;

DO $$
BEGIN
  DROP POLICY IF EXISTS "profiles_select_admin" ON public.profiles;
  CREATE POLICY "profiles_select_admin"
    ON public.profiles FOR SELECT TO authenticated
    USING (public.is_admin_user() OR public.can_list_users());
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- SECURITY: never trust role from client user_metadata — always default ENGINEER
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, display_name, role)
  VALUES (
    new.id,
    new.email,
    COALESCE(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1)),
    'ENGINEER'::public.user_role
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- ============================================================================
-- 16. REVOKE EXECUTE from PUBLIC/anon for SECURITY DEFINER functions
-- ============================================================================

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin_user() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_list_users() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.prevent_self_role_change() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_all_descendant_plots(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.get_all_descendant_plots(uuid) FROM PUBLIC, anon;

-- ============================================================================
-- 17. GRANT statements — Data API compliance
-- ============================================================================
-- Pattern from reference SQL: explicit GRANTs ensure PostgREST can serve
-- the correct data based on RLS policies.

-- profiles — no direct client writes (admin uses service_role only)
REVOKE UPDATE, INSERT, DELETE ON public.profiles FROM authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO service_role;

-- estates
GRANT SELECT ON public.estates TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estates TO service_role;

-- blocks
GRANT SELECT ON public.blocks TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.blocks TO service_role;

-- plots — column-limited UPDATE for authenticated (approval/inspection fields only; geometry via service_role)
REVOKE UPDATE ON public.plots FROM authenticated;
GRANT SELECT ON public.plots TO authenticated;
GRANT UPDATE (approval_status, inspection_status, updated_at) ON public.plots TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plots TO service_role;

-- Soft-delete safety: is_demo must be explicit (never default true on production rows)
ALTER TABLE public.estates            ALTER COLUMN is_demo SET DEFAULT false;
ALTER TABLE public.blocks             ALTER COLUMN is_demo SET DEFAULT false;
ALTER TABLE public.plots              ALTER COLUMN is_demo SET DEFAULT false;
ALTER TABLE public.geographical_units ALTER COLUMN is_demo SET DEFAULT false;

-- property_interests
GRANT SELECT ON public.property_interests TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.property_interests TO service_role;

-- applications
GRANT SELECT ON public.applications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.applications TO service_role;

-- approvals — no authenticated write grant; role RLS policies allow insert/update for authorized roles
GRANT SELECT, INSERT, UPDATE ON public.approvals TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.approvals TO service_role;

-- inspections
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspections TO service_role;

-- inspection_photos
GRANT SELECT, INSERT ON public.inspection_photos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_photos TO service_role;

-- inspection_findings
GRANT SELECT, INSERT ON public.inspection_findings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_findings TO service_role;

-- documents
GRANT SELECT ON public.documents TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO service_role;

-- audit_logs
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.audit_logs TO service_role;

-- plot_status_history
GRANT SELECT, INSERT ON public.plot_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.plot_status_history TO service_role;

-- geographical_units — column-limited UPDATE; approval_status not client-writable
REVOKE UPDATE ON public.geographical_units FROM authenticated;
GRANT SELECT ON public.geographical_units TO authenticated;
GRANT UPDATE (inspection_status, updated_at) ON public.geographical_units TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.geographical_units TO service_role;

-- SELECT policies: active staff only (supersede any USING (true) defaults)
DO $$
BEGIN
  DROP POLICY IF EXISTS "estates_select_auth" ON public.estates;
  CREATE POLICY "estates_select_auth"
    ON public.estates FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "blocks_select_auth" ON public.blocks;
  CREATE POLICY "blocks_select_auth"
    ON public.blocks FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "plots_select_auth" ON public.plots;
  CREATE POLICY "plots_select_auth"
    ON public.plots FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "property_interests_select_auth" ON public.property_interests;
  CREATE POLICY "property_interests_select_auth"
    ON public.property_interests FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "applications_select_auth" ON public.applications;
  CREATE POLICY "applications_select_auth"
    ON public.applications FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  DROP POLICY IF EXISTS "approvals_select_auth" ON public.approvals;
  CREATE POLICY "approvals_select_auth"
    ON public.approvals FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

GRANT SELECT, INSERT, UPDATE ON public.geographical_units TO service_role;

-- inspection_assignments
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_assignments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inspection_assignments TO service_role;

-- assignment_areas
GRANT SELECT, INSERT, UPDATE ON public.assignment_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assignment_areas TO service_role;

-- map_areas
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_areas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_areas TO service_role;

-- ============================================================================
-- 18. STORAGE BUCKETS & POLICIES (merged from storage.sql — AGENTS §35)
-- ============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'inspection-photos',
  'inspection-photos',
  false,
  10485760,
  array['image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-documents',
  'property-documents',
  false,
  52428800,
  array['application/pdf', 'image/jpeg', 'image/png']
) ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "inspection_photos_select" ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_insert" ON storage.objects;
DROP POLICY IF EXISTS "inspection_photos_delete" ON storage.objects;
DROP POLICY IF EXISTS "property_documents_select" ON storage.objects;
DROP POLICY IF EXISTS "property_documents_insert" ON storage.objects;

DO $$
BEGIN
  CREATE POLICY "inspection_photos_select"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'inspection-photos'
      AND (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
            AND p.is_active = true
            AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
        )
        OR EXISTS (
          SELECT 1 FROM public.inspections i
          WHERE i.id = (string_to_array(name, '/'))[2]::uuid
            AND i.inspector_id = auth.uid()
            AND EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.is_active = true
            )
        )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "inspection_photos_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'inspection-photos'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
      AND EXISTS (
        SELECT 1 FROM public.inspections i
        WHERE i.id = (string_to_array(name, '/'))[2]::uuid
          AND i.status IN ('DRAFT','SUBMITTED','UNDER_REVIEW')
          AND (
            i.inspector_id = auth.uid()
            OR EXISTS (
              SELECT 1 FROM public.profiles p
              WHERE p.id = auth.uid() AND p.role = 'ADMIN' AND p.is_active = true
            )
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "inspection_photos_delete"
    ON storage.objects FOR DELETE TO authenticated
    USING (
      bucket_id = 'inspection-photos'
      AND EXISTS (
        SELECT 1 FROM public.inspections i
        WHERE i.id = (string_to_array(name, '/'))[2]::uuid
          AND i.inspector_id = auth.uid()
          AND i.status = 'DRAFT'
          AND EXISTS (
            SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.is_active = true
          )
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "property_documents_select"
    ON storage.objects FOR SELECT TO authenticated
    USING (
      bucket_id = 'property-documents'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "property_documents_insert"
    ON storage.objects FOR INSERT TO authenticated
    WITH CHECK (
      bucket_id = 'property-documents'
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 19. spatial_ref_sys NOTE
-- ============================================================================
-- PostGIS system table owned by postgres superuser. Cannot enable RLS from
-- dashboard. REVOKE ALL (section 13) blocks API access. Safe to ignore
-- the linter warning for this table.

-- ============================================================================
-- 20. MAP AREA FIELD WORKFLOW (zone assignment + officer sub-areas)
-- ============================================================================
-- idx_map_areas_parent speeds up "children of a zone" lookups.
-- map_areas_update_auth is split into two permissive policies (OR):
--   map_areas_update_roles : role-based reviewers may update any row and set
--                            any status (APPROVE / REJECT / reopen).
--   map_areas_update_own   : the creator may update their own row but cannot
--                            write APPROVED or REJECTED (no self-approval).
-- Safe to re-run: drops any earlier variant first.

CREATE INDEX IF NOT EXISTS idx_map_areas_parent ON public.map_areas(parent_area_id);

DROP POLICY IF EXISTS "map_areas_update_auth" ON public.map_areas;
DROP POLICY IF EXISTS "map_areas_update_roles" ON public.map_areas;
DROP POLICY IF EXISTS "map_areas_update_own"   ON public.map_areas;

DO $$
BEGIN
  CREATE POLICY "map_areas_update_roles"
    ON public.map_areas FOR UPDATE TO authenticated
    USING (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER','APPROVAL_OFFICER')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "map_areas_update_own"
    ON public.map_areas FOR UPDATE TO authenticated
    USING (
      drawn_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    )
    WITH CHECK (
      drawn_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
      AND status NOT IN ('APPROVED','REJECTED')
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 21. INSPECTIONS: link inspection to map area (zone / field area)
-- ============================================================================

ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS map_area_id uuid;

DO $$
BEGIN
  ALTER TABLE public.inspections
    ADD CONSTRAINT inspections_map_area_fk
    FOREIGN KEY (map_area_id) REFERENCES public.map_areas(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_inspections_map_area ON public.inspections(map_area_id);

-- ============================================================================
-- 22. FIELD-OUTCOME STATUSES + ZONE CASCADE DELETE
-- ============================================================================
-- Two engineer field-outcome statuses (provisional wording - for FHA confirmation):
--   NON_COMPLIANT_OBSERVED : inspector observed non-compliance (observation, not a
--                            legal/enforcement decision)
--   AWAITING_OWNER         : field work paused, waiting for the property owner
-- NOTE: ALTER TYPE ADD VALUE cannot be used within the same transaction;
-- run this file's statements as a script (Supabase SQL editor default).

ALTER TYPE public.map_area_status ADD VALUE IF NOT EXISTS 'NON_COMPLIANT_OBSERVED';
ALTER TYPE public.map_area_status ADD VALUE IF NOT EXISTS 'AWAITING_OWNER';

-- Deleting a zone must delete every descendant field area (children, grandchildren).
DO $$
BEGIN
  ALTER TABLE public.map_areas
    DROP CONSTRAINT IF EXISTS map_areas_parent_area_id_fkey;
  ALTER TABLE public.map_areas
    ADD CONSTRAINT map_areas_parent_area_id_fkey
    FOREIGN KEY (parent_area_id) REFERENCES public.map_areas(id) ON DELETE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- GIS_OFFICER may delete areas (zones they drew are IN_PROGRESS once assigned,
-- and the role branch must match the API's ADMIN_ROLES).
DO $$
BEGIN
  DROP POLICY IF EXISTS "map_areas_delete_auth" ON public.map_areas;
  CREATE POLICY "map_areas_delete_auth"
    ON public.map_areas FOR DELETE TO authenticated
    USING (
      (
        drawn_by = auth.uid()
        AND EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid() AND p.is_active = true
        )
      )
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid()
          AND p.is_active = true
          AND p.role IN ('ADMIN','SUPERVISOR','GIS_OFFICER')
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 23. MAP AREAS: "Empty / Unoccupied" field outcome
-- ============================================================================
-- Field outcome recorded by the assigned officer on their own marked child
-- area (observation, not an enforcement decision). Allowed for ENGINEER via
-- map_areas_update_own (WITH CHECK only blocks APPROVED/REJECTED).
ALTER TYPE public.map_area_status ADD VALUE IF NOT EXISTS 'EMPTY_UNOCCUPIED';

-- ============================================================================
-- 24. ASSIGNMENT STATUS: READY_FOR_COMPLETION (manual completion gate)
-- ============================================================================
-- When an assignment's progress reaches 100% it becomes READY_FOR_COMPLETION;
-- an authorized user (ADMIN/SUPERVISOR) then explicitly marks it COMPLETED.
-- The application never auto-completes an assignment (WORKFLOWS v0.2 A6).
-- Appended at the end of the enum so fresh installs match migrated databases.
ALTER TYPE public.assignment_status ADD VALUE IF NOT EXISTS 'READY_FOR_COMPLETION';

-- ============================================================================
-- 25. MAP AREAS: property outcome statuses (UNAPPROVED / SET_FOR_DEMOLITION)
-- ============================================================================
-- Field outcomes recorded via metadata.property_outcome (proposed by the
-- assigned officer, agreed by a higher review role; higher roles are
-- accepted directly). Observations/recommendations requiring human review —
-- not automated enforcement decisions (AGENTS.md §8). Pair with
-- EMPTY_UNOCCUPIED (§23) as the "unoccupied property" outcome.
ALTER TYPE public.map_area_status ADD VALUE IF NOT EXISTS 'UNAPPROVED_PROPERTY';
ALTER TYPE public.map_area_status ADD VALUE IF NOT EXISTS 'SET_FOR_DEMOLITION';
-- NOTE: ALTER TYPE ADD VALUE cannot be used within the same transaction;
-- run this file's statements as a script (Supabase SQL editor default).

-- ============================================================================
-- 26. MAP AREAS: "approved property" field outcome (fourth property outcome)
-- ============================================================================
-- Symmetric positive counterpart to §23/§25 (unoccupied / unapproved /
-- demolition): the officer records that the property conforms to its stored
-- approval — a field observation for higher-role agreement, never an
-- automated official approval decision (AGENTS.md §7/§8).
ALTER TYPE public.map_area_status ADD VALUE IF NOT EXISTS 'APPROVED_PROPERTY';

-- ============================================================================
-- 27. MAP AREAS: status/outcome history (who submitted / approved / rejected)
-- ============================================================================
-- Per-area record of every status transition and property-outcome event:
-- who did what to which area and when (AGENTS A14). Written server-side by
-- PATCH /map-areas/{id}; read via GET /api/v1/map-areas/history.
CREATE TABLE IF NOT EXISTS public.map_area_status_history (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_id    uuid NOT NULL REFERENCES public.map_areas(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  field      text NOT NULL CHECK (field IN ('status', 'property_outcome')),
  old_value  text,
  new_value  text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_map_area_status_history_area
  ON public.map_area_status_history(area_id, created_at DESC);

ALTER TABLE public.map_area_status_history ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  CREATE POLICY "map_area_history_select_auth"
    ON public.map_area_status_history FOR SELECT TO authenticated
    USING (EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.is_active = true
    ));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "map_area_history_insert_auth"
    ON public.map_area_status_history FOR INSERT TO authenticated
    WITH CHECK (
      changed_by = auth.uid()
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.is_active = true
      )
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

GRANT SELECT ON public.map_area_status_history TO authenticated;
GRANT INSERT ON public.map_area_status_history TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.map_area_status_history TO service_role;

-- ============================================================================
-- 28. INSPECTIONS: GPS capture timestamp (evidence: when the location was taken)
--     inspection_photos already has latitude/longitude/captured_at columns.
-- ============================================================================
ALTER TABLE public.inspections ADD COLUMN IF NOT EXISTS gps_captured_at timestamptz;

-- ============================================================================
-- END OF LIVE UPDATE
-- ============================================================================
