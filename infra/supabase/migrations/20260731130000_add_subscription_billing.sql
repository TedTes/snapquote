alter table snapquote.orgs
  add column if not exists stripe_billing_customer_id text,
  add column if not exists stripe_billing_subscription_id text,
  add column if not exists stripe_billing_status text not null default 'trial',
  add column if not exists billing_current_period_end timestamptz,
  add column if not exists billing_cancel_at_period_end boolean not null default false,
  add column if not exists billing_checkout_session_id text,
  add column if not exists billing_updated_at timestamptz;

alter table snapquote.orgs
  drop constraint if exists orgs_stripe_billing_status_check;

alter table snapquote.orgs
  add constraint orgs_stripe_billing_status_check
  check (
    stripe_billing_status in (
      'trial',
      'checkout_started',
      'active',
      'trialing',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired',
      'paused'
    )
  );

update snapquote.orgs
set stripe_billing_status = case
  when plan in ('solo', 'crew') then 'active'
  when plan = 'expired' then 'canceled'
  else stripe_billing_status
end
where stripe_billing_status = 'trial';

create unique index if not exists orgs_stripe_billing_customer_idx
  on snapquote.orgs(stripe_billing_customer_id)
  where stripe_billing_customer_id is not null;

create unique index if not exists orgs_stripe_billing_subscription_idx
  on snapquote.orgs(stripe_billing_subscription_id)
  where stripe_billing_subscription_id is not null;

create index if not exists orgs_stripe_billing_status_idx
  on snapquote.orgs(stripe_billing_status);

create or replace view public.snapquote_orgs
with (security_invoker = true) as
select * from snapquote.orgs;

revoke all on public.snapquote_orgs from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_orgs to service_role;
