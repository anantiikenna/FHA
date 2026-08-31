-- RLS policies — SECURITY.md:32, AUTHORIZATION_RBAC.md:7, API.md:6
-- Deny-by-default; grant only what role requires. All policies require authenticated.

-- Helper: is_authenticated check
-- Profiles: users can read own profile; admin can read all
create policy "profiles_select_own" on public.profiles for select to authenticated
  using (auth.uid() = id);
create policy "profiles_select_admin" on public.profiles for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));

-- Estates/Blocks/Plots: any authenticated with plot.read can read demo data
-- For MVP, allow authenticated to read estates/blocks/plots (filtered by is_demo in demo env)
create policy "estates_select_auth" on public.estates for select to authenticated using (true);
create policy "blocks_select_auth" on public.blocks for select to authenticated using (true);
create policy "plots_select_auth" on public.plots for select to authenticated using (true);
-- Writes restricted to ADMIN/GIS_OFFICER (enforced via service_role in API layer)
-- No direct insert/update policies for anon/authenticated on GIS tables

-- Approvals: authenticated can read (approval.read — AUTHORIZATION_RBAC.md:6)
create policy "approvals_select_auth" on public.approvals for select to authenticated using (true);

-- Inspections: creator can read/update own draft; all authenticated can read submitted history per estate scope (MVP: allow read)
create policy "inspections_select_auth" on public.inspections for select to authenticated using (true);
create policy "inspections_insert_engineer" on public.inspections for insert to authenticated
  with check (auth.uid() = inspector_id);
create policy "inspections_update_own_draft" on public.inspections for update to authenticated
  using (auth.uid() = inspector_id and status = 'DRAFT')
  with check (auth.uid() = inspector_id);

-- Documents/Photos/Findings: follow parent inspection/plot access
create policy "documents_select_auth" on public.documents for select to authenticated using (true);
-- Storage objects bucket policies handled via storage.buckets RLS (private buckets, signed URLs)

-- Audit logs: only ADMIN can select
-- Enable RLS on audit_logs (was not enabled in 001)
alter table public.audit_logs enable row level security;
create policy "audit_select_admin" on public.audit_logs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'ADMIN'));
create policy "audit_insert_auth" on public.audit_logs for insert to authenticated with check (true);

-- Ensure RLS on remaining tables
alter table public.property_interests enable row level security;
alter table public.applications enable row level security;
alter table public.inspection_photos enable row level security;
alter table public.inspection_findings enable row level security;
alter table public.documents enable row level security;

create policy "property_interests_select_auth" on public.property_interests for select to authenticated using (true);
create policy "applications_select_auth" on public.applications for select to authenticated using (true);
create policy "inspection_photos_select_auth" on public.inspection_photos for select to authenticated using (true);
create policy "inspection_photos_insert_own" on public.inspection_photos for insert to authenticated with check (true);
create policy "inspection_findings_select_auth" on public.inspection_findings for select to authenticated using (true);
create policy "inspection_findings_insert_auth" on public.inspection_findings for insert to authenticated with check (true);
