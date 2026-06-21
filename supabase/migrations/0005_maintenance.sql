-- ============================================================================
-- 0005_maintenance.sql
-- maintenance_requests + comments + attachments + status history.
--
-- Note on author/creator columns: both staff (user_profiles) and tenants
-- (tenant_profiles) can create requests and comment on them. Rather than two
-- nullable FK columns with a CHECK(... XOR ...) guard, we use a plain uuid +
-- a `_type` discriminator. This trades a hard FK constraint for schema
-- simplicity — referential integrity for these columns is enforced at the
-- application layer. Flagged in the architecture doc as a deliberate
-- trade-off to revisit if strict FK enforcement becomes a priority.
-- ============================================================================

create table maintenance_requests (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  unit_id uuid not null references units(id) on delete cascade,
  lease_id uuid references leases(id),
  created_by uuid not null,
  created_by_type text not null check (created_by_type in ('staff', 'tenant')),
  title text not null,
  description text,
  category text
    check (category in ('plumbing', 'electrical', 'appliance', 'hvac', 'structural', 'pest', 'other')),
  priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'new'
    check (status in ('new', 'in_progress', 'waiting', 'completed', 'closed')),
  assigned_to uuid references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger trg_maintenance_requests_updated_at
  before update on maintenance_requests
  for each row execute function touch_updated_at();

create index idx_maintenance_company on maintenance_requests(company_id);
create index idx_maintenance_unit on maintenance_requests(unit_id);
create index idx_maintenance_status on maintenance_requests(company_id, status);
create index idx_maintenance_assigned on maintenance_requests(assigned_to);

create or replace function sync_maintenance_company_id()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id
  from units where id = new.unit_id;
  return new;
end;
$$;

create trigger trg_sync_maintenance_company_id
  before insert on maintenance_requests
  for each row execute function sync_maintenance_company_id();

-- ----------------------------------------------------------------------------
-- Auto-log status_history on any status change, so the audit trail can never
-- be skipped by a forgetful API route.
-- ----------------------------------------------------------------------------
create table maintenance_status_history (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references maintenance_requests(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid not null,
  changed_at timestamptz not null default now()
);

create index idx_status_history_request on maintenance_status_history(request_id);

create or replace function log_maintenance_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'INSERT') then
    insert into maintenance_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, null, new.status, new.created_by);
  elsif (tg_op = 'UPDATE' and new.status is distinct from old.status) then
    insert into maintenance_status_history (request_id, from_status, to_status, changed_by)
    values (new.id, old.status, new.status, coalesce(auth.uid(), new.created_by));
  end if;
  return new;
end;
$$;

create trigger trg_log_maintenance_status_change
  after insert or update on maintenance_requests
  for each row execute function log_maintenance_status_change();

create table maintenance_comments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references maintenance_requests(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  author_id uuid not null,
  author_type text not null check (author_type in ('staff', 'tenant')),
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_maint_comments_request on maintenance_comments(request_id, created_at);

create or replace function sync_maint_comment_company_id()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id
  from maintenance_requests where id = new.request_id;
  return new;
end;
$$;

create trigger trg_sync_maint_comment_company_id
  before insert on maintenance_comments
  for each row execute function sync_maint_comment_company_id();

create table maintenance_attachments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references maintenance_requests(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  file_url text not null,
  file_type text,
  uploaded_by uuid not null,
  created_at timestamptz not null default now()
);

create index idx_maint_attachments_request on maintenance_attachments(request_id);

create or replace function sync_maint_attachment_company_id()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id
  from maintenance_requests where id = new.request_id;
  return new;
end;
$$;

create trigger trg_sync_maint_attachment_company_id
  before insert on maintenance_attachments
  for each row execute function sync_maint_attachment_company_id();

alter table maintenance_requests enable row level security;
alter table maintenance_comments enable row level security;
alter table maintenance_attachments enable row level security;
alter table maintenance_status_history enable row level security;
