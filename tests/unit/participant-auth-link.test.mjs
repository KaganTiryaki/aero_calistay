import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
import { createRequire } from 'node:module';

const nativeRequire = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));
function route(type, { membership = null, app = { email: 'person@example.com', status: 'accepted_pending_payment' } } = {}) {
  const calls = { verify: [], password: [], claim: [] };
  const server = { auth: { verifyOtp: async (input) => { calls.verify.push(input); return { data: { user: { id: 'user-a', email: 'person@example.com', email_confirmed_at: 'now' } }, error: null }; } } };
  const admin = { from(table) { const filters = []; const query = { select() { return query; }, eq(column, value) { filters.push([column, value]); return query; }, maybeSingle: async () => ({ data: membership && filters.some(([column, value]) => column === 'user_id' && value === 'user-a') ? membership : null, error: null }), single: async () => ({ data: table === 'applications' && app && filters.some(([column, value]) => column === 'id' && value === 'app-a') ? app : null, error: null }) }; return query; } };
  const stubs = {
    '@/lib/supabase/server': { createServerSupabase: async () => server },
    '@/lib/supabase/admin': { createAdminSupabase: () => admin },
    '@/lib/http': { json: (data, status = 200) => new (nativeRequire('next/server').NextResponse)(JSON.stringify(data), { status }), protectMutation() {} },
    '@/lib/participant/server': { participantFailure: (error) => { const message = error?.message ?? ''; return new (nativeRequire('next/server').NextResponse)(JSON.stringify({ error: message }), { status: message.includes('FORBIDDEN') ? 403 : 500 }); } },
  };
  const cache = new Map(), context = vm.createContext({ Request, Response, URL, Error, process, console });
  function evaluate(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loaded = { exports: {} }; cache.set(filename, loaded);
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
    const require = (name) => stubs[name] ?? nativeRequire(name);
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename })(require, loaded, loaded.exports);
    return loaded.exports;
  }
  const handler = evaluate(path.join(root, 'app/api/participant/auth-link/complete/route.ts')).POST;
  return { handler, calls, request: () => new (nativeRequire('next/server').NextRequest)('https://test.example.com/api/participant/auth-link/complete', { method: 'POST', headers: { origin: 'https://test.example.com', host: 'test.example.com', 'content-type': 'application/json' }, body: JSON.stringify({ tokenHash: 'x'.repeat(32), type }) }) };
}

test('invite requires a new password while an existing-account magiclink preserves it', async () => {
  for (const [type, expected] of [['invite', true], ['magiclink', false], ['recovery', true]]) {
    const f = route(type, { membership: type === 'invite' ? null : { application_id: 'app-a' } });
    const response = await f.handler(f.request());
    assert.equal(response.status, 200);
    assert.equal((await response.json()).setPassword, expected);
    assert.equal(f.calls.verify.length, 1);
  }
});

test('recovery cannot verify against a different participant membership', async () => {
  const f = route('recovery', { membership: { application_id: 'app-a' }, app: { email: 'different@example.com', status: 'accepted_pending_payment' } });
  const response = await f.handler(f.request());
  assert.equal(response.status, 403);
  assert.equal(f.calls.verify.length, 1);
});
