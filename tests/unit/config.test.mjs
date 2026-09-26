import test from 'node:test';
import assert from 'node:assert/strict';
import { hasPublicSupabaseConfig } from '../../lib/supabase/config.ts';

test('login can show setup state when Supabase public config is absent', () => {
  assert.equal(hasPublicSupabaseConfig({}), false);
  assert.equal(hasPublicSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co' }), false);
  assert.equal(hasPublicSupabaseConfig({ NEXT_PUBLIC_SUPABASE_URL: 'https://example.supabase.co', NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x' }), true);
});
