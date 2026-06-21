-- ============================================================================
-- 0008_announcements.sql
-- announcements + announcement_reads (read-tracking for unread badges).
-- ============================================================================

create table announcements (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  property_id uuid references properties(id), -- null = company-wide
  title text not null,
  body text not null,
  category text not null default 'general'
    check (category in ('news', 'maintenance_notice', 'water_shutdown', 'general')),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_by uuid not null references user_profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (expires_at is null or expires_at > published_at)
);

create trigger trg_announcements_updated_at
  before update on announcements
  for each row execute function touch_updated_at();

create index idx_announcements_company on announcements(company_id, published_at desc);
create index idx_announcements_property on announcements(property_id);

create table announcement_reads (
  announcement_id uuid not null references announcements(id) on delete cascade,
  tenant_id uuid not null references tenant_profiles(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, tenant_id)
);

alter table announcements enable row level security;
alter table announcement_reads enable row level security;
