create table if not exists snapquote.service_templates (
  id uuid primary key default gen_random_uuid(),
  trade text not null check (length(trim(trade)) between 1 and 80),
  key text not null check (length(trim(key)) between 1 and 80),
  name text not null check (length(trim(name)) between 1 and 160),
  description text not null default '',
  unit text not null check (unit in ('room', 'each', 'hour', 'flat', 'sqft', 'lnft', 'day')),
  kind text not null check (kind in ('labour', 'material')),
  default_pricing_type text not null check (default_pricing_type in ('fixed', 'room_size')),
  aliases text[] not null default '{}'::text[],
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (trade, key)
);

create table if not exists snapquote.pricing_regions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(trim(key)) between 1 and 120),
  country_code text,
  region_code text,
  metro_name text,
  currency text not null default 'USD' check (length(currency) = 3),
  labor_multiplier numeric(8,4) not null default 1 check (labor_multiplier > 0),
  material_multiplier numeric(8,4) not null default 1 check (material_multiplier > 0),
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists snapquote.pricing_sources (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(trim(key)) between 1 and 120),
  name text not null check (length(trim(name)) between 1 and 240),
  source_type text not null check (source_type in ('curated', 'government', 'vendor', 'import', 'llm_draft')),
  source_url text,
  collected_at date,
  notes text not null default '',
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists snapquote.pricing_versions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (length(trim(key)) between 1 and 120),
  trade text not null check (length(trim(trade)) between 1 and 80),
  status text not null check (status in ('draft', 'reviewed', 'published', 'retired')),
  formula_version text not null check (length(trim(formula_version)) between 1 and 80),
  published_at timestamptz,
  source_snapshot jsonb not null default '{}'::jsonb,
  notes text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists snapquote.service_price_suggestions (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references snapquote.pricing_versions(id) on delete cascade,
  service_template_id uuid not null references snapquote.service_templates(id) on delete cascade,
  region_id uuid not null references snapquote.pricing_regions(id) on delete cascade,
  unit text not null check (unit in ('room', 'each', 'hour', 'flat', 'sqft', 'lnft', 'day')),
  pricing_type text not null check (pricing_type in ('fixed', 'room_size')),
  low_cents integer not null check (low_cents >= 0),
  median_cents integer not null check (median_cents >= 0),
  high_cents integer not null check (high_cents >= 0),
  pricing jsonb not null,
  currency text not null default 'USD' check (length(currency) = 3),
  confidence numeric(4,3) not null default 0.500 check (confidence >= 0 and confidence <= 1),
  provenance jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint suggestion_price_order check (low_cents <= median_cents and median_cents <= high_cents),
  constraint suggestion_fixed_pricing check (
    pricing_type <> 'fixed'
    or (
      pricing->>'type' = 'fixed'
      and (pricing->>'unitPriceCents') is not null
    )
  ),
  constraint suggestion_room_size_pricing check (
    pricing_type <> 'room_size'
    or (
      pricing->>'type' = 'room_size'
      and pricing->'prices' is not null
    )
  ),
  unique (version_id, service_template_id, region_id)
);

create table if not exists snapquote.suggestion_source_links (
  suggestion_id uuid not null references snapquote.service_price_suggestions(id) on delete cascade,
  source_id uuid not null references snapquote.pricing_sources(id) on delete cascade,
  weight numeric(8,4) not null default 1 check (weight > 0),
  note text not null default '',
  primary key (suggestion_id, source_id)
);

create table if not exists snapquote.pricing_suggestion_audit_log (
  id uuid primary key default gen_random_uuid(),
  version_id uuid references snapquote.pricing_versions(id) on delete set null,
  suggestion_id uuid references snapquote.service_price_suggestions(id) on delete set null,
  action text not null check (length(trim(action)) between 1 and 80),
  actor text not null default 'system' check (length(trim(actor)) between 1 and 160),
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists service_templates_trade_active_idx on snapquote.service_templates(trade, active);
create index if not exists pricing_versions_trade_status_published_idx on snapquote.pricing_versions(trade, status, published_at desc);
create index if not exists service_price_suggestions_version_region_idx on snapquote.service_price_suggestions(version_id, region_id);
create index if not exists suggestion_source_links_source_idx on snapquote.suggestion_source_links(source_id);

drop trigger if exists set_service_templates_updated_at on snapquote.service_templates;
create trigger set_service_templates_updated_at
before update on snapquote.service_templates
for each row execute function snapquote.set_updated_at();

drop trigger if exists set_pricing_regions_updated_at on snapquote.pricing_regions;
create trigger set_pricing_regions_updated_at
before update on snapquote.pricing_regions
for each row execute function snapquote.set_updated_at();

drop trigger if exists set_pricing_sources_updated_at on snapquote.pricing_sources;
create trigger set_pricing_sources_updated_at
before update on snapquote.pricing_sources
for each row execute function snapquote.set_updated_at();

drop trigger if exists set_pricing_versions_updated_at on snapquote.pricing_versions;
create trigger set_pricing_versions_updated_at
before update on snapquote.pricing_versions
for each row execute function snapquote.set_updated_at();

drop trigger if exists set_service_price_suggestions_updated_at on snapquote.service_price_suggestions;
create trigger set_service_price_suggestions_updated_at
before update on snapquote.service_price_suggestions
for each row execute function snapquote.set_updated_at();

alter table snapquote.service_templates enable row level security;
alter table snapquote.pricing_regions enable row level security;
alter table snapquote.pricing_sources enable row level security;
alter table snapquote.pricing_versions enable row level security;
alter table snapquote.service_price_suggestions enable row level security;
alter table snapquote.suggestion_source_links enable row level security;
alter table snapquote.pricing_suggestion_audit_log enable row level security;

create or replace view public.snapquote_service_templates as
select * from snapquote.service_templates;

create or replace view public.snapquote_pricing_regions as
select * from snapquote.pricing_regions;

create or replace view public.snapquote_pricing_sources as
select * from snapquote.pricing_sources;

create or replace view public.snapquote_pricing_versions as
select * from snapquote.pricing_versions;

create or replace view public.snapquote_service_price_suggestions as
select * from snapquote.service_price_suggestions;

create or replace view public.snapquote_suggestion_source_links as
select * from snapquote.suggestion_source_links;

create or replace view public.snapquote_pricing_suggestion_audit_log as
select * from snapquote.pricing_suggestion_audit_log;

grant select, insert, update, delete on
  public.snapquote_service_templates,
  public.snapquote_pricing_regions,
  public.snapquote_pricing_sources,
  public.snapquote_pricing_versions,
  public.snapquote_service_price_suggestions,
  public.snapquote_suggestion_source_links,
  public.snapquote_pricing_suggestion_audit_log
to service_role;

insert into snapquote.pricing_regions (
  key,
  country_code,
  region_code,
  metro_name,
  currency,
  confidence
) values (
  'global',
  null,
  null,
  null,
  'USD',
  0.550
) on conflict (key) do update set
  currency = excluded.currency,
  confidence = excluded.confidence,
  active = true;

insert into snapquote.pricing_sources (
  key,
  name,
  source_type,
  notes,
  confidence
) values (
  'snapquote-starter-catalog-v1',
  'SnapQuote starter catalog v1',
  'curated',
  'Initial curated starter suggestions. Contractors must confirm or edit before these prices become active.',
  0.650
) on conflict (key) do update set
  name = excluded.name,
  source_type = excluded.source_type,
  notes = excluded.notes,
  confidence = excluded.confidence;

insert into snapquote.pricing_versions (
  key,
  trade,
  status,
  formula_version,
  published_at,
  source_snapshot,
  notes
) values (
  'painting-starter-v1',
  'painting',
  'published',
  'starter-v1',
  timezone('utc', now()),
  '{"sources":["snapquote-starter-catalog-v1"],"review":"curated_seed"}'::jsonb,
  'Initial painting starter suggestions for first-run setup.'
) on conflict (key) do update set
  status = excluded.status,
  published_at = coalesce(snapquote.pricing_versions.published_at, excluded.published_at),
  source_snapshot = excluded.source_snapshot,
  notes = excluded.notes;

insert into snapquote.service_templates (
  trade,
  key,
  name,
  description,
  unit,
  kind,
  default_pricing_type,
  aliases
) values
  ('painting', 'paint_walls', 'Paint walls', 'Wall painting priced per room size.', 'room', 'labour', 'room_size', array['walls', 'paint room walls']),
  ('painting', 'paint_ceiling', 'Paint ceiling', 'Ceiling painting priced per room size.', 'room', 'labour', 'room_size', array['ceilings', 'paint ceiling']),
  ('painting', 'paint_trim', 'Paint trim', 'Trim painting priced per room size.', 'room', 'labour', 'room_size', array['baseboards', 'trim']),
  ('painting', 'paint_door', 'Paint door', 'Paint a standard interior door.', 'each', 'labour', 'fixed', array['doors', 'paint doors']),
  ('painting', 'heavy_wall_prep', 'Heavy wall prep', 'Hourly labour for heavy prep beyond standard patching.', 'hour', 'labour', 'fixed', array['wall prep', 'prep work']),
  ('painting', 'patch_nail_holes', 'Patch nail holes', 'Patch normal nail holes before painting.', 'room', 'labour', 'room_size', array['patch holes', 'nail holes']),
  ('painting', 'primer_coat', 'Primer coat', 'Apply primer coat per room.', 'room', 'material', 'room_size', array['primer', 'prime walls']),
  ('painting', 'material_allowance', 'Material allowance', 'Flat allowance for paint and standard materials.', 'flat', 'material', 'fixed', array['materials', 'paint allowance'])
on conflict (trade, key) do update set
  name = excluded.name,
  description = excluded.description,
  unit = excluded.unit,
  kind = excluded.kind,
  default_pricing_type = excluded.default_pricing_type,
  aliases = excluded.aliases,
  active = true;

with seed(key, pricing_type, unit, low_cents, median_cents, high_cents, pricing, confidence, provenance) as (
  values
    ('paint_walls', 'room_size', 'room', 25000, 42000, 65000, '{"type":"room_size","prices":{"small":25000,"medium":42000,"large":65000}}'::jsonb, 0.650, '{"note":"starter baseline"}'::jsonb),
    ('paint_ceiling', 'room_size', 'room', 12000, 18000, 26000, '{"type":"room_size","prices":{"small":12000,"medium":18000,"large":26000}}'::jsonb, 0.650, '{"note":"starter baseline"}'::jsonb),
    ('paint_trim', 'room_size', 'room', 9000, 16000, 24000, '{"type":"room_size","prices":{"small":9000,"medium":16000,"large":24000}}'::jsonb, 0.650, '{"note":"starter baseline"}'::jsonb),
    ('paint_door', 'fixed', 'each', 7500, 9500, 12500, '{"type":"fixed","unitPriceCents":9500}'::jsonb, 0.650, '{"note":"starter baseline"}'::jsonb),
    ('heavy_wall_prep', 'fixed', 'hour', 6500, 8500, 12000, '{"type":"fixed","unitPriceCents":8500}'::jsonb, 0.600, '{"note":"starter baseline"}'::jsonb),
    ('patch_nail_holes', 'room_size', 'room', 3500, 5000, 7500, '{"type":"room_size","prices":{"small":3500,"medium":5000,"large":7500}}'::jsonb, 0.550, '{"note":"optional starter"}'::jsonb),
    ('primer_coat', 'room_size', 'room', 8000, 12000, 18000, '{"type":"room_size","prices":{"small":8000,"medium":12000,"large":18000}}'::jsonb, 0.550, '{"note":"optional starter"}'::jsonb),
    ('material_allowance', 'fixed', 'flat', 10000, 15000, 22500, '{"type":"fixed","unitPriceCents":15000}'::jsonb, 0.500, '{"note":"optional starter"}'::jsonb)
),
lookup as (
  select
    seed.*,
    version.id as version_id,
    region.id as region_id,
    template.id as service_template_id,
    region.currency
  from seed
  join snapquote.pricing_versions version on version.key = 'painting-starter-v1'
  join snapquote.pricing_regions region on region.key = 'global'
  join snapquote.service_templates template on template.trade = 'painting' and template.key = seed.key
),
inserted as (
  insert into snapquote.service_price_suggestions (
    version_id,
    service_template_id,
    region_id,
    unit,
    pricing_type,
    low_cents,
    median_cents,
    high_cents,
    pricing,
    currency,
    confidence,
    provenance
  )
  select
    version_id,
    service_template_id,
    region_id,
    unit,
    pricing_type,
    low_cents,
    median_cents,
    high_cents,
    pricing,
    currency,
    confidence,
    provenance
  from lookup
  on conflict (version_id, service_template_id, region_id) do update set
    unit = excluded.unit,
    pricing_type = excluded.pricing_type,
    low_cents = excluded.low_cents,
    median_cents = excluded.median_cents,
    high_cents = excluded.high_cents,
    pricing = excluded.pricing,
    currency = excluded.currency,
    confidence = excluded.confidence,
    provenance = excluded.provenance
  returning id
)
insert into snapquote.suggestion_source_links (suggestion_id, source_id, weight, note)
select inserted.id, source.id, 1, 'seed source'
from inserted
cross join snapquote.pricing_sources source
where source.key = 'snapquote-starter-catalog-v1'
on conflict (suggestion_id, source_id) do update set
  weight = excluded.weight,
  note = excluded.note;

insert into snapquote.pricing_suggestion_audit_log (
  version_id,
  action,
  actor,
  meta
)
select
  version.id,
  'seed_published_catalog',
  'migration',
  '{"catalog":"painting-starter-v1"}'::jsonb
from snapquote.pricing_versions version
where version.key = 'painting-starter-v1'
  and not exists (
    select 1
    from snapquote.pricing_suggestion_audit_log log
    where log.version_id = version.id
      and log.action = 'seed_published_catalog'
  );
