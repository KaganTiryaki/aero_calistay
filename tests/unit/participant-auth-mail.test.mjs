import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../../supabase/functions/process-mail-queue/participant-auth-mail.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const context = vm.createContext({ crypto: globalThis.crypto, TextEncoder, TextDecoder, URL, atob, btoa });
const loaded = { exports: {} };
vm.runInContext(`(function(module,exports){${compiled}\n})(loaded,loaded.exports)`, Object.assign(context, { loaded }));
const { prepareParticipantAuthMail } = loaded.exports;
const job = { id: '22222222-2222-4222-8222-222222222222', application_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', kind: 'participant_auth', recipient_email: 'person@example.com',
  html_content: '<p>Güvenli giriş</p>', text_content: 'Güvenli giriş' };

async function fixture({ email = job.recipient_email, expiresAt = new Date(Date.now() + 60_000).toISOString() } = {}) {
  const key = randomBytes(32); const nonce = randomBytes(12);
  const payload = { email, url: 'https://aerocalistay.org/katilimci/aktivasyon?token_hash=opaque&type=recovery', expiresAt };
  const cipher = createCipheriv('aes-256-gcm', key, nonce); cipher.setAAD(Buffer.from(job.application_id));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const tag = cipher.getAuthTag();
  const row = { application_id: job.application_id, recipient_email: job.recipient_email, expires_at: expiresAt,
    nonce: nonce.toString('base64'), ciphertext: ciphertext.toString('base64'), auth_tag: tag.toString('base64') };
  return { key: key.toString('base64'), db: { rpc: async () => ({ data: [row], error: null }) } };
}

test('participant auth mail decrypts only a matching unexpired recipient payload', async () => {
  const f = await fixture(); const outgoing = await prepareParticipantAuthMail(f.db, job, f.key);
  assert.match(outgoing.html_content, /token_hash=opaque/);
  assert.equal(outgoing.recipient_email, job.recipient_email);
});

test('participant auth mail rejects recipient mismatch and expired payload', async () => {
  const mismatch = await fixture({ email: 'other@example.com' });
  await assert.rejects(prepareParticipantAuthMail(mismatch.db, job, mismatch.key), /AUTH_MAIL_PAYLOAD_INVALID/);
  const expired = await fixture({ expiresAt: new Date(Date.now() - 1000).toISOString() });
  await assert.rejects(prepareParticipantAuthMail(expired.db, job, expired.key), /AUTH_MAIL_PAYLOAD_INVALID/);
});
