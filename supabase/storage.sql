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

-- Inspection photos: authenticated can read; inspector of parent inspection can upload
create policy "inspection_photos_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'inspection-photos');

create policy "inspection_photos_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'inspection-photos'
    and exists (
      select 1 from public.inspections i
      where i.id = (string_to_array(name, '/'))[2]::uuid
        and i.inspector_id = auth.uid()
    )
  );

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

-- Property documents: authenticated can read; admin/service_role manages
create policy "property_documents_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'property-documents');

create policy "property_documents_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'property-documents');

-- ============================================================================
-- END OF STORAGE
-- ============================================================================
