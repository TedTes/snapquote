alter table snapquote.orgs
add column if not exists setup_completed_at timestamptz;

create or replace view public.snapquote_orgs as
select * from snapquote.orgs;

revoke all on public.snapquote_orgs from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_orgs to service_role;
