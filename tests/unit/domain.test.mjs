import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeEmail, validateApplication, parsePastedApplications } from '../../lib/applications/validation.ts';
import { renderApprovalMail } from '../../lib/mail/approval-template.ts';
import { brevoEventTime, classifyBrevoEvent, eventFingerprint } from '../../lib/mail/brevo-events.ts';
import { createQrValue, hashQrValue, isQrValue } from '../../lib/qr/credentials.ts';
import { availableApprovalSlots } from '../../lib/mail/quota.ts';

test('normalizes only case and surrounding whitespace of email', () => {
  assert.equal(normalizeEmail('  Ada.Example+one@Gmail.com  '), 'ada.example+one@gmail.com');
});

test('validates multiword Turkish names and rejects invalid records', () => {
  assert.deepEqual(validateApplication({ firstName: '  Ayşe Nur ', lastName: ' Yılmaz Şen ', email: ' AYSE@example.com ' }), {
    firstName: 'Ayşe Nur', lastName: 'Yılmaz Şen', email: 'ayse@example.com',
  });
  assert.throws(() => validateApplication({ firstName: '', lastName: 'Kaya', email: 'wrong' }));
  assert.throws(() => validateApplication({ firstName: 'Ali', lastName: 'Kaya', email: 'wrong' }));
});

test('parses pasted rows and reports duplicates and errors before saving', () => {
  const rows = parsePastedApplications('Ad\tSoyad\tE-posta\nAyşe Nur\tŞen\tAYSE@example.com\nAli\tCan\tali@example.com\nAyşe Nur\tŞen\tayse@example.com\nBoş\tSatır\tbad');
  assert.equal(rows.valid.length, 2);
  assert.equal(rows.errors.length, 2);
  assert.match(rows.errors[0].reason, /tekrar/i);
});

test('approval mail escapes person and committee names in HTML', () => {
  const mail = renderApprovalMail({ firstName: '<Ayşe>', lastName: 'Şen', committeeName: 'Hukuk & <Etik>' });
  assert.match(mail.html, /&lt;Ayşe&gt;/);
  assert.match(mail.html, /Hukuk &amp; &lt;Etik&gt;/);
  assert.doesNotMatch(mail.html, /<Ayşe>/);
  assert.match(mail.text, /Hukuk & <Etik>/);
});

test('only request and delivered prove sending; deferred does not', () => {
  assert.equal(classifyBrevoEvent('request').confirmsSend, true);
  assert.equal(classifyBrevoEvent('delivered').confirmsSend, true);
  assert.equal(classifyBrevoEvent('deferred').confirmsSend, false);
  assert.equal(classifyBrevoEvent('hard_bounce').deliveryStatus, 'hard_bounced');
  assert.notEqual(eventFingerprint({ messageId: 'm', email: 'a@b.co', event: 'request', date: 1 }),
    eventFingerprint({ messageId: 'm', email: 'a@b.co', event: 'delivered', date: 1 }));
  assert.equal(eventFingerprint({ messageId: 'm', email: 'a@b.co', event: 'delivered', date: 1_790_416_800 }),
    eventFingerprint({ messageId: 'm', email: 'a@b.co', event: 'delivered', date: '2026-09-26T10:00:00.000Z' }));
  assert.equal(eventFingerprint({ messageId: '<MESSAGE@brevo>', email: 'a@b.co', event: 'delivered', date: 1 }),
    eventFingerprint({ messageId: 'message@brevo', email: 'a@b.co', event: 'delivered', date: 1 }));
});

test('Brevo webhook UTC epoch wins over timezone-free local date', () => {
  assert.equal(brevoEventTime({ tsEvent: 1_790_416_800, date: '2026-09-26 12:00:00' }), '2026-09-26T10:00:00.000Z');
  assert.equal(brevoEventTime({ date: '2026-09-26 12:00:00' }), null);
  assert.equal(brevoEventTime({ date: '2026-09-26T10:00:00Z' }), '2026-09-26T10:00:00.000Z');
});

test('QR values are opaque, random and hashable without exposing names', () => {
  const first = createQrValue();
  const second = createQrValue();
  assert.ok(isQrValue(first));
  assert.notEqual(first, second);
  assert.notEqual(hashQrValue(first), first);
  assert.equal(isQrValue('AERO1:123'), false);
});

test('approval slots reserve staff mail and never exceed provider credit', () => {
  assert.equal(availableApprovalSlots({ dailySent: 0, approvalBudget: 290, providerRemaining: 300, reserve: 10 }), 290);
  assert.equal(availableApprovalSlots({ dailySent: 10, approvalBudget: 290, providerRemaining: 20, reserve: 10 }), 10);
  assert.equal(availableApprovalSlots({ dailySent: 290, approvalBudget: 290, providerRemaining: 100, reserve: 10 }), 0);
  assert.equal(availableApprovalSlots({ dailySent: 299, approvalBudget: 300, providerRemaining: 1, reserve: 0 }), 1);
  assert.equal(availableApprovalSlots({ dailySent: 300, approvalBudget: 300, providerRemaining: 0, reserve: 0 }), 0);
  assert.equal(availableApprovalSlots({ dailySent: 301, approvalBudget: 300, providerRemaining: 0, reserve: 0 }), 0);
});
