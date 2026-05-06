# MegaPrompt — Project Intelligence

## Purpose
AI-powered mega prompt generator. Users describe a rough idea; the app expands it into a production-grade prompt for Claude, ChatGPT, image gen, or code gen.

Two modes:
- **Claude Mega Prompt (v2.3)** — structured XML output with intent detection, completeness scoring, locale awareness, conflict detection, and a repair loop. Calls `claude-opus-4-5` via AI Gateway.
- **Generic LLM Prompt** — expands ideas for Chat / Image / Code prompts. Calls `anthropic/claude-haiku-4.5` via AI Gateway.

Auth is required to generate. Free tier = 1 prompt lifetime. Paid plans via Autumn + Stripe.

---

## Architecture

```
mega-prompt-generator/
├── CLAUDE.md                          ← you are here
├── autumn.config.ts                   ← Autumn billing plans (push with: bunx atmn push -y)
├── drizzle.config.ts
├── wrangler.jsonc                     ← Cloudflare Worker config + D1 binding
├── .dev.vars                          ← local secrets (never commit)
├── src/
│   ├── api/                           ← Hono backend (Cloudflare Worker)
│   │   ├── index.ts                   ← all routes: /ping, /generate, /generate-claude, /prompts CRUD, /auth/*, /autumn/*
│   │   ├── auth.ts                    ← Better Auth factory (createAuth)
│   │   ├── claude-system-prompt.ts    ← 400-line XML system prompt for Claude v2.3
│   │   ├── middleware/
│   │   │   └── authentication.ts     ← authMiddleware (populates user/session) + authenticatedOnly (401 guard)
│   │   ├── database/
│   │   │   ├── schema.ts              ← prompts table + re-exports auth-schema
│   │   │   └── auth-schema.ts         ← Better Auth generated tables (user, session, account, verification)
│   │   └── migrations/                ← Drizzle SQL migrations
│   └── web/                           ← React 19 frontend (Vite)
│       ├── app.tsx                    ← Routes: / → Landing, /app → AppRoute (auth-gated Index), /auth → AuthPage, /pricing → Pricing
│       ├── main.tsx                   ← React entry
│       ├── styles.css                 ← Global dark theme (Syne + DM Sans fonts)
│       ├── components/
│       │   └── provider.tsx           ← AutumnProvider (wraps entire app, enables useCustomer)
│       ├── lib/
│       │   └── auth.ts                ← Better Auth client (createAuthClient → authClient)
│       └── pages/
│           ├── landing.tsx            ← Public landing page (/) — explains product, hero, features, how-it-works, CTA
│           ├── index.tsx              ← Main app (/app, auth-gated): generate + history + templates tabs
│           ├── auth.tsx               ← Sign in / Sign up page (email+password, WhatsApp coming soon)
│           ├── pricing.tsx            ← Pricing plans (Free / Starter / Pro / Agency)
│           └── admin.tsx              ← Admin dashboard (/admin, email-gated): users, stats, revenue, plan management
```

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Cloudflare Workers (via Wrangler + @cloudflare/vite-plugin) |
| Backend framework | Hono 4.12.5 |
| Frontend | React 19 + Vite 7 |
| Routing | Wouter 3 |
| Styling | Tailwind CSS v4 + custom CSS variables |
| Database | Cloudflare D1 (SQLite) |
| ORM | Drizzle ORM |
| Auth | Better Auth 1.4.22 (email+password, Drizzle adapter) |
| Billing / Quota | Autumn JS 1.2.0 (autumnHandler for routes, useCustomer/useListPlans in React) |
| AI | Vercel AI SDK → Claude models via Cloudflare AI Gateway |
| Fonts | Syne (headings) + DM Sans (body) from Google Fonts |

---

## Core Commands

```bash
# Dev server (Cloudflare Worker + React via Vite)
bun dev --port 8452

# Build for production (runs tsgo type-check + autumn.config check + vite build)
bun run build

# Combined check: tsgo + vite build + wrangler dry-run deploy
bun run check

# Database migrations
bun run db:generate            # generate migration SQL from schema
bun run db:migrate             # apply migrations locally (wrangler d1 migrations apply DB --local)
bun run db:studio              # open Drizzle Studio

# Push Autumn billing plans to sandbox
bunx atmn push -y

# Generate Better Auth schema (outputs auth-schema.ts)
bunx @better-auth/cli generate

# Type checking only (uses TypeScript native preview)
bunx tsgo

# Cloudflare Workers types regeneration
bun run cf-typegen

# Deploy to Cloudflare Workers
bunx wrangler deploy
```

---

## Environment Variables (`.dev.vars`)

```
AI_GATEWAY_BASE_URL=https://gateway.ai.cloudflare.com/v1/...
AI_GATEWAY_API_KEY=...
BETTER_AUTH_SECRET=...
AUTUMN_SECRET_KEY=sk_...
```

For production, set these as Cloudflare Worker secrets:
```bash
bunx wrangler secret put BETTER_AUTH_SECRET
bunx wrangler secret put AUTUMN_SECRET_KEY
bunx wrangler secret put AI_GATEWAY_BASE_URL
bunx wrangler secret put AI_GATEWAY_API_KEY
```

---

## Data Models

### `prompts` table (D1 / SQLite)
```ts
{
  id: string (UUID, PK)
  userId: string | null       // FK → better-auth user.id (null = legacy anonymous)
  title: string               // first 60 chars of input idea
  inputIdea: string
  generatedPrompt: string     // raw text or XML
  promptType: "chat" | "image" | "code"
  promptMode: "generic" | "claude"
  rating: number (0–5)
  createdAt: number (Unix ms)
}
```

### Better Auth tables (auto-generated)
- `user` — id, name, email, emailVerified, image, createdAt, updatedAt
- `session` — id, userId, expiresAt, token, ...
- `account` — OAuth accounts (email+password stored here)
- `verification` — email verification tokens

---

## API Contract

All routes under `/api/` prefix.

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/ping` | None | Health check → `{ message: "Pong! {ts}" }` |
| ALL | `/api/auth/*` | N/A | Better Auth handler (sign in, sign up, session, sign out) |
| ALL | `/api/autumn/*` | N/A | Autumn billing handler (attach, checkout, portal) |
| POST | `/api/generate` | Required | Generic LLM prompt gen → `{ generated, remaining }` |
| POST | `/api/generate-claude` | Required | Claude v2.3 structured prompt → `{ result: ClaudeResult, remaining }` |
| POST | `/api/prompts` | Required | Save prompt → `{ id }` |
| GET | `/api/prompts` | Required | List user prompts (user-scoped) → `{ prompts: [] }` |
| PATCH | `/api/prompts/:id/rating` | Required | Rate prompt → `{ ok: true }` |
| DELETE | `/api/prompts/:id` | Required | Delete prompt → `{ ok: true }` |
| GET | `/api/prompts/export?format=md\|csv` | Required + Agency plan | Bulk export all user's prompts as `.md` or `.csv` file |
| GET | `/api/admin/users` | Required + Admin email | List all users with plan + prompt count |
| GET | `/api/admin/stats` | Required + Admin email | Usage stats: totals, by type/mode, last-30-day daily activity |
| GET | `/api/admin/revenue` | Required + Admin email | Proxies Autumn `/v1/customers` for subscription/revenue view |
| PATCH | `/api/admin/users/:id/plan` | Required + Admin email | Change a user's plan via Autumn `attach` |
| DELETE | `/api/admin/users/:id` | Required + Admin email | Delete user + cascade prompts (cannot delete self) |

### Error responses
- `401` — not authenticated (from `authenticatedOnly` middleware)
- `402` — quota exceeded `{ error: "quota_exceeded", remaining: 0 }`
- `403` — `{ error: "plan_required", requiredPlan, currentPlan }` (plan-gated routes) or `{ error: "forbidden" }` (admin routes)
- `400` — missing required fields / invalid plan / `cannot_delete_self`
- `500` — internal error `{ error: "message" }`
- `502` — `{ error: "autumn_error", detail }` when downstream Autumn API call fails

---

## Quota System (Autumn)

Feature ID: `"prompts"` — tracks all generations regardless of mode.

### Plans (defined in `autumn.config.ts`)
| Plan ID | Prompts | Price |
|---------|---------|-------|
| `free` | 1 (yearly reset ≈ lifetime) | $0 |
| `starter` | 50/month | $9/mo |
| `pro` | 200/month | $29/mo |
| `agency` | Unlimited | $79/mo |

### Quota flow
1. `checkQuota(userId, secretKey)` → `autumn.check({ customerId, featureId, requiredBalance: 1 })`
2. If `!allowed` → return HTTP 402
3. Call AI → if success → `trackUsage(userId, secretKey)` → `autumn.track({ ..., value: 1 })`
4. Frontend detects 402 → shows `<QuotaWall>` component → redirects to `/pricing`

---

## Auth Flow (Better Auth)

- `createAuth(baseURL, autumnSecretKey?)` — factory called per-request with dynamic base URL
- `export const auth = createAuth("http://localhost:8452")` — static export at bottom of `auth.ts` for CLI schema generation only
- `authMiddleware` — runs on all protected routes, populates `c.var.user` and `c.var.session`
- `authenticatedOnly` — blocks unauthenticated requests with 401
- `authClient` — Better Auth React client, created in `src/web/lib/auth.ts`, points to `/api/auth`
- `authClient.useSession()` — React hook for current session state
- Autumn plugin on Better Auth automatically creates a customer in Autumn on sign-up

---

## Conventions Claude MUST follow

1. **Worker-safe imports** — never `import fs`, `import path`, or any Node.js built-ins in `src/api/`. Only use Web APIs + Cloudflare Workers APIs.
2. **`cloudflare:workers` env** — `import { env } from "cloudflare:workers"` only works at runtime inside the Worker. The static `auth` export at the bottom of `auth.ts` exists purely for the CLI — don't break it.
3. **Per-request auth instantiation** — always call `createAuth(baseURL, secretKey)` with dynamic base URL extracted from `c.req.url`. Never use a module-level singleton.
4. **User-scoped queries** — every DB query on the `prompts` table MUST include `eq(prompts.userId, user.id)` to prevent cross-user data leaks.
5. **Track AFTER success** — quota tracking (`autumn.track`) only fires after the AI call succeeds. Never track on error.
6. **No `any` types** — use `unknown` + type narrowing or define proper interfaces.
7. **Error boundaries** — all API handlers wrapped in try/catch; all unknown errors caught and returned as `{ error: message }`.
8. **React 19** — use `use()` hook for async data where appropriate. No class components.
9. **Wouter routing** — use `useLocation()` for navigation, not `window.location.href` (breaks SPA routing).
10. **CSS strategy** — global styles in `styles.css`, Tailwind utility classes for layout/spacing, inline `style={{}}` for dynamic colors and theme values. No CSS modules.

---

## What NOT To Do

- ❌ Don't add `node:` protocol imports in `src/api/` — crashes the Worker
- ❌ Don't call `createAuth()` at module level with `env.DB` — `env` is only available inside request handlers
- ❌ Don't use `React.FC` type — just type props inline with interfaces
- ❌ Don't add `console.log` in production paths — use structured error returns
- ❌ Don't fetch `/api/prompts` without checking `isLoggedIn` first — causes 401 noise in logs
- ❌ Don't call `autumn.track` before confirming AI generation succeeded
- ❌ Don't add new Autumn features without running `bunx atmn push -y` to sync to sandbox
- ❌ Don't modify `auth-schema.ts` directly — it's generated by `bunx @better-auth/cli generate`
- ❌ Don't store credit card data, PII beyond email/name, or API keys in D1

---

## Definition of Done (per feature)

- [ ] TypeScript compiles with `bunx tsgo` — zero errors (or run `bun run check` for the full lap: tsgo + vite build + wrangler dry-run)
- [ ] Dev server starts clean (`bun dev --port 8452`) — no unhandled exceptions
- [ ] Feature works end-to-end in browser (not just unit tested)
- [ ] Auth-required routes return 401 when unauthenticated
- [ ] Plan-gated routes return 403 with `{ requiredPlan }` when current plan is below
- [ ] Admin-only routes return 403 `{ error: "forbidden" }` for non-allowlisted emails
- [ ] Quota-enforced routes return 402 when quota = 0
- [ ] User-scoped DB queries tested (can't access other user's data)
- [ ] Error states shown in UI (not just console logged)
- [ ] No `any` types introduced
- [ ] Migrations generated (`bun run db:generate`) and applied (`bun run db:migrate`) locally before merging

---

## Plan-Gated Features

Four features are gated behind plan tiers. Backend enforces via HTTP errors; frontend reflects visually.

### 1. Claude v2.3 Mode — Pro+ only
- **Backend**: `POST /api/generate-claude` calls `getUserPlan(userId, secretKey)` before running. Returns `403 { error: "plan_required", requiredPlan: "pro" }` for `free` or `starter`.
- **Frontend**: `canUseClaude = hasPlan(activePlan, "pro")`. Claude tab in `ModeSwitcher` shows 🔒 for non-pro. Clicking shows upgrade wall instead of form.
- **Helper**: `getUserPlan(userId, secretKey)` calls `autumn.customers.getOrCreate({ customerId: userId })` — returns `sub?.planId ?? "free"`.

### 2. Priority Model Routing — Pro+ only
- **Backend**: `POST /api/generate` (Generic mode) uses `claude-sonnet-4-5` for Pro+ users, `claude-haiku-4.5` for free/starter. Same `getUserPlan` check.
- **Frontend**: `isPriorityModel = hasPlan(activePlan, "pro")`. Generic mode output area shows "⚡ Sonnet model" badge for pro+ users.

### 3. Bulk Export — Agency only
- **Backend**: `GET /api/prompts/export?format=md|csv` returns `403 { error: "plan_required", requiredPlan: "agency" }` for non-agency users. Agency users get all their prompts as `.md` or `.csv` file download.
- **Frontend**: `canBulkExport = hasPlan(activePlan, "agency")`. History tab header shows export buttons (MD + CSV) for agency; locked button with tooltip for others.

### 4. Accurate Pricing Copy — All plans
- **Frontend**: `pricing.tsx` `PLAN_META` updated with accurate feature descriptions. Each plan has `locked?: string[]` array — rendered as dimmed `–` items showing what's not included.

### Plan Rank Ordering
```ts
const PLAN_RANK = { free: 0, starter: 1, pro: 2, agency: 3 };
const hasPlan = (current: string, required: string) =>
  (PLAN_RANK[current] ?? 0) >= (PLAN_RANK[required] ?? 99);
```
Both backend and frontend define this same structure independently.

### Model per Plan
| Plan | Generic Mode Model | Claude Mode Model |
|------|-------------------|-------------------|
| free / starter | `claude-haiku-4.5` | blocked (403) |
| pro / agency | `claude-sonnet-4-5` | `claude-opus-4-5` |

---

## Admin Panel

Page: `src/web/pages/admin.tsx` mounted at `/admin` in `src/web/app.tsx`.
Backend: 5 endpoints under `/api/admin/*` in `src/api/index.ts`.

### Access control
- Gated by **email allowlist**, not plan tier.
- Allowlist is a hardcoded const at the top of the admin section in `src/api/index.ts`:
  ```ts
  const ADMIN_EMAILS = ["abd.rabo.940@gmail.com", "Ibrahim@al-ai.ai"];
  ```
- `adminOnly(email)` does a case-insensitive match. Non-admins get `403 { error: "forbidden" }`.
- To add a new admin: append to `ADMIN_EMAILS` and redeploy. Always use a real email — non-email strings will silently never match.

### Capabilities
- **Users tab** — list every user with name/email/plan/prompt count, change plan, delete user (cascades prompts).
- **Stats tab** — total prompts, total users, breakdown by `promptType` and `promptMode`, 30-day daily activity histogram.
- **Revenue tab** — proxies `https://api.useautumn.com/v1/customers?limit=100` so admins can see active subscriptions.

### Conventions for admin code
1. Every admin route MUST start with `if (!adminOnly(user.email)) return c.json({ error: "forbidden" }, 403);`
2. Plan changes go through `autumn.attach({ customerId, productId })` first, with a direct REST fallback to `/v1/customers/:id/entitlements`.
3. `DELETE /admin/users/:id` must reject when `targetId === user.id` (no admin self-deletion).
4. Admin routes do NOT consume quota and do NOT need `getUserPlan` checks — the email gate is sufficient.

---

## Known Issues / Watch Out

1. **PostCSS warning** — `@import` order in `styles.css` causes a non-fatal Vite warning. Safe to ignore; doesn't affect functionality.
2. **Autumn `Autumn` class import** — use `import { Autumn } from "autumn-js"` (not `autumn-js/hono`) for the `check`/`track` methods.
3. **Better Auth `useSession`** — hook is `authClient.useSession()` (not `useAuthSession`). Returns `{ data: { user, session } | null }`.
4. **Worker CPU startup limit (error 10021)** — Worker bundle is ~4MB due to `better-auth` + `@ai-sdk/openai` + `jose`. Fixed by: (a) using `better-auth/minimal` import (no Kysely), (b) `nodejs_compat_v2` compat flag in `wrangler.json` (lazy module evaluation — modules aren't parsed until first use), (c) never calling `createAuth()` at module level.
5. **Cloudflare D1 in dev** — migrations use `bunx drizzle-kit migrate`, NOT `wrangler d1 execute` for local dev. For production deploy use `wrangler d1 execute --remote`.
5. **Pricing page shows $0** — plan prices are placeholder. Update in Autumn dashboard before going live.
