alter table snapquote.orgs
  add column if not exists stripe_account_id text,
  add column if not exists stripe_charges_enabled boolean not null default false,
  add column if not exists stripe_payouts_enabled boolean not null default false,
  add column if not exists payment_currency text not null default 'cad',
  add column if not exists default_deposit_percent numeric(5,2) not null default 50
    check (default_deposit_percent >= 0 and default_deposit_percent <= 100);

alter table snapquote.quotes
  add column if not exists payment_status text not null default 'not_requested'
    check (payment_status in ('not_requested', 'checkout_created', 'paid', 'failed', 'refunded')),
  add column if not exists deposit_percent numeric(5,2) not null default 50
    check (deposit_percent >= 0 and deposit_percent <= 100),
  add column if not exists deposit_amount_cents integer check (deposit_amount_cents is null or deposit_amount_cents >= 0),
  add column if not exists paid_amount_cents integer not null default 0 check (paid_amount_cents >= 0),
  add column if not exists payment_currency text not null default 'cad',
  add column if not exists paid_at timestamptz,
  add column if not exists stripe_checkout_session_id text,
  add column if not exists stripe_payment_intent_id text;

create table if not exists snapquote.quote_payments (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references snapquote.quotes(id) on delete cascade,
  provider text not null default 'stripe' check (provider in ('stripe')),
  provider_account_id text,
  provider_checkout_session_id text unique,
  provider_payment_intent_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'cad',
  status text not null default 'checkout_created'
    check (status in ('checkout_created', 'paid', 'failed', 'expired', 'refunded')),
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  raw_event jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists quote_payments_quote_created_idx
  on snapquote.quote_payments(quote_id, created_at desc);

create index if not exists quote_payments_session_idx
  on snapquote.quote_payments(provider_checkout_session_id);

drop trigger if exists set_quote_payments_updated_at on snapquote.quote_payments;
create trigger set_quote_payments_updated_at
before update on snapquote.quote_payments
for each row execute function snapquote.set_updated_at();

alter table snapquote.quote_payments enable row level security;

alter table snapquote.quote_events
  drop constraint if exists quote_events_type_check;

alter table snapquote.quote_events
  add constraint quote_events_type_check check (
    type in (
      'created',
      'sent',
      'viewed',
      'accepted',
      'declined',
      'expired',
      'followed_up',
      'superseded',
      'payment_started',
      'payment_paid',
      'payment_failed'
    )
  );

create or replace view public.snapquote_orgs
with (security_invoker = true) as
select * from snapquote.orgs;

create or replace view public.snapquote_quotes
with (security_invoker = true) as
select * from snapquote.quotes;

create or replace view public.snapquote_quote_events
with (security_invoker = true) as
select * from snapquote.quote_events;

create or replace view public.snapquote_quote_payments
with (security_invoker = true) as
select * from snapquote.quote_payments;

grant select, insert, update, delete on snapquote.quote_payments to service_role;
grant select, insert, update, delete on public.snapquote_quote_payments to service_role;
