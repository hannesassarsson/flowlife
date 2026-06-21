-- ============================================================================
-- 0003_properties.sql
-- properties -> buildings -> units hierarchy.
-- company_id is denormalized onto buildings and units (not just inherited via
-- FK) so every RLS policy at any depth is a flat, indexable equality check.
-- ============================================================================

create table properties (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  address_line1 text not null,
  address_line2 text,
  city text not null,
  postal_code text not null,
  country text not null default 'SE',
  latitude numeric(9,6),
  longitude numeric(9,6),
  cover_image_url text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_properties_updated_at
  before update on properties
  for each row execute function touch_updated_at();

create index idx_properties_company on properties(company_id);

create table buildings (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references properties(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  name text not null,
  floors integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_buildings_updated_at
  before update on buildings
  for each row execute function touch_updated_at();

create index idx_buildings_property on buildings(property_id);
create index idx_buildings_company on buildings(company_id);

create table units (
  id uuid primary key default gen_random_uuid(),
  building_id uuid not null references buildings(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  unit_number text not null,
  floor integer,
  size_sqm numeric(6,2),
  rooms numeric(3,1),
  rent_amount numeric(10,2),
  rent_currency text not null default 'SEK',
  status text not null default 'vacant'
    check (status in ('vacant', 'occupied', 'maintenance', 'unavailable')),
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (building_id, unit_number)
);

create trigger trg_units_updated_at
  before update on units
  for each row execute function touch_updated_at();

create index idx_units_building on units(building_id);
create index idx_units_company on units(company_id);
create index idx_units_status on units(company_id, status);

-- ----------------------------------------------------------------------------
-- Trigger: keep buildings.company_id / units.company_id in sync with parent
-- on INSERT, so denormalization can never drift from a typo'd company_id.
-- ----------------------------------------------------------------------------
create or replace function sync_building_company_id()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id
  from properties where id = new.property_id;
  return new;
end;
$$;

create trigger trg_sync_building_company_id
  before insert on buildings
  for each row execute function sync_building_company_id();

create or replace function sync_unit_company_id()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id
  from buildings where id = new.building_id;
  return new;
end;
$$;

create trigger trg_sync_unit_company_id
  before insert on units
  for each row execute function sync_unit_company_id();

alter table properties enable row level security;
alter table buildings enable row level security;
alter table units enable row level security;
