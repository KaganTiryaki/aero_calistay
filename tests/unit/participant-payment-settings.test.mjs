import test from 'node:test';
import assert from 'node:assert/strict';
import {loadPanelRoute,staff,selection} from '../helpers/panel-route.mjs';
test('payment settings accept absent IBAN, amount and deadline without losing the portal',async()=>{
 const saved=[];const db={from:()=>({update:value=>({eq:async(...scope)=>{saved.push({value,scope});return {error:null};}})})};
 const f=loadPanelRoute('payment-settings',{staff,db});const response=await f.PATCH(f.request({iban:null,amountMinor:null,deadline:null,portalUrl:'https://example.com/katilimci'}));
 assert.equal(response.status,200);assert.equal(saved[0].value.payment_deadline,null);assert.equal(saved[0].value.payment_iban,null);assert.equal(saved[0].value.payment_amount_minor,null);assert.deepEqual(saved[0].scope,['id',staff.eventId]);
});
test('expected payment amount PATCH requires a positive integer, reason and application version',async()=>{
 const calls=[];const db={rpc:async(name,args)=>{calls.push({name,args});return {data:true,error:null};}};const f=loadPanelRoute('payments',{staff,db});
 assert.equal(typeof f.PATCH,'function');
 const input={applicationId:selection.applicationId,applicationVersion:2,expectedAmountMinor:150000,reason:'Güncel katılım ücreti'};
 assert.equal((await f.PATCH(f.request(input))).status,200);assert.equal(calls[0].name,'set_application_payment_amount');assert.equal(calls[0].args.p_expected_version,2);
 for(const bad of [{...input,expectedAmountMinor:0},{...input,reason:''},{...input,applicationVersion:undefined}])assert.equal((await f.PATCH(f.request(bad))).status,400);
 assert.equal(calls.length,1);
});
