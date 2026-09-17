create table if not exists snapquote.push_devices (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  org_member_id uuid not null references snapquote.org_members(id) on delete cascade,
  expo_push_token text not null unique,
  platform text not null check (platform in ('ios', 'android')),
  active boolean not null default true,
  last_registered_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists push_devices_org_active_idx
  on snapquote.push_devices(org_id, active)
  where active = true;

drop trigger if exists set_push_devices_updated_at on snapquote.push_devices;
create trigger set_push_devices_updated_at
before update on snapquote.push_devices
for each row execute function snapquote.set_updated_at();

alter table snapquote.push_devices enable row level security;

revoke all on snapquote.push_devices from public, anon, authenticated;
grant select, insert, update, delete on snapquote.push_devices to service_role;

create or replace view public.snapquote_push_devices as
select * from snapquote.push_devices;

revoke all on public.snapquote_push_devices from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_push_devices to service_role;
