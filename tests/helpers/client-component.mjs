import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import ts from 'typescript';
const require = createRequire(import.meta.url);
export function component(file, name, { props = {}, fetch, client = {}, moduleStubs = {}, storage = { getItem: () => null, setItem() {}, removeItem() {} }, href = 'https://example.com/katilimci/aktivasyon?token_hash=opaque-token-hash&type=invite&job=22222222-2222-4222-8222-222222222222' } = {}) {
  const state = [], effects = [], redirects = [], history = [], pendingEffects = [], cleanups = new Map(); let cursor = 0;
  const window = { location: { href, origin: 'https://example.com', assign: (url) => redirects.push(url) }, history: { replaceState: (...args) => history.push(args[2]) },setInterval:()=>1,clearInterval(){},confirm:()=>true };
  const stubs = { react: { useCallback:(fn,deps)=>{const i=cursor++;if(!(i in state)||deps.some((d,index)=>d!==state[i].deps[index]))state[i]={fn,deps};return state[i].fn;},useRef: (initial) => { const i = cursor++; if (!(i in state)) state[i] = { current: initial }; return state[i]; },useState: (initial) => { const i = cursor++; if (!(i in state)) state[i] = typeof initial==='function'?initial():initial; return [state[i], (value) => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; }, useEffect: (fn,deps) => { const i = cursor++; if (!(i in state)||!deps||deps.some((d,index)=>d!==state[i]?.[index])) { state[i] = deps; effects.push(fn); pendingEffects.push({i,fn}); } } },
    '@/components/operations/ActionFeedback':{ActionFeedback:'feedback'},
    '@/lib/supabase/browser': { createBrowserSupabase: () => client }, '@/lib/participant/prepare-receipt': { prepareReceipt: async file => file, receiptAccept: 'image/heic,image/webp,application/pdf' }, '@/lib/content': { operations: new Proxy({}, { get: () => new Proxy({}, { get: (_,key) => String(key) }) }) }, 'next/link': { __esModule: true, default: 'a' }, 'next/image': { __esModule: true, default: 'img' } };
  const modules=new Map();
  function loadModule(url){
    if(modules.has(String(url)))return modules.get(String(url));
    const exports={};modules.set(String(url),exports);
    const source=ts.transpileModule(readFileSync(url,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
    vm.runInNewContext(`(function(require,exports){${source}\n})`, { fetch, window, URL, URLSearchParams, AbortController, Error, console, Intl, Date, crypto, sessionStorage: storage })((id)=>moduleStubs[id]??stubs[id]??(id.startsWith('@/lib/operations/')?loadModule(new URL(`../../${id.slice(2)}.ts`,import.meta.url)):require(id)),exports);
    return exports;
  }
  const exports=loadModule(new URL(file,import.meta.url));
  function render() { cursor = 0; return exports[name](props); }
  function nodes(tree, type) { if (!tree || typeof tree !== 'object') return []; const children = [tree.props?.children].flat(Infinity); return [...(tree.type === type ? [tree] : []), ...children.flatMap(child => nodes(child, type))]; }
  function runEffects(){for(const {i,fn} of pendingEffects.splice(0)){cleanups.get(i)?.();cleanups.set(i,fn());}}
  return { render, nodes, redirects, history, effects,runEffects, submit: async () => nodes(render(), 'form')[0].props.onSubmit({ preventDefault() {} }) };
}
