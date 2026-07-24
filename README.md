# SnapQuote

Same-day quoting for home-service trades. The app helps a contractor capture a job, generate a priced draft from their own price book, send the quote, and track whether the customer viewed or accepted it.

## Active Structure

This repo now follows the production path we are actually building:

- `mobile/src/app` - Expo Router route tree; route files stay thin when feature code belongs elsewhere.
- `mobile/src/api` - mobile API client for the Supabase Edge Function.
- `mobile/src/auth` - login screen, auth store, OAuth callback UI, and app-level auth gate.
- `mobile/src/components` - reusable mobile components, motion helpers, and theme tokens.
- `mobile/src/state` - quote/workspace store and quote selectors.
- `mobile/src/utils` - formatting and general utility helpers.
- `shared` - shared TypeScript domain logic, schemas, pricing rules, matching, and tests.
- `infra/supabase/functions/snapquote` - Supabase Edge Function API.
- `infra/supabase/migrations` - Postgres schema, views, grants, auth/setup migrations, and storage setup.

Removed scaffold:

- local Fastify API
- BullMQ/Redis worker
- standalone prompts package
- local Docker Postgres/Redis/LocalStack stack

The mobile app calls the Supabase Edge Function directly through `EXPO_PUBLIC_API_URL`.

## Local Development

Install dependencies:

```sh
pnpm install
```

Run the mobile app:

```sh
pnpm dev:mobile
```

Clear the Expo cache:

```sh
pnpm dev:mobile:clear
```

Run verification:

```sh
pnpm lint
pnpm typecheck
pnpm test
```

## Supabase

The app runs on Supabase Postgres + Edge Functions. SnapQuote data is isolated in the `snapquote` schema with public views for the Edge Function.

Link an existing Supabase project:

```sh
cd infra/supabase
supabase link --project-ref <existing-project-ref>
```

Apply migrations:

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
EXPO_PUBLIC_API_URL=https://<project-ref>.functions.supabase.co/snapquote
```

Build and deploy the public quote host:

```sh
pnpm build:web
pnpm --filter @snapquote/web deploy
```

Required or optional Edge Function secrets:

```sh
supabase secrets set OPENAI_API_KEY=<key>
supabase secrets set OPENAI_MODEL=gpt-4.1-mini
supabase secrets set SNAPQUOTE_PUBLIC_BASE_URL=https://quotes.your-domain.com
supabase secrets set RESEND_API_KEY=<resend-api-key>
supabase secrets set SNAPQUOTE_FROM_EMAIL='SnapQuote <quotes@your-domain.com>'
supabase secrets set SNAPQUOTE_REPLY_TO_EMAIL=owner@your-domain.com
supabase secrets set SNAPQUOTE_DEFAULT_ORG_ID=00000000-0000-4000-8000-000000000001
```

## Auth Redirects

The standalone/dev-client app scheme is:

```sh
snapquote://auth/callback
```

For Expo Go, add the redirect URL printed in Metro logs by `Linking.createURL("auth/callback")`, for example:

```sh
exp://<LAN-IP>:<port>/--/auth/callback
```

Add the active redirect URLs to Supabase Auth URL Configuration. Enable Google and Apple providers in Supabase after creating their provider credentials.

## Edge Function Routes

The `snapquote` Edge Function currently owns the API surface, including:

- `GET /health`
- auth OAuth start/complete/refresh/logout helpers
- onboarding/setup
- price book CRUD
- customer CRUD
- quote creation, update, review, send, follow-up
- AI extraction/transcription
- public quote view/respond

The mobile API wrapper is `mobile/src/api/client.ts`; it builds typed requests to this Edge Function.
