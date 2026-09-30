import test from 'node:test';
import assert from 'node:assert/strict';
import { sameOrigin, safeCsvCell, verifyBearer, safeReturnPath, requestTargetOrigin } from '../../lib/security.ts';

test('state changing requests reject cross-origin submissions', () => {
  assert.equal(sameOrigin('https://aerocalistay.org', 'https://aerocalistay.org'), true);
  assert.equal(sameOrigin('https://evil.example', 'https://aerocalistay.org'), false);
  assert.equal(sameOrigin(null, 'https://aerocalistay.org'), false);
});

test('origin checks use the browser-facing Host even when Next rewrites localhost internally', () => {
  const headers = new Headers({ host: '127.0.0.1:3000', 'x-forwarded-proto': 'http' });
  assert.equal(requestTargetOrigin(headers, 'http:'), 'http://127.0.0.1:3000');
  assert.equal(sameOrigin('http://127.0.0.1:3000', requestTargetOrigin(headers, 'http:')), true);
  assert.equal(sameOrigin('https://evil.example', requestTargetOrigin(headers, 'http:')), false);
});

test('CSV export neutralizes formula-leading cells', () => {
  assert.equal(safeCsvCell('=HYPERLINK("evil")'), "'=HYPERLINK(" + '"evil")');
  assert.equal(safeCsvCell('  +SUM(1)'), "'  +SUM(1)");
  assert.equal(safeCsvCell('Ayşe'), 'Ayşe');
});

test('webhook bearer compares the complete token', () => {
  assert.equal(verifyBearer('Bearer abc123', 'abc123'), true);
  assert.equal(verifyBearer('Bearer abc12', 'abc123'), false);
  assert.equal(verifyBearer(null, 'abc123'), false);
});

test('auth callback redirect stays on this site', () => {
  assert.equal(safeReturnPath('/giris?recovery=1'), '/giris?recovery=1');
  assert.equal(safeReturnPath('https://evil.example/'), '/giris');
  assert.equal(safeReturnPath('//evil.example/'), '/giris');
});
