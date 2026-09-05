-- ============================================================================
-- FHA MVP — Live Update (safe to run on existing database)
-- Fixes Supabase linter warnings + adds dual-status system.
-- Run this AFTER Schema.sql has already been applied.
-- Version: 2.0
-- Date: 2026-09-05
-- ============================================================================

-- ============================================================================
-- 1. Fix function_search_path_mutable
--    Drop and recreate with set search_path = public
-- ============================================================================

-- handle_updated_at
drop trigger if exists set_updated_at on public.profiles;
drop trigger if exists set_updated_at on public.estates;
drop trigger if exists set_updated_at on public.blocks;
drop trigger if exists set_updated_at on public.plots;
drop trigger if exists set_updated_at on public.property_interests;
drop trigger if exists set_updated_at on public.applications;
drop trigger if exists set_updated_at on public.approvals;
drop trigger if exists set_updated_at on public.inspections;
drop trigger if exists set_updated_at on public.inspection_findings;
drop trigger if exists set_updated_at on public.documents;

drop function if exists public.handle_updated_at();

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

-- handle_new_user
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

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

-- Revoke EXECUTE from anon/authenticated (explicit per role)
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
revoke execute on function public.handle_new_user() from public;

-- ============================================================================
-- 2. Fix rls_policy_always_true — drop and recreate INSERT policies
-- ============================================================================

-- inspection_photos: only inspector of parent inspection can insert
drop policy if exists "inspection_photos_insert_auth" on public.inspection_photos;
create policy "inspection_photos_insert_auth"
  on public.inspection_photos for insert to authenticated
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ));

-- inspection_findings: only inspector of parent inspection can insert
drop policy if exists "inspection_findings_insert_auth" on public.inspection_findings;
create policy "inspection_findings_insert_auth"
  on public.inspection_findings for insert to authenticated
  with check (exists (
    select 1 from public.inspections i
    where i.id = inspection_id and i.inspector_id = auth.uid()
  ));

-- audit_logs: user_id must match the inserting user
drop policy if exists "audit_insert_auth" on public.audit_logs;
create policy "audit_insert_auth"
  on public.audit_logs for insert to authenticated
  with check (user_id = auth.uid());

-- ============================================================================
-- Done. Re-run the linter to verify.
-- ============================================================================

-- ============================================================================
-- 3. DUAL-STATUS SYSTEM (inspection_status + approval_status on plots)
--    Safe to run on existing database — uses IF NOT EXISTS
-- ============================================================================

-- New enum types
DO $$ BEGIN
  create type public.plot_inspection_status as enum ('NOT_INSPECTED','INSPECTION_IN_PROGRESS','INSPECTED','AWAITING_REVIEW','REINSPECTION_REQUIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create type public.plot_approval_status as enum ('NOT_REVIEWED','PENDING','APPROVED','APPROVED_WITH_CONDITIONS','REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Add columns to plots
ALTER TABLE public.plots ADD COLUMN IF NOT EXISTS inspection_status public.plot_inspection_status NOT NULL DEFAULT 'NOT_INSPECTED';
ALTER TABLE public.plots ADD COLUMN IF NOT EXISTS approval_status   public.plot_approval_status   NOT NULL DEFAULT 'NOT_REVIEWED';

-- Status history table
CREATE TABLE IF NOT EXISTS public.plot_status_history (
  id         uuid primary key default gen_random_uuid(),
  plot_id    uuid not null references public.plots(id) on delete cascade,
  changed_by uuid references public.profiles(id) on delete set null,
  field      text not null check (field in ('inspection_status', 'approval_status')),
  old_value  text,
  new_value  text not null,
  reason     text,
  created_at timestamptz not null default now()
);

CREATE INDEX IF NOT EXISTS idx_status_history_plot ON public.plot_status_history(plot_id);

-- Enable RLS
ALTER TABLE public.plot_status_history ENABLE ROW LEVEL SECURITY;

-- RLS policies
DO $$ BEGIN
  create policy "status_history_select_auth"
    on public.plot_status_history for select to authenticated using (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  create policy "status_history_insert_auth"
    on public.plot_status_history for insert to authenticated
    with check (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update trigger for plot_status_history
DO $$ BEGIN
  create trigger set_updated_at before update on public.plot_status_history
    for each row execute function public.handle_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- 4. MIGRATE EXISTING DATA — set initial dual-status from legacy plot_status
-- ============================================================================

-- APPROVED plots → approval_status = APPROVED
UPDATE public.plots
  SET approval_status = 'APPROVED'
  WHERE status = 'APPROVED'
  AND approval_status = 'NOT_REVIEWED';

-- PENDING plots → approval_status = PENDING
UPDATE public.plots
  SET approval_status = 'PENDING'
  WHERE status = 'PENDING'
  AND approval_status = 'NOT_REVIEWED';

-- UNDER_CONSTRUCTION / COMPLETED → inspection_status = INSPECTED
UPDATE public.plots
  SET inspection_status = 'INSPECTED'
  WHERE status IN ('UNDER_CONSTRUCTION', 'COMPLETED')
  AND inspection_status = 'NOT_INSPECTED';

-- INSPECTION_REQUIRED → inspection_status = AWAITING_REVIEW
UPDATE public.plots
  SET inspection_status = 'AWAITING_REVIEW'
  WHERE status = 'INSPECTION_REQUIRED'
  AND inspection_status = 'NOT_INSPECTED';

-- REVIEW_REQUIRED → inspection_status = INSPECTED, approval_status = PENDING
UPDATE public.plots
  SET inspection_status = 'INSPECTED', approval_status = 'PENDING'
  WHERE status = 'REVIEW_REQUIRED'
  AND inspection_status = 'NOT_INSPECTED';

-- ============================================================================
-- Done. Re-run the linter to verify.
-- ============================================================================
