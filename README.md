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
