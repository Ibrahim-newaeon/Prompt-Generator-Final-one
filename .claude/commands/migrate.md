---
description: Generate a Drizzle migration from schema changes and apply it locally
---

1. Run `bun run db:generate` — Drizzle inspects `src/api/database/schema.ts` and emits a new SQL file under `src/api/migrations/`.
2. Show the user the generated SQL (read the newest file in `src/api/migrations/`) so they can confirm it's what they expected.
3. If the user confirms, run `bun run db:migrate` to apply it to the local D1 instance.

Stop and ask before applying if:
- The migration includes `DROP TABLE`, `DROP COLUMN`, or any `ALTER` that loses data.
- It modifies Better Auth tables (`user`, `session`, `account`, `verification`) — those are owned by `bunx @better-auth/cli generate`, not hand-edited schema.

Never run against the remote D1 (`--remote`) from this command. Production migrations are a deliberate, separate step.
