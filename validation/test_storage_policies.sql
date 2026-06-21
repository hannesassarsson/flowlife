-- ============================================================================
-- test_storage_policies.sql
--
-- storage.objects RLS can largely be tested the same way as any other
-- table — by inserting a row into storage.objects directly via SQL while
-- impersonating a role, since the storage policies are just RLS policies
-- on a normal table under the hood. This DOES NOT exercise the actual file
-- upload path (multipart, signed URLs, the storage API server) — only the
-- access-control logic. See the manual checklist at the bottom for what
-- still needs a real upload through the Supabase client or dashboard.
--
-- Run AFTER: migrations -> seed.sql -> additional_test_fixtures.sql
-- ============================================================================

\set ON_ERROR_STOP off
\pset format aligned
\pset border 2

\echo '============================================================'
\echo 'TEST S1: OWNER can insert into documents bucket for their own'
\echo 'company path. Expected: INSERT succeeds.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into storage.objects (bucket_id, name, owner)
values (
  'documents',
  '10000000-0000-0000-0000-000000000001/lease/50000000-0000-0000-0000-000000000001/lease-agreement.pdf',
  '00000000-0000-0000-0000-000000000002'
);
rollback;

\echo '============================================================'
\echo 'TEST S2: TENANT cannot insert into documents bucket at all'
\echo '(only managers can upload). Expected: ERROR — RLS violation.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005';
insert into storage.objects (bucket_id, name, owner)
values (
  'documents',
  '10000000-0000-0000-0000-000000000001/lease/50000000-0000-0000-0000-000000000001/sneaky-upload.pdf',
  '00000000-0000-0000-0000-000000000005'
);
rollback;

\echo '============================================================'
\echo 'TEST S3: OWNER from Company B cannot insert into a Company A'
\echo "path in the documents bucket, even though they're a legitimate"
\echo 'owner (just of the wrong company). Expected: ERROR.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000007'; -- soder-properties owner
insert into storage.objects (bucket_id, name, owner)
values (
  'documents',
  '10000000-0000-0000-0000-000000000001/lease/50000000-0000-0000-0000-000000000001/cross-tenant-attempt.pdf',
  '00000000-0000-0000-0000-000000000007'
);
rollback;

\echo '============================================================'
\echo 'TEST S4: MAINTENANCE STAFF can upload an attachment to THEIR'
\echo 'assigned ticket. Expected: INSERT succeeds.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
insert into storage.objects (bucket_id, name, owner)
values (
  'maintenance-attachments',
  '10000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000001/before-photo.jpg',
  '00000000-0000-0000-0000-000000000004'
);
rollback;

\echo '============================================================'
\echo 'TEST S5: MAINTENANCE STAFF cannot upload to the UNASSIGNED'
\echo 'ticket (60000000-...-002). Expected: ERROR.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000004';
insert into storage.objects (bucket_id, name, owner)
values (
  'maintenance-attachments',
  '10000000-0000-0000-0000-000000000001/60000000-0000-0000-0000-000000000002/should-fail.jpg',
  '00000000-0000-0000-0000-000000000004'
);
rollback;

\echo '============================================================'
\echo 'TEST S6: ANON can read the branding bucket (public logos).'
\echo 'Expected: this only proves the SELECT policy allows it —'
\echo 'actually confirm by inserting a row first in this same'
\echo 'transaction as the owner, then reading as anon.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000002';
insert into storage.objects (bucket_id, name, owner)
values (
  'branding',
  '10000000-0000-0000-0000-000000000001/logo.png',
  '00000000-0000-0000-0000-000000000002'
);
set local role anon;
select count(*) as should_be_at_least_1
from storage.objects
where bucket_id = 'branding'
  and name = '10000000-0000-0000-0000-000000000001/logo.png';
rollback;

\echo '============================================================'
\echo 'TEST S7: A user cannot upload an avatar under someone elses'
\echo 'user_id path. Expected: ERROR.'
\echo '============================================================'
begin;
set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-0000-0000-000000000005'; -- tenant
insert into storage.objects (bucket_id, name, owner)
values (
  'avatars',
  '00000000-0000-0000-0000-000000000002/not-my-avatar.png', -- owner's user_id, not tenant's
  '00000000-0000-0000-0000-000000000005'
);
rollback;

\echo '============================================================'
\echo 'SQL-LEVEL STORAGE TESTS DONE.'
\echo '============================================================'

\echo ''
\echo '============================================================'
\echo 'MANUAL CHECKLIST — things that need a REAL upload through the'
\echo 'Supabase client or Storage API, not just SQL-level RLS:'
\echo '============================================================'
\echo '[ ] Actual file upload (multipart) succeeds for an owner uploading'
\echo '    a real PDF to the documents bucket via supabase.storage.from()'
\echo '[ ] Signed URL generation works for a tenant viewing a'
\echo '    visible_to_tenant document (createSignedUrl, not public URL,'
\echo '    since the documents bucket is private)'
\echo '[ ] Public URL (getPublicUrl) works for the branding bucket'
\echo '    without any auth token at all — open the URL in an incognito'
\echo '    browser tab to confirm'
\echo '[ ] Bucket file-size limits and MIME-type restrictions are set'
\echo '    in the Supabase dashboard (not covered by RLS — these are'
\echo '    bucket-level config, see README "Known trade-offs" section)'
\echo '[ ] Attempting to upload a 50MB file to avatars (or whatever your'
\echo '    real limit is) is rejected at the API level, not just slow'
