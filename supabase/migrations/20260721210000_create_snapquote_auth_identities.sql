create table if not exists snapquote.auth_identities (
  id uuid primary key default gen_random_uuid(),
  org_member_id uuid not null references snapquote.org_members(id) on delete cascade,
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create unique index if not exists auth_identities_email_unique_idx
on snapquote.auth_identities (lower(email));

drop trigger if exists set_auth_identities_updated_at on snapquote.auth_identities;
create trigger set_auth_identities_updated_at
before update on snapquote.auth_identities
for each row execute function snapquote.set_updated_at();

alter table snapquote.auth_identities enable row level security;

create or replace view public.snapquote_auth_identities as
select * from snapquote.auth_identities;

revoke all on public.snapquote_auth_identities from public, anon, authenticated;

grant select, insert, update, delete on public.snapquote_auth_identities to service_role;
