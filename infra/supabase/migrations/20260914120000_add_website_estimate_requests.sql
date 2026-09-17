create table if not exists snapquote.website_estimate_requests (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  quote_id uuid references snapquote.quotes(id) on delete set null,
  customer_id uuid references snapquote.customers(id) on delete set null,
  source text not null default 'website_widget' check (source in ('website_widget', 'website_page')),
  status text not null default 'draft_created' check (status in ('draft_created', 'estimate_only', 'reviewed', 'archived')),
  customer_name text not null check (length(trim(customer_name)) between 1 and 160),
  customer_email text,
  customer_phone text,
  address text not null check (length(trim(address)) between 1 and 400),
  city text not null default '' check (length(trim(city)) <= 120),
  checklist jsonb not null default '{}'::jsonb,
  notes text not null default '' check (length(notes) <= 5000),
  estimate_low_cents integer not null check (estimate_low_cents >= 0),
  estimate_high_cents integer not null check (estimate_high_cents >= estimate_low_cents),
  estimate_currency text not null default 'cad' check (length(estimate_currency) = 3),
  line_count integer not null default 0 check (line_count >= 0),
  unpriced_line_count integer not null default 0 check (unpriced_line_count >= 0),
  unconfirmed_line_count integer not null default 0 check (unconfirmed_line_count >= 0),
  disclaimer text not null default '',
  referrer text,
  user_agent text,
  ip_hash text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists website_estimate_requests_org_created_idx
  on snapquote.website_estimate_requests(org_id, created_at desc);

create index if not exists website_estimate_requests_quote_idx
  on snapquote.website_estimate_requests(quote_id)
  where quote_id is not null;

create index if not exists website_estimate_requests_customer_idx
  on snapquote.website_estimate_requests(customer_id)
  where customer_id is not null;

drop trigger if exists set_website_estimate_requests_updated_at on snapquote.website_estimate_requests;
create trigger set_website_estimate_requests_updated_at
before update on snapquote.website_estimate_requests
for each row execute function snapquote.set_updated_at();

alter table snapquote.website_estimate_requests enable row level security;

revoke all on snapquote.website_estimate_requests from public, anon, authenticated;
grant select, insert, update, delete on snapquote.website_estimate_requests to service_role;

create or replace view public.snapquote_website_estimate_requests as
select * from snapquote.website_estimate_requests;

revoke all on public.snapquote_website_estimate_requests from public, anon, authenticated;
grant select, insert, update, delete on public.snapquote_website_estimate_requests to service_role;
