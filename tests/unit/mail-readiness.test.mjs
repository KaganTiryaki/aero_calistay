import test from 'node:test';
import assert from 'node:assert/strict';
import { checkBrevoReadiness } from '../../supabase/functions/process-mail-queue/readiness.ts';

test('provider IP rejection gets a distinct diagnosis without revealing the raw response or key', async () => {
  const result = await checkBrevoReadiness('private-key', 'sender@example.com', async () => Response.json({
    code: 'unauthorized', message: 'We have detected you are using an unrecognised IP address 192.0.2.100 private-key',
  }, { status: 401 }));
  assert.equal(result.ready, false); assert.equal(result.code, 'BREVO_IP_BLOCKED');
  assert.equal(JSON.stringify(result).includes('private-key'), false);
  assert.equal(JSON.stringify(result).includes('192.0.2.100'), false);
});

test('healthy account and active matching sender pass through read-only API calls', async () => {
  const calls = [];
  const result = await checkBrevoReadiness('test-key', 'SENDER@example.com', async (url, init) => {
    calls.push(String(url)); assert.equal(init.method ?? 'GET', 'GET');
    assert.equal(init.headers['api-key'], 'test-key');
    return String(url).endsWith('/account') ? Response.json({ relay: { enabled: true } })
      : Response.json({ senders: [{ email: 'sender@example.com', active: true }] });
  });
  assert.equal(result.ready, true); assert.equal(calls.length, 2);
});

test('inactive SMTP account prevents querying senders', async () => {
  let calls = 0;
  const result = await checkBrevoReadiness('key', 'sender@example.com', async () => {
    calls++; return Response.json({ relay: { enabled: false } });
  });
  assert.equal(result.code, 'BREVO_SMTP_INACTIVE'); assert.equal(calls, 1);
});

test('timeout, malformed account data and non-JSON error responses fail closed', async () => {
  for (const response of [async () => { throw Error('timeout'); }, async () => new Response('bad gateway', { status: 503 }),
    async () => Response.json(null), async () => Response.json({})]) {
    assert.equal((await checkBrevoReadiness('key', 'sender@example.com', response)).ready, false);
  }
});

test('a different verified sender cannot authorize the configured address', async () => {
  const result = await checkBrevoReadiness('key', 'sender@example.com', async (url) => String(url).endsWith('/account')
    ? Response.json({ relay: { enabled: true } }) : Response.json({ senders: [{ email: 'other@example.com', active: true }] }));
  assert.equal(result.code, 'BREVO_SENDER_INACTIVE');
});
