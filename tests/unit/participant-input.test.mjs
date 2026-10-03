import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReceipt } from '../../lib/participant/receipt.ts';
import { observeScan } from '../../lib/check-in/scan-gate.ts';

test('receipt validation rejects disguised, oversized and empty files',()=>{
 assert.equal(validateReceipt(new Uint8Array([137,80,78,71,13,10,26,10]),'image/png'),true);
 assert.equal(validateReceipt(new TextEncoder().encode('<html>fake</html>'),'image/png'),false);
 assert.equal(validateReceipt(new Uint8Array(),'application/pdf'),false);
 assert.equal(validateReceipt(new Uint8Array(5242881),'image/png'),false);
 assert.equal(validateReceipt(new TextEncoder().encode('%PDF-1.7\n'),'application/pdf'),true);
});

test('continuous same card is suppressed but a removed or different card is accepted',()=>{
 const state={code:'',lastSeen:0,blockedUntil:0};
 assert.equal(observeScan(state,'card-a',1000),true); state.blockedUntil=3000;
 for(let now=1100;now<=4000;now+=100) assert.equal(observeScan(state,'card-a',now),false);
 assert.equal(observeScan(state,'card-b',4100),true);
 assert.equal(observeScan(state,'card-b',5201),true);
});
