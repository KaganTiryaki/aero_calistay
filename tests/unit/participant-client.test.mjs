import test from 'node:test';
import assert from 'node:assert/strict';
import { component } from '../helpers/client-component.mjs';
const response = (body, status = 200) => new Response(JSON.stringify(body), { status });
const auth = '../../components/participant/AuthClient.tsx';
test('refresh resumes the verified password form with the current minimum',async()=>{
 const calls=[];const c=component(auth,'ParticipantAuthClient',{props:{mode:'activate'},href:'https://example.com/katilimci/aktivasyon',fetch:async(url,init)=>{calls.push({url,method:init?.method??'GET'});return response({setPassword:true,audience:'participant'});}});
 c.render();c.effects[0]();await new Promise(setImmediate);
 assert.equal(c.nodes(c.render(),'input').find(x=>x.props.type==='password').props.minLength,6);assert.deepEqual(calls,[{url:'/api/participant/activate',method:'GET'}]);
});
test('activation session conflict offers explicit local logout and preserves the unused invite', async () => {
  let signedOut = 0; const calls = [];
  const c = component(auth, 'ParticipantAuthClient', { props: { mode: 'activate' }, client: { auth: { signOut: async (options) => { assert.equal(options.scope, 'local'); signedOut++; return { error: null }; } } }, fetch: async (url, init) => {
    calls.push(JSON.parse(init.body)); return signedOut ? response({ ok: true, setPassword: true }) : response({ error: 'Mevcut hesabınızdan çıkış yapın.' }, 409);
  } });
  await c.submit(); assert.equal(signedOut, 0); assert.equal(c.history.length, 0);
  const logout = c.nodes(c.render(), 'button').find(x => x.props.children === 'logoutForActivation'); assert.ok(logout);
  await logout.props.onClick(); assert.equal(signedOut, 1); assert.equal(c.history.length, 0); assert.equal(calls.length, 1);
  await c.submit(); assert.equal(calls[0].tokenHash, calls[1].tokenHash);
  assert.ok(c.nodes(c.render(), 'input').some(x => x.props.type === 'password'));
  assert.ok(c.nodes(c.render(), 'button').some(x => x.props.children === 'saveActivationPassword'));
});
test('failed activation logout keeps the conflict actionable without verifying the invite', async () => {
  let calls = 0;
  const c = component(auth, 'ParticipantAuthClient', { props: { mode: 'activate' }, client: { auth: { signOut: async () => ({ error: new Error('Çıkış başarısız') }) } }, fetch: async () => { calls++; return response({ error: 'Çıkış yapın' }, 409); } });
  await c.submit(); const logout = c.nodes(c.render(), 'button').find(x => x.props.children === 'logoutForActivation'); assert.ok(logout);
  await logout.props.onClick(); assert.equal(calls, 1); assert.equal(c.history.length, 0);
  assert.ok(c.nodes(c.render(), 'button').some(x => x.props.children === 'logoutForActivation'));
  assert.ok(c.nodes(c.render(), 'p').some(x => x.props.children === 'Çıkış başarısız'));
});
test('invite renders a separate password step; failed save retries without consuming the token twice', async () => {
  const calls = []; let save = 0;
  const c = component(auth, 'ParticipantAuthClient', { props: { mode: 'activate' }, client: { auth: { signOut: async () => {}, updateUser: async () => ({ error: null }) } }, fetch: async (url) => {
    calls.push(url);
    if (url.endsWith('/complete')) return response({ ok: true, setPassword: true });
    if (url.endsWith('/activate')) return ++save === 1 ? response({ error: 'Geçici hata' }, 503) : response({ ok: true });
    return response({ ok: true });
  } });
  await c.submit(); assert.deepEqual(c.redirects, []);
  const password = c.nodes(c.render(), 'input').find(x => x.props.type === 'password'); assert.ok(password);
  assert.equal(password.props.minLength,6);
  password.props.onChange({ target: { value: 'a-strong-password' } });
  await c.submit(); assert.deepEqual(c.redirects, []);
  await c.submit(); assert.deepEqual(c.redirects, ['/katilimci']);
  assert.equal(calls.filter(x => x.endsWith('/complete')).length, 1);
  assert.equal(calls.filter(x => x.endsWith('/activate')).length, 2);
});
test('existing-account magiclink goes to the panel without changing a password', async () => {
  const calls=[]; const c=component(auth,'ParticipantAuthClient',{props:{mode:'activate'},fetch:async url=>{calls.push(url);return response({ok:true,setPassword:false});}});
  await c.submit();assert.deepEqual(c.redirects,['/katilimci']);assert.equal(calls.includes('/api/participant/activate'),false);
});
test('staff default invite session is consumed only on explicit submit and then shows a separate password form',async()=>{
 let sessions=0;const calls=[];
 const c=component(auth,'ParticipantAuthClient',{props:{mode:'staff-activate'},href:'https://example.com/personel/aktivasyon#access_token=access&refresh_token=refresh&type=invite',client:{auth:{getUser:async()=>({data:{user:null}}),setSession:async()=>{sessions++;return {error:null};}}},fetch:async(url,init)=>{calls.push(JSON.parse(init.body));return response({ok:true,setPassword:true});}});
 c.render();assert.equal(sessions,0);await c.submit();assert.equal(sessions,1);assert.deepEqual(c.redirects,[]);assert.deepEqual(calls,[{session:true,type:'invite'}]);assert.ok(c.nodes(c.render(),'input').some(x=>x.props.type==='password'));
});
test('recovery request exposes an unavailable service instead of claiming a sent email', async () => {
  const c=component(auth,'ParticipantAuthClient',{fetch:async()=>response({error:'Hizmet kullanılamıyor'},503)});
  c.nodes(c.render(),'input').find(x=>x.props.type==='email').props.onChange({target:{value:'p@example.com'}});
  await c.nodes(c.render(),'button').find(x=>x.props.children==='Şifremi unuttum').props.onClick();
  assert.ok(c.nodes(c.render(),'p').some(x=>x.props.children==='Hizmet kullanılamıyor'));
});

test('receipt finalize response loss retries the same upload without a new begin or Storage write',async()=>{
 const calls=[];let writes=0,finalizes=0;
 const c=component('../../components/participant/ParticipantClient.tsx','ParticipantClient',{client:{storage:{from:()=>({uploadToSignedUrl:async()=>{writes++;return {error:null};}})}},fetch:async(url,init)=>{
  if(url.endsWith('/me'))return response({application:{id:'app',first_name:'Test',status:'accepted_pending_payment'},payment:null,qrReady:false});
  const input=JSON.parse(init.body);calls.push(input);
  if(input.action==='begin')return response({id:'receipt-id',path:'app/receipt.png',token:'signed-token'});
  if(++finalizes===1)throw Error('Ağ kesildi');return response({ok:true});
 }});
 c.render();c.effects[0]();await new Promise(setImmediate);
 c.nodes(c.render(),'input').find(x=>x.props.type==='file').props.onChange({target:{files:[{type:'image/png',size:100}]}});
 await c.submit();await c.submit();
 assert.equal(calls.filter(x=>x.action==='begin').length,1);assert.deepEqual(calls.filter(x=>x.action==='finalize').map(x=>x.id),['receipt-id','receipt-id']);assert.equal(writes,1);
});
test('a rejected uploaded file can be explicitly replaced instead of trapping the participant in retries',async()=>{
 const c=component('../../components/participant/ParticipantClient.tsx','ParticipantClient',{client:{storage:{from:()=>({uploadToSignedUrl:async()=>({error:null})})}},fetch:async(url,init)=>{
  if(url.endsWith('/me'))return response({application:{id:'app',status:'accepted_pending_payment'},payment:null,qrReady:false});
  return JSON.parse(init.body).action==='begin'?response({id:'bad-receipt',path:'receipt.png',token:'token'}):response({error:'Dosya doğrulanamadı'},400);
 }});
 c.render();c.effects[0]();await new Promise(setImmediate);
 c.nodes(c.render(),'input').find(x=>x.props.type==='file').props.onChange({target:{files:[{type:'image/png',size:100}]}});await c.submit();
 assert.equal(c.nodes(c.render(),'input').find(x=>x.props.type==='file').props.disabled,true);
 await c.nodes(c.render(),'button').find(x=>x.props.children==='Başka dosya seç').props.onClick();
 assert.equal(c.nodes(c.render(),'input').find(x=>x.props.type==='file').props.disabled,false);
});
test('administrator can create a pending test application without sending email',async()=>{
 const writes=[];const c=component('../../components/panel/ApplicationsClient.tsx','ApplicationsClient',{fetch:async(url,init)=>{
  if(init?.method==='POST'){writes.push({url,body:JSON.parse(init.body)});return response({id:'new-app'});}
  return response({items:[],total:0});
 }});
 for(const [index,value] of [[0,'Test'],[1,'Katılımcı'],[2,'test@example.com']])c.nodes(c.render(),'input')[index].props.onChange({target:{value}});
 await c.submit();assert.deepEqual(writes,[{url:'/api/panel/applications',body:{firstName:'Test',lastName:'Katılımcı',email:'test@example.com'}}]);
});

test('participant load failure is recoverable rather than an endless loading screen',async()=>{
 const c=component('../../components/participant/ParticipantClient.tsx','ParticipantClient',{fetch:async()=>response({},503)});c.render();c.runEffects();await new Promise(setImmediate);
 assert.ok(!c.nodes(c.render(),'p').some(n=>n.props.children==='loading'));assert.ok(c.nodes(c.render(),'button').some(n=>n.props.children==='Tekrar dene'));
});
test('participant logout failure does not redirect',async()=>{
 const c=component('../../components/participant/ParticipantClient.tsx','ParticipantClient',{fetch:async()=>response({},503),client:{auth:{signOut:async()=>({error:new Error('Çıkış başarısız')})}}});
 await c.nodes(c.render(),'button').find(n=>n.props.children==='logout').props.onClick();assert.deepEqual(c.redirects,[]);
});
test('tokenless activation does not offer a verification button when no resumable session exists',async()=>{
 const c=component(auth,'ParticipantAuthClient',{props:{mode:'activate'},href:'https://example.com/katilimci/aktivasyon',fetch:async()=>response({},403)});c.render();c.runEffects();await new Promise(setImmediate);
 assert.ok(!c.nodes(c.render(),'button').some(n=>n.props.children==='activate'));assert.ok(c.nodes(c.render(),'p').some(n=>String(n.props.children).includes('Geçerli bir aktivasyon')));
});
test('activation resume network failure is presented separately from invalid link',async()=>{
 const c=component(auth,'ParticipantAuthClient',{props:{mode:'activate'},href:'https://example.com/katilimci/aktivasyon',fetch:async()=>{throw new Error('offline');}});c.render();c.runEffects();await new Promise(setImmediate);
 assert.ok(c.nodes(c.render(),'p').some(n=>String(n.props.children).includes('kontrol edilemedi')));
});


test('missing recovery email is always an error even after a successful link request',async()=>{
 const c=component(auth,'ParticipantAuthClient',{fetch:async()=>response({ok:true})});
 const email=()=>c.nodes(c.render(),'input').find(n=>n.props.type==='email');email().props.onChange({target:{value:'t@example.com'}});
 await c.nodes(c.render(),'button').find(n=>n.props.children==='Şifremi unuttum').props.onClick();email().props.onChange({target:{value:''}});
 await c.nodes(c.render(),'button').find(n=>n.props.children==='Şifremi unuttum').props.onClick();assert.equal(c.nodes(c.render(),'p').find(n=>n.props.children==='email').props.role,'alert');
});
