# Database Validation Runbook

Run this against a **fresh local Supabase project**, not production. Steps
are in order — don't skip ahead, since later steps depend on earlier ones
having run cleanly.

---

## Prerequisites

```bash
# If you don't have the CLI yet:
npm install -g supabase

# In your project root (wherever supabase/migrations/ lives):
supabase init        # only if this isn't already a Supabase project
supabase start        # spins up local Postgres, Auth, Storage, Studio
```

`supabase start` prints a `DB URL` — that's your connection string for
every `psql` command below. It defaults to:

```
postgresql://postgres:postgres@127.0.0.1:54322/postgres
```

---

## Step 1: Run all migrations against a fresh project

```bash
supabase db reset
```

This drops and recreates the local database, applies every file in
`supabase/migrations/` in filename order, then runs `supabase/seed.sql`
(confirmed current CLI behavior: seed files live as a sibling to the
`migrations/` folder, not inside it — `supabase db reset` looks for
`supabase/seed.sql` specifically). The seed file in this delivery has
been placed there (`supabase/seed.sql`), not in `migrations/`, for exactly
this reason — if you'd put the whole `supabase/` folder under a different
root, double check `seed.sql` ended up as a sibling of `migrations/`, not
inside it.

**Pass criteria:** command exits 0, no `ERROR` lines in the output. If you
see an error, the line number + file tells you exactly where to fix
something — don't proceed to Step 2 until this is clean.

**Common failure modes to watch for:**
- `relation "X" does not exist` → a migration references a table before
  it's created. Should not happen with this set (verified by static
  dependency analysis), but if it does, it's almost certainly an edit made
  after the fact, not the original structure.
- `function "X" does not exist` → same idea, for a helper function.
- `duplicate key value violates unique constraint` during seed.sql → you
  ran seed.sql twice without a reset in between; just `supabase db reset`
  again.

---

## Step 2: Verify migration order

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\dt public.*"
```

**Pass criteria:** you should see all 19 tables: `user_profiles`,
`companies`, `company_branding`, `company_memberships`, `tenant_profiles`,
`properties`, `buildings`, `units`, `leases`, `lease_tenants`,
`maintenance_requests`, `maintenance_comments`, `maintenance_attachments`,
`maintenance_status_history`, `documents`, `message_threads`,
`thread_participants`, `messages`, `announcements`, `announcement_reads`,
`audit_logs` (21 total, listed without the `0001`-style prefix since
migrations don't create per-file schemas).

Also confirm function count looks right:

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\df public.*"
```

You should see ~17 functions: `is_super_admin`, `user_company_ids`,
`user_role_in_company`, `is_company_staff`, `is_company_manager`,
`is_tenant_of_company`, `tenant_lease_ids`, `tenant_unit_ids`,
`can_view_maintenance_request`, `touch_updated_at`, plus the
`sync_*_company_id` triggers' functions, `log_maintenance_status_change`,
`touch_thread_last_message_at`, `is_thread_participant`,
`resolve_document_company_id`, `sync_document_company_id`,
`tenant_can_view_document`, `storage_path_segment`.

---

## Step 3: Verify RLS policies

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select schemaname, tablename, policyname, cmd
from pg_policies
where schemaname = 'public'
order by tablename, cmd;
"
```

**Pass criteria:** every table from Step 2 should appear at least once
(most appear 3-5 times, once per command type). If a table is MISSING
entirely from this list, it has RLS enabled but zero policies — meaning
**everyone is locked out**, not locked in. That's the opposite failure
mode from what you want, but just as broken.

Also confirm RLS is actually *enabled* (not just policies existing with
RLS off, which would make them decorative):

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select relname, relrowsecurity
from pg_class
where relnamespace = 'public'::regnamespace
  and relkind = 'r'
order by relname;
"
```

**Pass criteria:** `relrowsecurity` is `t` (true) for every table.

---

## Step 4: Verify seed data

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "
select 'companies' as t, count(*) from companies
union all select 'user_profiles', count(*) from user_profiles
union all select 'tenant_profiles', count(*) from tenant_profiles
union all select 'company_memberships', count(*) from company_memberships
union all select 'properties', count(*) from properties
union all select 'units', count(*) from units
union all select 'leases', count(*) from leases
union all select 'maintenance_requests', count(*) from maintenance_requests
union all select 'maintenance_comments', count(*) from maintenance_comments
union all select 'announcements', count(*) from announcements;
"
```

**Pass criteria** (from `seed.sql` alone, before `additional_test_fixtures.sql`):

| Table | Expected count |
|---|---|
| companies | 1 |
| user_profiles | 4 |
| tenant_profiles | 1 |
| company_memberships | 3 |
| properties | 1 |
| units | 2 |
| leases | 1 |
| maintenance_requests | 1 |
| maintenance_comments | 1 |
| announcements | 1 |

This query is run as the `postgres` superuser role (bypasses RLS), so it
shows the TRUE row counts — useful to confirm seed data landed at all,
separate from whether RLS later hides some of it from a given role.

If any count is 0 when it shouldn't be, re-check `seed.sql` ran (Step 1)
and that you're querying the right database.

---

## Step 5: Test role isolation

```bash
cd validation/

# Load the contractor + second company + unassigned-ticket fixtures first —
# needed for the contractor and cross-tenant tests in step 5b.
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f additional_test_fixtures.sql

# Main role isolation suite (super admin, owner, PM, maintenance staff, tenant)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f test_rls_isolation.sql > rls_results.txt 2>&1

# Contractor + cross-tenant isolation (the two scenarios the main suite can't cover alone)
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f test_contractor_and_cross_tenant.sql > cross_tenant_results.txt 2>&1
```

Open `rls_results.txt` and `cross_tenant_results.txt` and check each test's
actual output against the `Expected:` comment printed right above it in
the script (every test prints its own expectation via `\echo` before
running, so the results file is self-documenting).

**The single highest-priority result in the whole validation pass:**
Tests C4, C5, C6 in `cross_tenant_results.txt`. If any role from one
company can see a row belonging to the other company, RLS isolation has a
real bug — stop everything else and fix it before looking at anything
else.

**The second-highest priority result:** Test 5 in `rls_results.txt` and
Tests C1–C3 in `cross_tenant_results.txt` — confirms the assigned-only
restriction for `maintenance_staff` / `contractor` actually holds at the
database level, not just in application code.

---

## Step 6: Verify storage access rules

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f test_storage_policies.sql > storage_results.txt 2>&1
```

This covers the access-control LOGIC (who can read/write which paths) via
direct `storage.objects` inserts under role impersonation — it does **not**
exercise actual file upload through the Storage API (multipart encoding,
signed URLs, bucket size limits). Run through the manual checklist printed
at the end of that script's output separately, ideally through the
Supabase client SDK or dashboard, before considering storage fully
validated.

---

## Step 7: Verify triggers behave correctly

```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f test_triggers.sql > trigger_results.txt 2>&1
```

Checks all 4 automatic-trigger behaviors: unit status sync on lease
change, maintenance status history auto-logging, thread `last_message_at`
touch, and — most importantly — that `documents.company_id` is **derived**
from the related entity and cannot be spoofed by a client-supplied value
(Test T9). T9 is the test to scrutinize most closely.

---

## After validation: how to read the results

For each `.txt` results file, go test-by-test and mark pass/fail. A simple
template:

```
[ ] TEST 1  — super admin sees all companies
[ ] TEST 2  — owner sees only their company
[ ] TEST 3  — owner sees their properties/units
[ ] TEST 4  — PM sees all company maintenance requests
[ ] TEST 5  — maintenance staff sees ONLY their assigned ticket  *** CRITICAL ***
[ ] TEST 6  — tenant sees only their own unit/lease/requests
[ ] TEST 7  — tenant cannot see company_memberships
[ ] TEST 8  — tenant cannot INSERT into properties
[ ] TEST 9  — anon cannot read tenant_profiles
[ ] TEST 10 — company_branding IS publicly readable (confirm intended)
[ ] TEST 11 — audit_logs cannot be updated
[ ] TEST 12 — maintenance staff can comment on their own assigned ticket

[ ] TEST C1 — contractor has nothing assigned yet (0 rows)
[ ] TEST C2 — maintenance staff still can't see the unassigned ticket
[ ] TEST C3 — contractor sees a ticket once it's assigned to them
[ ] TEST C4 — Company A owner cannot see Company B                *** CRITICAL ***
[ ] TEST C5 — Company B owner cannot see Company A                *** CRITICAL ***
[ ] TEST C6 — super admin sees BOTH companies                      *** CRITICAL ***

[ ] TEST S1 — owner can upload to documents bucket
[ ] TEST S2 — tenant cannot upload to documents bucket
[ ] TEST S3 — Company B owner cannot upload into Company A's path  *** CRITICAL ***
[ ] TEST S4 — maintenance staff can upload to their assigned ticket
[ ] TEST S5 — maintenance staff cannot upload to unassigned ticket
[ ] TEST S6 — anon can read branding bucket (confirm intended)
[ ] TEST S7 — user cannot upload avatar under someone else's path

[ ] TEST T1–T3 — unit status auto-syncs on lease insert/update
[ ] TEST T4–T6 — maintenance_status_history auto-logs correctly
[ ] TEST T7    — message_threads.last_message_at auto-touches
[ ] TEST T8    — company_id auto-populates on unit insert
[ ] TEST T9    — documents.company_id cannot be spoofed             *** CRITICAL ***
```

If everything marked `*** CRITICAL ***` passes and nothing else is glaringly
wrong, the database layer is validated and we move to the Next.js project
structure, typed Supabase client, middleware, multi-tenant routing,
white-label architecture, and query layer — still no UI or business logic
until you give the go-ahead.

If anything fails, share the relevant `.txt` output and I'll fix the
specific migration or policy.
