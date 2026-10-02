import test from 'node:test';
import assert from 'node:assert/strict';
import { loadWorker, fakeDb, batchId, job, provider } from '../helpers/mail-worker.mjs';

test('health rejects a Brevo key that the live provider rejects', async () => {
  const db = fakeDb();
  const handler = loadWorker({ db, fetchImpl: async () => new Response('{"code":"unauthorized","message":"Key not found"}', { status: 401 }) });
  const response = await handler({ action: 'health' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'BREVO_AUTH_REJECTED');
  assert.equal(db.claims.length, 0);
});

test('health rejects inactive senders before creating any send attempt', async () => {
  const handler = loadWorker({ db: fakeDb(), fetchImpl: async (url) => String(url).endsWith('/account')
    ? Response.json({ relay: { enabled: true } }) : Response.json({ senders: [{ email: 'sender@example.com', active: false }] }) });
  const response = await handler({ action: 'health' });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'BREVO_SENDER_INACTIVE');
});

test('wrong bearer and disabled worker never reach provider or database', async () => {
  const db = fakeDb();
  const handler = loadWorker({ db, env: { MAIL_QUEUE_ENABLED: 'false' } });
  assert.equal((await handler({ action: 'health' }, 'wrong')).status, 401);
  assert.equal((await (await handler({ action: 'health' })).json()).enabled, false);
  assert.equal(db.claims.length, 0);
});

test('malformed targeted requests cannot fall back to draining the entire queue', async () => {
  for (const body of [null, [], { batchId: null, limit: 1 }, { batchId: 123, limit: 1 },
    { batchId: 'bad', limit: 1 }, { batchId, limit: 0 }, { batchId, limit: 21 }, { batchId, limit: 1.5 },
    { action: 'unknown' }, { unexpected: 'input' }, 'broken-json']) {
    const db = fakeDb();
    const response = await loadWorker({ db, fetchImpl: provider() })(body);
    assert.equal(response.status, 400, JSON.stringify(body));
    assert.equal(db.claims.length, 0);
  }
});

test('incomplete or unverified settings stop before sending', async () => {
  for (const env of [{ MAIL_ENV: 'invalid' }, { BREVO_CONTRACT_VERIFIED: 'false' }, { BREVO_API_KEY: '' },
    { MAIL_ENV: 'test', MAIL_TEST_ALLOWLIST: '' }]) {
    const db = fakeDb();
    const response = await loadWorker({ db, env })({ batchId, limit: 1 });
    assert.equal(response.status, 503); assert.equal(db.claims.length, 0);
  }
});

test('test-mode allowlist rejects unrelated recipients without touching Brevo', async () => {
  const db = fakeDb([{ ...job }]);
  const response = await loadWorker({ db, env: { MAIL_ENV: 'test', MAIL_TEST_ALLOWLIST: 'other@example.com' } })({ batchId, limit: 1 });
  assert.equal((await response.json()).failed, 1);
  assert.equal(db.marks[0].p_status, 'failed');
});

test('a configured recipient allowlist also protects controlled production tests', async () => {
  const db = fakeDb([{ ...job }]);
  const response = await loadWorker({ db, env: { MAIL_TEST_ALLOWLIST: 'other@example.com' }, fetchImpl: provider() })({ batchId, limit: 1 });
  const result = await response.json();
  assert.equal(result.accepted, 0);
  assert.equal(result.failed, 1);
});

test('a database claim error is explicit and cannot be reported as a successful zero-send batch', async () => {
  const db = { rpc: async () => ({ data: null, error: { message: 'database unavailable' } }) };
  const response = await loadWorker({ db })({ batchId, limit: 1 });
  assert.equal(response.status, 503);
  assert.equal((await response.json()).code, 'MAIL_QUEUE_UNAVAILABLE');
});

test('targeted sending calls only that batch and persists provider acceptance', async () => {
  const db = fakeDb([{ ...job }]);
  const response = await loadWorker({ db, fetchImpl: provider() })({ batchId, limit: 3 });
  const result = await response.json();
  assert.equal(response.status, 200);
  assert.equal(result.accepted, 1);
  assert.equal(result.processed, 1);
  assert.equal(db.claims.every((claim) => claim.name === 'claim_batch_mail_jobs' && claim.args.p_batch_id === batchId), true);
  assert.equal(db.marks[0].p_status, 'provider_accepted');
  assert.equal(db.marks[0].p_message_id, '<message@brevo>');
});

test('unpersisted provider acceptance is reported as uncertain, never as success', async () => {
  for (const mark of [{ data: false, error: null }, { data: null, error: { message: 'database unavailable' } }]) {
    const db = fakeDb([{ ...job }], mark);
    const response = await loadWorker({ db, fetchImpl: provider() })({ batchId, limit: 1 });
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.accepted, 0);
    assert.equal(body.code, 'MAIL_RESULT_UNCONFIRMED');
  }
});

test('quota, rate and account rejection stop the batch with an explicit blocked result', async () => {
  for (const [status, code, want] of [[400, 'not_enough_credits', 'quota_wait'], [429, 'too_many_requests', 'queued'], [401, 'unauthorized', 'queued']]) {
    const db = fakeDb([{ ...job }, { ...job, id: crypto.randomUUID() }]);
    const response = await loadWorker({ db, fetchImpl: provider(() => new Response(JSON.stringify({ code }), { status })) })({ batchId, limit: 3 });
    const body = await response.json();
    assert.equal(body.accepted, 0);
    assert.equal(body.processed, 1);
    assert.equal(body.blocked, true);
    assert.ok(body.error);
    assert.equal(db.marks[0].p_status, want);
    assert.equal(db.claims.length, 1);
  }
});

test('timeouts remain uncertain and do not instruct a resend', async () => {
  const db = fakeDb([{ ...job }]);
  const response = await loadWorker({ db, fetchImpl: provider(() => { throw Error('timeout'); }) })({ batchId, limit: 1 });
  assert.equal(db.marks[0].p_status, 'uncertain');
  const body = await response.json();
  assert.equal(body.accepted, 0);
  assert.equal(body.uncertain, 1);
});
