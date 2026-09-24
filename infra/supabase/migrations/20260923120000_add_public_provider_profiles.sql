alter table snapquote.orgs
  add column if not exists profile_bio text,
  add column if not exists service_area text,
  add column if not exists years_in_business integer;

alter table snapquote.orgs
  drop constraint if exists orgs_profile_bio_length_check,
  add constraint orgs_profile_bio_length_check
    check (profile_bio is null or length(trim(profile_bio)) <= 500),
  drop constraint if exists orgs_service_area_length_check,
  add constraint orgs_service_area_length_check
    check (service_area is null or length(trim(service_area)) <= 160),
  drop constraint if exists orgs_years_in_business_check,
  add constraint orgs_years_in_business_check
    check (years_in_business is null or years_in_business between 0 and 150);

create table if not exists snapquote.portfolio_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  storage_bucket text not null default 'snapquote-provider-portfolio',
  storage_path text not null,
  image_url text not null,
  caption text not null default '' check (length(trim(caption)) <= 160),
  position integer not null default 0 check (position >= 0),
  published boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (storage_bucket, storage_path)
);

create index if not exists portfolio_items_org_position_idx
  on snapquote.portfolio_items(org_id, published desc, position, created_at);

drop trigger if exists set_portfolio_items_updated_at on snapquote.portfolio_items;
create trigger set_portfolio_items_updated_at
before update on snapquote.portfolio_items
for each row execute function snapquote.set_updated_at();

create table if not exists snapquote.provider_reviews (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  quote_id uuid not null references snapquote.quotes(id) on delete cascade,
  token text not null unique,
  reviewer_name text not null check (length(trim(reviewer_name)) between 1 and 160),
  rating smallint check (rating is null or rating between 1 and 5),
  body text not null default '' check (length(trim(body)) <= 1200),
  published boolean not null default true,
  submitted_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (quote_id),
  constraint provider_reviews_submission_check check (
    (submitted_at is null and rating is null)
    or (submitted_at is not null and rating is not null)
  )
);

create index if not exists provider_reviews_org_submitted_idx
  on snapquote.provider_reviews(org_id, published, submitted_at desc)
  where submitted_at is not null;

drop trigger if exists set_provider_reviews_updated_at on snapquote.provider_reviews;
create trigger set_provider_reviews_updated_at
before update on snapquote.provider_reviews
for each row execute function snapquote.set_updated_at();

alter table snapquote.portfolio_items enable row level security;
alter table snapquote.provider_reviews enable row level security;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'snapquote-provider-portfolio',
  'snapquote-provider-portfolio',
  true,
  8000000,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

revoke all on snapquote.portfolio_items, snapquote.provider_reviews from public, anon, authenticated;
grant select, insert, update, delete on snapquote.portfolio_items, snapquote.provider_reviews to service_role;

create or replace view public.snapquote_orgs
with (security_invoker = true) as
select * from snapquote.orgs;

create or replace view public.snapquote_portfolio_items
with (security_invoker = true) as
select * from snapquote.portfolio_items;

create or replace view public.snapquote_provider_reviews
with (security_invoker = true) as
select * from snapquote.provider_reviews;

revoke all on public.snapquote_orgs, public.snapquote_portfolio_items, public.snapquote_provider_reviews
  from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_orgs, public.snapquote_portfolio_items, public.snapquote_provider_reviews
  to service_role;
