-- ============================================================================
-- seed.sql
-- Local dev seed data only. Run via `supabase db reset` (applies migrations
-- then this file) or `psql -f seed.sql` against a local instance.
--
-- IMPORTANT: this creates auth.users rows directly, which only works against
-- a local Supabase instance with the service role — never run this against
-- a hosted/production project.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Auth users (super admin, one owner, one PM, one maintenance staff, one
-- tenant). Password for all demo accounts: "password123" (local dev only).
-- ----------------------------------------------------------------------------
insert into auth.users (id, email, encrypted_password, email_confirmed_at, created_at, updated_at, raw_app_meta_data, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-000000000001', 'super@platform.dev', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000002', 'owner@nordichomes.dev', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000003', 'pm@nordichomes.dev', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000004', 'maintenance@nordichomes.dev', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-000000000005', 'tenant@nordichomes.dev', crypt('password123', gen_salt('bf')), now(), now(), now(), '{"provider":"email","providers":["email"]}', '{}', 'authenticated', 'authenticated')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Staff profiles
-- ----------------------------------------------------------------------------
insert into user_profiles (id, full_name, email, is_super_admin)
values
  ('00000000-0000-0000-0000-000000000001', 'Platform Admin', 'super@platform.dev', true),
  ('00000000-0000-0000-0000-000000000002', 'Astrid Lindqvist', 'owner@nordichomes.dev', false),
  ('00000000-0000-0000-0000-000000000003', 'Erik Johansson', 'pm@nordichomes.dev', false),
  ('00000000-0000-0000-0000-000000000004', 'Maja Bergström', 'maintenance@nordichomes.dev', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Demo company + branding
-- ----------------------------------------------------------------------------
insert into companies (id, name, slug, status, plan_tier)
values ('10000000-0000-0000-0000-000000000001', 'Nordic Homes AB', 'nordic-homes', 'active', 'growth')
on conflict (id) do nothing;

insert into company_branding (
  company_id, logo_url, primary_color, secondary_color, accent_color,
  portal_name, welcome_message, subdomain_slug, contact_email
)
values (
  '10000000-0000-0000-0000-000000000001',
  null,
  '#1A1A1A', '#F5F5F0', '#D4A574',
  'My Home',
  'Welcome home. Find everything you need, right here.',
  'nordic-homes',
  'hello@nordichomes.dev'
)
on conflict (company_id) do nothing;

-- ----------------------------------------------------------------------------
-- Memberships
-- ----------------------------------------------------------------------------
insert into company_memberships (user_id, company_id, role, status)
values
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('00000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000001', 'property_manager', 'active'),
  ('00000000-0000-0000-0000-000000000004', '10000000-0000-0000-0000-000000000001', 'maintenance_staff', 'active')
on conflict (user_id, company_id) do nothing;

-- ----------------------------------------------------------------------------
-- Tenant profile
-- ----------------------------------------------------------------------------
insert into tenant_profiles (id, company_id, full_name, email, status)
values ('00000000-0000-0000-0000-000000000005', '10000000-0000-0000-0000-000000000001', 'Lina Karlsson', 'tenant@nordichomes.dev', 'active')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Property -> Building -> Units
-- ----------------------------------------------------------------------------
insert into properties (id, company_id, name, address_line1, city, postal_code, country)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'Vasastan Residence', 'Sveavägen 42', 'Stockholm', '11334', 'SE')
on conflict (id) do nothing;

insert into buildings (id, property_id, name, floors)
values ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'Building A', 6)
on conflict (id) do nothing;

insert into units (id, building_id, unit_number, floor, size_sqm, rooms, rent_amount, rent_currency, status)
values
  ('40000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001', '101', 1, 45.5, 2, 11500, 'SEK', 'occupied'),
  ('40000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000001', '102', 1, 62.0, 3, 14200, 'SEK', 'vacant')
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- Lease + lease_tenants (this also flips unit 101 to 'occupied' via trigger,
-- but it's already seeded as occupied above for clarity if you query before
-- the trigger fires in a partial reset)
-- ----------------------------------------------------------------------------
insert into leases (id, unit_id, start_date, end_date, rent_amount, rent_currency, status)
values ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '2025-09-01', null, 11500, 'SEK', 'active')
on conflict (id) do nothing;

insert into lease_tenants (lease_id, tenant_id, is_primary)
values ('50000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', true)
on conflict (lease_id, tenant_id) do nothing;

-- ----------------------------------------------------------------------------
-- A sample maintenance request, assigned to the maintenance staff member
-- ----------------------------------------------------------------------------
insert into maintenance_requests (
  id, unit_id, lease_id, created_by, created_by_type,
  title, description, category, priority, status, assigned_to
)
values (
  '60000000-0000-0000-0000-000000000001',
  '40000000-0000-0000-0000-000000000001',
  '50000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000005',
  'tenant',
  'Leaking kitchen faucet',
  'The kitchen faucet has been dripping constantly for the past two days.',
  'plumbing',
  'normal',
  'in_progress',
  '00000000-0000-0000-0000-000000000004'
)
on conflict (id) do nothing;

insert into maintenance_comments (request_id, author_id, author_type, body)
values (
  '60000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000004',
  'staff',
  'Picked this up — will stop by tomorrow morning between 9-11am to take a look.'
);

-- ----------------------------------------------------------------------------
-- A welcome announcement
-- ----------------------------------------------------------------------------
insert into announcements (company_id, title, body, category, created_by)
values (
  '10000000-0000-0000-0000-000000000001',
  'Welcome to your new tenant portal',
  'We''ve launched a brand new way to manage your home with us — submit maintenance requests, message your property manager, and find your documents all in one place.',
  'general',
  '00000000-0000-0000-0000-000000000002'
);
