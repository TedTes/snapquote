-- Reverts the quote-level customer snapshot columns (customer_name/customer_email/
-- customer_phone) added in 20260730120000. customer_id has been the required,
-- non-null foreign key to snapquote.customers since the base schema
-- (20260721170000_create_snapquote_schema.sql), so every quote is already linked.
do $$
declare
  unlinked_count integer;
begin
  select count(*) into unlinked_count
  from snapquote.quotes q
  left join snapquote.customers c on c.id = q.customer_id
  where q.customer_id is null or c.id is null;

  if unlinked_count > 0 then
    raise exception 'Refusing to drop quote customer snapshot columns: % quote(s) have no valid customer_id', unlinked_count;
  end if;
end $$;

drop view if exists public.snapquote_quotes;

alter table snapquote.quotes
  drop column if exists customer_name,
  drop column if exists customer_email,
  drop column if exists customer_phone;

create view public.snapquote_quotes
with (security_invoker = true) as
select * from snapquote.quotes;

grant select, insert, update, delete on public.snapquote_quotes to service_role;
