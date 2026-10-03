import test from 'node:test';
import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {loadWorker,fakeDb,job,batchId,provider} from '../helpers/mail-worker.mjs';
function fixture({existing=false,storeError=false}={}){
 const candidate={...job,application_id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',kind:'acceptance'};
 const jobs=[candidate];const db=fakeDb(jobs);const base=db.rpc;let row=null,generated=0,sends=0;
 db.auth={admin:{generateLink:async()=>{generated++;return {data:{properties:{hashed_token:'opaque-token-for-real-worker'},user:{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'}},error:null};}}};
 db.rpc=async(name,args)=>{
  if(name==='read_participant_auth_mail')return {data:row?[row]:[],error:null};
  if(name==='begin_participant_auth_preparation')return {data:[{application_id:candidate.application_id,recipient_email:candidate.recipient_email,portal_url:'https://example.com/katilimci',auth_user_id:existing?'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb':null,email_confirmed:existing,purpose:'activate'}],error:null};
  if(name==='store_bound_participant_auth_mail'){
   row={job_id:args.p_job_id,application_id:args.p_application_id,recipient_email:candidate.recipient_email,nonce:args.p_nonce,ciphertext:args.p_ciphertext,auth_tag:args.p_auth_tag,expires_at:args.p_expires_at.replace('Z','+00:00'),auth_type:args.p_type,token_fingerprint:args.p_fingerprint};
   return {data:!storeError,error:storeError?Error('commit acknowledgement lost'):null};
  }
  return base(name,args);
 };
 const key=randomBytes(32).toString('base64');
 const worker=loadWorker({db,env:{AUTH_MAIL_PAYLOAD_KEY:key},fetchImpl:provider(()=>{sends++;return new Response('{"messageId":"<message@brevo>"}',{status:201});})});
 return {worker,db,jobs,get generated(){return generated;},get sends(){return sends;},get row(){return row;},expire(){row.expires_at=new Date(Date.now()-1000).toISOString();},retry(){jobs.push(candidate);}};
}
test('acceptance worker generates once, stores a bound invite, and safely reuses the encrypted link on retry',async()=>{
 const f=fixture();assert.equal((await f.worker({batchId,limit:1})).status,200);assert.equal(f.sends,1);assert.equal(f.row.auth_type,'invite');
 f.retry();assert.equal((await f.worker({batchId,limit:1})).status,200);assert.equal(f.generated,1);assert.equal(f.sends,2);
});
test('existing Auth identity gets a magiclink and preserves its password',async()=>{const f=fixture({existing:true});await f.worker({batchId,limit:1});assert.equal(f.row.auth_type,'magiclink');assert.equal(f.sends,1);});
test('reconciliation-only worker invocation never generates a token or sends an email',async()=>{
 const f=fixture();f.db.from=()=>({select(){return this;},in(){return this;},lte(){return this;},order(){return this;},limit:async()=>({data:[],error:null}),update:()=>({eq:async()=>({error:null})})});
 const response=await f.worker({action:'reconcile'});assert.equal(response.status,200);assert.equal(f.generated,0);assert.equal(f.sends,0);
});
test('ambiguous payload storage never calls the mail provider',async()=>{const f=fixture({storeError:true});await f.worker({batchId,limit:1});assert.equal(f.generated,1);assert.equal(f.sends,0);assert.equal(f.db.marks[0].p_status,'failed');});
test('expired persisted payload is terminal and cannot silently regenerate a link',async()=>{const f=fixture();await f.worker({batchId,limit:1});f.expire();f.retry();await f.worker({batchId,limit:1});assert.equal(f.generated,1);assert.equal(f.sends,1);assert.equal(f.db.marks.at(-1).p_status,'failed');});
