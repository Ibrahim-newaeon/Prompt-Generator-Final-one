---
name: migrate
description: Generate, inspect, and apply a Drizzle migration to local D1 only.
disable-model-invocation: true
---

Run the repository's migration generation command, inspect the newest SQL, and stop for approval if it drops, recreates, or destructively alters data. Better Auth tables must use the Better Auth generator. Apply only to local D1 and never use `--remote`.
