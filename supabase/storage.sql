-- ============================================================================
-- FHA MVP — Storage Buckets & Policies
-- Run AFTER Schema.sql. Creates private buckets for photos and documents.
-- ============================================================================

-- ============================================================================
-- BUCKETS
-- ============================================================================

-- Private bucket for inspection photos
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'inspection-photos',
  'inspection-photos',
  false,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png']
) on conflict (id) do nothing;

-- Private bucket for approval/allocation documents
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'property-documents',
  'property-documents',
  false,
  52428800,  -- 50MB
  array['application/pdf', 'image/jpeg', 'image/png']
) on conflict (id) do nothing;

-- ============================================================================
-- STORAGE RLS POLICIES
-- ============================================================================

drop policy if exists "inspection_photos_select" on storage.objects;
drop policy if exists "inspection_photos_insert" on storage.objects;
drop policy if exists "inspection_photos_delete" on storage.objects;
drop policy if exists "property_documents_select" on storage.objects;
drop policy if exists "property_documents_insert" on storage.objects;

-- Inspection photos: inspector of parent inspection OR privileged review roles
create policy "inspection_photos_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'inspection-photos'
    and (
      exists (
        select 1 from public.profiles p
        where p.id = auth.uid()
          and p.is_active = true
          and p.role in ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
      )
      or exists (
        select 1 from public.inspections i
        where i.id = (string_to_array(name, '/'))[2]::uuid
          and i.inspector_id = auth.uid()
      )
    )
  );

-- Inspector of parent inspection may upload (path: inspections/{id}/file)
create policy "inspection_photos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspection-photos'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    )
    and exists (
      select 1 from public.inspections i
      where i.id = (string_to_array(name, '/'))[2]::uuid
        and i.inspector_id = auth.uid()
        and i.status in ('DRAFT','SUBMITTED','UNDER_REVIEW')
    )
  );

-- Delete only while inspection is still DRAFT and user is inspector
create policy "inspection_photos_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'inspection-photos'
    and exists (
      select 1 from public.inspections i
      where i.id = (string_to_array(name, '/'))[2]::uuid
        and i.inspector_id = auth.uid()
        and i.status = 'DRAFT'
    )
  );

-- Property documents: any active staff may read (workflow: View Documents)
create policy "property_documents_select"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'property-documents'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid() and p.is_active = true
    )
  );

-- Upload restricted to approval/admin roles (never open to all authenticated)
create policy "property_documents_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'property-documents'
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.is_active = true
        and p.role in ('ADMIN','SUPERVISOR','APPROVAL_OFFICER')
    )
  );

-- ============================================================================
-- END OF STORAGE
-- ============================================================================
