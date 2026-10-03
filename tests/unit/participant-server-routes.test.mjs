import test from 'node:test';import assert from 'node:assert/strict';import {loadServerRoute} from '../helpers/server-route.mjs';
const user={id:'user-a',email:'p@example.com',email_confirmed_at:'now'};
test('login refuses inactive applications, signs out the new session, and resets limits after successful claim',async()=>{
 for(const active of [false,true]){const calls=[];const db={rpc:async(name)=>{calls.push(name);return name==='check_participant_auth_attempt'?{data:[{allowed:true}],error:null}:name==='claim_participant_account'?{data:active?'app':null,error:active?null:Error('FORBIDDEN')}:{data:null,error:null};}};
 const f=loadServerRoute('participant/login',{db,server:{auth:{signInWithPassword:async()=>({data:{user},error:null}),signOut:async()=>calls.push('signout')}}});const response=await f.POST(f.request({email:'p@example.com',password:'a-password'}));assert.equal(response.status,active?200:403);assert.equal(calls.includes('signout'),!active);}
});
test('password save retries with a verified proof but never verifies the consumed token again',async()=>{
 let saved=0,claims=0;const proof={userId:user.id,jobId:'job',fingerprint:'fingerprint',type:'invite',audience:'participant'};
 const f=loadServerRoute('participant/activate',{proof,db:{rpc:async name=>{if(name==='claim_participant_account')claims++;return {data:true,error:null};}},server:{auth:{getUser:async()=>({data:{user},error:null}),updateUser:async()=>({error:++saved===1?{status:503}:null})}}});
 assert.equal((await f.POST(f.request({password:'long-safe-password'}))).status,503);assert.deepEqual(f.calls,[]);
 assert.equal((await f.POST(f.request({password:'long-safe-password'}))).status,200);assert.equal(saved,2);assert.equal(claims,1);assert.deepEqual(f.calls,['cleared']);
});
test('password cannot change for another session, a revoked invitation, or a short password',async()=>{
 for(const options of [{current:{...user,id:'other'},valid:true,password:'long-safe-password'},{current:user,valid:false,password:'long-safe-password'},{current:user,valid:true,password:'short'}]){
  let writes=0;const f=loadServerRoute('participant/activate',{proof:{userId:user.id,audience:'participant'},db:{rpc:async()=>({data:options.valid,error:null})},server:{auth:{getUser:async()=>({data:{user:options.current},error:null}),updateUser:async()=>{writes++;return {error:null};}}}});
  assert.ok((await f.POST(f.request({password:options.password}))).status>=400);assert.equal(writes,0);
 }
});
test('closed production server gate stops auth before external dependencies',async()=>{const f=loadServerRoute('participant/login',{env:{NODE_ENV:'production'}});assert.equal((await f.POST(f.request({email:'p@example.com',password:'long-safe-password'}))).status,503);});
test('staff can save an activation password while participant rollout is closed',async()=>{
 const f=loadServerRoute('participant/activate',{env:{NODE_ENV:'production'},proof:{userId:user.id,audience:'staff'},db:{rpc:async()=>({data:true,error:null})},server:{auth:{getUser:async()=>({data:{user},error:null}),updateUser:async()=>({error:null})}}});
 assert.equal((await f.POST(f.request({password:'long-safe-password'}))).status,200);
});
test('auth link reserves a job before dispatch and never generates tokens in the HTTP route',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:name==='reserve_participant_auth_link'?[{allowed:true}]:'batch',error:null};}};
 const f=loadServerRoute('participant/auth-link',{db,worker:async input=>{calls.push({name:input.action??'dispatch'});return {ready:true,failed:0};}});
 const response=await f.POST(f.request({email:'p@example.com',purpose:'activate'}));assert.equal(response.status,202);assert.deepEqual(calls.map(x=>x.name),['reserve_participant_auth_link','health','request_participant_auth_mail','dispatch']);assert.equal(calls[2].args.p_purpose,'activate');
});
test('auth link limits use Retry-After and unavailable DB/provider do not claim success',async()=>{
 for(const mode of ['limit','db','provider']){const f=loadServerRoute('participant/auth-link',{db:{rpc:async()=>({data:[{allowed:mode!=='limit',wait_seconds:72}],error:mode==='db'?Error('offline'):null})},worker:async()=>({ready:false})});const response=await f.POST(f.request({email:'p@example.com',purpose:'recovery'}));assert.equal(response.status,mode==='limit'?429:503);if(mode==='limit')assert.equal(response.headers.get('Retry-After'),'72');}
});
test('staff activation validates its staff role instead of participant membership',async()=>{
 const calls=[];const f=loadServerRoute('auth/staff-activate',{db:{rpc:async name=>{calls.push(name);return {data:name==='check_participant_auth_attempt'?[{allowed:true}]:true,error:null};}},server:{auth:{getUser:async()=>({data:{user:null},error:null}),verifyOtp:async()=>({data:{user},error:null})}}});
 const response=await f.POST(f.request({tokenHash:'a'.repeat(32),type:'magiclink'}));assert.equal(response.status,200);assert.equal((await response.json()).setPassword,false);assert.ok(calls.includes('validate_staff_activation'));assert.equal(calls.includes('claim_participant_account'),false);
});
test('a default-provider staff session still requires an active staff role before setting a password',async()=>{
 for(const active of [false,true]){
  const f=loadServerRoute('auth/staff-activate',{db:{rpc:async name=>({data:name==='check_participant_auth_attempt'?[{allowed:true}]:active,error:null})},server:{auth:{getUser:async()=>({data:{user},error:null}),signOut:async()=>{}}}});
  assert.equal((await f.POST(f.request({session:true,type:'invite'}))).status,active?200:403);
 }
});
test('internal rollout probe rejects missing or wrong bearer before reaching services',async()=>{
 const f=loadServerRoute('internal/participant-rollout',{env:{PARTICIPANT_ROLLOUT_MONITOR_SECRET:'test-monitor-key-at-least-32-characters'}});
 assert.equal((await f.POST(f.request({}))).status,401);
});
