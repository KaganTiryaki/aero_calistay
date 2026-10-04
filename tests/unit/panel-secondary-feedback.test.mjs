import test from 'node:test';
import assert from 'node:assert/strict';
import {component} from '../helpers/client-component.mjs';
const response=(body,status=200)=>new Response(JSON.stringify(body),{status});
test('invalid meal date is shown as an error without an unhandled rejection',async()=>{
 const c=component('../../components/panel/MealsClient.tsx','MealsClient',{fetch:async()=>response({items:[]})});
 c.nodes(c.render(),'input')[0].props.onChange({target:{value:'Öğle'}});await c.submit();
 assert.ok(c.nodes(c.render(),'feedback').some(n=>n.props.feedback.kind==='error'));
});
test('successful meal creation clears form but survives list failure',async()=>{
 const c=component('../../components/panel/MealsClient.tsx','MealsClient',{fetch:async(_url,init)=>init?.method==='POST'?response({ok:true}):response({},503)});
 for(const [i,value] of [[0,'Öğle'],[1,'2026-10-04T12:00'],[2,'2026-10-04T13:00']])c.nodes(c.render(),'input')[i].props.onChange({target:{value}});
 await c.submit();assert.equal(c.nodes(c.render(),'input')[0].props.value,'');assert.ok(c.nodes(c.render(),'feedback').some(n=>n.props.feedback.kind==='success'));
});
test('settings controls remain disabled until their section loads',()=>{
 const c=component('../../components/panel/SettingsClient.tsx','SettingsClient',{fetch:()=>new Promise(()=>{})});
 assert.ok(c.nodes(c.render(),'fieldset').length>=3);assert.ok(c.nodes(c.render(),'fieldset').every(n=>n.props.disabled));
});
test('mail initial load does not announce an empty history',async()=>{
 const c=component('../../components/panel/SendingClient.tsx','SendingClient',{fetch:async()=>response({batches:[],jobs:[],hasMore:false}),moduleStubs:{'@/lib/mail/status':{summarizeMailJobs:()=>({})},'@/lib/mail/presentation':{presentMailJob:()=>({})}}});
 assert.ok(c.nodes(c.render(),'p').some(n=>String(n.props.children).includes('yükleniyor')));
 c.runEffects();await new Promise(setImmediate);assert.ok(c.nodes(c.render(),'div').some(n=>n.props.className==='ops-empty'));
});
test('approved mutation network error is caught and pending state resets',async()=>{
 const person={id:'a',first_name:'Test',last_name:'Aday',email:'t@example.com'};
 const c=component('../../components/panel/ApprovedClient.tsx','ApprovedClient',{fetch:async()=>{throw new Error('offline');},moduleStubs:{'./useApproved':{useApproved:()=>({people:[person],error:'',refresh:async()=>{},loading:false,hasLoaded:true})}}});
 await c.nodes(c.render(),'button').find(n=>n.props.children==='rotate').props.onClick();
 assert.ok(c.nodes(c.render(),'feedback').some(n=>n.props.feedback.kind==='uncertain'));
 assert.ok(c.nodes(c.render(),'button').every(n=>!n.props.disabled));
});

test('mail paging is locked during dispatch so the old page cannot replace the new one',async()=>{
 let complete;const c=component('../../components/panel/SendingClient.tsx','SendingClient',{fetch:async(_url,init)=>init?.method==='POST'?new Promise(resolve=>complete=resolve):response({batches:[{id:'b',total:1,created_at:'2026-10-04'}],jobs:[],canContinueByBatch:{b:true},hasMore:true}),moduleStubs:{'@/lib/mail/status':{summarizeMailJobs:()=>({})},'@/lib/mail/presentation':{presentMailJob:()=>({})}}});
 c.render();c.runEffects();await new Promise(setImmediate);const pending=c.nodes(c.render(),'button').find(n=>n.props.children==='Kalan gönderimleri sürdür').props.onClick();
 assert.equal(c.nodes(c.render(),'button').find(n=>n.props.children==='Sonraki').props.disabled,true);complete(response({acceptedTotal:1,deliveredTotal:0,pending:0,failedTotal:0,uncertainTotal:0}));await pending;
});
