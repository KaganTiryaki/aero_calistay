import test from 'node:test';
import assert from 'node:assert/strict';
import { createCipheriv, createHash, randomBytes } from 'node:crypto';
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
  const fingerprint = createHash('sha256').update('opaque').digest('hex');
  const payload = { email, url: `https://aerocalistay.org/katilimci/aktivasyon?token_hash=opaque&type=recovery&job=${job.id}`, expiresAt, jobId:job.id, applicationId:job.application_id, type:'recovery', fingerprint };
  const cipher = createCipheriv('aes-256-gcm', key, nonce); cipher.setAAD(Buffer.from(JSON.stringify([job.id,job.application_id,job.recipient_email,'recovery',expiresAt,fingerprint])));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(payload)), cipher.final()]);
  const tag = cipher.getAuthTag();
  const row = { job_id:job.id, application_id: job.application_id, recipient_email: job.recipient_email, expires_at: expiresAt,auth_type:'recovery',token_fingerprint:fingerprint,
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

test('a payload copied to a different mail job for the same application is rejected', async()=>{
  const f=await fixture();await assert.rejects(prepareParticipantAuthMail(f.db,{...job,id:'33333333-3333-4333-8333-333333333333'},f.key),/AUTH_MAIL_PAYLOAD_INVALID|operation/i);
});
test('invalid encryption key must not generate a replacement Supabase token', async()=>{
  let generated=0;
  const db={rpc:async(name)=>({data:name==='participant_auth_identity'?null:[],error:null}),auth:{admin:{generateLink:async()=>{generated++;return {data:{properties:{hashed_token:'opaque'}},error:null};}}},from(table){return {select(){return this;},eq(){return this;},single:async()=>({data:table==='applications'?{id:job.application_id,email:job.recipient_email,status:'accepted_pending_payment',event_id:'event'}:{participant_portal_url:'https://example.com/katilimci'},error:null})};}};
  await assert.rejects(prepareParticipantAuthMail(db,{...job,kind:'acceptance'},''));assert.equal(generated,0);
});
