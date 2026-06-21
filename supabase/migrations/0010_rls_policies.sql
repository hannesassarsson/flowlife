-- ============================================================================
-- 0010_rls_policies.sql
-- All RLS policies, kept in one file separate from table creation so the
-- security model can be reviewed and iterated on independently of schema.
--
-- Conventions used throughout:
--   - is_super_admin() always bypasses, checked first via OR.
--   - Staff policies check is_company_staff() / is_company_manager().
--   - Tenant policies check is_tenant_of_company() AND a row-level ownership
--     condition (their own lease/unit), never company-wide access.
--   - INSERT policies use `with check`, SELECT/UPDATE/DELETE use `using`.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_profiles
-- Staff can see other staff within companies they share; everyone can see
-- (and update) their own row.
-- ----------------------------------------------------------------------------
create policy "user_profiles_select_self_or_shared_company"
on user_profiles for select
using (
  is_super_admin()
  or id = auth.uid()
  or id in (
    select cm.user_id from company_memberships cm
    where cm.company_id in (select user_company_ids())
  )
);

create policy "user_profiles_update_self"
on user_profiles for update
using (id = auth.uid() or is_super_admin())
with check (id = auth.uid() or is_super_admin());

create policy "user_profiles_insert_self"
on user_profiles for insert
with check (id = auth.uid());

-- ----------------------------------------------------------------------------
-- companies
-- Staff can see companies they belong to. Tenants can see their own company
-- (needed to render branding). Super admin sees all.
-- ----------------------------------------------------------------------------
create policy "companies_select_member_or_tenant"
on companies for select
using (
  is_super_admin()
  or id in (select user_company_ids())
  or id in (select company_id from tenant_profiles where id = auth.uid())
);

create policy "companies_insert_super_admin_only"
on companies for insert
with check (is_super_admin());

create policy "companies_update_owner_or_super_admin"
on companies for update
using (is_super_admin() or is_company_manager(id) and user_role_in_company(id) = 'owner')
with check (is_super_admin() or user_role_in_company(id) = 'owner');

-- ----------------------------------------------------------------------------
-- company_branding
-- Branding is publicly readable (needed to render the marketing/portal page
-- before login resolves a subdomain), but only the owner can write it.
-- ----------------------------------------------------------------------------
create policy "company_branding_select_anyone"
on company_branding for select
using (true);

create policy "company_branding_update_owner"
on company_branding for update
using (is_super_admin() or user_role_in_company(company_id) = 'owner')
with check (is_super_admin() or user_role_in_company(company_id) = 'owner');

create policy "company_branding_insert_owner"
on company_branding for insert
with check (is_super_admin() or user_role_in_company(company_id) = 'owner');

-- ----------------------------------------------------------------------------
-- company_memberships
-- Staff can see fellow members of their own companies. Only owners can
-- invite/modify/remove staff.
-- ----------------------------------------------------------------------------
create policy "memberships_select_same_company"
on company_memberships for select
using (
  is_super_admin()
  or company_id in (select user_company_ids())
);

create policy "memberships_insert_owner_only"
on company_memberships for insert
with check (is_super_admin() or user_role_in_company(company_id) = 'owner');

create policy "memberships_update_owner_only"
on company_memberships for update
using (is_super_admin() or user_role_in_company(company_id) = 'owner')
with check (is_super_admin() or user_role_in_company(company_id) = 'owner');

create policy "memberships_delete_owner_only"
on company_memberships for delete
using (is_super_admin() or user_role_in_company(company_id) = 'owner');

-- ----------------------------------------------------------------------------
-- tenant_profiles
-- Staff of the company can see/manage tenants. A tenant can see their own
-- profile and update limited fields (handled at app layer for column-level
-- restriction; RLS only gates row access).
-- ----------------------------------------------------------------------------
create policy "tenant_profiles_select_staff_or_self"
on tenant_profiles for select
using (
  is_super_admin()
  or is_company_staff(company_id)
  or id = auth.uid()
);

create policy "tenant_profiles_insert_manager"
on tenant_profiles for insert
with check (is_super_admin() or is_company_manager(company_id));

create policy "tenant_profiles_update_manager_or_self"
on tenant_profiles for update
using (is_super_admin() or is_company_manager(company_id) or id = auth.uid())
with check (is_super_admin() or is_company_manager(company_id) or id = auth.uid());

-- ----------------------------------------------------------------------------
-- properties / buildings / units
-- Staff (any role) can view; only owner/PM can create/edit/delete.
-- Tenants can view only the property/building/unit tied to their own lease.
-- ----------------------------------------------------------------------------
create policy "properties_select_staff_or_own_unit"
on properties for select
using (
  is_super_admin()
  or is_company_staff(company_id)
  or id in (
    select b.property_id from buildings b
    where b.id in (select building_id from units where id in (select tenant_unit_ids()))
  )
);

create policy "properties_insert_manager"
on properties for insert
with check (is_super_admin() or is_company_manager(company_id));

create policy "properties_update_manager"
on properties for update
using (is_super_admin() or is_company_manager(company_id))
with check (is_super_admin() or is_company_manager(company_id));

create policy "properties_delete_manager"
on properties for delete
using (is_super_admin() or is_company_manager(company_id));

create policy "buildings_select_staff_or_own_unit"
on buildings for select
using (
  is_super_admin()
  or is_company_staff(company_id)
  or id in (select building_id from units where id in (select tenant_unit_ids()))
);

create policy "buildings_insert_manager"
on buildings for insert
with check (is_super_admin() or is_company_manager(company_id));

create policy "buildings_update_manager"
on buildings for update
using (is_super_admin() or is_company_manager(company_id))
with check (is_super_admin() or is_company_manager(company_id));

create policy "buildings_delete_manager"
on buildings for delete
using (is_super_admin() or is_company_manager(company_id));

create policy "units_select_staff_or_own"
on units for select
using (
  is_super_admin()
  or is_company_staff(company_id)
  or id in (select tenant_unit_ids())
);

create policy "units_insert_manager"
on units for insert
with check (is_super_admin() or is_company_manager(company_id));

create policy "units_update_manager"
on units for update
using (is_super_admin() or is_company_manager(company_id))
with check (is_super_admin() or is_company_manager(company_id));

create policy "units_delete_manager"
on units for delete
using (is_super_admin() or is_company_manager(company_id));

-- ----------------------------------------------------------------------------
-- leases / lease_tenants
-- Manager-only create/edit. Tenants see only their own leases.
-- ----------------------------------------------------------------------------
create policy "leases_select_manager_or_own"
on leases for select
using (
  is_super_admin()
  or is_company_manager(company_id)
  or id in (select tenant_lease_ids())
);

create policy "leases_insert_manager"
on leases for insert
with check (is_super_admin() or is_company_manager(company_id));

create policy "leases_update_manager"
on leases for update
using (is_super_admin() or is_company_manager(company_id))
with check (is_super_admin() or is_company_manager(company_id));

create policy "leases_delete_manager"
on leases for delete
using (is_super_admin() or is_company_manager(company_id));

create policy "lease_tenants_select_manager_or_self"
on lease_tenants for select
using (
  is_super_admin()
  or lease_id in (select id from leases where is_company_manager(company_id))
  or tenant_id = auth.uid()
);

create policy "lease_tenants_insert_manager"
on lease_tenants for insert
with check (
  is_super_admin()
  or lease_id in (select id from leases where is_company_manager(company_id))
);

create policy "lease_tenants_delete_manager"
on lease_tenants for delete
using (
  is_super_admin()
  or lease_id in (select id from leases where is_company_manager(company_id))
);

-- ----------------------------------------------------------------------------
-- maintenance_requests
-- Owner/PM see all requests in their company. maintenance_staff/contractor
-- see ONLY requests assigned to them — enforced at the database level via
-- can_view_maintenance_request(), not left to the app layer. Tenants see
-- only their own unit's requests.
-- ----------------------------------------------------------------------------
create policy "maintenance_select_role_scoped_or_own"
on maintenance_requests for select
using (
  is_super_admin()
  or can_view_maintenance_request(company_id, assigned_to)
  or unit_id in (select tenant_unit_ids())
);

create policy "maintenance_insert_staff_or_tenant"
on maintenance_requests for insert
with check (
  is_super_admin()
  or is_company_staff(company_id)
  or unit_id in (select tenant_unit_ids())
);

create policy "maintenance_update_manager_or_assigned"
on maintenance_requests for update
using (
  is_super_admin()
  or is_company_manager(company_id)
  or assigned_to = auth.uid()
)
with check (
  is_super_admin()
  or is_company_manager(company_id)
  or assigned_to = auth.uid()
);

create policy "maintenance_delete_manager"
on maintenance_requests for delete
using (is_super_admin() or is_company_manager(company_id));

create policy "maint_comments_select_role_scoped_or_own_request"
on maintenance_comments for select
using (
  is_super_admin()
  or request_id in (
    select id from maintenance_requests
    where can_view_maintenance_request(company_id, assigned_to)
       or unit_id in (select tenant_unit_ids())
  )
);

create policy "maint_comments_insert_role_scoped_or_own_request"
on maintenance_comments for insert
with check (
  is_super_admin()
  or request_id in (
    select id from maintenance_requests
    where can_view_maintenance_request(company_id, assigned_to)
       or unit_id in (select tenant_unit_ids())
  )
);

create policy "maint_attachments_select_role_scoped_or_own_request"
on maintenance_attachments for select
using (
  is_super_admin()
  or request_id in (
    select id from maintenance_requests
    where can_view_maintenance_request(company_id, assigned_to)
       or unit_id in (select tenant_unit_ids())
  )
);

create policy "maint_attachments_insert_role_scoped_or_own_request"
on maintenance_attachments for insert
with check (
  is_super_admin()
  or request_id in (
    select id from maintenance_requests
    where can_view_maintenance_request(company_id, assigned_to)
       or unit_id in (select tenant_unit_ids())
  )
);

create policy "maint_status_history_select_role_scoped_or_own_request"
on maintenance_status_history for select
using (
  is_super_admin()
  or request_id in (
    select id from maintenance_requests
    where can_view_maintenance_request(company_id, assigned_to)
       or unit_id in (select tenant_unit_ids())
  )
);
-- No insert/update/delete policy: rows are written only by the
-- log_maintenance_status_change() trigger (security definer), never directly.

-- ----------------------------------------------------------------------------
-- documents
-- Staff (manager-tier for writes, any staff for reads) full access. Tenants
-- see only documents flagged visible_to_tenant AND tied to their own
-- lease/unit, or company-wide visible docs.
-- ----------------------------------------------------------------------------
create policy "documents_select_staff_or_tenant_visible"
on documents for select
using (
  is_super_admin()
  or is_company_staff(company_id)
  or (
    is_tenant_of_company(company_id)
    and tenant_can_view_document(related_entity_type, related_entity_id, visible_to_tenant)
  )
);

create policy "documents_insert_manager"
on documents for insert
with check (is_super_admin() or is_company_manager(company_id));

create policy "documents_update_manager"
on documents for update
using (is_super_admin() or is_company_manager(company_id))
with check (is_super_admin() or is_company_manager(company_id));

create policy "documents_delete_manager"
on documents for delete
using (is_super_admin() or is_company_manager(company_id));

-- ----------------------------------------------------------------------------
-- message_threads / thread_participants / messages
-- Visible only to participants of the thread (plus owner/PM oversight).
-- ----------------------------------------------------------------------------
create policy "threads_select_participant_or_manager"
on message_threads for select
using (
  is_super_admin()
  or is_company_manager(company_id)
  or is_thread_participant(id)
);

create policy "threads_insert_staff_or_tenant"
on message_threads for insert
with check (
  is_super_admin()
  or is_company_staff(company_id)
  or is_tenant_of_company(company_id)
);

create policy "threads_update_participant_or_manager"
on message_threads for update
using (is_super_admin() or is_company_manager(company_id) or is_thread_participant(id))
with check (is_super_admin() or is_company_manager(company_id) or is_thread_participant(id));

create policy "thread_participants_select_own_thread"
on thread_participants for select
using (
  is_super_admin()
  or is_thread_participant(thread_id)
  or participant_id = auth.uid()
);

create policy "thread_participants_insert_self_or_staff"
on thread_participants for insert
with check (
  is_super_admin()
  or participant_id = auth.uid()
  or is_company_staff((select company_id from message_threads where id = thread_id))
);

create policy "messages_select_participant"
on messages for select
using (
  is_super_admin()
  or is_company_manager(company_id)
  or is_thread_participant(thread_id)
);

create policy "messages_insert_participant"
on messages for insert
with check (
  is_super_admin()
  or is_thread_participant(thread_id)
);

-- ----------------------------------------------------------------------------
-- announcements / announcement_reads
-- Readable by all staff and all tenants of the company (subject to
-- property scoping); writable only by managers.
-- ----------------------------------------------------------------------------
create policy "announcements_select_staff_or_tenant"
on announcements for select
using (
  is_super_admin()
  or is_company_staff(company_id)
  or (
    is_tenant_of_company(company_id)
    and (
      property_id is null
      or property_id in (
        select b.property_id from buildings b
        where b.id in (select building_id from units where id in (select tenant_unit_ids()))
      )
    )
  )
);

create policy "announcements_insert_manager"
on announcements for insert
with check (is_super_admin() or is_company_manager(company_id));

create policy "announcements_update_manager"
on announcements for update
using (is_super_admin() or is_company_manager(company_id))
with check (is_super_admin() or is_company_manager(company_id));

create policy "announcements_delete_manager"
on announcements for delete
using (is_super_admin() or is_company_manager(company_id));

create policy "announcement_reads_select_own"
on announcement_reads for select
using (is_super_admin() or tenant_id = auth.uid());

create policy "announcement_reads_insert_own"
on announcement_reads for insert
with check (tenant_id = auth.uid());

-- ----------------------------------------------------------------------------
-- audit_logs
-- Append-only. Super admin can read everything; company owners can read
-- their own company's logs. No update, no delete policy for anyone.
-- ----------------------------------------------------------------------------
create policy "audit_logs_select_super_admin_or_owner"
on audit_logs for select
using (
  is_super_admin()
  or (company_id is not null and user_role_in_company(company_id) = 'owner')
);

create policy "audit_logs_insert_anyone_authenticated"
on audit_logs for insert
with check (auth.uid() is not null or is_super_admin());

create policy "audit_logs_no_update"
on audit_logs for update
using (false);
-- Intentionally no delete policy at all — default-deny applies.
