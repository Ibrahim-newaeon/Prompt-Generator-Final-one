---
description: Pre-flight a production deploy (check + push migrations + show what would deploy). Does NOT actually deploy.
---

Pre-deploy checklist for Cloudflare Workers. **This command never runs `wrangler deploy` itself** — it surfaces everything you need to deploy confidently, then hands off.

1. Run `bun run check` — must pass.
2. Show pending D1 migrations: list files in `src/api/migrations/` and warn if any have not been applied to remote (the user should run `bunx wrangler d1 migrations apply DB --remote` themselves).
3. Confirm Worker secrets are set in production. Print this checklist for the user to verify in Cloudflare dashboard:
   - `BETTER_AUTH_SECRET`
   - `AUTUMN_SECRET_KEY`
   - `AI_GATEWAY_BASE_URL`
   - `AI_GATEWAY_API_KEY`
4. Show `git status` and the last 5 commits so the user knows exactly what would ship.
5. End with: "Ready. Run `bunx wrangler deploy` yourself when you're sure."

Do not run `wrangler deploy`, `wrangler secret put`, or any `--remote` D1 command — those are explicitly denied in `.claude/settings.json` and require manual execution.
