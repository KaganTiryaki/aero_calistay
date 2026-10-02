import test from 'node:test';
import assert from 'node:assert/strict';
import { sendTransactionalEmail } from '../../supabase/functions/process-mail-queue/brevo-client.ts';

const job = { recipient_email: 'test@example.com', subject: 'Test', html_content: '<p>Test</p>', text_content: 'Test', tag: 'aero-job-abc', idempotency_key: '11111111-1111-4111-8111-111111111111' };
const config = { apiKey: 'secret', senderEmail: 'from@example.com', senderName: 'AERO', replyToEmail: 'reply@example.com' };

test('201 stores provider message id without declaring approval', async () => {
  const calls = [];
  const result = await sendTransactionalEmail(job, config, async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ messageId: '<message@brevo>' }), { status: 201 });
  });
  assert.deepEqual(result, { kind: 'accepted', messageId: '<message@brevo>' });
  assert.deepEqual(calls[0].to, [{ email: 'test@example.com' }]);
  assert.deepEqual(calls[0].tags, ['aero-job-abc']);
  assert.equal(calls[0].headers['Idempotency-Key'], job.idempotency_key);
});

test('timeout and 5xx are uncertain and never instruct automatic retry', async () => {
  assert.equal((await sendTransactionalEmail(job, config, async () => { throw new Error('timeout'); })).kind, 'uncertain');
  assert.equal((await sendTransactionalEmail(job, config, async () => new Response('{}', { status: 503 }))).kind, 'uncertain');
});

test('quota waits, recipient rejection fails, and account errors stop the queue', async () => {
  assert.equal((await sendTransactionalEmail(job, config, async () => new Response('{"code":"not_enough_credits"}', { status: 400 }))).kind, 'quota');
  assert.equal((await sendTransactionalEmail(job, config, async () => new Response('{"code":"invalid_email"}', { status: 400 }))).kind, 'failed');
  assert.equal((await sendTransactionalEmail(job, config, async () => new Response('{"code":"invalid_parameter"}', { status: 400 }))).kind, 'config');
  assert.equal((await sendTransactionalEmail(job, config, async () => new Response('{}', { status: 401 }))).kind, 'config');
  assert.equal((await sendTransactionalEmail(job, config, async () => new Response('{}', { status: 403 }))).kind, 'config');
});

test('201 without a valid message identifier remains uncertain', async () => {
  for (const body of [null, {}, { messageId: '' }, { messageId: '  ' }, { messageId: 123 }, { messageId: [] }])
    assert.equal((await sendTransactionalEmail(job, config, async () => Response.json(body, { status: 201 }))).kind, 'uncertain');
});

test('JSON null and non-JSON provider errors never crash the worker', async () => {
  assert.equal((await sendTransactionalEmail(job, config, async () => Response.json(null, { status: 401 }))).kind, 'config');
  assert.equal((await sendTransactionalEmail(job, config, async () => new Response('gateway error', { status: 502 }))).kind, 'uncertain');
});

test('duplicate idempotency replies remain uncertain rather than instructing a resend', async () => {
  assert.equal((await sendTransactionalEmail(job, config, async () => Response.json({ code: 'duplicate_parameter' }, { status: 400 }))).kind, 'uncertain');
});

test('rate limit waits are positive and invalid reset values use a conservative default', async () => {
  for (const [reset, expected] of [['2', 2], ['0', 1], ['-5', 1], ['invalid', 60]]) {
    const result = await sendTransactionalEmail(job, config, async () => new Response('{}', { status: 429, headers: { 'retry-after': reset } }));
    assert.equal(result.kind, 'rate'); assert.equal(result.retryAfter, expected);
  }
});

test('SMTP authorization failures distinguish IP blocking without exposing provider response details', async () => {
  const result = await sendTransactionalEmail(job, config, async () => Response.json({ code: 'unauthorized',
    message: 'We have detected you are using an unrecognised IP address 192.0.2.100 secret',
  }, { status: 401 }));
  assert.equal(result.kind, 'config');
  assert.ok(result.reason.includes('IP'));
  assert.equal(result.reason.includes('192.0.2.100'), false);
  assert.equal(result.reason.includes('secret'), false);
});
