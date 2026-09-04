---
name: deploy
description: Prepare a read-only MegaPrompt production deployment checklist without deploying.
disable-model-invocation: true
---

1. Run `bun run check`.
2. List migration files and identify unresolved remote-application questions without running remote commands.
3. Print the required secret names without reading or displaying their values.
4. Show Git status and recent commits.
5. Report readiness and leave deployment, Autumn pushes, secrets, and remote migrations to explicit user-authorized actions.
