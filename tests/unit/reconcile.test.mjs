import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileJobs } from '../../supabase/functions/process-mail-queue/reconcile.ts';

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
