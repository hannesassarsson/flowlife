-- ============================================================================
-- test_rls_isolation.sql
--
-- Simulates each role hitting RLS policies WITHOUT needing 6 real
-- authenticated Supabase sessions, using the pattern from Supabase's own
-- testing docs (supabase/supabase apps/docs/.../testing/overview.mdx):
--
--   begin;
--   set local role authenticated;
--   set local request.jwt.claim.sub = '<user-uuid>';
--   -- ... run query as that user ...
--   rollback;  (or commit, if testing a write you want kept)
--
-- WHY `set local` INSIDE A TRANSACTION, NOT plain `set` / `set_config`:
-- `set local` is scoped to the current transaction and automatically
-- reverts at COMMIT/ROLLBACK. Plain `set` (or `set_config` with
-- is_local=false) persists for the rest of the session and can leak across
-- "tests" if you forget to reset every value — a real foot-gun when testing
-- RLS, since a leaked role/claim silently makes a later test pass or fail
-- for the wrong reason. Wrapping every test in begin/rollback is the safe,
-- repeatable pattern, and matches what Supabase's own test suite does.
--
-- auth.uid() resolves from request.jwt.claim.sub (checked first) or by
-- parsing request.jwt.claims as JSON (fallback) — setting the scalar claim
-- directly is simpler and is what Supabase's own test suite does.
--
-- RUN THIS AFTER migrations + seed.sql, against your LOCAL dev project:
--   psql "postgresql://postgres:postgres@localhost:54322/postgres" -f test_rls_isolation.sql
-- ============================================================================

\set ON_ERROR_STOP off
\pset format aligned
\pset border 2

-- Seed UUIDs (from seed.sql), referenced throughout:
-- super@platform.dev          = 00000000-0000-0000-0000-000000000001  (super admin)
-- owner@nordichomes.dev       = 00000000-0000-0000-0000-000000000002  (owner)
-- pm@nordichomes.dev          = 00000000-0000-0000-0000-000000000003  (property_manager)
-- maintenance@nordichomes.dev = 00000000-0000-0000-0000-000000000004  (maintenance_staff)
-- tenant@nordichomes.dev      = 00000000-0000-0000-0000-000000000005  (tenant)
-- company nordic-homes        = 10000000-0000-0000-0000-000000000001
-- maintenance request (assigned to maintenance@nordichomes.dev)
--                              = 60000000-0000-0000-0000-000000000001
--
-- NOTE: no contractor exists in seed.sql yet. Run
-- additional_test_fixtures.sql first if you want to test that role too.

\echo '============================================================'
\echo 'TEST 1: SUPER ADMIN should see ALL companies'
\echo 'Expected: 1+ row (nordic-homes), regardless of membership'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001';
select id, name, slug from companies;
rollback;

\echo '============================================================'
\echo 'TEST 2: OWNER should see their own company only'
\echo 'Expected: exactly 1 row (nordic-homes)'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select id, name, slug from companies;
rollback;

\echo '============================================================'
\echo 'TEST 3: OWNER can see all properties/units in their company'
\echo 'Expected: 1 property (Vasastan Residence), 2 units (101, 102)'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
select name from properties;
select unit_number, status from units order by unit_number;
rollback;

\echo '============================================================'
\echo 'TEST 4: PROPERTY MANAGER can see all maintenance requests'
\echo 'Expected: 1 row (Leaking kitchen faucet) — PM sees company-wide'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000003';
select title, status, assigned_to from maintenance_requests;
rollback;

\echo '============================================================'
\echo 'TEST 5: MAINTENANCE STAFF sees ONLY requests assigned to them'
\echo 'Expected: 1 row (assigned to maintenance@nordichomes.dev)'
\echo 'This is the critical test for can_view_maintenance_request() —'
\echo 'if this returns 0 rows OR more than the assigned ticket, the'
\echo 'role-scoping fix is broken.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select title, status, assigned_to from maintenance_requests;
rollback;

\echo '============================================================'
\echo 'TEST 6: TENANT sees ONLY their own unit, lease, and requests'
\echo 'Expected: 1 unit (101, NOT 102), 1 lease, 1 maintenance request'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
select unit_number from units;
select id, status from leases;
select title, status from maintenance_requests;
rollback;

\echo '============================================================'
\echo 'TEST 7: TENANT cannot see company_memberships (staff roster)'
\echo 'Expected: 0 rows — tenants have no membership row'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
select count(*) as should_be_zero from company_memberships;
rollback;

\echo '============================================================'
\echo 'TEST 8: TENANT cannot INSERT into properties (write isolation)'
\echo 'Expected: ERROR — new row violates row-level security policy'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
insert into properties (company_id, name, address_line1, city, postal_code)
values ('10000000-0000-0000-0000-000000000001', 'Hacked Property', 'x', 'x', 'x');
rollback;

\echo '============================================================'
\echo 'TEST 9: UNAUTHENTICATED (anon role) cannot read tenant_profiles'
\echo 'Expected: 0 rows'
\echo '============================================================'
begin;
set local role anon;
select count(*) as should_be_zero from tenant_profiles;
rollback;

\echo '============================================================'
\echo 'TEST 10: company_branding IS publicly readable by design'
\echo '(needed to render logo/colors pre-login). Confirm this is what'
\echo 'you actually want — it is intentionally not gated by auth.'
\echo 'Expected: 1 row, even as anon'
\echo '============================================================'
begin;
set local role anon;
select portal_name, primary_color from company_branding;
rollback;

\echo '============================================================'
\echo 'TEST 11: audit_logs cannot be updated by anyone (append-only)'
\echo 'Expected: UPDATE 0 (the "using (false)" policy silently matches'
\echo 'zero rows for UPDATE — it does not throw, it just affects'
\echo 'nothing. Confirm row count below is 0, not an error type.)'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
update audit_logs set action = 'tampered' where true;
rollback;

\echo '============================================================'
\echo 'TEST 12: MAINTENANCE STAFF can comment on their assigned ticket'
\echo 'Expected: INSERT 0 1 (succeeds)'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
insert into maintenance_comments (request_id, author_id, author_type, body)
values ('60000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'staff', 'On my way.');
rollback;

\echo '============================================================'
\echo 'DONE. Review each block above against its "Expected" comment.'
\echo 'For negative tests (8, 9), psql with ON_ERROR_STOP off will'
\echo 'print the error and continue rather than halting the script.'
\echo '============================================================'
