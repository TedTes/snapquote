alter table snapquote.quotes
  add column if not exists customer_name text not null default 'Unnamed customer',
  add column if not exists customer_email text,
  add column if not exists customer_phone text;

with quote_customer_backfill as (
  select
    q.id,
    nullif(
      trim(
        regexp_replace(
          substring(q.scope_summary from '^([^:]{1,160}):'),
          '^Painting quote for[[:space:]]+',
          '',
          'i'
        )
      ),
      ''
    ) as scope_customer_name,
    c.name,
    c.email,
    c.phone
  from snapquote.quotes q
  join snapquote.customers c on q.customer_id = c.id
)
update snapquote.quotes q
set
  customer_name = coalesce(
    nullif(nullif(trim(q.customer_name), ''), 'Unnamed customer'),
    b.scope_customer_name,
    b.name,
    'Unnamed customer'
  ),
  customer_email = coalesce(q.customer_email, b.email),
  customer_phone = coalesce(q.customer_phone, b.phone)
from quote_customer_backfill b
where q.id = b.id
  and (
    q.customer_name = 'Unnamed customer'
    or q.customer_email is null
    or q.customer_phone is null
  );

alter table snapquote.quotes
  drop constraint if exists quotes_customer_name_check;

alter table snapquote.quotes
  add constraint quotes_customer_name_check
  check (length(trim(customer_name)) between 1 and 160);

create or replace view public.snapquote_quotes
with (security_invoker = true) as
select * from snapquote.quotes;

grant select, insert, update, delete on public.snapquote_quotes to service_role;
