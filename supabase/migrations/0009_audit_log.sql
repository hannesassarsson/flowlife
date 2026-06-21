-- ============================================================================
-- 0009_audit_log.sql
-- audit_logs — append-only. No update/delete granted to any role except
-- super admin (enforced in 0010_rls_policies.sql via `for update using (false)`
-- and no delete policy at all).
-- ============================================================================

create table audit_logs (
  id uuid primary key default gen_random_uuid(),
  company_id uuid, -- nullable: platform-level events (company creation, super admin actions)
  actor_id uuid not null,
  actor_type text not null check (actor_type in ('staff', 'tenant', 'super_admin', 'system')),
  action text not null,
  entity_type text,
  entity_id uuid,
  metadata jsonb not null default '{}',
  ip_address inet,
  created_at timestamptz not null default now()
);

create index idx_audit_company on audit_logs(company_id, created_at desc);
create index idx_audit_entity on audit_logs(entity_type, entity_id);
create index idx_audit_actor on audit_logs(actor_id, created_at desc);

alter table audit_logs enable row level security;
