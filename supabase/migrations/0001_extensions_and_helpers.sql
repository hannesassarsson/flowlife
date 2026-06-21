-- ============================================================================
-- 0001_extensions_and_helpers.sql
-- Extensions + helper functions used by RLS policies throughout the schema.
-- ============================================================================

create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "pg_trgm";    -- future: fuzzy search on names/addresses

-- ----------------------------------------------------------------------------
-- is_super_admin()
-- Checked first in every policy so platform admins bypass company scoping
-- without being modeled as a fake membership row.
-- ----------------------------------------------------------------------------
create or replace function is_super_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select coalesce(
    (select is_super_admin from user_profiles where id = auth.uid()),
    false
  );
$$;

-- ----------------------------------------------------------------------------
-- user_company_ids()
-- All company_ids the current user is staff in (owner/PM/maintenance/contractor).
-- Subquery-based (not JWT-claim-based) so role/company changes apply instantly,
-- with no dependency on token refresh.
-- ----------------------------------------------------------------------------
create or replace function user_company_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select company_id
  from company_memberships
  where user_id = auth.uid()
    and status = 'active';
$$;

-- ----------------------------------------------------------------------------
-- user_role_in_company(check_company_id uuid)
-- Returns the caller's role string in a given company, or null if not a member.
-- ----------------------------------------------------------------------------
create or replace function user_role_in_company(check_company_id uuid)
returns text
language sql
security definer
stable
set search_path = public
as $$
  select role
  from company_memberships
  where user_id = auth.uid()
    and company_id = check_company_id
    and status = 'active'
  limit 1;
$$;

-- ----------------------------------------------------------------------------
-- is_company_staff(check_company_id uuid)
-- True if caller is an active staff member (any role) of the company.
-- ----------------------------------------------------------------------------
create or replace function is_company_staff(check_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from company_memberships
    where user_id = auth.uid()
      and company_id = check_company_id
      and status = 'active'
  );
$$;

-- ----------------------------------------------------------------------------
-- is_company_manager(check_company_id uuid)
-- True if caller is owner or property_manager in the company — the roles
-- permitted to manage properties, leases, and assign maintenance.
-- ----------------------------------------------------------------------------
create or replace function is_company_manager(check_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from company_memberships
    where user_id = auth.uid()
      and company_id = check_company_id
      and status = 'active'
      and role in ('owner', 'property_manager')
  );
$$;

-- ----------------------------------------------------------------------------
-- is_tenant_of_company(check_company_id uuid)
-- True if caller has a tenant_profiles row in this company.
-- ----------------------------------------------------------------------------
create or replace function is_tenant_of_company(check_company_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from tenant_profiles
    where id = auth.uid()
      and company_id = check_company_id
  );
$$;

-- ----------------------------------------------------------------------------
-- tenant_lease_ids()
-- All lease_ids the current user (as a tenant) is party to. Used to scope
-- maintenance_requests, documents, message_threads to "your own lease only."
-- ----------------------------------------------------------------------------
create or replace function tenant_lease_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select lease_id
  from lease_tenants
  where tenant_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- tenant_unit_ids()
-- All unit_ids the current user (as a tenant) currently or previously leased.
-- ----------------------------------------------------------------------------
create or replace function tenant_unit_ids()
returns setof uuid
language sql
security definer
stable
set search_path = public
as $$
  select l.unit_id
  from leases l
  join lease_tenants lt on lt.lease_id = l.id
  where lt.tenant_id = auth.uid();
$$;

-- ----------------------------------------------------------------------------
-- can_view_maintenance_request(check_company_id, check_assigned_to)
-- Owner/PM see all requests in their company. maintenance_staff/contractor
-- see only requests assigned to them. This is the DB-level enforcement of
-- the "assigned-only" rule from the permission matrix — not left to the
-- app layer, so a direct API/DB query can't bypass it.
-- ----------------------------------------------------------------------------
create or replace function can_view_maintenance_request(check_company_id uuid, check_assigned_to uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select case user_role_in_company(check_company_id)
    when 'owner' then true
    when 'property_manager' then true
    when 'maintenance_staff' then check_assigned_to = auth.uid()
    when 'contractor' then check_assigned_to = auth.uid()
    else false
  end;
$$;

-- ----------------------------------------------------------------------------
-- touch_updated_at()
-- Generic trigger function to keep updated_at current on every UPDATE.
-- ----------------------------------------------------------------------------
create or replace function touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
