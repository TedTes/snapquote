alter table snapquote.orgs
  add column if not exists profile_services text[] not null default '{}';

alter table snapquote.orgs
  drop constraint if exists orgs_profile_services_count_check,
  add constraint orgs_profile_services_count_check
    check (cardinality(profile_services) <= 12);

create or replace view public.snapquote_orgs
with (security_invoker = true) as
select * from snapquote.orgs;

revoke all on public.snapquote_orgs from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_orgs to service_role;
