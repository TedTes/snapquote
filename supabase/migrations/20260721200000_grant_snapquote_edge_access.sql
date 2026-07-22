grant usage on schema snapquote to service_role;

grant select, insert, update, delete on all tables in schema snapquote to service_role;
grant usage, select on all sequences in schema snapquote to service_role;
grant execute on all functions in schema snapquote to service_role;

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

alter default privileges in schema snapquote
grant select, insert, update, delete on tables to service_role;

alter default privileges in schema snapquote
grant usage, select on sequences to service_role;

alter default privileges in schema snapquote
grant execute on functions to service_role;
