-- ============================================================================
-- test_contractor_and_cross_tenant.sql
--
-- Run AFTER: migrations -> seed.sql -> additional_test_fixtures.sql
-- Covers the two scenarios the main test_rls_isolation.sql can't, because
-- seed.sql alone has no contractor and only one company:
--   - CONTRACTOR role isolation (assigned-only, same rule as maintenance_staff)
--   - CROSS-TENANT isolation (Company A staff/tenant vs Company B data)
-- ============================================================================

\set ON_ERROR_STOP off
\pset format aligned
\pset border 2

-- Fixture UUIDs (from additional_test_fixtures.sql):
-- contractor@plumbingco.dev     = 00000000-0000-0000-0000-000000000006
-- unassigned request (unit 102) = 60000000-0000-0000-0000-000000000002
-- owner@soderproperties.dev     = 00000000-0000-0000-0000-000000000007  (Company B)
-- Söder Properties AB           = 10000000-0000-0000-0000-000000000002 (Company B)
-- Söder Loft unit 201            = 40000000-0000-0000-0000-000000000003 (Company B)

\echo '============================================================'
\echo 'TEST C1: CONTRACTOR has no requests assigned to them yet'
\echo 'Expected: 0 rows (they exist as a company member but nothing'
\echo 'is assigned to them — confirms they do NOT fall back to seeing'
\echo 'everything when assigned_to is null for other tickets)'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000006';
select title, assigned_to from maintenance_requests;
rollback;

\echo '============================================================'
\echo 'TEST C2: MAINTENANCE STAFF cannot see the UNASSIGNED ticket'
\echo '(60000000-...-002) even though they CAN see their own assigned'
\echo 'one (60000000-...-001). Expected: still exactly 1 row, the'
\echo 'same one as TEST 5 in the main suite — NOT 2.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
select title, assigned_to from maintenance_requests;
rollback;

\echo '============================================================'
\echo 'TEST C3: Now assign the unassigned ticket to the contractor and'
\echo 'confirm THEY can see it (and the maintenance_staff member still'
\echo "cannot, since it's not assigned to them)."
\echo 'Expected: contractor sees 1 row (the newly assigned ticket)'
\echo '============================================================'
begin;
set local role authenticated;
-- assign as the owner (who has update rights), all within this tx
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
update maintenance_requests
set assigned_to = '00000000-0000-0000-0000-000000000006'
where id = '60000000-0000-0000-0000-000000000002';
-- now check as the contractor, still inside the same transaction so the
-- update is visible (it hasn't committed, but we're in the same tx)
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000006';
select title, assigned_to from maintenance_requests;
rollback; -- roll back the assignment too, keeps fixtures clean for re-runs

\echo '============================================================'
\echo 'TEST C4 (CROSS-TENANT, CRITICAL): Company A owner cannot see'
\echo 'Company B (Söder Properties) at all.'
\echo 'Expected: companies query returns ONLY nordic-homes, never'
\echo 'soder-properties. properties/units queries return ONLY'
\echo 'Vasastan Residence / units 101+102, never Söder Loft / 201.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002'; -- nordic-homes owner
select slug from companies;
select name from properties;
select unit_number from units;
rollback;

\echo '============================================================'
\echo 'TEST C5 (CROSS-TENANT, CRITICAL): Company B owner cannot see'
\echo "Company A's data either — isolation must hold in both directions."
\echo 'Expected: companies query returns ONLY soder-properties.'
\echo 'properties/units queries return ONLY Söder Loft / unit 201.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007'; -- soder-properties owner
select slug from companies;
select name from properties;
select unit_number from units;
rollback;

\echo '============================================================'
\echo 'TEST C6 (CROSS-TENANT, CRITICAL): SUPER ADMIN sees BOTH companies'
\echo 'Expected: 2 rows — nordic-homes AND soder-properties'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000001'; -- super admin
select slug from companies order by slug;
rollback;

\echo '============================================================'
\echo "TEST C7: Company A's maintenance staff cannot query Company B's"
\echo 'maintenance_requests by guessing/iterating IDs — should simply'
\echo 'not appear in their result set even if they had the UUID.'
\echo 'Söder Properties has no maintenance requests seeded, so this is'
\echo 'really validated by C4/C5 already, but documenting the intent:'
\echo 'cross-tenant isolation is enforced by company_id matching via'
\echo 'membership, not by obscurity of UUIDs.'
\echo '============================================================'

\echo '============================================================'
\echo 'DONE. The cross-tenant tests (C4, C5, C6) are the highest-'
\echo 'priority results in this entire validation pass — if any of'
\echo 'them show data leaking across companies, stop and fix RLS'
\echo 'before doing anything else.'
\echo '============================================================'
