import test from 'node:test';
import assert from 'node:assert/strict';
import { changeCommittee, toggleCandidate, toSelections } from '../../lib/panel/approval-selection.ts';

const committee='55555555-5555-4555-8555-555555555555';
const other='66666666-6666-4666-8666-666666666666';
const candidate=(index)=>({id:`44444444-4444-4444-8444-${String(index).padStart(12,'0')}`,firstName:'Test',lastName:String(index),email:`person${index}@example.com`,version:1});

test('committee is required and changing it clears candidates',()=>{
 const blank={committeeId:'',people:[]};
 assert.throws(()=>toSelections(toggleCandidate(blank,candidate(1))),/komite/i);
 const selected=toggleCandidate(changeCommittee(blank,committee),candidate(1));
 assert.equal(selected.people.length,1);
 assert.deepEqual(toSelections(selected),[{applicationId:candidate(1).id,version:1,committeeId:committee}]);
 assert.equal(changeCommittee(selected,other).people.length,0);
});

test('candidate selection is stable across pages and capped at 500',()=>{
 let draft=changeCommittee({committeeId:'',people:[]},committee);
 for(let index=0;index<500;index++) draft=toggleCandidate(draft,candidate(index));
 assert.equal(draft.people.length,500);
 assert.throws(()=>toggleCandidate(draft,candidate(501)),/500/);
 assert.equal(toggleCandidate(draft,candidate(20)).people.length,499);
 assert.equal(toSelections(draft).every(item=>item.committeeId===committee),true);
});
