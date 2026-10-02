import test from 'node:test';
import assert from 'node:assert/strict';
import { NextRequest } from 'next/server.js';
import { loadPanelRoute } from '../helpers/panel-route.mjs';

const payload = { event: 'delivered', email: 'test@example.com', 'message-id': '<message@brevo>',
  ts_event: 1790985600, tag: 'aero-job-11111111-1111-4111-8111-111111111111' };
function request(body, token = 'test-token', extraHeaders = {}) {
  return new NextRequest('https://test.example.com/api/webhooks/brevo', { method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json', ...extraHeaders },
    body: typeof body === 'string' ? body : JSON.stringify(body) });
}
async function withWebhook(fn, result = { data: true, error: null }) {
  const prior = process.env.BREVO_WEBHOOK_TOKEN; process.env.BREVO_WEBHOOK_TOKEN = 'test-token';
  const calls = [], db = { rpc: async (name, args) => { calls.push({ name, args }); return result; } };
  const route = loadPanelRoute('webhooks/brevo', { db });
  try { await fn(route, calls); }
  finally { if (prior === undefined) delete process.env.BREVO_WEBHOOK_TOKEN; else process.env.BREVO_WEBHOOK_TOKEN = prior; }
}

test('unauthorized webhooks cannot mutate delivery or approval data', async () => {
  await withWebhook(async (route, calls) => {
    assert.equal((await route.POST(request(payload, 'wrong'))).status, 401);
    assert.equal(calls.length, 0);
  });
});

test('JSON-array tags and UTC timestamps are normalized before event recording', async () => {
  await withWebhook(async (route, calls) => {
    const response = await route.POST(request({ ...payload, tag: JSON.stringify(['other-tag', payload.tag]) }));
    assert.equal(response.status, 200); assert.equal((await response.json()).accepted, true);
    assert.equal(calls.length, 1); assert.equal(calls[0].name, 'record_mail_event');
    assert.equal(calls[0].args.p_provider_time, '2026-10-03T00:00:00.000Z');
    assert.equal(calls[0].args.p_tag, payload.tag);
  });
});

test('malformed, oversized and ambiguous timestamp webhooks fail without recording', async () => {
  await withWebhook(async (route, calls) => {
    for (const [body, status] of [['bad JSON', 400], ['x'.repeat(32769), 413],
      [{ ...payload, email: 'bad' }, 400], [{ ...payload, ts_event: undefined, date: '2026-10-03 03:00:00' }, 400]])
      assert.equal((await route.POST(request(body))).status, status);
    assert.equal(calls.length, 0);
  });
});

test('unrelated webhook tags are ignored without approving a participant', async () => {
  await withWebhook(async (route, calls) => {
    assert.equal((await (await route.POST(request({ ...payload, tag: 'other-app' }))).json()).accepted, false);
    assert.equal(calls.length, 0);
  });
});

test('webhook storage failure requests provider retry instead of acknowledging success', async () => {
  await withWebhook(async (route) => assert.equal((await route.POST(request(payload))).status, 429),
    { data: null, error: { message: 'database error' } });
});
