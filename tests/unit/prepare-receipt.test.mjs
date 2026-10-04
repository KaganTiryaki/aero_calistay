import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareReceipt } from '../../lib/participant/prepare-receipt.ts';
const jpeg = () => new Blob([new Uint8Array([255,216,255,224,0])], {type:'image/jpeg'});
const png = new Uint8Array([137,80,78,71,13,10,26,10]);
const ftyp = brand => new Uint8Array([0,0,0,24,...Buffer.from('ftyp'+brand),0,0,0,0,...Buffer.from(brand+'mif1')]);
test('phone files with blank or incorrect MIME are detected from bytes',async()=>{
 const p=await prepareReceipt(new File([png],'screenshot.PNG',{type:''}));assert.equal(p.type,'image/png');assert.deepEqual(new Uint8Array(await p.arrayBuffer()),png);
 const pdf=await prepareReceipt(new File(['%PDF-1.7\n'],'bank.pdf',{type:'application/octet-stream'}));assert.equal(pdf.type,'application/pdf');
});
test('HEIC and HEIF are converted to a JPEG that administrators can open',async()=>{
 for(const brand of ['heic','heix','mif1']){let converted=0;const p=await prepareReceipt(new File([ftyp(brand)],'photo.HEIC',{type:'image/heic'}),{heicToJpeg:async()=>{converted++;return jpeg();}});assert.equal(converted,1);assert.equal(p.type,'image/jpeg');assert.match(p.name,/\.jpg$/);}
});
test('WebP, GIF, BMP and AVIF phone images are normalized rather than uploaded with unsupported MIME',async()=>{
 const images=[new Uint8Array([...Buffer.from('RIFF'),0,0,0,0,...Buffer.from('WEBP')]),Buffer.from('GIF89a'),Buffer.from('BM'),ftyp('avif')];
 for(const bytes of images){let converted=0;const p=await prepareReceipt(new File([bytes],'receipt',{type:''}),{imageToJpeg:async()=>{converted++;return jpeg();}});assert.equal(converted,1);assert.equal(p.type,'image/jpeg');}
});
test('large phone screenshots are compressed, while oversized PDFs and disguised files fail before upload',async()=>{
 const p=await prepareReceipt(new File([png,new Uint8Array(6*1024*1024)],'large.png'),{imageToJpeg:async()=>jpeg()});assert.equal(p.type,'image/jpeg');assert.ok(p.size<5242880);
 await assert.rejects(prepareReceipt(new File(['%PDF-',new Uint8Array(5242880)],'large.pdf')),/büyük/);
 await assert.rejects(prepareReceipt(new File(['<svg onload="evil()">'],'fake.png',{type:'image/png'})),/seçin/);
 await assert.rejects(prepareReceipt(new File([ftyp('heic')],'broken.heic'),{heicToJpeg:async()=>{throw Error('decode failed');}}),/açılamadı/);
});
