create or replace view public.snapquote_orgs
with (security_invoker = true) as
select * from snapquote.orgs;

create or replace view public.snapquote_org_members
with (security_invoker = true) as
select * from snapquote.org_members;

create or replace view public.snapquote_customers
with (security_invoker = true) as
select * from snapquote.customers;

create or replace view public.snapquote_price_book_items
with (security_invoker = true) as
select * from snapquote.price_book_items;

create or replace view public.snapquote_quotes
with (security_invoker = true) as
select * from snapquote.quotes;

create or replace view public.snapquote_quote_line_items
with (security_invoker = true) as
select * from snapquote.quote_line_items;

create or replace view public.snapquote_quote_events
with (security_invoker = true) as
select * from snapquote.quote_events;

create or replace view public.snapquote_quote_public_links
with (security_invoker = true) as
select * from snapquote.quote_public_links;
