---
description: Run the full pre-deploy quality lap (tsgo + vite build + wrangler dry-run)
---

Run `bun run check` and report the result.

This script chains:
1. `tsgo` — type-checks the whole repo (worker + web).
2. `vite build` — confirms the React bundle builds.
3. `wrangler deploy --dry-run` — confirms the Worker bundle compiles and fits Cloudflare limits.

If anything fails, surface the first error with file:line and propose a focused fix. Do not deploy or push anywhere — this is a local check only.
