import { createClient } from '@supabase/supabase-js';

const email = process.argv[2]?.trim().toLowerCase();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY;
if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !url || !key) {
  console.error('Usage: node --env-file=.env.local scripts/bootstrap-admin.mjs admin@example.com');
  process.exit(2);
}
const client = createClient(url, key, { auth: { persistSession: false } });
const { data: event, error: eventError } = await client.from('events').select('id').limit(1).single();
if (eventError || !event) throw eventError ?? new Error('Event not found; apply migrations first.');
const site = process.env.NEXT_PUBLIC_SITE_URL;
if (!site) throw new Error('NEXT_PUBLIC_SITE_URL is required for invitation redirect.');
const redirectTo = `${site}/auth/callback?next=${encodeURIComponent('/giris?recovery=1')}`;
const { data: invitation, error: inviteError } = await client.auth.admin.inviteUserByEmail(email, { redirectTo });
let user = invitation.user;
if (!user) {
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await client.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    user = data.users.find((candidate) => candidate.email?.toLowerCase() === email) ?? null;
    if (user || data.users.length < 200) break;
  }
  if (!user) throw inviteError ?? new Error('Invitation failed.');
}
const { error } = await client.from('staff_members').upsert({
  user_id: user.id, event_id: event.id, role: 'admin', active: true,
}, { onConflict: 'user_id,event_id' });
if (error) throw error;
console.log(inviteError ? 'Existing auth user assigned active admin role.' : 'Admin invitation and active role created.');
