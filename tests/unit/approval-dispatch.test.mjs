import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchDecision } from '../../lib/panel/approval-dispatch.ts';

const outcome={dispatchReady:true,canContinue:true,pending:9,failedTotal:0,uncertainTotal:0};
test('bulk dispatch advances only while queued jobs make progress',()=>{
 assert.equal(dispatchDecision(outcome,12),'continue');
 assert.equal(dispatchDecision({...outcome,pending:12},12),'stop');
 assert.equal(dispatchDecision({...outcome,canContinue:false},12),'stop');
 assert.equal(dispatchDecision({...outcome,pending:0,canContinue:false},3),'complete');
});
test('quota, uncertainty, worker failure and per-job failure stop automatic sending',()=>{
 for(const patch of [{dispatchReady:false},{uncertainTotal:1},{failedTotal:1},{canContinue:false}])
  assert.equal(dispatchDecision({...outcome,...patch},12),'stop');
});
