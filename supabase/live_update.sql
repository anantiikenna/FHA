-- FHA MVP — Live Update v2.0
-- Safe to run on existing database.
-- Run this AFTER Schema.sql has already been applied.

-- ============================================================================
-- 1. NEW ENUM TYPES (skip if already exist)
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

-- ============================================================================
-- 4. ENABLE RLS + POLICIES
-- ============================================================================

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
-- 5. UPDATE TRIGGER
-- ============================================================================

DO $$
BEGIN
  CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.plot_status_history
    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 6. MIGRATE EXISTING DATA from legacy status column
-- ============================================================================

UPDATE public.plots
  SET approval_status = 'APPROVED'
  WHERE status = 'APPROVED'
  AND approval_status = 'NOT_REVIEWED';

UPDATE public.plots
  SET approval_status = 'PENDING'
  WHERE status = 'PENDING'
  AND approval_status = 'NOT_REVIEWED';

UPDATE public.plots
  SET inspection_status = 'INSPECTED'
  WHERE status IN ('UNDER_CONSTRUCTION', 'COMPLETED')
  AND inspection_status = 'NOT_INSPECTED';

UPDATE public.plots
  SET inspection_status = 'AWAITING_REVIEW'
  WHERE status = 'INSPECTION_REQUIRED'
  AND inspection_status = 'NOT_INSPECTED';

UPDATE public.plots
  SET inspection_status = 'INSPECTED', approval_status = 'PENDING'
  WHERE status = 'REVIEW_REQUIRED'
  AND inspection_status = 'NOT_INSPECTED';

-- Done.
