# Supabase Migrations — Property Management Platform

Phase 1 schema, RLS policies, and storage configuration. No application code —
this is the database layer only, per the architecture doc.

## Running locally

```bash
supabase init        # if not already a Supabase project
supabase start
supabase db reset     # applies all migrations in order, then seed.sql
```

Migration files are numbered and must run in order — `supabase db reset`
handles this automatically by filename sort. If you run them manually with
`psql`, preserve the numeric order.

## File order & purpose

| File | Contents |
|---|---|
| `0001_extensions_and_helpers.sql` | Extensions (`pgcrypto`, `pg_trgm`) + every RLS helper function (`is_super_admin`, `user_company_ids`, `is_company_manager`, `can_view_maintenance_request`, etc.) |
| `0002_platform_identity.sql` | `user_profiles`, `companies`, `company_branding`, `company_memberships`, `tenant_profiles` |
| `0003_properties.sql` | `properties` → `buildings` → `units`, with auto-sync triggers for denormalized `company_id` |
| `0004_leases.sql` | `leases`, `lease_tenants`, auto unit-status sync on lease start/end |
| `0005_maintenance.sql` | `maintenance_requests`, `maintenance_comments`, `maintenance_attachments`, `maintenance_status_history` (auto-logged via trigger) |
| `0006_documents.sql` | `documents`, with `company_id` derived from the related entity (never trusted from client input) |
| `0007_messaging.sql` | `message_threads`, `thread_participants`, `messages`, Realtime publication |
| `0008_announcements.sql` | `announcements`, `announcement_reads` |
| `0009_audit_log.sql` | `audit_logs` (append-only) |
| `0010_rls_policies.sql` | Every RLS policy, for every table, in one file |
| `0011_storage_buckets.sql` | Storage buckets + storage RLS, path-segment helper |
| `seed.sql` | Local dev seed data — **do not run against a hosted project** |

Functions in `0001` reference tables created in later files. This is valid
Postgres: function bodies aren't resolved against the catalog until the
function is actually invoked, so forward references across migration files
are safe and is the standard pattern for RLS helper functions.

## Why functions are split from table creation, and policies from both

- **Helpers (0001) before tables**: every later file's triggers/policies can
  call them immediately, and there's exactly one place to update a security
  rule (e.g. "what counts as a company manager") instead of N inline copies.
- **Policies (0010) in one file, after all tables**: the security model can
  be read, reviewed, and diffed independently of schema changes. If you're
  doing a security review, this is the only file you need to open.

## Key design decisions baked into this schema

1. **Shared DB + RLS, not schema-per-tenant.** Every tenant-scoped table
   carries `company_id`. Chosen for simplicity per Phase 1 scope — revisit
   if compliance requirements (e.g. data residency per customer) emerge.

2. **RLS policies use subqueries against `company_memberships` /
   `tenant_profiles`, not JWT claims.** A role change or company switch
   takes effect immediately, with no dependency on token refresh. Costs one
   extra join per query; worth it for correctness.

3. **`company_id` is denormalized onto every tenant-scoped table**, even
   ones reachable via a parent FK (e.g. `units.company_id` even though
   `units → buildings → properties → companies` would work). This keeps
   every RLS policy a flat, indexable equality check regardless of nesting
   depth. Drift is prevented by `before insert` triggers that derive the
   value from the parent — the client never supplies it directly.

4. **`maintenance_staff` and `contractor` roles see ONLY requests assigned
   to them, enforced in RLS via `can_view_maintenance_request()`** — not
   just hidden in the UI. A direct API or SQL query cannot bypass this.
   `owner` and `property_manager` see everything in their company.

5. **Documents' `company_id` is derived from the related entity**
   (`resolve_document_company_id()`), not accepted from the client. This
   closes a spoofing vector where a document could otherwise be tagged with
   a different company's ID than its actual target entity.

6. **Soft FK + type discriminator** (`author_id`/`author_type`,
   `created_by`/`created_by_type`, `sender_id`/`sender_type`) is used
   anywhere both staff (`user_profiles`) and tenants (`tenant_profiles`)
   can be the actor. This trades a hard FK constraint for schema
   simplicity — referential integrity on these columns is enforced at the
   application layer, not the database. Revisit if this becomes a problem
   in practice (e.g. via a unifying `actors` view with an enforced FK).

7. **Audit logs are append-only.** `for update using (false)` and no
   delete policy at all — default-deny. Insert is open to any authenticated
   actor since the app layer decides what's worth logging, not RLS.

8. **Automatic triggers replace app-layer "remember to also do X" logic**
   in four places: unit status sync on lease change, maintenance status
   history logging, thread `last_message_at` touch, and all `company_id`
   denormalization syncs. These exist so correctness doesn't depend on
   every future code path (including bulk imports, AI auto-triage, admin
   scripts) remembering to maintain invariants manually.

## Known trade-offs / things to revisit before Phase 2

- No hard FK on `documents.related_entity_id`, `maintenance_comments.author_id`,
  `messages.sender_id`, etc. (see #6 above).
- `custom_domain` / `custom_domain_verified` columns exist on
  `company_branding` but have no verification flow yet (Phase 2).
- `companies.plan_tier` exists as a Stripe-billing hook but no billing
  schema (invoices, payment_methods, subscriptions) is built yet.
- Storage bucket size limits, MIME-type restrictions, and signed-URL
  expiry policy are not configured here — set these in the Supabase
  dashboard or via the management API before go-live.
