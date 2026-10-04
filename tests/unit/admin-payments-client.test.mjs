import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadPanelRoute, staff, selection } from '../helpers/panel-route.mjs';
import { component } from '../helpers/client-component.mjs';
const { NextRequest } = createRequire(import.meta.url)('next/server');

const receiptId = '66666666-6666-4666-8666-666666666666';

function routeDb({mime='application/pdf', appEvent=staff.eventId, status='under_review'}={}) {
 const signed=[];
 const db={
  from(table) {
   const query={select(){return query;},eq(){return query;},single:async()=>({data:{storage_object_id:'private/receipt',application_id:selection.applicationId,expected_mime:mime,status},error:null}),maybeSingle:async()=>({data:appEvent===staff.eventId?{id:selection.applicationId}:null,error:null})};
   assert.ok(['payment_submissions','applications'].includes(table));
   return query;
  },
  storage:{from:()=>({
   createSignedUrl:async(path,ttl,options)=>{
    signed.push({path,ttl,options});
    return {data:{signedUrl:'https://storage.example.com/signed'},error:null};
   },
  })},
 };
 return {db,signed};
}

function request(query='') {return new NextRequest(`https://test.example.com/api/panel/payments?receipt=${receiptId}${query}`);}

test('receipt preview is inline and download keeps the MIME extension',async()=>{
 const {db,signed}=routeDb();const route=loadPanelRoute('payments',{db,staff});
 const preview=await route.GET(request());assert.equal(preview.status,200);
 const previewBody=await preview.json();
 assert.equal(previewBody.url,'https://storage.example.com/signed');
 assert.equal(previewBody.mime,'application/pdf');
 assert.equal(previewBody.fileName,'dekont.pdf');
 assert.ok(!Number.isNaN(Date.parse(previewBody.expiresAt)));
 assert.equal(signed[0].options,undefined);
 const download=await route.GET(request('&download=1'));assert.equal(download.status,200);
 assert.equal(signed[1].options.download,'dekont.pdf');
 const jpeg=routeDb({mime:'image/jpeg'});const jpegRoute=loadPanelRoute('payments',{db:jpeg.db,staff});
 const jpegBody=await (await jpegRoute.GET(request('&download=1'))).json();
 assert.equal(jpegBody.fileName,'dekont.jpg');assert.equal(jpeg.signed[0].options.download,'dekont.jpg');
});

test('signed receipt access rejects other events, incomplete uploads and malformed options',async()=>{
 for(const options of [{appEvent:'77777777-7777-4777-8777-777777777777'},{status:'uploading'}]) {
  const {db,signed}=routeDb(options);const route=loadPanelRoute('payments',{db,staff});
  assert.notEqual((await route.GET(request())).status,200);assert.equal(signed.length,0);
 }
 const {db,signed}=routeDb();const route=loadPanelRoute('payments',{db,staff});
 assert.equal((await route.GET(request('&download=yes'))).status,400);assert.equal(signed.length,0);
});

test('a late signed URL cannot replace the preview of a newer receipt',async()=>{
 const pending=new Map();
 const receipt=(id,name)=>({id,version:1,status:'under_review',created_at:'2026-10-04T00:00:00Z',application:{id,version:1,first_name:name,last_name:'Test',email:`${name}@example.com`,committee_name:null,payment_amount_minor:100,payment_currency:'TRY'}});
 const a=receipt('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','A');
 const b=receipt('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','B');
 const fetch=async(url)=>{
  if(url.startsWith('/api/panel/payments?receipt='))return await new Promise(resolve=>pending.set(url.split('receipt=')[1],resolve));
  if(url.startsWith('/api/panel/payments?page='))return {ok:true,json:async()=>({items:[a,b],hasMore:false})};
  if(url==='/api/panel/payment-settings')return {ok:true,json:async()=>({})};
  throw new Error(url);
 };
 const c=component('../../components/panel/PaymentsClient.tsx','PaymentsClient',{fetch});
 c.render();c.effects.forEach(fn=>fn());await new Promise(resolve=>setImmediate(resolve));
 const viewButtons=c.nodes(c.render(),'button').filter(node=>node.props.children==='view');
 viewButtons[0].props.onClick();viewButtons[1].props.onClick();
 pending.get(b.id)({ok:true,json:async()=>({url:'https://example.com/B.pdf',mime:'application/pdf'})});
 await new Promise(resolve=>setImmediate(resolve));
 pending.get(a.id)({ok:true,json:async()=>({url:'https://example.com/A.pdf',mime:'application/pdf'})});
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(c.nodes(c.render(),'iframe')[0]?.props.src,'https://example.com/B.pdf');
});
