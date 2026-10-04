import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadPanelRoute, staff, selection } from '../helpers/panel-route.mjs';
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
