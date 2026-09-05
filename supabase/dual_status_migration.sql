-- ============================================================================
-- FHA MVP — Dual-Status Migration
-- Adds inspection_status + approval_status to plots, plus status history.
-- Run AFTER Schema.sql and live_update.sql on existing database.
-- ============================================================================

-- ============================================================================
-- 1. NEW ENUM TYPES
-- ============================================================================

-- Inspection lifecycle (what the engineer does)
create type public.plot_inspection_status as enum (
  'NOT_INSPECTED',
  'INSPECTION_IN_PROGRESS',
  'INSPECTED',
  'AWAITING_REVIEW',
  'REINSPECTION_REQUIRED'
);

-- Approval lifecycle (what the approval officer does)
create type public.plot_approval_status as enum (
  'NOT_REVIEWED',
  'PENDING',
  'APPROVED',
  'APPROVED_WITH_CONDITIONS',
  'REJECTED'
);

-- ============================================================================
-- 2. ADD COLUMNS TO PLOTS
-- ============================================================================

alter table public.plots
  add column if not exists inspection_status public.plot_inspection_status not null default 'NOT_INSPECTED',
  add column if not exists approval_status   public.plot_approval_status   not null default 'NOT_REVIEWED';

-- ============================================================================
-- 3. STATUS HISTORY TABLE
-- ============================================================================

create table if not exists public.plot_status_history (
  id              uuid primary key default gen_random_uuid(),
  plot_id         uuid not null references public.plots(id) on delete cascade,
  changed_by      uuid references public.profiles(id) on delete set null,
  field           text not null check (field in ('inspection_status', 'approval_status')),
  old_value       text,
  new_value       text not null,
  reason          text,
  created_at      timestamptz not null default now()
);

create index if not exists idx_status_history_plot on public.plot_status_history(plot_id);

-- Enable RLS
alter table public.plot_status_history enable row level security;

-- Anyone authenticated can read status history
create policy "status_history_select_auth"
  on public.plot_status_history for select to authenticated
  using (true);

-- Authenticated users can insert (server API enforces who)
create policy "status_history_insert_auth"
  on public.plot_status_history for insert to authenticated
  with check (true);

-- ============================================================================
-- 4. UPDATE MOCK DATA — set initial statuses based on existing plot_status
-- ============================================================================

-- Plots that were APPROVED → approval_status = APPROVED
update public.plots
  set approval_status = 'APPROVED'
  where status = 'APPROVED';

-- Plots that were PENDING → approval_status = PENDING
update public.plots
  set approval_status = 'PENDING'
  where status = 'PENDING';

-- Plots that were UNDER_CONSTRUCTION or COMPLETED → inspection_status = INSPECTED
update public.plots
  set inspection_status = 'INSPECTED'
  where status in ('UNDER_CONSTRUCTION', 'COMPLETED');

-- Plots that were INSPECTION_REQUIRED → inspection_status = AWAITING_REVIEW
update public.plots
  set inspection_status = 'AWAITING_REVIEW'
  where status = 'INSPECTION_REQUIRED';

-- Plots that were REVIEW_REQUIRED → approval_status = PENDING, inspection_status = INSPECTED
update public.plots
  set inspection_status = 'INSPECTED', approval_status = 'PENDING'
  where status = 'REVIEW_REQUIRED';

-- ============================================================================
-- Done.
-- ============================================================================
