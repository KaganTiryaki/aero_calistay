import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';

const migration1 = readFileSync(new URL('../../supabase/migrations/202609260001_aero_operations.sql', import.meta.url), 'utf8');
const migration2 = readFileSync(new URL('../../supabase/migrations/202609260002_mail_queue_and_badges.sql', import.meta.url), 'utf8');
const migration3 = readFileSync(new URL('../../supabase/migrations/202609260003_retry_failed_approval.sql', import.meta.url), 'utf8');
const migration4 = readFileSync(new URL('../../supabase/migrations/202609300001_admin_activity.sql', import.meta.url), 'utf8');
const migration5 = readFileSync(new URL('../../supabase/migrations/202610010001_admin_login_rate_limit.sql', import.meta.url), 'utf8');
const migration6 = readFileSync(new URL('../../supabase/migrations/202610020001_immediate_mail_dispatch.sql', import.meta.url), 'utf8');

async function database() {
  const pg = await PGlite.create({ extensions: { pgcrypto } });
  await pg.exec(`create schema auth; create schema extensions;
    create role anon; create role authenticated; create role service_role bypassrls;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;`);
  await pg.exec(migration1);
  await pg.exec(migration2);
  await pg.exec(migration3);
  await pg.exec(migration4);
  await pg.exec(migration5);
  await pg.exec(migration6);
  return pg;
}

test('admin login rate limit backs off, blocks after five failures, and resets', async () => {
  const pg = await database();
  const ip = '203.0.113.10';
  const device = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const first = (await pg.query('select * from private.record_admin_login_failure($1::inet,$2::uuid,$3::timestamptz)', [ip, device, '2026-10-01T10:00:00Z'])).rows[0];
  assert.deepEqual(first, { allowed: true, wait_seconds: 1, failure_count: 1, suspicious: false });
  for (let i = 0; i < 3; i++) await pg.query('select * from private.record_admin_login_failure($1::inet,$2::uuid,$3::timestamptz)', [ip, device, `2026-10-01T10:00:0${i + 1}Z`]);
  const fifth = (await pg.query('select * from private.record_admin_login_failure($1::inet,$2::uuid,$3::timestamptz)', [ip, device, '2026-10-01T10:00:05Z'])).rows[0];
  assert.equal(fifth.allowed, true);
  assert.equal(fifth.failure_count, 5);
  assert.equal(fifth.wait_seconds, 900);
  assert.equal(fifth.suspicious, true);
  const blocked = (await pg.query('select * from private.check_admin_login_rate_limit($1::inet,$2::uuid,$3::timestamptz)', [ip, device, '2026-10-01T10:01:00Z'])).rows[0];
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.wait_seconds, 845);
  await pg.query('select private.reset_admin_login_failures($1::inet,$2::uuid)', [ip, device]);
  const reset = (await pg.query('select * from private.check_admin_login_rate_limit($1::inet,$2::uuid,$3::timestamptz)', [ip, device, '2026-10-01T10:01:00Z'])).rows[0];
  assert.deepEqual(reset, { allowed: true, wait_seconds: 0, failure_count: 0, suspicious: false });
  await pg.close();
});

function queue(pg, id, actor, jobs, hash = 'a'.repeat(64)) {
  return pg.query('select public.queue_approval_batch($1,$2,$3::jsonb,$4)', [id, actor, JSON.stringify(jobs), hash]);
}

test('migrations apply and keep anon away from participant data', async () => {
  const pg = await database();
  const events = await pg.query('select count(*)::int as count from public.events');
  assert.equal(events.rows[0].count, 1);
  await pg.exec('set role anon');
  await assert.rejects(pg.query('select * from public.applications'), /permission denied|row-level security/i);
  await assert.rejects(pg.query('select * from public.admin_activity'), /permission denied|row-level security/i);
  await pg.exec('reset role');
  await pg.close();
});

test('activity history is readable only by an active admin and cannot be written by browser users', async () => {
  const pg = await database();
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const staff = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1),($2)', [admin, staff]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$3,'admin'),($2,$3,'staff')", [admin, staff, event]);
  await pg.query("insert into public.admin_activity(actor_id,event_id,action,outcome,device_class) values ($1,$2,'login','succeeded','desktop')", [admin, event]);
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [staff]);
  await pg.exec('set role authenticated');
  assert.equal((await pg.query('select count(*)::int as count from public.admin_activity')).rows[0].count, 0);
  await assert.rejects(pg.query("insert into public.admin_activity(action,device_class) values ('forged','desktop')"), /permission denied/i);
  await pg.exec('reset role');
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  await pg.exec('set role authenticated');
  assert.equal((await pg.query('select count(*)::int as count from public.admin_activity')).rows[0].count, 1);
  await pg.close();
});

test('queue, Brevo event, QR and first check-in form one durable flow', async () => {
  const pg = await database();
  const admin = '11111111-1111-4111-8111-111111111111';
  const staff = '22222222-2222-4222-8222-222222222222';
  const batch = '33333333-3333-4333-8333-333333333333';
  const requestId = '44444444-4444-4444-8444-444444444444';
  await pg.query('insert into auth.users(id) values ($1), ($2)', [admin, staff]);
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$3,'admin'),($2,$3,'staff')", [admin, staff, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Hukuk') returning id", [event])).rows[0].id;
  const application = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) values ($1,'Ayşe Nur','Şen','ayse@example.com') returning id", [event])).rows[0].id;
  const jobs = [{ applicationId: application, version: 1, committeeId: committee, email: 'ayse@example.com', subject: 'Kabul', html: '<p>Kabul</p>', text: 'Kabul' }];
  await queue(pg, batch, admin, jobs);
  await queue(pg, batch, admin, jobs);
  await assert.rejects(queue(pg, batch, admin, jobs, 'b'.repeat(64)), /BATCH_CONFLICT/);
  assert.equal((await pg.query('select count(*)::int as count from public.mail_jobs')).rows[0].count, 1);
  assert.equal((await pg.query('select status from public.applications where id=$1', [application])).rows[0].status, 'approval_queued');
  assert.equal((await pg.query('select count(*)::int as count from public.qr_credentials')).rows[0].count, 0);
  const job = (await pg.query('select tag from public.mail_jobs limit 1')).rows[0];
  for (let i = 0; i < 2; i++) await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz)',
    ['fingerprint-1', job.tag, '<message@brevo>', 'ayse@example.com', 'request', '2026-09-26T10:00:00Z']);
  assert.equal((await pg.query('select status from public.applications where id=$1', [application])).rows[0].status, 'approved');
  const qr = (await pg.query('select raw_value from public.qr_credentials where application_id=$1', [application])).rows[0].raw_value;
  assert.match(qr, /^AERO1:[A-Za-z0-9_-]{43}$/);
  assert.equal((await pg.query('select count(*)::int as count from public.qr_credentials')).rows[0].count, 1);
  const delivery = await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz) as accepted',
    ['fingerprint-delivered', job.tag, 'message@brevo', 'ayse@example.com', 'delivered', '2026-09-26T10:02:00Z']);
  assert.equal(delivery.rows[0].accepted, true);
  await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz)',
    ['fingerprint-old-deferred', job.tag, '<message@brevo>', 'ayse@example.com', 'deferred', '2026-09-26T10:01:00Z']);
  assert.equal((await pg.query('select delivery_status from public.mail_jobs')).rows[0].delivery_status, 'delivered');
  await pg.query('update public.events set check_in_open=true where id=$1', [event]);
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [staff]);
  await pg.exec('set role authenticated');
  assert.equal((await pg.query('select count(*)::int as count from public.applications')).rows[0].count, 0);
  await assert.rejects(pg.query("update public.applications set status='approved' where id=$1", [application]), /permission denied/i);
  const first = (await pg.query('select public.check_in_code($1,$2) as result', [qr, requestId])).rows[0].result;
  const repeat = (await pg.query('select public.check_in_code($1,$2) as result', [qr, requestId])).rows[0].result;
  assert.equal(first.result, 'recorded');
  assert.equal(first.committee, 'Hukuk');
  assert.equal(repeat.result, 'recorded');
  await pg.exec('reset role');
  assert.equal((await pg.query('select count(*)::int as count from public.check_ins')).rows[0].count, 1);
  await pg.close();
});

test('same email and competing approval are rejected; cancelling never revives a QR', async () => {
  const pg = await database();
  const admin = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1)', [admin]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$2,'admin')", [admin, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Felsefe') returning id", [event])).rows[0].id;
  const application = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) values ($1,'Ali','Can','ali@example.com') returning id", [event])).rows[0].id;
  await assert.rejects(pg.query("insert into public.applications(event_id,first_name,last_name,email) values ($1,'Başka','Biri','ali@example.com')", [event]), /unique|duplicate/i);
  const job = [{ applicationId: application, version: 1, committeeId: committee, email: 'ali@example.com', subject: 'Kabul', html: '<p>Kabul</p>', text: 'Kabul' }];
  await queue(pg, 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', admin, job);
  await assert.rejects(queue(pg, 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', admin, job), /STALE_APPLICATION/);
  const tag = (await pg.query('select tag from public.mail_jobs')).rows[0].tag;
  assert.equal((await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz) as accepted', ['bad', tag, 'm', 'wrong@example.com', 'request', '2026-09-26T10:00:00Z'])).rows[0].accepted, false);
  assert.equal((await pg.query('select status from public.applications where id=$1', [application])).rows[0].status, 'approval_queued');
  await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz)', ['good', tag, 'm', 'ali@example.com', 'request', '2026-09-26T10:00:00Z']);
  const oldQr = (await pg.query('select raw_value from public.qr_credentials where application_id=$1', [application])).rows[0].raw_value;
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  await pg.exec('set role authenticated');
  assert.equal((await pg.query('select public.rotate_qr($1) as changed', [application])).rows[0].changed, true);
  await pg.exec('reset role');
  const newQr = (await pg.query('select raw_value from public.qr_credentials where application_id=$1', [application])).rows[0].raw_value;
  assert.notEqual(newQr, oldQr);
  await pg.query('update public.events set check_in_open=true where id=$1', [event]);
  await pg.exec('set role authenticated');
  assert.equal((await pg.query('select public.check_in_code($1,$2) as result', [oldQr, crypto.randomUUID()])).rows[0].result.result, 'invalid');
  assert.equal((await pg.query('select public.cancel_application($1) as cancelled', [application])).rows[0].cancelled, true);
  assert.equal((await pg.query('select public.check_in_code($1,$2) as result', [newQr, crypto.randomUUID()])).rows[0].result.result, 'inactive');
  await pg.exec('reset role');
  await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz)', ['late', tag, 'm', 'ali@example.com', 'delivered', '2026-09-26T10:01:00Z']);
  assert.equal((await pg.query('select status from public.applications where id=$1', [application])).rows[0].status, 'cancelled');
  await pg.close();
});

test('definite quota rejection releases reservation and pauses new sends', async () => {
  const pg = await database();
  const admin = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
  const worker = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1)', [admin]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$2,'admin')", [admin, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Etik') returning id", [event])).rows[0].id;
  const application = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) values ($1,'Ela','Şen','ela@example.com') returning id", [event])).rows[0].id;
  const jobs = [{ applicationId: application, version: 1, committeeId: committee, email: 'ela@example.com', subject: 'Kabul', html: '<p>Kabul</p>', text: 'Kabul' }];
  await queue(pg, 'ffffffff-ffff-4fff-8fff-ffffffffffff', admin, jobs);
  const claimed = (await pg.query('select id from public.claim_mail_jobs($1,1)', [worker])).rows;
  assert.equal(claimed.length, 1);
  assert.equal((await pg.query('select reserved_today from public.mail_provider_state')).rows[0].reserved_today, 1);
  await pg.query("select public.mark_mail_job($1,$2,'quota_wait',null,'quota',now()+interval '15 minutes')", [claimed[0].id, worker]);
  assert.equal((await pg.query('select reserved_today from public.mail_provider_state')).rows[0].reserved_today, 0);
  assert.equal((await pg.query('select count(*)::int as count from public.claim_mail_jobs($1,1)', [worker])).rows[0].count, 0);
  await pg.close();
});

test('a previous-day send failure does not free a new-day mail slot', async () => {
  const pg = await database();
  const admin = '01010101-0101-4101-8101-010101010101';
  const worker = '02020202-0202-4202-8202-020202020202';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1)', [admin]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$2,'admin')", [admin, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Etik') returning id", [event])).rows[0].id;
  const app = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) values ($1,'Ece','Can','ece@example.com') returning id", [event])).rows[0].id;
  await queue(pg, '03030303-0303-4303-8303-030303030303', admin,
    [{ applicationId: app, version: 1, committeeId: committee, email: 'ece@example.com', subject: 'Kabul', html: 'Kabul', text: 'Kabul' }]);
  const job = (await pg.query('select id from public.claim_mail_jobs($1,1)', [worker])).rows[0].id;
  await pg.query("update public.mail_provider_state set sent_day = ((now() at time zone 'Europe/Istanbul')::date + 1), reserved_today = 5 where id = 1");
  await pg.query("select public.mark_mail_job($1,$2,'failed',null,'Adres geçersiz')", [job, worker]);
  assert.equal((await pg.query('select reserved_today from public.mail_provider_state')).rows[0].reserved_today, 5);
  await pg.close();
});

test('failed approval can be reopened explicitly without reusing the old job', async () => {
  const pg = await database();
  const admin = '77777777-7777-4777-8777-777777777777';
  const worker = '88888888-8888-4888-8888-888888888888';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1)', [admin]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$2,'admin')", [admin, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Etik') returning id", [event])).rows[0].id;
  const application = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) values ($1,'Ece','Şen','ece@example.com') returning id", [event])).rows[0].id;
  const jobs = [{ applicationId: application, version: 1, committeeId: committee, email: 'ece@example.com', subject: 'Kabul', html: '<p>Kabul</p>', text: 'Kabul' }];
  await queue(pg, '99999999-9999-4999-8999-999999999999', admin, jobs);
  const job = (await pg.query('select id from public.claim_mail_jobs($1,1)', [worker])).rows[0].id;
  await pg.query("select public.mark_mail_job($1,$2,'failed',null,'Geçersiz adres')", [job, worker]);
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  await pg.exec('set role authenticated');
  assert.equal((await pg.query('select public.reopen_failed_approval($1) as reopened', [job])).rows[0].reopened, true);
  assert.equal((await pg.query('select public.reopen_failed_approval($1) as reopened', [job])).rows[0].reopened, false);
  await pg.exec('reset role');
  const app = (await pg.query('select status,version from public.applications where id=$1', [application])).rows[0];
  assert.equal(app.status, 'pending');
  assert.equal(app.version, 3);
  assert.equal((await pg.query('select status from public.mail_jobs where id=$1', [job])).rows[0].status, 'failed');
  assert.ok((await pg.query('select reopened_at from public.mail_jobs where id=$1', [job])).rows[0].reopened_at);
  await pg.close();
});

test('Brevo invalid_email makes an unapproved application recoverable', async () => {
  const pg = await database();
  const admin = 'abababab-abab-4bab-8bab-abababababab';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1)', [admin]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$2,'admin')", [admin, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Etik') returning id", [event])).rows[0].id;
  const app = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) values ($1,'Ece','Can','ece@example.com') returning id", [event])).rows[0].id;
  await queue(pg, 'cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd', admin,
    [{ applicationId: app, version: 1, committeeId: committee, email: 'ece@example.com', subject: 'Kabul', html: 'Kabul', text: 'Kabul' }]);
  const job = (await pg.query('select id,tag from public.mail_jobs')).rows[0];
  await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz)',
    ['invalid-event', job.tag, 'message-1', 'ece@example.com', 'invalid_email', '2026-09-26T10:00:00Z']);
  assert.equal((await pg.query('select status from public.mail_jobs where id=$1', [job.id])).rows[0].status, 'failed');
  assert.equal((await pg.query('select status from public.applications where id=$1', [app])).rows[0].status, 'approval_queued');
  await pg.query("select set_config('request.jwt.claim.sub',$1,false)", [admin]);
  await pg.exec('set role authenticated');
  assert.equal((await pg.query('select public.reopen_failed_approval($1) as reopened', [job.id])).rows[0].reopened, true);
  await pg.close();
});

test('350 recipients persist in one batch while the default daily budget stops at 290', async () => {
  const pg = await database();
  const admin = '11111111-2222-4333-8444-555555555555';
  const worker = '66666666-7777-4888-8999-aaaaaaaaaaaa';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1)', [admin]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$2,'admin')", [admin, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Sosyoloji') returning id", [event])).rows[0].id;
  const apps = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) select $1,'Kişi','Örnek','person'||n||'@example.com' from generate_series(1,350) n returning id,email,version", [event])).rows;
  const jobs = apps.map((app) => ({ applicationId: app.id, version: app.version, committeeId: committee, email: app.email, subject: 'Kabul', html: '<p>Kabul</p>', text: 'Kabul' }));
  await queue(pg, 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff', admin, jobs);
  let claimed = 0;
  for (let i = 0; i < 20; i++) claimed += (await pg.query('select count(*)::int as count from public.claim_mail_jobs($1,20)', [worker])).rows[0].count;
  assert.equal(claimed, 290);
  assert.equal((await pg.query("select count(*)::int as count from public.mail_jobs where status='quota_wait'")).rows[0].count, 60);
  assert.equal((await pg.query('select reserved_today from public.mail_provider_state')).rows[0].reserved_today, 290);
  assert.equal((await pg.query('select count(*)::int as count from public.qr_credentials')).rows[0].count, 0);
  await pg.close();
});

test('three definite failures in fifty leave forty-seven approvals and QR credentials', async () => {
  const pg = await database();
  const admin = '12121212-1212-4212-8212-121212121212';
  const worker = '34343434-3434-4434-8434-343434343434';
  const event = (await pg.query('select id from public.events limit 1')).rows[0].id;
  await pg.query('insert into auth.users(id) values ($1)', [admin]);
  await pg.query("insert into public.staff_members(user_id,event_id,role) values ($1,$2,'admin')", [admin, event]);
  const committee = (await pg.query("insert into public.committees(event_id,name) values ($1,'Hukuk') returning id", [event])).rows[0].id;
  const apps = (await pg.query("insert into public.applications(event_id,first_name,last_name,email) select $1,'Kişi','Örnek','fifty'||n||'@example.com' from generate_series(1,50) n returning id,email,version", [event])).rows;
  const jobs = apps.map((app) => ({ applicationId: app.id, version: app.version, committeeId: committee, email: app.email, subject: 'Kabul', html: '<p>Kabul</p>', text: 'Kabul' }));
  await queue(pg, '56565656-5656-4565-8565-565656565656', admin, jobs);
  const claimed = [];
  for (let i = 0; i < 3; i++) claimed.push(...(await pg.query('select id,tag,recipient_email from public.claim_mail_jobs($1,20)', [worker])).rows);
  assert.equal(claimed.length, 50);
  for (const [index, job] of claimed.entries()) {
    if (index < 3) {
      await pg.query("select public.mark_mail_job($1,$2,'failed',null,'Geçersiz adres')", [job.id, worker]);
    } else {
      await pg.query("select public.mark_mail_job($1,$2,'provider_accepted',$3)", [job.id, worker, `message-${index}`]);
      await pg.query('select public.record_mail_event($1,$2,$3,$4,$5,$6::timestamptz)',
        [`fingerprint-${index}`, job.tag, `message-${index}`, job.recipient_email, 'request', '2026-09-26T10:00:00Z']);
    }
  }
  assert.equal((await pg.query("select count(*)::int as count from public.applications where status='approved'")).rows[0].count, 47);
  assert.equal((await pg.query('select count(*)::int as count from public.qr_credentials')).rows[0].count, 47);
  assert.equal((await pg.query("select count(*)::int as count from public.mail_jobs where status='failed'")).rows[0].count, 3);
  await pg.close();
});
