import test from 'node:test';import assert from 'node:assert/strict';
import {loadPanelRoute,staff} from '../helpers/panel-route.mjs';
test('inviting the acting administrator cannot demote that administrator',async()=>{
 let writes=0;const db={rpc:async()=>({data:staff.userId,error:null}),from:()=>({upsert:async()=>{writes++;return {error:null};}})};
 const f=loadPanelRoute('staff',{db,staff});const response=await f.POST(f.request({email:'admin@example.com'}));
 assert.equal(response.status,409);assert.equal(writes,0);
});
