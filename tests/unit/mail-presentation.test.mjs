import test from 'node:test';
import assert from 'node:assert/strict';
import { presentMailJob } from '../../lib/mail/presentation.ts';

test('provider acceptance without delivery event is clearly pending confirmation',()=>{
 assert.equal(presentMailJob({status:'provider_accepted',delivery_status:'unknown',last_error:null}).label,'Gönderildi · teslimat bildirimi bekleniyor');
 assert.equal(presentMailJob({status:'queued',delivery_status:'unknown',last_error:null}).label,'Gönderim sırası bekliyor');
});

test('a later bounce outranks previous provider acceptance',()=>{
 const result=presentMailJob({status:'provider_accepted',delivery_status:'hard_bounced',last_error:'provider detail'});
 assert.equal(result.label,'Adrese teslim edilemedi');
 assert.equal(result.tone,'bad');
 assert.equal(result.detail,'provider detail');
});

test('unknown state does not display raw codes in the main list',()=>{
 assert.equal(presentMailJob({status:'unexpected_provider_state',delivery_status:'unknown',last_error:null}).label,'Durum kontrol ediliyor');
});
