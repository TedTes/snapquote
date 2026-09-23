alter table snapquote.website_estimate_requests
  add column if not exists preferred_start_date date,
  add column if not exists preferred_end_date date;

alter table snapquote.website_estimate_requests
  drop constraint if exists website_estimate_requests_preferred_timeline_check,
  add constraint website_estimate_requests_preferred_timeline_check
    check (
      preferred_end_date is null
      or (preferred_start_date is not null and preferred_end_date >= preferred_start_date)
    );

create or replace view public.snapquote_website_estimate_requests as
select * from snapquote.website_estimate_requests;

revoke all on public.snapquote_website_estimate_requests from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_website_estimate_requests to service_role;
