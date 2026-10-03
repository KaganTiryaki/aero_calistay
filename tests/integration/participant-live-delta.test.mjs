import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync,readdirSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';import {restoreCapturedSchema} from '../helpers/live-schema.mjs';
test('reviewed participant delta applies to captured live schema without converting existing approvals or mail jobs',async()=>{
 const pg=await PGlite.create({extensions:{pgcrypto}});try{
 await pg.exec("create schema auth;create schema extensions;create role anon;create role authenticated;create role service_role bypassrls;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create schema storage;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;");
 await restoreCapturedSchema({query:sql=>pg.exec(sql)});
 const user=crypto.randomUUID();await pg.query("insert into auth.users values($1,'admin@test.com',now())",[user]);
 const event=(await pg.query("insert into events(name) values('Captured event') returning id")).rows[0].id;await pg.query("insert into staff_members(user_id,event_id,role) values($1,$2,'admin')",[user,event]);
 const app=(await pg.query("insert into applications(event_id,first_name,last_name,email,status) values($1,'Old','Test','old@test.com','approval_queued') returning id",[event])).rows[0].id;
 const dir=new URL('../../supabase/migrations/',import.meta.url),files=readdirSync(dir).filter(x=>x>='202610030002_'&&x.endsWith('.sql')).sort();
 for(const file of files){await pg.exec('begin');await pg.exec(readFileSync(new URL(file,dir),'utf8'));await pg.exec('commit');}
 assert.equal((await pg.query('select status from applications where id=$1',[app])).rows[0].status,'approval_queued');assert.equal((await pg.query('select count(*)::integer n from qr_credentials')).rows[0].n,0);
 assert.equal((await pg.query('select participant_rollout_enabled from events where id=$1',[event])).rows[0].participant_rollout_enabled,false);
 assert.equal((await pg.query("select public from storage.buckets where id='participant-receipts'")).rows[0].public,false);
 }finally{await pg.close();}
});
