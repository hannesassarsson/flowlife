-- ============================================================================
-- 0002_platform_identity.sql
-- user_profiles, companies, company_branding, company_memberships,
-- tenant_profiles. RLS is enabled but policies live in 0010_rls_policies.sql.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- user_profiles
-- One row per auth.users row, for STAFF-side identities (super admin, owner,
-- property manager, maintenance staff, contractor). Tenants are modeled
-- separately in tenant_profiles — see architecture notes.
-- ----------------------------------------------------------------------------
create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  is_super_admin boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_user_profiles_updated_at
  before update on user_profiles
  for each row execute function touch_updated_at();

comment on table user_profiles is
  'Staff-side identities only (super admin, owner, PM, maintenance, contractor). Tenants live in tenant_profiles.';

-- ----------------------------------------------------------------------------
-- companies
-- A landlord/property-management business — the tenant of this SaaS.
-- ----------------------------------------------------------------------------
create table companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  status text not null default 'active'
    check (status in ('active', 'suspended', 'trial')),
  plan_tier text not null default 'starter'
    check (plan_tier in ('starter', 'growth', 'enterprise')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_companies_updated_at
  before update on companies
  for each row execute function touch_updated_at();

create index idx_companies_slug on companies(slug);
create index idx_companies_status on companies(status);

-- ----------------------------------------------------------------------------
-- company_branding
-- White-label theme + portal identity. 1:1 with companies, split out so the
-- core company record stays lean as branding fields grow over time.
-- ----------------------------------------------------------------------------
create table company_branding (
  company_id uuid primary key references companies(id) on delete cascade,
  logo_url text,
  favicon_url text,
  primary_color text not null default '#1A1A1A',
  secondary_color text not null default '#F5F5F0',
  accent_color text not null default '#D4A574',
  portal_name text not null default 'Tenant Portal',
  welcome_message text,
  homepage_image_url text,
  subdomain_slug text not null unique,
  custom_domain text unique,
  custom_domain_verified boolean not null default false,
  contact_email text,
  contact_phone text,
  updated_at timestamptz not null default now()
);

create trigger trg_company_branding_updated_at
  before update on company_branding
  for each row execute function touch_updated_at();

create index idx_branding_subdomain on company_branding(subdomain_slug);
create index idx_branding_custom_domain on company_branding(custom_domain)
  where custom_domain is not null;

-- ----------------------------------------------------------------------------
-- company_memberships
-- Links a staff user_profile to a company with a role. A user can belong to
-- multiple companies (e.g. a contractor working for several landlords).
-- ----------------------------------------------------------------------------
create table company_memberships (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references user_profiles(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  role text not null
    check (role in ('owner', 'property_manager', 'maintenance_staff', 'contractor')),
  status text not null default 'active'
    check (status in ('active', 'invited', 'suspended')),
  invited_by uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  unique (user_id, company_id)
);

create index idx_memberships_company on company_memberships(company_id);
create index idx_memberships_user on company_memberships(user_id);
create index idx_memberships_role on company_memberships(company_id, role);

-- ----------------------------------------------------------------------------
-- tenant_profiles
-- Renter identities. Scoped to exactly one company (a tenant's portal access
-- belongs to one landlord at a time). Kept separate from user_profiles so
-- tenant permissions never inherit staff-shaped defaults.
-- ----------------------------------------------------------------------------
create table tenant_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  full_name text not null,
  email text not null,
  phone text,
  status text not null default 'active'
    check (status in ('active', 'former')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_tenant_profiles_updated_at
  before update on tenant_profiles
  for each row execute function touch_updated_at();

create index idx_tenant_profiles_company on tenant_profiles(company_id);
create index idx_tenant_profiles_email on tenant_profiles(email);

alter table user_profiles enable row level security;
alter table companies enable row level security;
alter table company_branding enable row level security;
alter table company_memberships enable row level security;
alter table tenant_profiles enable row level security;
