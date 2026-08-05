-- Label the current starter pricing catalog honestly: it is an editable setup
-- baseline, not sourced regional market pricing.

update snapquote.pricing_sources
set
  notes = 'Initial editable starter suggestions for first-run setup. Not sourced market-rate data; contractors must confirm or edit before use.',
  confidence = least(confidence, 0.650),
  updated_at = timezone('utc', now())
where key = 'snapquote-starter-catalog-v1';

update snapquote.pricing_versions
set
  notes = 'Initial painting starter suggestions for first-run setup. Not external regional market pricing.',
  source_snapshot = source_snapshot || jsonb_build_object(
    'pricing_basis', 'editable_starter_defaults',
    'external_market_data', false,
    'maintained_update_pipeline', false,
    'market_data_status', 'not_sourced'
  ),
  updated_at = timezone('utc', now())
where key = 'painting-starter-v1';

update snapquote.service_price_suggestions
set
  provenance = provenance || jsonb_build_object(
    'pricing_basis', 'editable_starter_default',
    'external_market_data', false,
    'market_data_status', 'not_sourced'
  ),
  updated_at = timezone('utc', now())
where version_id in (
  select id
  from snapquote.pricing_versions
  where key = 'painting-starter-v1'
);
