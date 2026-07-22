# SnapQuote

Same-day AI quoting for home-service trades.

This repo is scaffolded around the product spec in the initial request. The current implementation targets M0:

- pnpm + Turbo monorepo
- strict TypeScript packages
- shared Zod schemas and quote-total computation
- Fastify API healthcheck plus versioned route skeletons
- BullMQ worker skeleton for the `process_job` pipeline
- Expo Router mobile shell
- local Postgres + pgvector, Redis, and LocalStack compose file
- CI for lint, typecheck, and tests

## Current Version Pins

- Node: `>=22.13.0 <25`
- Expo SDK: `54.0.0`
- Claude model default: `claude-sonnet-4-6`

The product spec asks for the latest Expo SDK, but this scaffold is pinned to SDK 54 so it can run in the current physical-device Expo Go app during the SDK 57 transition. The spec names `expo-av`; this scaffold uses `expo-audio`, and the capture layer is isolated for the M2 implementation.

## Local Development

Install dependencies:

```sh
pnpm install
```

Start local services:

```sh
docker compose -f infra/docker-compose.yml up
```

Run the API:

```sh
pnpm dev:api
```

Run the mobile app:

```sh
pnpm dev:mobile
```

Run verification:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

## Supabase Deployment Path

The MVP can run on **Supabase Postgres + Edge Functions** without creating a new Supabase project. Use an existing Supabase project and keep SnapQuote isolated in its own Postgres schema:

```sql
snapquote.*
```

The schema lives in:

```sh
supabase/migrations/20260721170000_create_snapquote_schema.sql
```

It creates:

- `snapquote.orgs`
- `snapquote.org_members`
- `snapquote.customers`
- `snapquote.price_book_items`
- `snapquote.quotes`
- `snapquote.quote_line_items`
- `snapquote.quote_events`
- `snapquote.quote_public_links`

Link one of your existing Supabase projects:

```sh
cd supabase
supabase link --project-ref <existing-project-ref>
```

Push the SnapQuote schema:

```sh
pnpm supabase:db:push
```

Serve the Edge Function locally:

```sh
SUPABASE_URL=http://127.0.0.1:54321 \
SUPABASE_SERVICE_ROLE_KEY=<local-service-role-key> \
pnpm supabase:functions:serve
```

Deploy the Edge Function:

```sh
pnpm supabase:functions:deploy
```

Point Expo at the Edge Function:

```sh
EXPO_PUBLIC_API_URL=http://127.0.0.1:54321/functions/v1/snapquote
```

For cloud:

```sh
EXPO_PUBLIC_API_URL=https://<project-ref>.functions.supabase.co/snapquote
```

The Edge Function uses `SUPABASE_SERVICE_ROLE_KEY`, so do not expose that key in the mobile app.

### Social auth

The mobile app uses the Expo scheme configured in `apps/mobile/app.json`:

```sh
snapquote://auth/callback
```

Add this URL to Supabase Auth redirect URLs. For Expo Go/development builds, also add the redirect URL printed by `Linking.createURL("auth/callback")` if it differs.

Then enable the Google and Apple providers in Supabase Auth after creating their credentials in the Google Cloud Console and Apple Developer Console. The mobile buttons call:

- `POST /v1/auth/oauth/start`
- `POST /v1/auth/oauth/complete`

Optional Edge Function secrets:

```sh
supabase secrets set OPENAI_API_KEY=<key>
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
supabase secrets set SNAPQUOTE_PUBLIC_BASE_URL=https://<project-ref>.functions.supabase.co/snapquote
supabase secrets set SNAPQUOTE_EMAIL_WEBHOOK_URL=https://your-email-worker.example/send
supabase secrets set SNAPQUOTE_DEFAULT_ORG_ID=00000000-0000-4000-8000-000000000001
```

The `snapquote` Edge Function exposes:

- `GET /health`
- `POST /v1/auth/sign-up`
- `POST /v1/auth/sign-in`
- `POST /v1/auth/refresh`
- `POST /v1/auth/oauth/start`
- `POST /v1/auth/oauth/complete`
- `POST /v1/onboarding/painter`
- `GET|POST /v1/price-book`
- `PATCH /v1/price-book/:id`
- `GET|POST /v1/customers`
- `GET|POST /v1/quotes`
- `GET|PATCH /v1/quotes/:id`
- `POST /v1/quotes/:id/lines/:lineId/confirm`
- `POST /v1/quotes/:id/lines/:lineId/save-price-book`
- `POST /v1/quotes/:id/send`
- `POST /v1/quotes/:id/follow-up`
- `POST /v1/ai/extract`
- `GET /public/quotes/:token`
- `POST /public/quotes/:token/respond`
