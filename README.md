# MegaPrompt

AI-powered prompt generator. Type a rough idea, get back a production-grade prompt for Claude, ChatGPT, image gen, or code gen.

Built on Cloudflare Workers + React 19 + Hono + D1, with Better Auth and Autumn billing.

## What it does

Two generation modes:

- **Generic LLM** — expands ideas into chat / image / code prompts. Haiku for Free + Starter, Sonnet for Pro + Agency.
- **Claude Mega Prompt (v2.3)** — structured XML prompt with intent detection, completeness scoring, locale awareness, and a repair loop. Pro and Agency only, runs on Opus.

Auth is required to generate. Quota and plan gating are enforced server-side via Autumn.

## Plans

| Plan    | Prompts          | Generic Model       | Claude Mode | Bulk Export | Price    |
|---------|------------------|---------------------|-------------|-------------|----------|
| Free    | 1 lifetime       | `claude-haiku-4.5`  | —           | —           | $0       |
| Starter | 50 / month       | `claude-haiku-4.5`  | —           | —           | $9/mo    |
| Pro     | 200 / month      | `claude-sonnet-4-5` | Opus        | —           | $29/mo   |
| Agency  | Unlimited        | `claude-sonnet-4-5` | Opus        | MD + CSV    | $79/mo   |

## Stack

| Layer         | Tech                                                |
|---------------|-----------------------------------------------------|
| Runtime       | Cloudflare Workers (Wrangler + `@cloudflare/vite-plugin`) |
| Backend       | Hono 4                                              |
| Frontend      | React 19 + Vite 7 + Wouter 3                        |
| Styling       | Tailwind CSS v4 (`@theme` in `styles.css`)          |
| Database      | Cloudflare D1 + Drizzle ORM                         |
| Auth          | Better Auth 1.4 (email + password)                  |
| Billing       | Autumn JS 1.2 + Stripe                              |
| AI            | Vercel AI SDK → Claude via Cloudflare AI Gateway    |

## Project structure

```
src/
├── api/                   ← Hono backend (Cloudflare Worker)
│   ├── index.ts           ← all routes (/ping, /generate, /generate-claude, /prompts, /admin)
│   ├── auth.ts            ← Better Auth factory
│   ├── claude-system-prompt.ts   ← XML system prompt for Claude v2.3
│   ├── middleware/        ← authMiddleware + authenticatedOnly
│   ├── database/          ← Drizzle schema + Better Auth schema
│   └── migrations/        ← Drizzle SQL migrations
└── web/                   ← React 19 frontend
    ├── app.tsx            ← Routes
    ├── pages/             ← landing / index / auth / pricing / admin
    ├── components/        ← Provider + UI primitives
    └── lib/auth.ts        ← Better Auth client
```

See [`CLAUDE.md`](./CLAUDE.md) for architectural conventions, API contract, and plan-gating logic.

## Quick start

```bash
bun install
bun run cf-typegen     # generate Cloudflare Worker types
bun run db:generate    # generate migration SQL from Drizzle schema
bun run db:migrate     # apply migrations to local D1
bun dev --port 8452    # start dev server
```

You'll need a `.dev.vars` file in the project root:

```
AI_GATEWAY_BASE_URL=https://gateway.ai.cloudflare.com/v1/...
AI_GATEWAY_API_KEY=...
BETTER_AUTH_SECRET=...
AUTUMN_SECRET_KEY=sk_...
```

## Common scripts

```bash
bun run check          # full quality lap: tsgo + vite build + wrangler dry-run
bun run build          # production build
bun run lint           # eslint
bunx tsgo              # type-check only
bunx atmn push -y      # push autumn.config.ts billing plans to Autumn sandbox
bunx wrangler deploy   # deploy Worker to Cloudflare
```

## API

All routes are under `/api/`.

| Method | Path                          | Auth                    | Notes |
|--------|-------------------------------|-------------------------|-------|
| GET    | `/api/ping`                   | —                       | Health check |
| ALL    | `/api/auth/*`                 | —                       | Better Auth handler |
| ALL    | `/api/autumn/*`               | —                       | Autumn billing handler |
| POST   | `/api/generate`               | User                    | Generic mode generation |
| POST   | `/api/generate-claude`        | User + Pro plan         | Claude v2.3 structured generation |
| POST   | `/api/prompts`                | User                    | Save prompt |
| GET    | `/api/prompts`                | User                    | List user's prompts |
| PATCH  | `/api/prompts/:id/rating`     | User                    | Rate a prompt |
| DELETE | `/api/prompts/:id`            | User                    | Delete a prompt |
| GET    | `/api/prompts/export`         | User + Agency plan      | Bulk export as `md` or `csv` |
| GET    | `/api/admin/users`            | Admin email             | List users + plans + prompt counts |
| GET    | `/api/admin/stats`            | Admin email             | Usage stats + 30-day activity |
| GET    | `/api/admin/revenue`          | Admin email             | Subscription data from Autumn |
| PATCH  | `/api/admin/users/:id/plan`   | Admin email             | Change a user's plan |
| DELETE | `/api/admin/users/:id`        | Admin email             | Delete user + cascade prompts |

Admin allowlist is hardcoded in `src/api/index.ts` (search for `ADMIN_EMAILS`).

## Working with Claude Code

This repo is set up for [Claude Code](https://claude.com/claude-code):

- [`CLAUDE.md`](./CLAUDE.md) — architecture, conventions, definition of done.
- `.claude/settings.json` — permission allowlist for safe commands; deny list blocks `wrangler deploy`, `--remote` D1 commands, force-push, etc.
- `.claude/commands/` — slash commands:
  - `/check` — run the full pre-deploy quality lap.
  - `/migrate` — generate + apply a Drizzle migration locally.
  - `/deploy` — pre-flight check before a production deploy (does not deploy itself).

## Deploy

Set production secrets (one-time):

```bash
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put AUTUMN_SECRET_KEY
bunx wrangler secret put AI_GATEWAY_BASE_URL
bunx wrangler secret put AI_GATEWAY_API_KEY
```

Apply migrations to remote D1:

```bash
bunx wrangler d1 migrations apply DB --remote
```

Deploy the Worker:

```bash
bunx wrangler deploy
```

## License

Private / unreleased.
