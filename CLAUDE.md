# MegaPrompt Project Guide

MegaPrompt turns a rough idea into a production-grade prompt. The application runs on Cloudflare Workers with a Hono API, React 19/Vite frontend, Cloudflare D1, Drizzle, Better Auth, and AI models reached through the configured gateway.

This repository is independent from **Prompt-Generator-Final-Version**. Compare code and configuration before porting changes between them.

## Sources of truth

Prefer registered code and migrations, then **package.json**, **wrangler.json**, **autumn.config.ts**, **README.md**, and **design.md**. Keep plan tables and model names in focused product configuration rather than duplicating volatile values here.

## Repository map

- **src/api/index.ts** — Worker routes and API composition
- **src/api/auth.ts** — Better Auth factory
- **src/api/database/** — Drizzle schema and auth tables
- **src/api/migrations/** — D1 migrations
- **src/web/** — React application
- **autumn.config.ts** — current quota and billing product configuration
- **wrangler.json** — Worker, assets, D1, R2, and compatibility settings

## Commands

~~~bash
bun install
bun dev
bun run lint
bun run build
bun run check
bun run cf-typegen
bun run db:generate
bun run db:migrate
~~~

The check command includes a Wrangler dry-run deployment. Real deploys, remote D1 migrations, billing-plan pushes, and secret changes require explicit authorization.

## Invariants

- Authentication is required for generation; enforce ownership and quota on the server, not only in React.
- Validate every request and structured model response. Provider failures must not create successful prompt or usage records.
- Keep Better Auth creation request-scoped where required by the Worker runtime; do not reintroduce eager module initialization that harms startup.
- Append D1 migrations and test locally before remote application.
- Billing and quota currently flow through Autumn and the configuration present in this repository. Do not relabel the provider or migrate it through documentation alone.
- Admin access must be server-authorized; hiding the route is insufficient.
- Keep secrets in Worker secret storage or local ignored files, never source or browser configuration.
- Follow **design.md** and existing primitives; retain responsive, accessible, loading, and error behavior.

A feature is ready when lint, build, the combined check, and relevant migration tests pass.
