-- ============================================================================
-- additional_test_fixtures.sql
-- Extra seed data NOT in the main seed.sql, needed for complete role-
-- isolation testing:
--   1. A contractor user + membership (seed.sql has no contractor)
--   2. A second, UNASSIGNED maintenance request (to test that maintenance
--      staff/contractors correctly see NOTHING for tickets not assigned
--      to them, vs. seeing their own assigned ticket)
--   3. A second company entirely (to test cross-tenant isolation — the
--      most important negative test, and one the main seed can't cover
--      with only one company)
--
-- Run this AFTER seed.sql, BEFORE test_rls_isolation.sql /
-- test_contractor_and_cross_tenant.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Contractor: auth user + user_profile + membership in nordic-homes
-- ----------------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values ('00000000-0000-0000-0000-000000000006', 'contractor@plumbingco.dev', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into user_profiles (id, full_name, email, is_super_admin)
values ('00000000-0000-0000-0000-000000000006', 'Johan Plumbing Co', 'contractor@plumbingco.dev', false)
on conflict (id) do nothing;

insert into company_memberships (user_id, company_id, role, status)
values ('00000000-0000-0000-0000-000000000006', '10000000-0000-0000-0000-000000000001', 'contractor', 'active')
on conflict (user_id, company_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. A second maintenance request on unit 102, UNASSIGNED — neither the
-- maintenance_staff nor the contractor should be able to see this one.
-- ----------------------------------------------------------------------------
insert into maintenance_requests (
  id, unit_id, created_by, created_by_type,
  title, description, category, priority, status, assigned_to
)
values (
  '60000000-0000-0000-0000-000000000002',
  '40000000-0000-0000-0000-000000000002', -- unit 102 (vacant, no tenant)
  '00000000-0000-0000-0000-000000000002', -- created by owner (e.g. routine inspection note)
  'staff',
  'Pre-move-in inspection needed',
  'Unit 102 needs a full inspection before the next tenant moves in.',
  'other',
  'low',
  'new',
  null -- intentionally unassigned
)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. A second company, entirely separate, to test cross-tenant isolation.
-- This is the single most important negative test in the whole suite: does
-- ANY role from Company A ever see ANY row belonging to Company B?
-- ----------------------------------------------------------------------------
insert into companies (id, name, slug, status, plan_tier)
values ('10000000-0000-0000-0000-000000000002', 'Söder Properties AB', 'soder-properties', 'active', 'starter')
on conflict (id) do nothing;

insert into company_branding (company_id, primary_color, secondary_color, accent_color, portal_name, subdomain_slug, contact_email)
values ('10000000-0000-0000-0000-000000000002', '#2B2B2B', '#FAFAF7', '#8FA68E', 'Resident Portal', 'soder-properties', 'hello@soderproperties.dev')
on conflict (company_id) do nothing;

insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values ('00000000-0000-0000-0000-000000000007', 'owner@soderproperties.dev', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

insert into user_profiles (id, full_name, email, is_super_admin)
values ('00000000-0000-0000-0000-000000000007', 'Sara Holm', 'owner@soderproperties.dev', false)
on conflict (id) do nothing;

insert into company_memberships (user_id, company_id, role, status)
values ('00000000-0000-0000-0000-000000000007', '10000000-0000-0000-0000-000000000002', 'owner', 'active')
on conflict (user_id, company_id) do nothing;

insert into properties (id, company_id, name, address_line1, city, postal_code, country)
values ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002', 'Söder Loft', 'Götgatan 10', 'Stockholm', '11646', 'SE')
on conflict (id) do nothing;

insert into buildings (id, property_id, name, floors)
values ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'Main Building', 4)
on conflict (id) do nothing;

insert into units (id, building_id, unit_number, floor, size_sqm, rooms, rent_amount, rent_currency, status)
values ('40000000-0000-0000-0000-000000000003', '30000000-0000-0000-0000-000000000002', '201', 2, 38.0, 1, 9800, 'SEK', 'vacant')
on conflict (id) do nothing;
