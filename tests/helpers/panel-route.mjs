import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const nativeRequire = createRequire(import.meta.url);
const root = fileURLToPath(new URL('../../', import.meta.url));

export function loadPanelRoute(route, { db, staff, worker } = {}) {
  const stubs = {
    '@/lib/auth/permissions': { requireStaff: async () => { if (!staff || staff.role !== 'admin') throw Error('FORBIDDEN'); return staff; } },
    '@/lib/supabase/admin': { createAdminSupabase: () => db },
    '@/lib/mail/dispatch': { callMailWorker: worker },
    '@/lib/activity/server': { startAdminActivity: async () => async () => {} },
  };
  const cache = new Map(), context = vm.createContext({ Request, Response, URL, Error, process, console });
  function evaluate(filename) {
    if (cache.has(filename)) return cache.get(filename).exports;
    const loadedModule = { exports: {} }; cache.set(filename, loadedModule);
    const compiled = ts.transpileModule(readFileSync(filename, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    }).outputText;
    const require = (name) => {
      if (stubs[name]) return stubs[name];
      if (name.startsWith('@/')) return evaluate(path.join(root, `${name.slice(2)}.ts`));
      if (name.startsWith('.')) return evaluate(path.resolve(path.dirname(filename), name));
      return nativeRequire(name);
    };
    vm.runInContext(`(function(require,module,exports){${compiled}\n})`, context, { filename })(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  const routePath = route.startsWith('webhooks/') ? route : `panel/${route}`;
  const routeModule = evaluate(path.join(root, `app/api/${routePath}/route.ts`));
  return { ...routeModule, request: (body, origin = 'https://test.example.com') => new (nativeRequire('next/server').NextRequest)(`https://test.example.com/api/${routePath}`, {
    method: 'POST', headers: { origin, host: 'test.example.com', 'content-type': 'application/json' }, body: JSON.stringify(body),
  }) };
}

export const staff = { userId: '11111111-1111-4111-8111-111111111111', eventId: '22222222-2222-4222-8222-222222222222', role: 'admin' };
export const batchId = '33333333-3333-4333-8333-333333333333';
export const selection = { applicationId: '44444444-4444-4444-8444-444444444444', version: 1, committeeId: '55555555-5555-4555-8555-555555555555' };
export const ready = { ready: true, processed: 0, accepted: 0, failed: 0, uncertain: 0, blocked: false };

export function panelDb({ batch = null, jobs = [] } = {}) {
  const queries = [], mutations = [];
  return { queries, mutations, from(table) {
    const filters = [];
    const query = { select() { return query; }, eq(...args) { filters.push(args); return query; },
      in(...args) { filters.push(args); return query; }, order() { return query; }, range() { return query; },
      maybeSingle() { return query; }, then(resolve, reject) {
        queries.push({ table, filters });
        const data = table === 'mail_batches' ? batch : table === 'mail_jobs' ? jobs
          : table === 'applications' ? [{ id: selection.applicationId, first_name: 'Test', last_name: 'Kişi', email: 'test@example.com', status: 'pending', version: 1 }]
          : table === 'committees' ? [{ id: selection.committeeId, name: 'Komite', active: true }] : [];
        return Promise.resolve({ data, error: null }).then(resolve, reject);
      } };
    return query;
  }, rpc: async (name, args) => { mutations.push({ name, args }); return { data: batchId, error: null }; } };
}
