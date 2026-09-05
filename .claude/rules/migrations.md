---
paths:
  - "src/api/migrations/**"
  - "src/api/database/**"
  - "drizzle.config.ts"
---

# D1 migration rules

- Append migrations and never rewrite an applied migration.
- Review SQL for data loss, table recreation, indexes, defaults, and backfills.
- Automated work may apply migrations only to local D1. Remote operations require explicit manual approval.
