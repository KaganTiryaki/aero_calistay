import test from 'node:test';
import assert from 'node:assert/strict';
import { isSharedAdminAuthorized } from '../../lib/auth/login-policy.ts';

test('shared password never grants panel access to staff, inactive, or another account', () => {
  const account = '11111111-1111-4111-8111-111111111111';
  assert.equal(isSharedAdminAuthorized(account, { user_id: account, role: 'admin', active: true }), true);
  assert.equal(isSharedAdminAuthorized(account, { user_id: account, role: 'staff', active: true }), false);
  assert.equal(isSharedAdminAuthorized(account, { user_id: account, role: 'admin', active: false }), false);
  assert.equal(isSharedAdminAuthorized(account, { user_id: '22222222-2222-4222-8222-222222222222', role: 'admin', active: true }), false);
  assert.equal(isSharedAdminAuthorized(account, null), false);
});
