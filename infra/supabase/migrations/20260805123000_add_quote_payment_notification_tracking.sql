alter table snapquote.quote_payments
  add column if not exists customer_receipt_status text not null default 'pending'
    check (customer_receipt_status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  add column if not exists customer_receipt_sent_at timestamptz,
  add column if not exists customer_receipt_message_id text,
  add column if not exists provider_notice_status text not null default 'pending'
    check (provider_notice_status in ('pending', 'sending', 'sent', 'failed', 'skipped')),
  add column if not exists provider_notice_sent_at timestamptz,
  add column if not exists provider_notice_message_id text;

create or replace view public.snapquote_quote_payments
with (security_invoker = true) as
select * from snapquote.quote_payments;

grant select, insert, update, delete on snapquote.quote_payments to service_role;
grant select, insert, update, delete on public.snapquote_quote_payments to service_role;
