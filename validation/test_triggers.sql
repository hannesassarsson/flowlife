-- ============================================================================
-- test_triggers.sql
--
-- Validates the 4 automatic trigger behaviors added beyond the original
-- schema design:
--   1. units.status syncs to 'occupied'/'vacant' on lease insert/update
--   2. maintenance_status_history auto-logs on every status change
--   3. message_threads.last_message_at auto-touches on new message
--   4. company_id denormalization (buildings, units, leases, maintenance_*,
--      documents, messages) is correctly derived from the parent, not
--      trusted from client input
--
-- Run as the postgres/service role (bypasses RLS) so we're testing trigger
-- LOGIC, not RLS interaction. Run AFTER migrations + seed.sql.
-- ============================================================================

\set ON_ERROR_STOP off
\pset format aligned
\pset border 2

\echo '============================================================'
\echo 'TEST T1: Unit 102 starts as vacant (per seed.sql)'
\echo 'Expected: status = vacant'
\echo '============================================================'
select unit_number, status from units where id = '40000000-0000-0000-0000-000000000002';

\echo '============================================================'
\echo 'TEST T2: Creating an active lease on unit 102 should flip it'
\echo 'to occupied automatically (trigger: sync_unit_status_on_lease_change)'
\echo 'Expected: status = occupied, with NO manual UPDATE on units'
\echo '============================================================'
begin;
insert into leases (id, unit_id, start_date, rent_amount, rent_currency, status)
values ('50000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000002', current_date, 14200, 'SEK', 'active');
select unit_number, status from units where id = '40000000-0000-0000-0000-000000000002';
rollback; -- undo, so seed data stays clean for other test files

\echo '============================================================'
\echo 'TEST T3: Ending that lease should flip the unit back to vacant'
\echo 'Expected: status = vacant after the UPDATE'
\echo '============================================================'
begin;
insert into leases (id, unit_id, start_date, rent_amount, rent_currency, status)
values ('50000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000002', current_date, 14200, 'SEK', 'active');
update leases set status = 'ended', end_date = current_date
where id = '50000000-0000-0000-0000-000000000099';
select unit_number, status from units where id = '40000000-0000-0000-0000-000000000002';
rollback;

\echo '============================================================'
\echo 'TEST T4: maintenance_status_history gets an INSERT row'
\echo 'automatically when a new maintenance_request is created'
\echo '(trigger: log_maintenance_status_change, INSERT branch)'
\echo 'Expected: 1 row, from_status = NULL, to_status = new'
\echo '============================================================'
begin;
insert into maintenance_requests (id, unit_id, created_by, created_by_type, title, status)
values ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'tenant', 'Test trigger ticket', 'new');
select from_status, to_status from maintenance_status_history
where request_id = '60000000-0000-0000-0000-000000000099';
rollback;

\echo '============================================================'
\echo 'TEST T5: maintenance_status_history gets a SECOND row when the'
\echo "request's status is updated (trigger: UPDATE branch)"
\echo 'Expected: 2 rows total — (NULL -> new), (new -> in_progress)'
\echo '============================================================'
begin;
insert into maintenance_requests (id, unit_id, created_by, created_by_type, title, status)
values ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'tenant', 'Test trigger ticket', 'new');
update maintenance_requests set status = 'in_progress' where id = '60000000-0000-0000-0000-000000000099';
select from_status, to_status from maintenance_status_history
where request_id = '60000000-0000-0000-0000-000000000099'
order by changed_at;
rollback;

\echo '============================================================'
\echo 'TEST T6: Updating a maintenance_request WITHOUT changing status'
\echo 'should NOT add a spurious history row (trigger checks'
\echo '"new.status is distinct from old.status")'
\echo 'Expected: still exactly 1 row (just the initial INSERT log)'
\echo '============================================================'
begin;
insert into maintenance_requests (id, unit_id, created_by, created_by_type, title, status, description)
values ('60000000-0000-0000-0000-000000000099', '40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'tenant', 'Test trigger ticket', 'new', 'original description');
update maintenance_requests set description = 'edited description, same status' where id = '60000000-0000-0000-0000-000000000099';
select count(*) as should_be_1 from maintenance_status_history
where request_id = '60000000-0000-0000-0000-000000000099';
rollback;

\echo '============================================================'
\echo 'TEST T7: message_threads.last_message_at updates automatically'
\echo 'when a new message is inserted (trigger: touch_thread_last_message_at)'
\echo 'Expected: last_message_at moves forward to match the new'
\echo "message's created_at, without a manual UPDATE on the thread."
\echo '============================================================'
begin;
insert into message_threads (id, subject)
values ('70000000-0000-0000-0000-000000000099', 'Trigger test thread');
select last_message_at as before_message from message_threads where id = '70000000-0000-0000-0000-000000000099';
-- small delay so the timestamps are visibly different in output
select pg_sleep(0.05);
insert into messages (thread_id, sender_id, sender_type, body)
values ('70000000-0000-0000-0000-000000000099', '00000000-0000-0000-0000-000000000002', 'staff', 'First message in thread');
select last_message_at as after_message from message_threads where id = '70000000-0000-0000-0000-000000000099';
rollback;

\echo '============================================================'
\echo 'TEST T8: company_id denormalization — inserting a unit with NO'
\echo 'company_id supplied should auto-populate it from the parent'
\echo 'building (trigger: sync_unit_company_id, before insert)'
\echo 'Expected: company_id = 10000000-0000-0000-0000-000000000001'
\echo '(matches the building/property chain), even though we never'
\echo 'set it in the INSERT statement below.'
\echo '============================================================'
begin;
insert into units (id, building_id, unit_number, rent_amount, rent_currency, status)
values ('40000000-0000-0000-0000-000000000099', '30000000-0000-0000-0000-000000000001', '999', 10000, 'SEK', 'vacant');
select unit_number, company_id from units where id = '40000000-0000-0000-0000-000000000099';
rollback;

\echo '============================================================'
\echo 'TEST T9: documents.company_id is DERIVED from the related'
\echo 'entity, not trusted from a client-supplied value — try to'
\echo "insert a document tagged with COMPANY B's id but pointing at a"
\echo "COMPANY A unit, and confirm the trigger overwrites it to"
\echo "COMPANY A's real id (closing the spoofing vector)."
\echo 'Expected: company_id in the result = nordic-homes'
\echo '(10000000-...-001), NOT soder-properties'
\echo '(10000000-...-002), even though that is what we tried to insert.'
\echo '============================================================'
begin;
insert into documents (id, company_id, title, file_url, related_entity_type, related_entity_id, uploaded_by)
values (
  '80000000-0000-0000-0000-000000000099',
  '10000000-0000-0000-0000-000000000002', -- WRONG company, deliberately, to test the override
  'Spoofing test document',
  'documents/fake.pdf',
  'unit',
  '40000000-0000-0000-0000-000000000001', -- this unit really belongs to Company A
  '00000000-0000-0000-0000-000000000002'
);
select title, company_id from documents where id = '80000000-0000-0000-0000-000000000099';
rollback;

\echo '============================================================'
\echo 'DONE. T9 is the most important result here — if company_id'
\echo "in its output matches what we TRIED to insert rather than the"
\echo "unit's real owner, the spoofing-prevention trigger is broken."
\echo '============================================================'
