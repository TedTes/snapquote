alter table snapquote.orgs
add column if not exists contact_phone text,
add column if not exists website text;

create or replace view public.snapquote_orgs as
select * from snapquote.orgs;

revoke all on public.snapquote_orgs from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_orgs to service_role;

insert into storage.buckets (id, name, public)
values ('snapquote-avatars', 'snapquote-avatars', true)
on conflict (id) do update set public = true;
