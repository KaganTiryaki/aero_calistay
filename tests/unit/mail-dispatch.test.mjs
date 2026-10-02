import test from 'node:test';
import assert from 'node:assert/strict';
import { callMailWorker } from '../../lib/mail/dispatch.ts';

const batchId = '11111111-1111-4111-8111-111111111111';
async function withWorker(response, fn) {
  const priorFetch = globalThis.fetch;
  const priorUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const priorSecret = process.env.MAIL_QUEUE_SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
  process.env.MAIL_QUEUE_SECRET = 'test-secret';
  globalThis.fetch = response;
  try { await fn(); } finally {
    globalThis.fetch = priorFetch;
    if (priorUrl === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL; else process.env.NEXT_PUBLIC_SUPABASE_URL = priorUrl;
    if (priorSecret === undefined) delete process.env.MAIL_QUEUE_SECRET; else process.env.MAIL_QUEUE_SECRET = priorSecret;
  }
}

test('provider authentication diagnosis reaches the panel without exposing credentials', async () => {
  await withWorker(async () => Response.json({ enabled: false, code: 'BREVO_AUTH_REJECTED', error: 'Brevo erişimi reddetti.' }, { status: 503 }), async () => {
    const result = await callMailWorker({ action: 'health' });
    assert.equal(result.ready, false);
    assert.equal(result.code, 'BREVO_AUTH_REJECTED');
    assert.equal(result.error, 'Brevo erişimi reddetti.');
    assert.equal(JSON.stringify(result).includes('test-secret'), false);
  });
});

test('worker counters must be nonnegative integers within the requested batch limit', async () => {
  for (const reply of [null, { enabled: true, processed: -1, accepted: 0 },
    { enabled: true, processed: 1, accepted: '1' }, { enabled: true, processed: 1, accepted: 2 },
    { enabled: true, processed: 4, accepted: 4 }, { enabled: true, processed: 1.5, accepted: 1 }]) {
    await withWorker(async () => Response.json(reply), async () => {
      assert.equal((await callMailWorker({ batchId, limit: 3 })).ready, false, JSON.stringify(reply));
    });
  }
});

test('a blocked batch remains explicit even when the worker request itself succeeds', async () => {
  await withWorker(async () => Response.json({ enabled: true, processed: 1, accepted: 0, blocked: true, error: 'Günlük e-posta hakkı doldu.' }), async () => {
    const result = await callMailWorker({ batchId, limit: 3 });
    assert.equal(result.ready, true);
    assert.equal(result.blocked, true);
    assert.equal(result.accepted, 0);
    assert.ok(result.error);
  });
});

test('dispatch transmits only the requested batch with private bearer and no-store', async () => {
  await withWorker(async (url, init) => {
    assert.equal(String(url), 'https://test.supabase.co/functions/v1/process-mail-queue');
    assert.equal(init.headers.Authorization, 'Bearer test-secret');
    assert.equal(init.cache, 'no-store');
    assert.deepEqual(JSON.parse(init.body), { batchId, limit: 3 });
    return Response.json({ enabled: true, processed: 1, accepted: 1 });
  }, async () => {
    const result = await callMailWorker({ batchId, limit: 3 });
    assert.equal(result.ready, true);
    assert.equal(result.accepted, 1);
  });
});

test('timeout, non-JSON and missing environment never claim confirmed success', async () => {
  for (const fetchImpl of [async () => { throw Error('timeout'); }, async () => new Response('not JSON', { status: 200 }), async () => new Response('Unauthorized', { status: 401 })]) {
    await withWorker(fetchImpl, async () => assert.equal((await callMailWorker({ batchId, limit: 1 })).ready, false));
  }
  await withWorker(async () => { throw Error('must not fetch'); }, async () => {
    delete process.env.MAIL_QUEUE_SECRET;
    assert.equal((await callMailWorker({ action: 'health' })).ready, false);
  });
});
