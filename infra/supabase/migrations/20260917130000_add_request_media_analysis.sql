alter table snapquote.website_estimate_requests
  add column if not exists analysis_status text not null default 'not_requested',
  add column if not exists analysis_model text,
  add column if not exists analysis_version text,
  add column if not exists analysis_error text,
  add column if not exists analysis_summary jsonb not null default '{}'::jsonb,
  add column if not exists analysis_started_at timestamptz,
  add column if not exists analysis_completed_at timestamptz;

alter table snapquote.website_estimate_requests
  drop constraint if exists website_estimate_requests_analysis_status_check,
  add constraint website_estimate_requests_analysis_status_check
    check (analysis_status in ('not_requested', 'pending', 'processing', 'completed', 'failed', 'no_media'));

create table if not exists snapquote.request_media (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references snapquote.website_estimate_requests(id) on delete cascade,
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  media_type text not null default 'photo' check (media_type in ('photo', 'video')),
  storage_bucket text not null default 'snapquote-request-photos',
  storage_path text not null,
  file_name text not null,
  content_type text not null,
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  duration_seconds numeric(10,3) check (duration_seconds is null or duration_seconds >= 0),
  processing_status text not null default 'uploaded'
    check (processing_status in ('uploaded', 'pending', 'processing', 'completed', 'failed')),
  analysis jsonb not null default '{}'::jsonb,
  analysis_model text,
  analysis_version text,
  analysis_error text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (storage_bucket, storage_path)
);

create index if not exists request_media_request_created_idx
  on snapquote.request_media(request_id, created_at);

create index if not exists request_media_org_status_idx
  on snapquote.request_media(org_id, processing_status);

drop trigger if exists set_request_media_updated_at on snapquote.request_media;
create trigger set_request_media_updated_at
before update on snapquote.request_media
for each row execute function snapquote.set_updated_at();

create table if not exists snapquote.request_analysis_suggestions (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references snapquote.website_estimate_requests(id) on delete cascade,
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  suggestion_type text not null default 'task'
    check (suggestion_type in ('task', 'site_condition', 'question')),
  description text not null check (length(trim(description)) between 1 and 500),
  quantity numeric(12,3) check (quantity is null or quantity > 0),
  unit text check (unit is null or unit in ('room', 'each', 'hour', 'flat', 'sqft', 'lnft', 'day')),
  line_kind text check (line_kind is null or line_kind in ('labour', 'material')),
  confidence numeric(4,3) not null check (confidence >= 0 and confidence <= 1),
  assumptions jsonb not null default '[]'::jsonb,
  evidence_media_ids jsonb not null default '[]'::jsonb,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  quote_line_item_id uuid references snapquote.quote_line_items(id) on delete set null,
  decided_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists request_analysis_suggestions_request_status_idx
  on snapquote.request_analysis_suggestions(request_id, status, created_at);

drop trigger if exists set_request_analysis_suggestions_updated_at on snapquote.request_analysis_suggestions;
create trigger set_request_analysis_suggestions_updated_at
before update on snapquote.request_analysis_suggestions
for each row execute function snapquote.set_updated_at();

insert into snapquote.request_media (
  request_id,
  org_id,
  media_type,
  storage_bucket,
  storage_path,
  file_name,
  content_type,
  processing_status
)
select
  request.id,
  request.org_id,
  'photo',
  'snapquote-request-photos',
  path.value,
  regexp_replace(path.value, '^.*/', ''),
  'image/jpeg',
  'uploaded'
from snapquote.website_estimate_requests request
cross join lateral jsonb_array_elements_text(request.photo_paths) as path(value)
on conflict (storage_bucket, storage_path) do nothing;

update snapquote.website_estimate_requests request
set analysis_status = case
  when exists (
    select 1 from snapquote.request_media media where media.request_id = request.id
  ) then 'not_requested'
  else 'no_media'
end
where request.analysis_status = 'not_requested';

alter table snapquote.request_media enable row level security;
alter table snapquote.request_analysis_suggestions enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'snapquote-request-media',
  'snapquote-request-media',
  false,
  60000000,
  array['video/mp4', 'video/quicktime', 'video/webm']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all on snapquote.request_media from public, anon, authenticated;
revoke all on snapquote.request_analysis_suggestions from public, anon, authenticated;
grant select, insert, update, delete on snapquote.request_media to service_role;
grant select, insert, update, delete on snapquote.request_analysis_suggestions to service_role;

create or replace view public.snapquote_website_estimate_requests as
select * from snapquote.website_estimate_requests;

create or replace view public.snapquote_request_media as
select * from snapquote.request_media;

create or replace view public.snapquote_request_analysis_suggestions as
select * from snapquote.request_analysis_suggestions;

revoke all on public.snapquote_website_estimate_requests from public, anon, authenticated;
revoke all on public.snapquote_request_media from public, anon, authenticated;
revoke all on public.snapquote_request_analysis_suggestions from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_website_estimate_requests to service_role;
grant select, insert, update, delete on public.snapquote_request_media to service_role;
grant select, insert, update, delete on public.snapquote_request_analysis_suggestions to service_role;
