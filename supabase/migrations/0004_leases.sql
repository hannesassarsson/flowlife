-- ============================================================================
-- 0004_leases.sql
-- leases (unit + time period + rent terms) and lease_tenants (many-to-many
-- join supporting co-tenants and tenant lease history).
-- ============================================================================

create table leases (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  start_date date not null,
  end_date date,
  rent_amount numeric(10,2) not null,
  rent_currency text not null default 'SEK',
  deposit_amount numeric(10,2),
  status text not null default 'active'
    check (status in ('active', 'ended', 'terminated')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date)
);

create trigger trg_leases_updated_at
  before update on leases
  for each row execute function touch_updated_at();

create index idx_leases_unit on leases(unit_id);
create index idx_leases_company on leases(company_id);
create index idx_leases_status on leases(company_id, status);

create or replace function sync_lease_company_id()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id
  from units where id = new.unit_id;
  return new;
end;
$$;

create trigger trg_sync_lease_company_id
  before insert on leases
  for each row execute function sync_lease_company_id();

create table lease_tenants (
  id uuid primary key default gen_random_uuid(),
  lease_id uuid not null references leases(id) on delete cascade,
  tenant_id uuid not null references tenant_profiles(id) on delete cascade,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (lease_id, tenant_id)
);

create index idx_lease_tenants_lease on lease_tenants(lease_id);
create index idx_lease_tenants_tenant on lease_tenants(tenant_id);

-- ----------------------------------------------------------------------------
-- Keep units.status in sync when a lease starts/ends. A trigger here means
-- the API layer never has to remember to flip unit status manually.
-- ----------------------------------------------------------------------------
create or replace function sync_unit_status_on_lease_change()
returns trigger
language plpgsql
as $$
begin
  if (tg_op = 'INSERT' and new.status = 'active') then
    update units set status = 'occupied' where id = new.unit_id;
  elsif (tg_op = 'UPDATE' and new.status in ('ended', 'terminated')
         and old.status = 'active') then
    update units set status = 'vacant' where id = new.unit_id;
  end if;
  return new;
end;
$$;

create trigger trg_sync_unit_status_on_lease_change
  after insert or update on leases
  for each row execute function sync_unit_status_on_lease_change();

alter table leases enable row level security;
alter table lease_tenants enable row level security;
