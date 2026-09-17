alter table snapquote.website_estimate_requests
  add column if not exists timing text not null default 'flexible',
  add column if not exists photo_paths jsonb not null default '[]'::jsonb,
  add column if not exists contact_channel text,
  add column if not exists opened_at timestamptz,
  add column if not exists contacted_at timestamptz,
  add column if not exists quote_sent_at timestamptz,
  add column if not exists archived_at timestamptz;

update snapquote.website_estimate_requests
set status = case status
  when 'draft_created' then 'new'
  when 'estimate_only' then 'new'
  when 'reviewed' then 'opened'
  else status
end;

alter table snapquote.website_estimate_requests
  drop constraint if exists website_estimate_requests_status_check;

alter table snapquote.website_estimate_requests
  alter column status set default 'new';

alter table snapquote.website_estimate_requests
  add constraint website_estimate_requests_status_check
  check (status in ('new', 'opened', 'contacted', 'quote_sent', 'archived'));

alter table snapquote.website_estimate_requests
  drop constraint if exists website_estimate_requests_timing_check;

alter table snapquote.website_estimate_requests
  add constraint website_estimate_requests_timing_check
  check (timing in ('asap', 'this_month', 'flexible', 'just_pricing'));

alter table snapquote.website_estimate_requests
  drop constraint if exists website_estimate_requests_contact_channel_check;

alter table snapquote.website_estimate_requests
  add constraint website_estimate_requests_contact_channel_check
  check (contact_channel is null or contact_channel in ('call', 'email'));

create index if not exists website_estimate_requests_org_status_created_idx
  on snapquote.website_estimate_requests(org_id, status, created_at desc);

insert into storage.buckets (id, name, public)
values ('snapquote-request-photos', 'snapquote-request-photos', false)
on conflict (id) do update set public = excluded.public;

create or replace view public.snapquote_website_estimate_requests as
select * from snapquote.website_estimate_requests;

revoke all on public.snapquote_website_estimate_requests from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_website_estimate_requests to service_role;
