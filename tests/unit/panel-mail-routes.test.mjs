import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createRequire } from 'node:module';
import { loadPanelRoute, panelDb, staff, batchId, selection, ready } from '../helpers/panel-route.mjs';
const {NextRequest}=createRequire(import.meta.url)('next/server');

test('unavailable Brevo leaves a new application untouched and returns the real diagnosis', async () => {
  const db = panelDb();
  const route = loadPanelRoute('batches', { db, staff, worker: async () => ({ ...ready, ready: false, code: 'BREVO_AUTH_REJECTED', error: 'Brevo erişimi reddetti.' }) });
  const response = await route.POST(route.request({ batchId, selections: [selection] }));
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'BREVO_AUTH_REJECTED');
  assert.equal(db.mutations.length, 0);
});

test('unauthenticated, non-admin and cross-origin users cannot send or queue a mail', async () => {
  for (const [who, origin] of [[null, 'https://test.example.com'], [{ ...staff, role: 'staff' }, 'https://test.example.com'], [staff, 'https://attacker.example.com']]) {
    const db = panelDb(); let called = false;
    const route = loadPanelRoute('batches', { db, staff: who, worker: async () => { called = true; return ready; } });
    assert.equal((await route.POST(route.request({ batchId, selections: [selection] }, origin))).status, 403);
    assert.equal(called, false); assert.equal(db.mutations.length, 0);
  }
});

test('an idempotent repeat reports persisted acceptance instead of saying zero emails succeeded', async () => {
  const hash = createHash('sha256').update(JSON.stringify([selection])).digest('hex');
  const db = panelDb({ batch: { event_id: staff.eventId, created_by: staff.userId, request_hash: hash },
    jobs: [{ status: 'provider_accepted', delivery_status: 'unknown', last_error: null }] });
  const route = loadPanelRoute('batches', { db, staff, worker: async () => ready });
  const response = await route.POST(route.request({ batchId, selections: [selection] }));
  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.acceptedTotal, 1);
  assert.equal(body.pending, 0);
  assert.equal(db.mutations.length, 0);
});

test('replaying an existing batch checks provider access but never sends queued mail', async () => {
  const hash = createHash('sha256').update(JSON.stringify([selection])).digest('hex');
  const db = panelDb({ batch: { event_id: staff.eventId, created_by: staff.userId, request_hash: hash },
    jobs: [{ status: 'queued', delivery_status: 'unknown', last_error: null }] });
  const calls = [];
  const route = loadPanelRoute('batches', { db, staff, worker: async (input) => {
    calls.push(input); return { ...ready, ready: false, error: 'Brevo erişimi reddetti.' };
  } });
  assert.equal((await route.POST(route.request({ batchId, selections: [selection] }))).status, 503);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ action: 'health' }]);
  assert.equal(db.mutations.length, 0);
});

test('a successful replay reads its queued jobs without dispatching again',async()=>{
  const hash=createHash('sha256').update(JSON.stringify([selection])).digest('hex');
  const db=panelDb({batch:{event_id:staff.eventId,created_by:staff.userId,request_hash:hash},jobs:[{status:'queued',delivery_status:'unknown',last_error:null}]});
  const calls=[];const route=loadPanelRoute('batches',{db,staff,worker:async(input)=>{calls.push(input);return ready;}});
  const response=await route.POST(route.request({batchId,selections:[selection]}));
  assert.equal(response.status,200);assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{action:'health'}]);
  assert.equal((await response.json()).canContinue,true);
});

test('checking one batch by GET never creates or dispatches it',async()=>{
  const db=panelDb({batch:{id:batchId,event_id:staff.eventId,created_by:staff.userId},jobs:[{status:'queued',delivery_status:'unknown',last_error:null}]});
  const calls=[];const route=loadPanelRoute('batches',{db,staff,worker:async(input)=>{calls.push(input);return ready;}});
  const response=await route.GET(new NextRequest(`https://test.example.com/api/panel/batches?batchId=${batchId}`));
  assert.equal(response.status,200);
  const body=await response.json();assert.equal(body.batchId,batchId);assert.equal(body.pending,1);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)),[{action:'health'}]);assert.equal(db.mutations.length,0);
});

test('four candidates create one batch and the first worker step is capped at three',async()=>{
  const people=Array.from({length:4},(_,index)=>({id:`44444444-4444-4444-8444-${String(index).padStart(12,'0')}`,first_name:'Test',last_name:String(index),email:`person${index}@example.com`,status:'pending',version:1}));
  const selections=people.map((person)=>({applicationId:person.id,version:1,committeeId:selection.committeeId}));
  const db=panelDb({apps:people});const calls=[];
  const route=loadPanelRoute('batches',{db,staff,worker:async(input)=>{calls.push(input);return ready;}});
  const response=await route.POST(route.request({batchId,selections}));
  assert.equal(response.status,200);
  assert.equal(db.mutations.filter((item)=>item.name==='queue_approval_batch').length,1);
  assert.equal(db.mutations[0].args.p_jobs.length,4);
  assert.ok(calls.some((input)=>input.batchId===batchId&&input.limit===3));
});

test('new mixed-committee batch is rejected before the transaction',async()=>{
  const people=[selection,{applicationId:'44444444-4444-4444-8444-000000000002',version:1,committeeId:'66666666-6666-4666-8666-666666666666'}];
  const db=panelDb();const route=loadPanelRoute('batches',{db,staff,worker:async()=>ready});
  assert.equal((await route.POST(route.request({batchId,selections:people}))).status,400);
  assert.equal(db.mutations.length,0);
});

test('a batch larger than 500 is rejected before contacting the worker',async()=>{
  const selections=Array.from({length:501},(_,index)=>({applicationId:`44444444-4444-4444-8444-${String(index).padStart(12,'0')}`,version:1,committeeId:selection.committeeId}));
  const db=panelDb();let calls=0;
  const route=loadPanelRoute('batches',{db,staff,worker:async()=>{calls++;return ready;}});
  assert.equal((await route.POST(route.request({batchId,selections}))).status,400);
  assert.equal(calls,0);assert.equal(db.mutations.length,0);
});

test('batch identity conflicts cannot trigger the worker', async () => {
  const db = panelDb({ batch: { event_id: staff.eventId, created_by: staff.userId, request_hash: 'wrong-hash' } }); let calls = 0;
  const route = loadPanelRoute('batches', { db, staff, worker: async () => { calls++; return ready; } });
  assert.equal((await route.POST(route.request({ batchId, selections: [selection] }))).status, 409);
  assert.equal(calls, 0);
});

test('manual retry checks the event boundary before health and sends at most three at once', async () => {
  const calls = [], db = panelDb({ batch: { id: batchId }, jobs:[{status:'queued',delivery_status:'unknown',last_error:null}] });
  const route = loadPanelRoute('dispatch-mail', { db, staff, worker: async (input) => { calls.push(input); return ready; } });
  const response = await route.POST(route.request({ batchId }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ action: 'health' }, { batchId, limit: 3 }]);
  const body=await response.json();
  assert.equal(body.batchId,batchId);
  assert.equal(typeof body.dispatchReady,'boolean');
  assert.equal(typeof body.canContinue,'boolean');
  assert.ok(db.queries[0].filters.some(([field, value]) => field === 'event_id' && value === staff.eventId));
});

test('manual continuation does not send queued jobs while another result is uncertain',async()=>{
  const db=panelDb({batch:{id:batchId},jobs:[{status:'queued',delivery_status:'unknown',last_error:null},{status:'uncertain',delivery_status:'unknown',last_error:null}]});
  let calls=0;const route=loadPanelRoute('dispatch-mail',{db,staff,worker:async()=>{calls++;return ready;}});
  assert.equal((await route.POST(route.request({batchId}))).status,409);
  assert.equal(calls,0);
});

test('invalid or missing batches never trigger sending', async () => {
  for (const [body, expected] of [[{ batchId: 'bad' }, 400], [{ batchId }, 404]]) {
    let calls = 0;
    const route = loadPanelRoute('dispatch-mail', { db: panelDb(), staff, worker: async () => { calls++; return ready; } });
    assert.equal((await route.POST(route.request(body))).status, expected);
    assert.equal(calls, 0);
  }
});
