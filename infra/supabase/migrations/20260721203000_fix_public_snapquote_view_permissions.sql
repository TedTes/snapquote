create or replace view public.snapquote_orgs as
select * from snapquote.orgs;

create or replace view public.snapquote_org_members as
select * from snapquote.org_members;

create or replace view public.snapquote_customers as
select * from snapquote.customers;

create or replace view public.snapquote_price_book_items as
select * from snapquote.price_book_items;

create or replace view public.snapquote_quotes as
select * from snapquote.quotes;

create or replace view public.snapquote_quote_line_items as
select * from snapquote.quote_line_items;

create or replace view public.snapquote_quote_events as
select * from snapquote.quote_events;

create or replace view public.snapquote_quote_public_links as
select * from snapquote.quote_public_links;

revoke all on
  public.snapquote_orgs,
  public.snapquote_org_members,
  public.snapquote_customers,
  public.snapquote_price_book_items,
  public.snapquote_quotes,
  public.snapquote_quote_line_items,
  public.snapquote_quote_events,
  public.snapquote_quote_public_links
from public, anon, authenticated;

grant select, insert, update, delete on
  public.snapquote_orgs,
  public.snapquote_org_members,
  public.snapquote_customers,
  public.snapquote_price_book_items,
  public.snapquote_quotes,
  public.snapquote_quote_line_items,
  public.snapquote_quote_events,
  public.snapquote_quote_public_links
to service_role;
