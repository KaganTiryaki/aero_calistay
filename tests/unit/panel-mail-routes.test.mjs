import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { loadPanelRoute, panelDb, staff, batchId, selection, ready } from '../helpers/panel-route.mjs';

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

test('replaying an existing batch still checks provider access before sending', async () => {
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

test('batch identity conflicts cannot trigger the worker', async () => {
  const db = panelDb({ batch: { event_id: staff.eventId, created_by: staff.userId, request_hash: 'wrong-hash' } }); let calls = 0;
  const route = loadPanelRoute('batches', { db, staff, worker: async () => { calls++; return ready; } });
  assert.equal((await route.POST(route.request({ batchId, selections: [selection] }))).status, 409);
  assert.equal(calls, 0);
});

test('manual retry checks the event boundary before health and sends at most three at once', async () => {
  const calls = [], db = panelDb({ batch: { id: batchId } });
  const route = loadPanelRoute('dispatch-mail', { db, staff, worker: async (input) => { calls.push(input); return ready; } });
  const response = await route.POST(route.request({ batchId }));
  assert.equal(response.status, 200);
  assert.deepEqual(JSON.parse(JSON.stringify(calls)), [{ action: 'health' }, { batchId, limit: 3 }]);
  assert.ok(db.queries[0].filters.some(([field, value]) => field === 'event_id' && value === staff.eventId));
});

test('invalid or missing batches never trigger sending', async () => {
  for (const [body, expected] of [[{ batchId: 'bad' }, 400], [{ batchId }, 404]]) {
    let calls = 0;
    const route = loadPanelRoute('dispatch-mail', { db: panelDb(), staff, worker: async () => { calls++; return ready; } });
    assert.equal((await route.POST(route.request(body))).status, expected);
    assert.equal(calls, 0);
  }
});
