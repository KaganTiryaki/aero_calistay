import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';
const nativeRequire=createRequire(import.meta.url),root=fileURLToPath(new URL('../../',import.meta.url));
export function loadServerRoute(route,{server,db,proof,env={},worker=async()=>({ready:true,failed:0}),cookieStore}={}){
 const cookies=cookieStore??new Map();const calls=[];const stubs={
  'server-only':{},'next/headers':{cookies:async()=>({get:name=>cookies.has(name)?{value:cookies.get(name)}:undefined,set:(name,value)=>cookies.set(name,value)})},
  '@/lib/supabase/server':{createServerSupabase:async()=>server},'@/lib/supabase/admin':{createAdminSupabase:()=>db},
  '@/lib/mail/dispatch':{callMailWorker:worker},
  ...(proof?{'@/lib/participant/auth':{readActivationProof:async()=>proof,clearActivationProof:async()=>calls.push('cleared')}}:{}),
 };
 const cache=new Map(),context=vm.createContext({Request,Response,URL,Headers,Buffer,Error,console,process:{env:{NODE_ENV:'test',PARTICIPANT_AUTH_LINK_HMAC_KEY:'test-only-auth-hmac-key-32-bytes-minimum',AUTH_MAIL_PAYLOAD_KEY:Buffer.alloc(32,1).toString('base64'),...env}}});
 function evaluate(filename){if(cache.has(filename))return cache.get(filename).exports;const mod={exports:{}};cache.set(filename,mod);const source=ts.transpileModule(readFileSync(filename,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  const require=name=>stubs[name]??(name.startsWith('@/')?evaluate(path.join(root,`${name.slice(2)}.ts`)):nativeRequire(name));vm.runInContext(`(function(require,module,exports){${source}\n})`,context,{filename})(require,mod,mod.exports);return mod.exports;}
 return {...evaluate(path.join(root,`app/api/${route}/route.ts`)),calls,cookies,request:body=>new(nativeRequire('next/server').NextRequest)(`https://test.example.com/api/${route}`,{method:'POST',headers:{origin:'https://test.example.com',host:'test.example.com','content-type':'application/json','x-real-ip':'127.0.0.1','x-vercel-forwarded-for':'192.0.2.10'},body:JSON.stringify(body)})};
}
