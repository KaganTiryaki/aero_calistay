import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
const email = process.env.ADMIN_LOGIN_EMAIL?.trim().toLowerCase() || 'aero-shared-admin@example.com';
if (!url || !key || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  throw new Error('Supabase URL, server key, and a valid ADMIN_LOGIN_EMAIL are required.');
}

const client = createClient(url, key, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { headers: { 'User-Agent': 'aero-admin-setup/1.0' } },
});
const { data: events, error: eventsError } = await client.from('events').select('id').limit(2);
if (eventsError || events?.length !== 1) throw new Error('Exactly one event must exist before administrator setup.');
const { error: activityError } = await client.from('admin_activity').select('id', { head: true }).limit(1);
if (activityError) throw new Error('Apply the administrator activity migration before account setup.');
const { data: existing, error: usersError } = await client.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (usersError) throw usersError;
if (existing.users.some((user) => user.email?.toLowerCase() === email)) {
  throw new Error('This shared administrator account already exists; setup will not overwrite it.');
}

const password = randomBytes(32).toString('base64url');
const output = join(homedir(), 'Documents', `AERO-ortak-yonetici-sifresi-${Date.now()}.txt`);
mkdirSync(dirname(output), { recursive: true });
if (existsSync(output)) throw new Error('Credential output file already exists.');
writeFileSync(output, `AERO ortak yönetici şifresi\nHesap: ${email}\nŞifre: ${password}\n\nBu dosyayı 15 yöneticiye güvenli bir kanaldan ilettikten sonra silin.\n`,
  { flag: 'wx', mode: 0o600 });

try {
  const { data: created, error: createError } = await client.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (createError || !created.user) throw createError ?? new Error('Auth account could not be created.');
  const { error: roleError } = await client.from('staff_members').insert({
    user_id: created.user.id, event_id: events[0].id, role: 'admin', active: true,
  });
  if (roleError) {
    await client.auth.admin.deleteUser(created.user.id);
    throw roleError;
  }
} catch (error) {
  unlinkSync(output);
  throw error;
}

const envPath = join(process.cwd(), '.env.local');
const envText = readFileSync(envPath, 'utf8');
if (!/^ADMIN_LOGIN_EMAIL=.+$/m.test(envText)) {
  writeFileSync(envPath, `${envText.trimEnd()}\nADMIN_LOGIN_EMAIL=${email}\n`);
}
console.log(`Shared administrator created. One-time credential file: ${output}`);
