alter table snapquote.price_book_items
  add column if not exists archived_at timestamptz;

create or replace view public.snapquote_price_book_items as
select * from snapquote.price_book_items;

grant select, insert, update, delete on public.snapquote_price_book_items to service_role;
