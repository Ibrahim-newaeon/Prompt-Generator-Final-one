---
paths:
  - "src/api/**"
  - "autumn.config.ts"
---

# API, authentication, and quota rules

- Follow established Hono, Better Auth, Drizzle, D1, R2, and Autumn boundaries.
- Validate input and keep authentication, authorization, quota decisions, and secrets server-side.
- Better Auth tables are generated through its CLI; do not hand-edit their schema.
- Autumn configuration changes affect billing and quotas and require explicit review before pushing.
