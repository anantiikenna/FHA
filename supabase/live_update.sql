-- ============================================================================
-- FHA MVP — Live Update (safe to run on existing database)
-- Fixes Supabase linter warnings without conflicts.
-- Run this AFTER Schema.sql has already been applied.
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
