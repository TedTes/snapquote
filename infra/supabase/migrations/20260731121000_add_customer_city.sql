alter table snapquote.customers
  add column if not exists city text not null default '';

with customer_city_backfill as (
  select
    id,
    nullif(
      trim(
        case
          when coalesce(array_length(parts, 1), 0) >= 3
            and parts[array_length(parts, 1)] ~* '^([a-z]{2}|[a-z]{2}[[:space:]]+[a-z][0-9][a-z][ -]?[0-9][a-z][0-9]|[0-9]{5}(-[0-9]{4})?|canada|usa|united states)$'
            then parts[array_length(parts, 1) - 1]
          when coalesce(array_length(parts, 1), 0) >= 2
            then parts[array_length(parts, 1)]
          else address
        end
      ),
      ''
    ) as inferred_city
  from (
    select
      id,
      address,
      regexp_split_to_array(address, '[[:space:]]*,[[:space:]]*') as parts
    from snapquote.customers
  ) parsed
)
update snapquote.customers c
set city = coalesce(customer_city_backfill.inferred_city, '')
from customer_city_backfill
where c.id = customer_city_backfill.id
  and trim(c.city) = '';

alter table snapquote.customers
  drop constraint if exists customers_city_length_check;

alter table snapquote.customers
  add constraint customers_city_length_check
  check (length(trim(city)) <= 120);

drop view if exists public.snapquote_customers;

create view public.snapquote_customers
with (security_invoker = true) as
select * from snapquote.customers;

grant select, insert, update, delete on public.snapquote_customers to service_role;
