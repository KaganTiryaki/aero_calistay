-- Server-written login and management activity. The client can only read it as an active admin.
create table public.admin_activity (
  id bigint generated always as identity primary key,
  actor_id uuid references auth.users(id),
  event_id uuid references public.events(id),
  session_id uuid,
  device_id uuid,
  action text not null check (length(action) between 1 and 80),
  target_id uuid,
  outcome text not null default 'started' check (outcome in ('started', 'succeeded', 'denied')),
  ip_address inet,
  user_agent text check (length(user_agent) <= 512),
  platform text check (length(platform) <= 80),
  device_class text not null check (device_class in ('mobile', 'desktop', 'unknown')),
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index admin_activity_created_idx on public.admin_activity (created_at desc, id desc);
create index admin_activity_session_idx on public.admin_activity (session_id, created_at desc);
create index admin_activity_device_idx on public.admin_activity (device_id, created_at desc);
alter table public.admin_activity enable row level security;
grant select on public.admin_activity to authenticated;
create policy admin_read_activity on public.admin_activity for select to authenticated
  using ((select private.has_staff_role('admin')));
