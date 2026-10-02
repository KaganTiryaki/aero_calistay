import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

export function loadWorker({ env = {}, db, fetchImpl } = {}) {
  let handler;
  const config = { SUPABASE_URL: 'https://test.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'test-service',
    MAIL_QUEUE_SECRET: 'test-secret', BREVO_API_KEY: 'test-api', MAIL_SENDER_EMAIL: 'sender@example.com',
    MAIL_SENDER_NAME: 'AERO', MAIL_REPLY_TO_EMAIL: 'reply@example.com', MAIL_QUEUE_ENABLED: 'true',
    MAIL_ENV: 'production', BREVO_CONTRACT_VERIFIED: 'true', ...env };
  const context = vm.createContext({ Request, Response, URL, URLSearchParams, TextEncoder, AbortSignal,
    crypto: globalThis.crypto, fetch: fetchImpl ?? (async () => { throw Error('unexpected HTTP'); }),
    Deno: { env: { get: (name) => config[name] }, serve: (fn) => { handler = fn; } } });
  const cache = new Map();
  function evaluate(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} }; cache.set(filename, loadedModule);
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = (name) => name.startsWith('npm:') ? { createClient: () => db }
      : evaluate(path.resolve(path.dirname(filename), name));
    const fn = vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename });
    fn(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  evaluate(fileURLToPath(new URL('../../supabase/functions/process-mail-queue/index.ts', import.meta.url)));
  return (body, token = 'test-secret') => handler(new Request('https://test.supabase.co/functions/v1/process-mail-queue', {
    method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  }));
}

export function fakeDb(jobs = [], markResult = { data: true, error: null }) {
  const claims = [], marks = [];
  return { claims, marks, rpc: async (name, args) => {
    if (name === 'claim_batch_mail_jobs' || name === 'claim_mail_jobs') {
      claims.push({ name, args }); return { data: jobs.length ? [jobs.shift()] : [], error: null };
    }
    if (name === 'mark_mail_job') { marks.push(args); return markResult; }
    throw Error(`unexpected RPC ${name}`);
  } };
}

export const batchId = '11111111-1111-4111-8111-111111111111';
export const job = { id: '22222222-2222-4222-8222-222222222222', recipient_email: 'recipient@example.com',
  subject: 'Kabul', html_content: '<p>Kabul</p>', text_content: 'Kabul', tag: 'aero-job-22222222-2222-4222-8222-222222222222',
  idempotency_key: '33333333-3333-4333-8333-333333333333' };

export function provider(sendResponse = () => new Response('{"messageId":"<message@brevo>"}', { status: 201 })) {
  return async (url, init) => {
    if (String(url).endsWith('/account')) return Response.json({ relay: { enabled: true }, plan: [] });
    if (String(url).endsWith('/senders')) return Response.json({ senders: [{ email: 'sender@example.com', active: true }] });
    if (String(url).endsWith('/smtp/email')) return sendResponse(url, init);
    throw Error(`unexpected HTTP ${url}`);
  };
}
