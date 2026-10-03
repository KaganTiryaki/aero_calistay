import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';

async function setup() {
 const pg=await PGlite.create({extensions:{pgcrypto}});
 await pg.exec(`create schema auth; create schema extensions; create role anon; create role authenticated; create role service_role bypassrls;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 create schema storage;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;`);
 const dir=new URL('../../supabase/migrations/',import.meta.url);
 const files=readdirSync(dir).filter(x=>x.endsWith('.sql')).sort();
 for(const file of files) await pg.exec(readFileSync(new URL(file,dir),'utf8'));
 const event=(await pg.query('select id from events limit 1')).rows[0].id;
 const admin=crypto.randomUUID(),participant=crypto.randomUUID(),staff=crypto.randomUUID();
 await pg.query("insert into auth.users values ($1,'admin@test.com',now()),($2,'p@test.com',now()),($3,'staff@test.com',now())",[admin,participant,staff]);
 await pg.query("insert into staff_members(user_id,event_id,role) values($1,$3,'admin'),($2,$3,'staff')",[admin,staff,event]);
 const committee=(await pg.query("insert into committees(event_id,name) values($1,'Hukuk') returning id",[event])).rows[0].id;
 const app=(await pg.query("insert into applications(event_id,first_name,last_name,email) values($1,'Ayşe','Şen','p@test.com') returning id",[event])).rows[0].id;
 await pg.query("update events set check_in_open=true,participant_rollout_enabled=true,participant_acceptance_enabled=true,participant_payment_mutations_enabled=true,payment_iban='TR00000000000000000000000000',payment_amount_minor=100000,payment_deadline=now()+interval '7 days',participant_portal_url='https://example.com/katilimci' where id=$1",[event]);
 async function as(user){await pg.exec('reset role');await pg.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);await pg.exec('set role authenticated');}
 return {pg,event,admin,participant,staff,committee,app,as};
}

async function receipt(s) {
 await s.as(s.admin); await s.pg.query('select accept_application($1,$2,1)',[s.app,s.committee]);
 await s.pg.exec('reset role'); await s.pg.query('insert into participant_memberships(user_id,application_id) values($1,$2)',[s.participant,s.app]);
 await s.as(s.participant);
 return (await s.pg.query("select begin_payment_submission($1,'image/png',100) id",[s.app])).rows[0].id;
}

async function upload(s,id) {
 await s.pg.exec('reset role');
 const row=(await s.pg.query('select storage_object_id,expected_mime,expected_size from payment_submissions where id=$1',[id])).rows[0];
 await s.pg.query("insert into storage.objects(bucket_id,name,owner_id,metadata) values('participant-receipts',$1,$2,$3)",[row.storage_object_id,s.participant,JSON.stringify({size:row.expected_size,mimetype:row.expected_mime})]);
 await s.pg.exec('set role service_role');
 await s.pg.query('select finalize_payment_submission($1,$2,$3)',[id,s.participant,'a'.repeat(64)]);
}

test('auth jobs have separate request identities and activation is bound to job, user, fingerprint and type',async()=>{
 const s=await setup();try{
  await s.as(s.admin);await s.pg.query('select accept_application($1,$2,1)',[s.app,s.committee]);await s.pg.exec('reset role');
  await s.pg.query("update mail_jobs set status='failed' where application_id=$1",[s.app]);await s.pg.exec('set role service_role');
  const first=(await s.pg.query("select request_participant_auth_mail('p@test.com','recovery',$1) id",[crypto.randomUUID()])).rows[0].id;assert.ok(first);
  assert.equal((await s.pg.query("select request_participant_auth_mail('p@test.com','recovery',$1) id",[crypto.randomUUID()])).rows[0].id,first);
  await s.pg.exec('reset role');await s.pg.query("update mail_jobs set status='sent',auth_prepare_state='prepared' where batch_id=$1",[first]);await s.pg.exec('set role service_role');
  const second=(await s.pg.query("select request_participant_auth_mail('p@test.com','recovery',$1) id",[crypto.randomUUID()])).rows[0].id;assert.ok(second);assert.notEqual(second,first);
  await s.pg.exec('reset role');const job=(await s.pg.query('select id from mail_jobs where batch_id=$1',[second])).rows[0].id;
  await s.pg.query("update mail_jobs set status='sending' where id=$1",[job]);await s.pg.exec('set role service_role');
  const context=(await s.pg.query('select * from begin_participant_auth_preparation($1)',[job])).rows[0];assert.equal(context.recipient_email,'p@test.com');
  await s.pg.query("select store_bound_participant_auth_mail($1,$2,$3,'recovery',$4,'AAAAAAAAAAAAAAAA','eA==','AAAAAAAAAAAAAAAAAAAAAA==',now()+interval '1 hour')",[job,s.app,s.participant,'f'.repeat(64)]);
  const valid=(user=s.participant,fingerprint='f'.repeat(64),type='recovery')=>s.pg.query('select validate_participant_activation($1,$2,$3,$4) ok',[user,job,fingerprint,type]);
  assert.equal((await valid()).rows[0].ok,true);assert.equal((await valid(s.staff)).rows[0].ok,false);assert.equal((await valid(s.participant,'e'.repeat(64))).rows[0].ok,false);assert.equal((await valid(s.participant,'f'.repeat(64),'invite')).rows[0].ok,false);
  await s.pg.exec('reset role');await s.pg.query("update participant_invites set status='revoked' where application_id=$1",[s.app]);await s.pg.exec('set role service_role');assert.equal((await valid()).rows[0].ok,false);
 }finally{await s.pg.close();}
});

test('reinvite does not create jobs for pending or cancelled applications and retention leaves provider audit intact',async()=>{
 const s=await setup();try{
  await s.pg.exec('set role service_role');assert.equal((await s.pg.query("select request_participant_auth_mail('p@test.com','activate',$1) id",[crypto.randomUUID()])).rows[0].id,null);
  await s.pg.exec('reset role');await s.as(s.admin);await s.pg.query('select accept_application($1,$2,1)',[s.app,s.committee]);await s.pg.exec('reset role');
  const job=(await s.pg.query('select id from mail_jobs where application_id=$1',[s.app])).rows[0].id;
  await s.pg.query("insert into participant_auth_mail_payloads(job_id,application_id,nonce,ciphertext,auth_tag,expires_at) values($1,$2,'AAAAAAAAAAAAAAAA','eA==','AAAAAAAAAAAAAAAAAAAAAA==',now()-interval '25 hours')",[job,s.app]);
  await s.pg.query("update mail_jobs set status='failed' where id=$1",[job]);await s.pg.exec('set role service_role');
  assert.equal((await s.pg.query('select * from read_participant_auth_mail($1)',[job])).rows.length,1);
  await s.pg.query('select cleanup_participant_auth_payloads()');assert.equal((await s.pg.query('select * from read_participant_auth_mail($1)',[job])).rows.length,0);
  for(const state of ['provider_accepted','uncertain']){
   await s.pg.exec('reset role');await s.pg.query("insert into participant_auth_mail_payloads(job_id,application_id,nonce,ciphertext,auth_tag,expires_at) values($1,$2,'AAAAAAAAAAAAAAAA','eA==','AAAAAAAAAAAAAAAAAAAAAA==',now()-interval '25 hours')",[job,s.app]);
   await s.pg.query('update mail_jobs set status=$2 where id=$1',[job,state]);await s.pg.exec('set role service_role');await s.pg.query('select cleanup_participant_auth_payloads()');
   assert.equal((await s.pg.query('select * from read_participant_auth_mail($1)',[job])).rows.length,state==='uncertain'?1:0);
  }
  await s.pg.exec('reset role');assert.equal((await s.pg.query('select count(*)::integer n from mail_jobs where id=$1',[job])).rows[0].n,1);
  await s.pg.query("update applications set status='cancelled' where id=$1",[s.app]);await s.pg.exec('set role service_role');assert.equal((await s.pg.query("select request_participant_auth_mail('p@test.com','activate',$1) id",[crypto.randomUUID()])).rows[0].id,null);
 }finally{await s.pg.close();}
});

test('participant login and activation have independent failure limits and success clears only its own counter',async()=>{
 const s=await setup();try{await s.pg.exec('set role service_role');const ip='a'.repeat(64);
  for(let n=0;n<10;n++)await s.pg.query("select record_participant_auth_attempt($1,'login',false)",[ip]);
  assert.equal((await s.pg.query("select * from check_participant_auth_attempt($1,'login')",[ip])).rows[0].allowed,false);
  assert.equal((await s.pg.query("select * from check_participant_auth_attempt($1,'activation')",[ip])).rows[0].allowed,true);
  await s.pg.query("select record_participant_auth_attempt($1,'login',true)",[ip]);assert.equal((await s.pg.query("select * from check_participant_auth_attempt($1,'login')",[ip])).rows[0].allowed,true);
 }finally{await s.pg.close();}
});
test('staff registration preserves administrator roles and only enables event-scoped staff accounts',async()=>{
 const s=await setup();try{
  await s.as(s.admin);await assert.rejects(s.pg.query('select register_event_staff($1,$2)',[s.admin,s.event]),/ADMIN_ROLE_PROTECTED/);
  await s.pg.query('select register_event_staff($1,$2)',[s.staff,s.event]);
  await s.pg.exec('reset role');await s.pg.query("update staff_members set role='admin' where user_id=$1 and event_id=$2",[s.staff,s.event]);
  await s.as(s.admin);await assert.rejects(s.pg.query('select register_event_staff($1,$2)',[s.staff,s.event]),/ADMIN_ROLE_PROTECTED/);
  await s.pg.exec('reset role');assert.equal((await s.pg.query('select role from staff_members where user_id=$1 and event_id=$2',[s.staff,s.event])).rows[0].role,'admin');
 }finally{await s.pg.close();}
});

test('admin fixes a missing expected amount with version and audit; staff, stale and confirmed changes fail',async()=>{
 const s=await setup();try{
  await s.pg.query('update events set payment_amount_minor=null where id=$1',[s.event]);const id=await receipt(s);await upload(s,id);await s.as(s.admin);
  await assert.rejects(s.pg.query('select approve_payment($1,$2,100000,now(),1,$3)',[id,'bank-null-amount',crypto.randomUUID()]),/PAYMENT_NOT_CONFIGURED/);
  await s.as(s.staff);await assert.rejects(s.pg.query("select set_application_payment_amount($1,2,100000,'Beklenen tutar')",[s.app]),/FORBIDDEN/);
  await s.as(s.admin);await s.pg.query("select set_application_payment_amount($1,2,100000,'Beklenen tutar')",[s.app]);
  await assert.rejects(s.pg.query("select set_application_payment_amount($1,2,200000,'Eski sürüm')",[s.app]),/STALE_APPLICATION/);
  await s.pg.query('select approve_payment($1,$2,100000,now(),1,$3)',[id,'bank-fixed-amount',crypto.randomUUID()]);
  await assert.rejects(s.pg.query("select set_application_payment_amount($1,4,200000,'Geriye dönük')",[s.app]),/APPLICATION_INACTIVE/);
  await s.pg.exec('reset role');assert.equal((await s.pg.query("select count(*)::integer n from audit_logs where action='payment_amount_set' and target_id=$1",[s.app])).rows[0].n,1);
 }finally{await s.pg.close();}
});

test('closed rollout gates block direct database acceptance and payment mutations',async()=>{
 const s=await setup();try{
  await s.pg.query('update events set participant_acceptance_enabled=false where id=$1',[s.event]);await s.as(s.admin);
  await assert.rejects(s.pg.query('select accept_application($1,$2,1)',[s.app,s.committee]),/FEATURE_DISABLED/);
  await s.pg.exec('reset role');assert.equal((await s.pg.query('select status from applications where id=$1',[s.app])).rows[0].status,'pending');
  await s.pg.query('update events set participant_acceptance_enabled=true where id=$1',[s.event]);const id=await receipt(s);
  await s.pg.exec('reset role');await s.pg.query('update events set participant_payment_mutations_enabled=false where id=$1',[s.event]);
  await assert.rejects(upload(s,id),/FEATURE_DISABLED/);
 }finally{await s.pg.close();}
});

test('safe failed invite retry preserves encrypted payload and provider idempotency; expired retry creates a new job',async()=>{
 const s=await setup();try{
  await s.as(s.admin);await s.pg.query('select accept_application($1,$2,1)',[s.app,s.committee]);await s.pg.exec('reset role');
  const job=(await s.pg.query('select id,idempotency_key from mail_jobs where application_id=$1',[s.app])).rows[0];
  await s.pg.query("update mail_jobs set status='failed',auth_prepare_state='prepared' where id=$1",[job.id]);
  await s.pg.query("insert into participant_auth_mail_payloads(job_id,application_id,nonce,ciphertext,auth_tag,expires_at) values($1,$2,'AAAAAAAAAAAAAAAA','eA==','AAAAAAAAAAAAAAAAAAAAAA==',now()+interval '1 hour')",[job.id,s.app]);
  await s.as(s.admin);await s.pg.query("select retry_participant_invite($1,'p@test.com')",[job.id]);await s.pg.exec('reset role');
  assert.equal((await s.pg.query('select idempotency_key from mail_jobs where id=$1',[job.id])).rows[0].idempotency_key,job.idempotency_key);
  await s.pg.query("update mail_jobs set status='failed' where id=$1",[job.id]);await s.pg.query("update participant_auth_mail_payloads set expires_at=now()-interval '1 hour' where job_id=$1",[job.id]);
  await s.as(s.admin);await s.pg.query("select retry_participant_invite($1,'p@test.com')",[job.id]);await s.pg.exec('reset role');
  const rows=(await s.pg.query('select id,status from mail_jobs where application_id=$1',[s.app])).rows;assert.equal(rows.length,2);assert.equal(rows.find(r=>r.id===job.id).status,'cancelled');assert.equal(rows.find(r=>r.id!==job.id).status,'queued');
 }finally{await s.pg.close();}
});

test('payment review pages reach receipts beyond 500 applications and stay event-scoped',async()=>{
 const s=await setup();
 try {
  await s.pg.query("insert into applications(event_id,first_name,last_name,email) select $1,'Test','Katılımcı','review-'||n||'@test.com' from generate_series(1,501) n",[s.event]);
  await s.pg.query("insert into payment_submissions(application_id,status,created_at) select id,'under_review','2026-10-01T09:00:00Z' from applications where email like 'review-%@test.com'");
  const otherEvent=(await s.pg.query("insert into events(name) values('Başka etkinlik') returning id")).rows[0].id;
  await s.pg.query('update events set participant_rollout_enabled=true,participant_payment_mutations_enabled=true where id=$1',[otherEvent]);
  const otherApp=(await s.pg.query("insert into applications(event_id,first_name,last_name,email) values($1,'Başka','Kişi','other@test.com') returning id",[otherEvent])).rows[0].id;
  await s.pg.query("insert into payment_submissions(application_id,status) values($1,'under_review')",[otherApp]);
  await s.as(s.staff);
  await assert.rejects(s.pg.query('select * from list_payment_reviews($1,0,50)',[s.event]),/FORBIDDEN/);
  await s.pg.exec('reset role');
  const seen=new Set();
  const expected=(await s.pg.query("select s.id from payment_submissions s join applications a on a.id=s.application_id where a.event_id=$1 and s.status='under_review' order by s.created_at desc,s.id desc",[s.event])).rows.map(row=>row.id);
  await s.as(s.admin);
  for(let page=0;page<=10;page++) {
   const rows=(await s.pg.query('select * from list_payment_reviews($1,$2,50)',[s.event,page])).rows;
   assert.equal(rows.length,page===10?1:51);
   assert.deepEqual(rows.slice(0,50).map(row=>row.id),expected.slice(page*50,page*50+50));
   for(const row of rows.slice(0,50)) {assert.equal(row.application.email.startsWith('review-'),true);seen.add(row.id);}
   if(page===10) assert.equal(rows.length,1);
  }
  assert.equal(seen.size,501);
  await assert.rejects(s.pg.query('select * from list_payment_reviews($1,-1,50)',[s.event]),/INVALID_PAGE/);
  await assert.rejects(s.pg.query('select * from list_payment_reviews($1,0,101)',[s.event]),/INVALID_PAGE/);
  await assert.rejects(s.pg.query('select * from list_payment_reviews($1,0,50)',[otherEvent]),/FORBIDDEN/);
 } finally {await s.pg.close();}
});

test('receipt cannot finalize without a stored object and participants cannot certify their own upload',async()=>{
 const s=await setup(); try {
 const id=await receipt(s);
 await assert.rejects(s.pg.query('select finalize_payment_submission($1,$2,$3)',[id,s.participant,'a'.repeat(64)]),/permission denied/);
 await s.pg.exec('reset role'); await s.pg.exec('set role service_role');
 await assert.rejects(s.pg.query('select finalize_payment_submission($1,$2,$3)',[id,s.participant,'a'.repeat(64)]),/UPLOAD_MISSING/);
 }finally{await s.pg.close();}
});

test('payment rejects unsubmitted, stale, null reference and cancelled applications',async()=>{
 const s=await setup(); try {
 const id=await receipt(s); await s.as(s.admin);
 const pay=(version=1,reference='bank-regression')=>s.pg.query('select approve_payment($1,$2,100000,now(),$3,$4)',[id,reference,version,crypto.randomUUID()]);
 await assert.rejects(pay(),/NOT_REVIEWABLE/);
 await upload(s,id); await s.as(s.admin);
 await assert.rejects(pay(99),/STALE_PAYMENT/);
 await assert.rejects(pay(1,null),/INVALID_PAYMENT/);
 await s.pg.query("select revoke_participation($1,'İptal',true)",[s.app]);
 await assert.rejects(pay(),/APPLICATION_INACTIVE/);
 await s.pg.exec('reset role'); assert.equal((await s.pg.query('select count(*)::int n from qr_credentials')).rows[0].n,0);
 }finally{await s.pg.close();}
});

test('receipt versions increase and first acceptance works without configured amount',async()=>{
 const s=await setup(); try {
 await s.pg.query('update events set payment_amount_minor=null where id=$1',[s.event]); await s.as(s.admin);
 await s.pg.query('select accept_application($1,$2,1)',[s.app,s.committee]);
 await s.pg.exec('reset role');
 assert.equal((await s.pg.query('select payment_amount_minor from applications where id=$1',[s.app])).rows[0].payment_amount_minor,null);
 assert.equal((await s.pg.query('select count(*)::int n from qr_credentials where application_id=$1',[s.app])).rows[0].n,0);
 await s.pg.query('update events set payment_amount_minor=100000 where id=$1',[s.event]);
 await s.pg.query('update applications set payment_amount_minor=100000 where id=$1',[s.app]);
 const id=await receipt(s); await upload(s,id); await s.as(s.admin);
 await s.pg.query("select request_payment_correction($1,1,'Dekont okunamıyor')",[id]); await s.as(s.participant);
 const next=(await s.pg.query("select begin_payment_submission($1,'image/png',100) id",[s.app])).rows[0].id;
 assert.notEqual(id,next); assert.equal((await s.pg.query('select version from payment_submissions where id=$1',[next])).rows[0].version,2);
 }finally{await s.pg.close();}
});

test('payment snapshot, request identity, QR rotation and event binding are enforced',async()=>{
 const s=await setup(); try {
 const id=await receipt(s); await upload(s,id); await s.pg.exec('reset role');await s.pg.query('update events set payment_amount_minor=200000 where id=$1',[s.event]);
 await s.as(s.admin);const req=crypto.randomUUID();
 await s.pg.query('select approve_payment($1,$2,100000,now(),1,$3)',[id,'snapshot-payment',req]);
 await assert.rejects(s.pg.query('select approve_payment($1,$2,100001,now(),1,$3)',[id,'snapshot-payment',req]),/REQUEST_CONFLICT/);
 assert.equal((await s.pg.query('select rotate_qr($1) changed',[s.app])).rows[0].changed,true);
 await s.pg.exec('reset role');const code=(await s.pg.query('select raw_value from qr_credentials')).rows[0].raw_value;
 const other=(await s.pg.query("insert into events(name) values('Other') returning id")).rows[0].id;
 await s.pg.query('update events set check_in_open=true where id=$1',[other]);
 await s.pg.query("insert into staff_members(user_id,event_id,role) values($1,$2,'staff')",[s.staff,other]);
 const meal=(await s.pg.query("insert into meal_sessions(event_id,name,opens_at,closes_at,active) values($1,'Other',now()-interval '1 hour',now()+interval '1 hour',true) returning id",[other])).rows[0].id;
 await s.as(s.staff);assert.equal((await s.pg.query('select redeem_meal($1,$2,$3) result',[code,meal,crypto.randomUUID()])).rows[0].result.result,'invalid');
 }finally{await s.pg.close();}
});

test('legacy mail delivery cannot grant acceptance or issue an unpaid QR',async()=>{
 const s=await setup();try{
 const batch=crypto.randomUUID(); await s.pg.query('select queue_approval_batch($1,$2,$3::jsonb,$4)',[batch,s.admin,JSON.stringify([{applicationId:s.app,version:1,committeeId:s.committee,email:'p@test.com',subject:'Kabul',html:'Kabul',text:'Kabul'}]),'a'.repeat(64)]);
 const job=(await s.pg.query('select tag from mail_jobs limit 1')).rows[0];
 await s.pg.query('select record_mail_event($1,$2,$3,$4,$5,now())',['mail-safe',job.tag,'provider','p@test.com','delivered']);
 assert.equal((await s.pg.query('select status from applications where id=$1',[s.app])).rows[0].status,'accepted_pending_payment');
 assert.equal((await s.pg.query('select count(*)::int n from qr_credentials')).rows[0].n,0);
 }finally{await s.pg.close();}
});

test('immediate mail dispatch claims the selected batch before older work',async()=>{
 const s=await setup();try{
  const other=(await s.pg.query("insert into applications(event_id,first_name,last_name,email) values($1,'Başka','Kişi','other-queue@test.com') returning id",[s.event])).rows[0].id;
  const first=crypto.randomUUID(),selected=crypto.randomUUID();
  for(const [batch,application,email] of [[first,s.app,'p@test.com'],[selected,other,'other-queue@test.com']])
   await s.pg.query('select queue_approval_batch($1,$2,$3::jsonb,$4)',[batch,s.admin,JSON.stringify([{applicationId:application,version:1,committeeId:s.committee,email,subject:'Kabul',html:'Kabul',text:'Kabul'}]),crypto.randomUUID().replaceAll('-','').padEnd(64,'a')]);
  await s.pg.exec('set role service_role');
  const claimed=(await s.pg.query('select batch_id from claim_batch_mail_jobs($1,$2,1)',[crypto.randomUUID(),selected])).rows;
  assert.deepEqual(claimed.map(row=>row.batch_id),[selected]);
  await s.pg.exec('reset role');
  assert.equal((await s.pg.query('select status from mail_jobs where batch_id=$1',[first])).rows[0].status,'queued');
 }finally{await s.pg.close();}
});

test('corrected invitation preserves the original job and creates a fresh identity without QR',async()=>{
 const s=await setup();try{
  const batch=crypto.randomUUID();
  await s.pg.query('select queue_approval_batch($1,$2,$3::jsonb,$4)',[batch,s.admin,JSON.stringify([{applicationId:s.app,version:1,committeeId:s.committee,email:'p@test.com',subject:'Kabul',html:'Kabul',text:'Kabul'}]),'a'.repeat(64)]);
  const job=(await s.pg.query('select id from mail_jobs where application_id=$1',[s.app])).rows[0];
  await s.pg.query("update mail_jobs set status='failed',last_error='Geçersiz e-posta' where id=$1",[job.id]);
  await s.as(s.admin);
  assert.equal((await s.pg.query('select retry_participant_invite($1,$2) ok',[job.id,'corrected@test.com'])).rows[0].ok,true);
  assert.equal((await s.pg.query('select retry_participant_invite($1,$2) ok',[job.id,'corrected@test.com'])).rows[0].ok,false);
  await s.pg.exec('reset role');
  const application=(await s.pg.query('select status,email from applications where id=$1',[s.app])).rows[0];
  assert.equal(application.status,'accepted_pending_payment');assert.equal(application.email,'corrected@test.com');
  assert.equal((await s.pg.query('select count(*)::int n from qr_credentials')).rows[0].n,0);
  assert.equal((await s.pg.query('select count(*)::int n from mail_batches')).rows[0].n,2);
  const original=(await s.pg.query('select status,recipient_email from mail_jobs where id=$1',[job.id])).rows[0];
  assert.equal(original.status,'cancelled');assert.equal(original.recipient_email,'p@test.com');
  const fresh=(await s.pg.query("select recipient_email,kind from mail_jobs where id<>$1",[job.id])).rows[0];
  assert.equal(fresh.recipient_email,'corrected@test.com');assert.equal(fresh.kind,'participant_auth');
 }finally{await s.pg.close();}
});

test('participant membership needs a confirmed accepted email and does not grant staff access',async()=>{
 const s=await setup();try{
  await s.pg.exec('set role service_role');
  await assert.rejects(s.pg.query('select claim_participant_account($1)',[s.participant]),/FORBIDDEN/);
  await s.pg.exec('reset role');await s.as(s.admin);await s.pg.query('select accept_application($1,$2,1)',[s.app,s.committee]);
  await s.pg.exec('reset role');await s.pg.exec('set role service_role');
  assert.equal((await s.pg.query('select claim_participant_account($1) id',[s.participant])).rows[0].id,s.app);
  assert.equal((await s.pg.query('select claim_participant_account($1) id',[s.participant])).rows[0].id,s.app);
  await s.pg.exec('reset role');
  assert.equal((await s.pg.query('select count(*)::int n from participant_memberships')).rows[0].n,1);
  await s.as(s.participant);
  assert.equal((await s.pg.query("select private.staff_for_event($1) allowed",[s.event])).rows[0].allowed,false);
 }finally{await s.pg.close();}
});

test('first acceptance is durable, idempotent, and never creates a QR; only payment confirms',async()=>{
 const s=await setup();const {pg,app,committee,admin,participant,as}=s;
 try{
 await as(participant);await assert.rejects(pg.query('select accept_application($1,$2,1)',[app,committee]),/FORBIDDEN/);
 await as(admin);await pg.query('select accept_application($1,$2,1)',[app,committee]);await pg.query('select accept_application($1,$2,1)',[app,committee]);
 await pg.exec('reset role');assert.equal((await pg.query('select count(*)::int n from participant_invites')).rows[0].n,1);
 assert.equal((await pg.query("select count(*)::int n from mail_jobs where application_id=$1 and kind='acceptance'",[app])).rows[0].n,1);
 assert.equal((await pg.query('select count(*)::int n from qr_credentials')).rows[0].n,0);
 assert.equal((await pg.query('select status from applications')).rows[0].status,'accepted_pending_payment');
 await pg.query('insert into participant_memberships(user_id,application_id) values($1,$2)',[participant,app]);
 await as(participant);const submission=(await pg.query("select begin_payment_submission($1,'image/png',100) id",[app])).rows[0].id;
 await upload(s,submission);
 await as(admin);await assert.rejects(pg.query('select approve_payment($1,$2,$3,now(),1,$4)',[submission,'bank-1',1,crypto.randomUUID()]),/INSUFFICIENT/);
 const requestId=crypto.randomUUID();const paidAt='2026-10-01T12:00:00+03:00';
 await pg.query('select approve_payment($1,$2,$3,$4,1,$5)',[submission,'bank-1',100000,paidAt,requestId]);
 await pg.query('select approve_payment($1,$2,$3,$4,1,$5)',[submission,'bank-1',100000,paidAt,requestId]);
 await assert.rejects(pg.query('select approve_payment($1,$2,$3,$4,1,$5)',[submission,'bank-1',100000,'2026-10-01T12:01:00+03:00',requestId]),/REQUEST_CONFLICT/);
 await pg.exec('reset role');assert.equal((await pg.query('select status from applications')).rows[0].status,'confirmed');
 assert.equal((await pg.query('select count(*)::int n from qr_credentials where active')).rows[0].n,1);
 assert.equal((await pg.query("select count(*)::int n from mail_jobs where kind='confirmation'")).rows[0].n,1);
 await as(participant);assert.equal((await pg.query('select count(*)::int n from applications')).rows[0].n,1);
 await assert.rejects(pg.query("update applications set status='confirmed'"),/permission denied/);
 }finally{await pg.close();}
});

test('meal redemption is per participant and meal; staff cannot see receipts; cancellation disables QR',async()=>{
 const s=await setup();const {pg,app,committee,admin,participant,staff,event,as}=s;
 try{
 await as(admin);await pg.query('select accept_application($1,$2,1)',[app,committee]);
 await pg.exec('reset role');await pg.query('insert into participant_memberships values($1,$2,now())',[participant,app]);
 await as(participant);const submission=(await pg.query("select begin_payment_submission($1,'application/pdf',100) id",[app])).rows[0].id;
 await upload(s,submission);
 await as(admin);await pg.query('select approve_payment($1,$2,100000,now(),1,$3)',[submission,'bank-2',crypto.randomUUID()]);
 await pg.exec('reset role');const code=(await pg.query('select raw_value from qr_credentials')).rows[0].raw_value;
 const meal=(await pg.query("insert into meal_sessions(event_id,name,opens_at,closes_at,active) values($1,'Öğle',now()-interval '1 hour',now()+interval '1 hour',true) returning id",[event])).rows[0].id;
 await as(staff);assert.equal((await pg.query('select count(*)::int n from payment_submissions')).rows[0].n,0);
 const req=crypto.randomUUID();let r=(await pg.query('select redeem_meal($1,$2,$3) result',[code,meal,req])).rows[0].result;assert.equal(r.result,'recorded');
 await pg.exec('reset role');await pg.query('update events set check_in_open=false where id=$1',[event]);await as(staff);
 assert.equal((await pg.query('select redeem_meal($1,$2,$3) result',[code,meal,crypto.randomUUID()])).rows[0].result.result,'closed');
 assert.equal((await pg.query('select redeem_meal($1,$2,$3) result',[code,meal,req])).rows[0].result.result,'recorded');
 await pg.exec('reset role');await pg.query('update events set check_in_open=true where id=$1',[event]);await as(staff);
 await assert.rejects(pg.query('select redeem_meal($1,$2,$3)', ['FAKECODE000',meal,req]),/REQUEST_CONFLICT/);
 r=(await pg.query('select redeem_meal($1,$2,$3) result',[code,meal,req])).rows[0].result;assert.equal(r.result,'recorded');
 r=(await pg.query('select redeem_meal($1,$2,$3) result',[code,meal,crypto.randomUUID()])).rows[0].result;assert.equal(r.result,'already');assert.ok(r.checkedInAt);
 await as(admin);await pg.query('select rotate_qr($1)',[app]);await pg.exec('reset role');const newCode=(await pg.query('select raw_value from qr_credentials')).rows[0].raw_value;
 await as(staff);assert.equal((await pg.query('select redeem_meal($1,$2,$3) result',[newCode,meal,crypto.randomUUID()])).rows[0].result.result,'already');
 await pg.exec('reset role');await pg.query('update meal_sessions set active=false where id=$1',[meal]);
 await as(staff);assert.equal((await pg.query('select redeem_meal($1,$2,$3) result',[code,meal,req])).rows[0].result.result,'recorded');
 await pg.exec('reset role');
 const second=(await pg.query("insert into meal_sessions(event_id,name,opens_at,closes_at,active) values($1,'Akşam',now()-interval '1 hour',now()+interval '1 hour',true) returning id",[event])).rows[0].id;
 await as(staff);assert.equal((await pg.query('select redeem_meal($1,$2,$3) result',[newCode,meal,crypto.randomUUID()])).rows[0].result.result,'closed');
 assert.equal((await pg.query('select redeem_meal($1,$2,$3) result',[newCode,second,crypto.randomUUID()])).rows[0].result.result,'recorded');
 await as(admin);await pg.query("select revoke_participation($1,'İptal',true)",[app]);
 await as(staff);assert.equal((await pg.query('select redeem_meal($1,$2,$3) result',[newCode,second,crypto.randomUUID()])).rows[0].result.result,'inactive');
 }finally{await pg.close();}
});
