import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileJobs } from '../../supabase/functions/process-mail-queue/reconcile.ts';

const fixtureJob = { id: '11111111-1111-4111-8111-111111111111', tag: 'aero-job-11111111-1111-4111-8111-111111111111',
  recipient_email: 'test@example.com', provider_message_id: '<message@brevo>', status: 'provider_accepted',
  first_send_at: '2026-10-03T00:00:00Z', next_attempt_at: '2026-10-03T00:00:00Z' };
const fixtureEvent = { date: '2026-10-03T00:01:00Z', email: 'test@example.com', event: 'delivered', messageId: 'message@brevo', tag: fixtureJob.tag };

async function reconcileFixture(fetchImpl, record = { data: true, error: null }) {
  const updates = [], recorded = [];
  const db = { from(table) {
    if (table === 'mail_jobs') return {
      select() { return { in() { return { lte() { return { order() { return { limit() { return Promise.resolve({ data: [fixtureJob], error: null }); } }; } }; } }; } }; },
      update(values) { updates.push({ table, values }); return { eq() { return { in() { return Promise.resolve({ error: null }); } }; } }; },
    };
    return { update(values) { updates.push({ table, values }); return { eq() { return Promise.resolve({ error: null }); } }; } };
  }, rpc(_name, args) { recorded.push(args); return Promise.resolve(record); } };
  const prior = globalThis.fetch; globalThis.fetch = fetchImpl;
  try { return { matched: await reconcileJobs(db, 'key'), updates, recorded }; }
  finally { globalThis.fetch = prior; }
}

test('reconciliation paginates past unrelated events with the documented filter contract', async () => {
  const urls = [];
  const result = await reconcileFixture(async (url) => {
    const query = new URL(String(url)).searchParams; urls.push(query);
    const events = query.get('offset') === '0' ? Array.from({ length: 1000 }, () => ({ ...fixtureEvent, tag: 'unrelated' })) : [fixtureEvent];
    return Response.json({ events });
  });
  assert.equal(result.matched, 1); assert.equal(result.recorded.length, 1);
  assert.deepEqual(urls.map((query) => query.get('offset')), ['0', '1000']);
  assert.equal(urls[0].get('tags'), '["aero-job-11111111-1111-4111-8111-111111111111"]');
  assert.equal(urls[0].get('messageId'), '<message@brevo>');
});

test('reconciliation ignores unrelated recipient, message, tags and invalid timestamps', async () => {
  const result = await reconcileFixture(async () => Response.json({ events: [
    { ...fixtureEvent, email: 'other@example.com' }, { ...fixtureEvent, messageId: 'other-message' },
    { ...fixtureEvent, tag: ['other'] }, { ...fixtureEvent, date: 'invalid' },
    { ...fixtureEvent, tag: [fixtureJob.tag] },
  ] }));
  assert.equal(result.matched, 1); assert.equal(result.recorded.length, 1);
});

test('a storage-rejected event is not counted as successfully reconciled', async () => {
  const result = await reconcileFixture(async () => Response.json({ events: [fixtureEvent] }), { data: false, error: null });
  assert.equal(result.matched, 0);
});

test('malformed provider events cannot crash reconciliation or count as confirmed', async () => {
  const result = await reconcileFixture(async () => Response.json({ events: [null, { tag: fixtureJob.tag },
    { ...fixtureEvent, messageId: 123 }, fixtureEvent] }));
  assert.equal(result.matched, 1);
});

test('provider or record failure does not postpone the unconfirmed job', async () => {
  for (const [fetchImpl, record] of [[async () => new Response('{}', { status: 503 }), { data: true, error: null }],
    [async () => Response.json({ events: [fixtureEvent] }), { data: null, error: { message: 'storage failure' } }]]) {
    const result = await reconcileFixture(fetchImpl, record);
    assert.equal(result.matched, 0);
    assert.equal(result.updates.filter((item) => item.table === 'mail_jobs').length, 0);
  }
});

test('a sent job is revisited so a missed delivered webhook updates its delivery state', async () => {
  const job = {
    id: '11111111-1111-4111-8111-111111111111',
    tag: 'aero-job-11111111-1111-4111-8111-111111111111',
    recipient_email: 'test@example.com',
    provider_message_id: '<message@brevo>',
    status: 'sent',
    first_send_at: '2026-09-26T10:00:00Z',
    next_attempt_at: '2026-09-26T10:00:00Z',
  };
  let selectedStatuses;
  const recorded = [];
  const db = {
    from(table) {
      if (table === 'mail_jobs') return {
        select() { return { in(_field, statuses) {
          selectedStatuses = statuses;
          return { lte() { return { order() { return { limit() {
            return Promise.resolve({ data: [job], error: null });
          } }; } }; } };
        } }; },
        update() { return { eq() { return { in() { return Promise.resolve({ error: null }); } }; } }; },
      };
      return { update() { return { eq() { return Promise.resolve({ error: null }); } }; } };
    },
    rpc(_name, args) { recorded.push(args); return Promise.resolve({ data: true, error: null }); },
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({ events: [{
    date: '2026-09-26T10:02:00Z', email: job.recipient_email, event: 'delivered',
    messageId: 'message@brevo', tag: job.tag,
  }] }), { status: 200 });
  try {
    assert.equal(await reconcileJobs(db, 'test-key'), 1);
    assert.ok(selectedStatuses.includes('sent'));
    assert.equal(recorded[0].p_event, 'delivered');
  } finally {
    globalThis.fetch = originalFetch;
  }
});
