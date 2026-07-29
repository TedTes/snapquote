alter table snapquote.quotes
  add column if not exists archived_at timestamptz;

create index if not exists quotes_org_active_updated_idx
  on snapquote.quotes(org_id, updated_at desc)
  where archived_at is null;

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
      'customer_replied',
      'superseded',
      'payment_started',
      'payment_paid',
      'payment_failed',
      'archived'
    )
  );

create or replace view public.snapquote_quotes
with (security_invoker = true) as
select * from snapquote.quotes;

create or replace view public.snapquote_quote_events
with (security_invoker = true) as
select * from snapquote.quote_events;

grant select, insert, update, delete on public.snapquote_quotes to service_role;
grant select, insert, update, delete on public.snapquote_quote_events to service_role;
