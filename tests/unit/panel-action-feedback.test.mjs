import test from 'node:test';
import assert from 'node:assert/strict';
import { component } from '../helpers/client-component.mjs';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
const app='../../components/panel/ApplicationsClient.tsx';
function fill(c){for(const [index,value] of [[0,'Test'],[1,'Aday'],[2,'test@example.com']])c.nodes(c.render(),'input')[index].props.onChange({target:{value}});}
test('saved applicant result survives failed refresh without another write',async()=>{
 let writes=0;const c=component(app,'ApplicationsClient',{fetch:async(_url,init)=>{if(init?.method==='POST'){writes++;return response({id:'new-app'});}return response({},503);}});
 fill(c);await c.submit();const result=c.nodes(c.render(),'feedback').find(n=>n.props.feedback.kind==='success')?.props.feedback;
 assert.ok(result);assert.equal(result.subject.name,'Test Aday');assert.equal(writes,1);
});
test('rejected application preserves the draft',async()=>{
 const c=component(app,'ApplicationsClient',{fetch:async()=>response({error:'Bu e-posta zaten kayıtlı.'},409)});fill(c);await c.submit();
 assert.equal(c.nodes(c.render(),'input')[0].props.value,'Test');assert.equal(c.nodes(c.render(),'input')[2].props.value,'test@example.com');
});
test('stale application filter response cannot replace the latest list',async()=>{
 const waits=[];const c=component(app,'ApplicationsClient',{fetch:()=>new Promise(resolve=>waits.push(resolve))});
 c.render();c.runEffects();c.nodes(c.render(),'select')[0].props.onChange({target:{value:'confirmed'}});c.render();c.runEffects();
 waits[1](response({items:[{id:'new',first_name:'Yeni',last_name:'Aday',email:'n@example.com',status:'confirmed'}],total:1}));await new Promise(setImmediate);
 waits[0](response({items:[{id:'old',first_name:'Eski',last_name:'Aday',email:'o@example.com',status:'pending'}],total:1}));await new Promise(setImmediate);
 assert.equal(c.nodes(c.render(),'strong')[0].props.children.join(''),'Yeni Aday');
});
const receipt={id:'r',version:1,status:'under_review',created_at:'2026-10-04',application:{id:'a',first_name:'Test',last_name:'Aday',email:'test@example.com',committee_name:'Sanat'}};
test('last receipt approval keeps named success and a normal empty list',async()=>{
 let approved=false;let writes=0;const c=component('../../components/panel/PaymentsClient.tsx','PaymentsClient',{fetch:async(url,init)=>{
  if(init?.method==='POST'){approved=true;writes++;return response({ok:true});}
  if(url.includes('payment-settings'))return response({payment_iban:'TR123'});
  if(url.includes('receipt='))return response({url:'https://example.com/receipt',mime:'application/pdf'});
  return response({items:approved?[]:[receipt],hasMore:false});
 }});
 c.render();c.runEffects();await new Promise(setImmediate);
 await c.nodes(c.render(),'button').find(n=>n.props.children==='view').props.onClick();await new Promise(setImmediate);
 await c.nodes(c.render(),'button').find(n=>n.props.children==='approve').props.onClick();await new Promise(setImmediate);
 const result=c.nodes(c.render(),'feedback').find(n=>n.props.feedback.kind==='success')?.props.feedback;
 assert.equal(result?.subject.name,'Test Aday');assert.equal(writes,1);
 assert.ok(!c.nodes(c.render(),'p').some(n=>String(n.props.children).includes('Liste alınamadı')));
});
test('receipt list works when settings fail and refresh preserves unsaved settings',async()=>{
 let failSettings=true;const c=component('../../components/panel/PaymentsClient.tsx','PaymentsClient',{fetch:async url=>url.includes('payment-settings')?response(failSettings?{}:{payment_iban:'TR123'},failSettings?503:200):response({items:[receipt],hasMore:false})});
 c.render();c.runEffects();await new Promise(setImmediate);assert.ok(c.nodes(c.render(),'strong').some(n=>Array.isArray(n.props.children)&&n.props.children.join('')==='Test Aday'));
 failSettings=false;await c.nodes(c.render(),'button').find(n=>n.props.children==='refresh').props.onClick();await new Promise(setImmediate);
 c.nodes(c.render(),'input')[0].props.onChange({target:{value:'TR-DRAFT'}});
 await c.nodes(c.render(),'button').find(n=>n.props.children==='refresh').props.onClick();await new Promise(setImmediate);
 assert.equal(c.nodes(c.render(),'input')[0].props.value,'TR-DRAFT');
});

test('lost application response shows an uncertain result instead of inviting a blind retry',async()=>{
 const c=component(app,'ApplicationsClient',{fetch:async()=>{throw new Error('offline');}});fill(c);await c.submit();assert.ok(c.nodes(c.render(),'feedback').some(n=>n.props.feedback.kind==='uncertain'));
});

test('approved receipt is removed locally when the followup list request fails',async()=>{
 let wrote=false;const c=component('../../components/panel/PaymentsClient.tsx','PaymentsClient',{fetch:async(url,init)=>{
 if(init?.method==='POST'){wrote=true;return response({ok:true});}
 if(url.includes('payment-settings'))return response({});if(url.includes('receipt='))return response({url:'https://example.com/r',mime:'application/pdf'});
 return wrote?response({},503):response({items:[receipt],hasMore:false});
 }});c.render();c.runEffects();await new Promise(setImmediate);await c.nodes(c.render(),'button').find(n=>n.props.children==='view').props.onClick();await new Promise(setImmediate);await c.nodes(c.render(),'button').find(n=>n.props.children==='approve').props.onClick();await new Promise(setImmediate);
 assert.ok(!c.nodes(c.render(),'button').some(n=>n.props.children==='view'));assert.ok(c.nodes(c.render(),'feedback').some(n=>n.props.feedback.kind==='success'));
});
test('receipt filter and review buttons are locked while acceptance is pending',async()=>{
 let finish;const c=component('../../components/panel/PaymentsClient.tsx','PaymentsClient',{fetch:async(url,init)=>{
 if(init?.method==='POST')return new Promise(resolve=>finish=resolve);if(url.includes('payment-settings'))return response({});if(url.includes('receipt='))return response({url:'https://example.com/r',mime:'application/pdf'});return response({items:[receipt],hasMore:false});
 }});c.render();c.runEffects();await new Promise(setImmediate);await c.nodes(c.render(),'button').find(n=>n.props.children==='view').props.onClick();await new Promise(setImmediate);
 const waiting=c.nodes(c.render(),'button').find(n=>n.props.children==='approve').props.onClick();
 assert.equal(c.nodes(c.render(),'select')[0].props.disabled,true);assert.equal(c.nodes(c.render(),'button').find(n=>n.props.children==='view').props.disabled,true);finish(response({ok:true}));await waiting;
});
