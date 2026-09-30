import test from 'node:test';
import assert from 'node:assert/strict';
import { requestMetadata } from '../../lib/activity/metadata.ts';

test('activity metadata keeps useful network and device hints without trusting arbitrary text as an IP', () => {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.17, 10.0.0.2',
    'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    'sec-ch-ua-platform': '"Windows"',
    'sec-ch-ua-mobile': '?0',
  });
  assert.deepEqual(requestMetadata(headers), {
    ipAddress: '203.0.113.17',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0',
    platform: 'Windows',
    deviceClass: 'desktop',
  });
  assert.equal(requestMetadata(new Headers({ 'x-forwarded-for': 'not-an-ip' })).ipAddress, null);
});
