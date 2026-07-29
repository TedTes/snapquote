alter table snapquote.orgs
  add column if not exists deposit_policy text not null default 'optional';

alter table snapquote.quotes
  add column if not exists deposit_policy text not null default 'optional';

alter table snapquote.orgs
  drop constraint if exists orgs_deposit_policy_check;

alter table snapquote.orgs
  add constraint orgs_deposit_policy_check
  check (deposit_policy in ('none', 'optional', 'required'));

alter table snapquote.quotes
  drop constraint if exists quotes_deposit_policy_check;

alter table snapquote.quotes
  add constraint quotes_deposit_policy_check
  check (deposit_policy in ('none', 'optional', 'required'));

update snapquote.quotes q
set deposit_policy = coalesce(o.deposit_policy, 'optional')
from snapquote.orgs o
where q.org_id = o.id
  and q.deposit_policy is distinct from coalesce(o.deposit_policy, 'optional');

create or replace view public.snapquote_orgs
with (security_invoker = true) as
select * from snapquote.orgs;

create or replace view public.snapquote_quotes
with (security_invoker = true) as
select * from snapquote.quotes;

revoke all on public.snapquote_orgs, public.snapquote_quotes from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_orgs to service_role;
grant select, insert, update, delete on public.snapquote_quotes to service_role;
