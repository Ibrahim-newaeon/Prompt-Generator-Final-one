---
name: check
description: Run the full MegaPrompt local quality check without deploying.
---

Run `bun run check`. It must type-check, build, and complete the Wrangler dry run. Surface the first actionable failure with file and line evidence. Do not deploy, change secrets, push Autumn configuration, or access remote D1.
