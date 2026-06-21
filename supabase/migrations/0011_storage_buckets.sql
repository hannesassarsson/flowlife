-- ============================================================================
-- 0011_storage_buckets.sql
-- Supabase Storage buckets + RLS policies on storage.objects.
--
-- Path convention (enforced by policy, not just convention):
--   documents/{company_id}/{related_entity_type}/{related_entity_id}/{filename}
--   maintenance-attachments/{company_id}/{request_id}/{filename}
--   branding/{company_id}/{filename}                (public bucket)
--   avatars/{user_id}/{filename}                     (public bucket)
--
-- storage.objects has a `name` column holding the full path. We use the
-- storage_path_segment() helper (defined below) to extract '/'-delimited
-- segments and check them against the caller's company membership.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- storage_path_segment(path, n)
-- Returns the nth '/'-delimited segment of a storage object path. Used
-- throughout this file instead of repeating string_to_array(name, '/') 2-3
-- times per policy — same result, computed once per call, easier to read.
-- ----------------------------------------------------------------------------
create or replace function storage_path_segment(path text, n int)
returns text
language sql
immutable
as $$
  select (string_to_array(path, '/'))[n];
$$;

insert into storage.buckets (id, name, public)
values
  ('documents', 'documents', false),
  ('maintenance-attachments', 'maintenance-attachments', false),
  ('branding', 'branding', true),
  ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- documents bucket: path = {company_id}/{related_entity_type}/{related_entity_id}/{filename}
-- Readable by company staff, or by tenants per the same rule as the
-- documents table (visible_to_tenant + owns the entity). Writable by managers.
-- ----------------------------------------------------------------------------
create policy "storage_documents_select"
on storage.objects for select
using (
  bucket_id = 'documents'
  and (
    is_super_admin()
    or is_company_staff(storage_path_segment(name, 1)::uuid)
    or exists (
      select 1 from documents d
      where d.company_id = storage_path_segment(name, 1)::uuid
        and d.related_entity_type = storage_path_segment(name, 2)
        and d.related_entity_id = storage_path_segment(name, 3)::uuid
        and is_tenant_of_company(d.company_id)
        and tenant_can_view_document(d.related_entity_type, d.related_entity_id, d.visible_to_tenant)
    )
  )
);

create policy "storage_documents_insert"
on storage.objects for insert
with check (
  bucket_id = 'documents'
  and (
    is_super_admin()
    or is_company_manager(storage_path_segment(name, 1)::uuid)
  )
);

create policy "storage_documents_delete"
on storage.objects for delete
using (
  bucket_id = 'documents'
  and (
    is_super_admin()
    or is_company_manager(storage_path_segment(name, 1)::uuid)
  )
);

-- ----------------------------------------------------------------------------
-- maintenance-attachments bucket: path = {company_id}/{request_id}/{filename}
-- Readable/writable by anyone who can already see that maintenance request
-- (reuses can_view_maintenance_request + tenant_unit_ids via a join).
-- ----------------------------------------------------------------------------
create policy "storage_maint_attachments_select"
on storage.objects for select
using (
  bucket_id = 'maintenance-attachments'
  and (
    is_super_admin()
    or exists (
      select 1 from maintenance_requests mr
      where mr.id = storage_path_segment(name, 2)::uuid
        and mr.company_id = storage_path_segment(name, 1)::uuid
        and (
          can_view_maintenance_request(mr.company_id, mr.assigned_to)
          or mr.unit_id in (select tenant_unit_ids())
        )
    )
  )
);

create policy "storage_maint_attachments_insert"
on storage.objects for insert
with check (
  bucket_id = 'maintenance-attachments'
  and (
    is_super_admin()
    or exists (
      select 1 from maintenance_requests mr
      where mr.id = storage_path_segment(name, 2)::uuid
        and mr.company_id = storage_path_segment(name, 1)::uuid
        and (
          is_company_staff(mr.company_id)
          or mr.unit_id in (select tenant_unit_ids())
        )
    )
  )
);

-- ----------------------------------------------------------------------------
-- branding bucket: path = {company_id}/{filename}. Public read (needed for
-- logos/favicons to render on the public portal pre-login); owner-only write.
-- ----------------------------------------------------------------------------
create policy "storage_branding_select_public"
on storage.objects for select
using (bucket_id = 'branding');

create policy "storage_branding_insert_owner"
on storage.objects for insert
with check (
  bucket_id = 'branding'
  and (
    is_super_admin()
    or user_role_in_company(storage_path_segment(name, 1)::uuid) = 'owner'
  )
);

create policy "storage_branding_delete_owner"
on storage.objects for delete
using (
  bucket_id = 'branding'
  and (
    is_super_admin()
    or user_role_in_company(storage_path_segment(name, 1)::uuid) = 'owner'
  )
);

-- ----------------------------------------------------------------------------
-- avatars bucket: path = {user_id}/{filename}. Public read; only the owning
-- user (staff or tenant — both share auth.uid()) can write their own.
-- ----------------------------------------------------------------------------
create policy "storage_avatars_select_public"
on storage.objects for select
using (bucket_id = 'avatars');

create policy "storage_avatars_insert_own"
on storage.objects for insert
with check (
  bucket_id = 'avatars'
  and storage_path_segment(name, 1)::uuid = auth.uid()
);

create policy "storage_avatars_delete_own"
on storage.objects for delete
using (
  bucket_id = 'avatars'
  and storage_path_segment(name, 1)::uuid = auth.uid()
);
