alter table snapquote.quote_line_items
  add column if not exists scope_confidence numeric(4,3),
  add column if not exists price_confidence numeric(4,3),
  add column if not exists requires_review boolean,
  add column if not exists assumptions jsonb not null default '[]'::jsonb,
  add column if not exists evidence_refs jsonb not null default '[]'::jsonb;

update snapquote.quote_line_items
set
  scope_confidence = coalesce(
    scope_confidence,
    case when match_state = 'red' then coalesce(match_confidence, 0.5) else 1 end
  ),
  price_confidence = coalesce(
    price_confidence,
    case
      when unit_price_cents is null then 0
      when match_state = 'green' then coalesce(match_confidence, 1)
      else coalesce(match_confidence, 0.7)
    end
  ),
  requires_review = coalesce(requires_review, match_state <> 'green');

alter table snapquote.quote_line_items
  alter column requires_review set default true,
  alter column requires_review set not null;

alter table snapquote.quote_line_items
  drop constraint if exists quote_line_items_scope_confidence_check,
  add constraint quote_line_items_scope_confidence_check
    check (scope_confidence is null or (scope_confidence >= 0 and scope_confidence <= 1)),
  drop constraint if exists quote_line_items_price_confidence_check,
  add constraint quote_line_items_price_confidence_check
    check (price_confidence is null or (price_confidence >= 0 and price_confidence <= 1)),
  drop constraint if exists green_lines_do_not_require_review,
  add constraint green_lines_do_not_require_review
    check (match_state <> 'green' or requires_review = false);

create or replace view public.snapquote_quote_line_items as
select * from snapquote.quote_line_items;

revoke all on public.snapquote_quote_line_items from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_quote_line_items to service_role;
