-- ============================================================================
-- 0007_messaging.sql
-- message_threads, thread_participants, messages.
-- Realtime delivery happens via Supabase Realtime subscribing to the
-- `messages` table filtered by thread_id — no schema requirement beyond
-- enabling the publication (see bottom of file).
-- ============================================================================

create table message_threads (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references companies(id) on delete cascade,
  subject text,
  related_lease_id uuid references leases(id),
  is_archived boolean not null default false,
  created_at timestamptz not null default now(),
  last_message_at timestamptz not null default now()
);

create index idx_threads_company on message_threads(company_id);
create index idx_threads_lease on message_threads(related_lease_id);

create table thread_participants (
  thread_id uuid not null references message_threads(id) on delete cascade,
  participant_id uuid not null,
  participant_type text not null check (participant_type in ('staff', 'tenant')),
  primary key (thread_id, participant_id)
);

create index idx_thread_participants_participant on thread_participants(participant_id);

create table messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references message_threads(id) on delete cascade,
  company_id uuid not null references companies(id) on delete cascade,
  sender_id uuid not null,
  sender_type text not null check (sender_type in ('staff', 'tenant')),
  body text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index idx_messages_thread on messages(thread_id, created_at);

create or replace function sync_message_company_id()
returns trigger
language plpgsql
as $$
begin
  select company_id into new.company_id
  from message_threads where id = new.thread_id;
  return new;
end;
$$;

create trigger trg_sync_message_company_id
  before insert on messages
  for each row execute function sync_message_company_id();

-- ----------------------------------------------------------------------------
-- Keep message_threads.last_message_at current for inbox sorting, and so the
-- UI never has to compute max(messages.created_at) per thread on every load.
-- ----------------------------------------------------------------------------
create or replace function touch_thread_last_message_at()
returns trigger
language plpgsql
as $$
begin
  update message_threads set last_message_at = new.created_at where id = new.thread_id;
  return new;
end;
$$;

create trigger trg_touch_thread_last_message_at
  after insert on messages
  for each row execute function touch_thread_last_message_at();

-- ----------------------------------------------------------------------------
-- is_thread_participant(check_thread_id uuid)
-- True if the current caller (staff or tenant) is listed as a participant.
-- ----------------------------------------------------------------------------
create or replace function is_thread_participant(check_thread_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from thread_participants
    where thread_id = check_thread_id
      and participant_id = auth.uid()
  );
$$;

alter table message_threads enable row level security;
alter table thread_participants enable row level security;
alter table messages enable row level security;

-- Enable Realtime on messages so thread views can subscribe to new rows.
alter publication supabase_realtime add table messages;
