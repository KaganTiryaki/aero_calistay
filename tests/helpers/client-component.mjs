import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
export function component(file, name, { props = {}, fetch, client = {}, href = 'https://example.com/katilimci/aktivasyon?token_hash=opaque-token-hash&type=invite&job=22222222-2222-4222-8222-222222222222' } = {}) {
  const state = [], effects = [], redirects = [], history = []; let cursor = 0;
  const window = { location: { href, origin: 'https://example.com', assign: (url) => redirects.push(url) }, history: { replaceState: (...args) => history.push(args[2]) } };
  const stubs = { react: { useCallback:fn=>fn,useState: (initial) => { const i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; }, useEffect: (fn) => { const i = cursor++; if (!(i in state)) { state[i] = true; effects.push(fn); } } },
    '@/lib/supabase/browser': { createBrowserSupabase: () => client }, '@/lib/participant/prepare-receipt': { prepareReceipt: async file => file, receiptAccept: 'image/heic,image/webp,application/pdf' }, '@/lib/content': { operations: new Proxy({}, { get: () => new Proxy({}, { get: (_,key) => String(key) }) }) }, 'next/link': { default: 'a' }, 'next/image': { default: 'img' } };
  const exports = {}; const source = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText;
  vm.runInNewContext(`(function(require,exports){${source}\n})`, { fetch, window, URL, URLSearchParams, Error, console, Intl, Date, crypto, sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} } })((id) => stubs[id] ?? require(id), exports);
  function render() { cursor = 0; return exports[name](props); }
  function nodes(tree, type) { if (!tree || typeof tree !== 'object') return []; const children = [tree.props?.children].flat(Infinity); return [...(tree.type === type ? [tree] : []), ...children.flatMap(child => nodes(child, type))]; }
  return { render, nodes, redirects, history, effects, submit: async () => nodes(render(), 'form')[0].props.onSubmit({ preventDefault() {} }) };
}
