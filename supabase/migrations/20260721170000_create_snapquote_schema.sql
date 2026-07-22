create schema if not exists snapquote;

create extension if not exists pgcrypto with schema public;

create or replace function snapquote.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists snapquote.orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 1 and 120),
  trade text not null default 'painting' check (trade = 'painting'),
  logo_url text,
  default_tax_rate numeric(6,5) not null default 0 check (default_tax_rate >= 0 and default_tax_rate <= 1),
  default_terms text not null default '',
  quote_valid_days integer not null default 14 check (quote_valid_days between 1 and 365),
  plan text not null default 'trial' check (plan in ('trial', 'solo', 'crew', 'expired')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists snapquote.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  auth_user_id uuid,
  email text not null,
  name text not null default '',
  role text not null default 'owner' check (role in ('owner')),
  created_at timestamptz not null default timezone('utc', now()),
  unique (org_id, email)
);

create table if not exists snapquote.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  name text not null check (length(trim(name)) between 1 and 160),
  email text,
  phone text,
  address text not null check (length(trim(address)) between 1 and 400),
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists snapquote.price_book_items (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  key text,
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '',
  unit text not null check (unit in ('room', 'each', 'hour', 'flat', 'sqft', 'lnft', 'day')),
  pricing_type text not null check (pricing_type in ('fixed', 'room_size')),
  unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0),
  small_price_cents integer check (small_price_cents is null or small_price_cents >= 0),
  medium_price_cents integer check (medium_price_cents is null or medium_price_cents >= 0),
  large_price_cents integer check (large_price_cents is null or large_price_cents >= 0),
  kind text not null check (kind in ('labour', 'material')),
  starter boolean not null default false,
  confirmed_at timestamptz,
  usage_count integer not null default 0 check (usage_count >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint price_book_fixed_pricing check (
    pricing_type <> 'fixed'
    or (
      unit_price_cents is not null
      and small_price_cents is null
      and medium_price_cents is null
      and large_price_cents is null
    )
  ),
  constraint price_book_room_size_pricing check (
    pricing_type <> 'room_size'
    or (
      unit_price_cents is null
      and small_price_cents is not null
      and medium_price_cents is not null
      and large_price_cents is not null
    )
  ),
  unique (org_id, key)
);

create table if not exists snapquote.quotes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references snapquote.orgs(id) on delete cascade,
  customer_id uuid not null references snapquote.customers(id) on delete restrict,
  address text not null check (length(trim(address)) between 1 and 400),
  job_title text not null default '',
  status text not null default 'draft' check (status in ('draft', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'superseded')),
  valid_until date not null,
  discount_type text not null default 'none' check (discount_type in ('none', 'percent', 'cents')),
  discount_value integer not null default 0 check (discount_value >= 0),
  tax_rate numeric(6,5) not null default 0 check (tax_rate >= 0 and tax_rate <= 1),
  subtotal_cents integer check (subtotal_cents is null or subtotal_cents >= 0),
  discount_cents integer check (discount_cents is null or discount_cents >= 0),
  tax_cents integer check (tax_cents is null or tax_cents >= 0),
  total_cents integer check (total_cents is null or total_cents >= 0),
  notes text not null default '',
  terms text not null default '',
  scope_summary text not null default '',
  scope_notes jsonb not null default '[]'::jsonb,
  conflicts jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '{}'::jsonb,
  transcript text not null default '',
  sent_at timestamptz,
  first_viewed_at timestamptz,
  responded_at timestamptz,
  superseded_by_quote_id uuid references snapquote.quotes(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists snapquote.quote_line_items (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references snapquote.quotes(id) on delete cascade,
  position integer not null check (position >= 0),
  description text not null check (length(trim(description)) between 1 and 500),
  quantity numeric(12,3) not null check (quantity > 0),
  unit text check (unit is null or unit in ('room', 'each', 'hour', 'flat', 'sqft', 'lnft', 'day')),
  unit_price_cents integer check (unit_price_cents is null or unit_price_cents >= 0),
  kind text not null check (kind in ('labour', 'material')),
  source text not null check (source in ('price_book', 'manual')),
  price_book_item_id uuid references snapquote.price_book_items(id) on delete set null,
  price_book_item_key text,
  match_confidence numeric(4,3) check (match_confidence is null or (match_confidence >= 0 and match_confidence <= 1)),
  match_state text not null check (match_state in ('green', 'yellow', 'red')),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint green_lines_have_prices check (match_state <> 'green' or unit_price_cents is not null),
  constraint price_book_lines_reference_item check (source <> 'price_book' or price_book_item_id is not null),
  unique (quote_id, position)
);

create table if not exists snapquote.quote_events (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references snapquote.quotes(id) on delete cascade,
  type text not null check (type in ('created', 'sent', 'viewed', 'accepted', 'declined', 'expired', 'followed_up', 'superseded')),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists snapquote.quote_public_links (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null references snapquote.quotes(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz,
  viewed_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (quote_id)
);

create index if not exists customers_org_created_idx on snapquote.customers(org_id, created_at desc);
create index if not exists price_book_org_confirmed_idx on snapquote.price_book_items(org_id, confirmed_at);
create index if not exists quotes_org_updated_idx on snapquote.quotes(org_id, updated_at desc);
create index if not exists quote_line_items_quote_position_idx on snapquote.quote_line_items(quote_id, position);
create index if not exists quote_events_quote_created_idx on snapquote.quote_events(quote_id, created_at);

drop trigger if exists set_orgs_updated_at on snapquote.orgs;
create trigger set_orgs_updated_at
before update on snapquote.orgs
for each row execute function snapquote.set_updated_at();

drop trigger if exists set_price_book_items_updated_at on snapquote.price_book_items;
create trigger set_price_book_items_updated_at
before update on snapquote.price_book_items
for each row execute function snapquote.set_updated_at();

drop trigger if exists set_quotes_updated_at on snapquote.quotes;
create trigger set_quotes_updated_at
before update on snapquote.quotes
for each row execute function snapquote.set_updated_at();

drop trigger if exists set_quote_line_items_updated_at on snapquote.quote_line_items;
create trigger set_quote_line_items_updated_at
before update on snapquote.quote_line_items
for each row execute function snapquote.set_updated_at();

alter table snapquote.orgs enable row level security;
alter table snapquote.org_members enable row level security;
alter table snapquote.customers enable row level security;
alter table snapquote.price_book_items enable row level security;
alter table snapquote.quotes enable row level security;
alter table snapquote.quote_line_items enable row level security;
alter table snapquote.quote_events enable row level security;
alter table snapquote.quote_public_links enable row level security;
