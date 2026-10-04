import test from 'node:test';
import assert from 'node:assert/strict';
import {component} from '../helpers/client-component.mjs';

test('a rejected batch that does not exist unlocks the committee and candidate selection',async()=>{
 const committeeId='55555555-5555-4555-8555-555555555555';
 const applicationId='44444444-4444-4444-8444-444444444444';
 const draft={committeeId,people:[{id:applicationId,firstName:'Test',lastName:'Kişi',email:'test@example.com',version:1}]};
 const values=new Map();
 const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};
 const calls=[];
 const fetch=async(url,options={})=>{
  calls.push({url,method:options.method??'GET'});
  if(url==='/api/panel/committees')return {ok:true,json:async()=>({items:[{id:committeeId,name:'Hukuk',active:true}]})};
  if(url.startsWith('/api/panel/applications?'))return {ok:true,json:async()=>({items:[],total:0})};
  if(url==='/api/panel/batches'&&options.method==='POST')return {ok:false,status:409,json:async()=>({error:'Seçim değişti; listeyi yenileyin.'})};
  if(url.startsWith('/api/panel/batches?batchId='))return {ok:false,status:404,json:async()=>({error:'Gönderim grubu bulunamadı.'})};
  throw new Error(url);
 };
 const c=component('../../components/panel/ApprovalClient.tsx','ApprovalClient',{fetch,storage,moduleStubs:{
  '@/lib/panel/approval-selection':{approvalAttemptKey:'attempt',emptyApprovalDraft:{committeeId:'',people:[]},persistApprovalDraft(){},readApprovalDraft:()=>draft,toSelections:()=>[{applicationId,version:1,committeeId}],changeCommittee:()=>draft,toggleCandidate:()=>draft},
  '@/lib/mail/approval-template':{renderApprovalMail:()=>({text:'Örnek',subject:'Kabul',html:'Örnek'})},
  '@/lib/panel/approval-dispatch':{dispatchDecision:()=> 'stop'},
  './ApprovalCandidates':{ApprovalCandidates:()=>null},
 }});
 c.render();c.effects.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));
 const send=c.nodes(c.render(),'button').find(node=>typeof node.props.children==='string'&&node.props.children.includes('kişiye kabul e-postası gönder'));
 assert.ok(send);send.props.onClick();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(values.has('attempt'),false,JSON.stringify({calls,message:c.nodes(c.render(),'p').map(node=>node.props.children)}));
 assert.ok(calls.some(call=>call.method==='GET'&&call.url.startsWith('/api/panel/batches?batchId=')));
 const after=c.render();
 assert.equal(c.nodes(after,'select')[0].props.disabled,false);
 assert.ok(c.nodes(after,'button').some(node=>typeof node.props.children==='string'&&node.props.children.includes('kişiye kabul e-postası gönder')));
});

test('completed acceptance retains committee and count after the draft is cleared',async()=>{
 const draft={committeeId:'c',people:[{id:'a',firstName:'Test',lastName:'Aday',email:'t@example.com',version:1}]};
 const outcome={batchId:'batch',dispatchReady:true,canContinue:false,acceptedTotal:1,deliveredTotal:0,pending:0,failedTotal:0,uncertainTotal:0};
 const c=component('../../components/panel/ApprovalClient.tsx','ApprovalClient',{fetch:async(url,init)=>({ok:true,json:async()=>url.includes('committees')?{items:[{id:'c',name:'Sanat',active:true}]}:url.includes('applications')?{items:[],total:0}:{...outcome,batchId:JSON.parse(init.body).batchId}}),moduleStubs:{
 '@/lib/panel/approval-selection':{approvalAttemptKey:'attempt',emptyApprovalDraft:{committeeId:'',people:[]},persistApprovalDraft(){},readApprovalDraft:()=>draft,toSelections:()=>[{applicationId:'a',version:1,committeeId:'c'}],changeCommittee:()=>draft,toggleCandidate:()=>draft},
 '@/lib/mail/approval-template':{renderApprovalMail:()=>({text:'Örnek'})},'@/lib/panel/approval-dispatch':{dispatchDecision:()=> 'stop'},'./ApprovalCandidates':{ApprovalCandidates:'candidates'},
 }});
 c.render();c.runEffects();await new Promise(setImmediate);
 const send=c.nodes(c.render(),'button').find(n=>String(n.props.children).includes('kişiye kabul e-postası gönder'));
 await send.props.onClick();await new Promise(setImmediate);
 const result=c.nodes(c.render(),'feedback')[0]?.props.feedback;
 assert.equal(result?.kind,'success');assert.equal(result?.subject.name,'Sanat · 1 aday');assert.match(result.description,/Teslim edildiği doğrulanan: 0/);
});

test('a successful candidate search clears only the earlier loading error',async()=>{
 let fail=true;const draft={committeeId:'c',people:[]};const c=component('../../components/panel/ApprovalClient.tsx','ApprovalClient',{fetch:async url=>url.includes('committees')?{ok:true,json:async()=>({items:[{id:'c',name:'Sanat',active:true}]})}:fail?{ok:false}:{ok:true,json:async()=>({items:[],total:0})},moduleStubs:{
 '@/lib/panel/approval-selection':{approvalAttemptKey:'attempt',emptyApprovalDraft:{committeeId:'',people:[]},persistApprovalDraft(){},readApprovalDraft:()=>draft,toSelections:()=>[],changeCommittee:()=>draft,toggleCandidate:()=>draft},
 '@/lib/mail/approval-template':{renderApprovalMail:()=>({text:'Örnek'})},'@/lib/panel/approval-dispatch':{dispatchDecision:()=> 'stop'},'./ApprovalCandidates':{ApprovalCandidates:'candidates'},
 }});c.render();c.runEffects();await new Promise(setImmediate);c.render();c.runEffects();await new Promise(setImmediate);
 assert.ok(c.nodes(c.render(),'p').some(n=>String(n.props.children).includes('Adaylar yüklenemedi')));fail=false;
 c.nodes(c.render(),'input')[0].props.onChange({target:{value:'Test'}});await c.submit();c.render();c.runEffects();await new Promise(setImmediate);
 assert.ok(!c.nodes(c.render(),'p').some(n=>String(n.props.children).includes('Adaylar yüklenemedi')));
});
