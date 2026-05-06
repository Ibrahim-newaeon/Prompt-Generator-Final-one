import { Hono } from 'hono';
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import { prompts, user as userTable } from "./database/schema";
import { eq, desc, and, count, sql } from "drizzle-orm";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { CLAUDE_SYSTEM_PROMPT } from "./claude-system-prompt";
import { createAuth } from "./auth";
import { authMiddleware, authenticatedOnly } from "./middleware/authentication";
import { autumnHandler } from "autumn-js/hono";
import { Autumn } from "autumn-js";

type Bindings = {
  DB: D1Database;
  AI_GATEWAY_BASE_URL: string;
  AI_GATEWAY_API_KEY: string;
  BETTER_AUTH_SECRET: string;
  AUTUMN_SECRET_KEY: string;
};

type Variables = {
  user: { id: string; name: string; email: string } | null;
  session: unknown | null;
};

// Plan tiers in ascending order
const PLAN_RANK: Record<string, number> = { free: 0, starter: 1, pro: 2, agency: 3 };

const app = new Hono<{ Bindings: Bindings; Variables: Variables }>().basePath('api');

app.use(cors({ origin: "*", credentials: true }));

// ── Auth routes ──
app.all("/auth/*", (c) => {
  const auth = createAuth(`${new URL(c.req.url).protocol}//${new URL(c.req.url).host}`, c.env, c.env.AUTUMN_SECRET_KEY);
  return auth.handler(c.req.raw);
});

// ── Autumn routes ──
app.all("/autumn/*", async (c) => {
  const handler = autumnHandler({
    secretKey: c.env.AUTUMN_SECRET_KEY,
    identify: async (ctx) => {
      const auth = createAuth(`${new URL(ctx.req.url).protocol}//${new URL(ctx.req.url).host}`, c.env, c.env.AUTUMN_SECRET_KEY);
      const session = await auth.api.getSession({ headers: ctx.req.raw.headers });
      if (!session) return null;
      return { customerId: session.user.id };
    },
  });
  return handler(c, async () => {});
});

app.get('/ping', (c) => c.json({ message: `Pong! ${Date.now()}` }));

// ── Generic LLM system prompts ──
const SYSTEM_PROMPTS: Record<string, string> = {
  chat: `You are a mega prompt engineer. Your task is to take a simple idea and expand it into a richly detailed, highly effective prompt for a large language model (like Claude or GPT-4).
The mega prompt should:
- Clearly define the role/persona the AI should take
- Provide rich context and background
- Specify the exact task with clear requirements
- Include constraints, tone, format, and output expectations
- Add examples or edge cases where helpful
- Be 200-500 words
Output ONLY the mega prompt text, no explanations or meta-commentary.`,

  image: `You are a world-class image prompt engineer specializing in AI image generation (Midjourney, DALL-E, Stable Diffusion).
Transform the given idea into an ultra-detailed image generation prompt that includes:
- Subject: detailed description of main subject, character, or scene
- Style: art style, medium, aesthetic (e.g. photorealistic, oil painting, cinematic)
- Composition: camera angle, framing, depth of field
- Lighting: quality, direction, mood, time of day
- Color palette: dominant colors, contrast, saturation
- Details: textures, materials, atmosphere
- Technical: resolution quality, render engine references
- Negative prompts suggestion at the end (prefix with "Negative:")
Output ONLY the mega prompt text, no explanations.`,

  code: `You are an expert Claude Code prompt architect. Your job is to transform a simple idea into a comprehensive, production-ready coding prompt optimised for Claude Code projects.

The output prompt MUST follow this exact Claude Code project structure:

---

## 1. CLAUDE.md — Project Intelligence
Instruct Claude to create a CLAUDE.md file at the root that contains:
- Project purpose and architecture overview
- Key technical decisions and the reasoning behind them
- Core commands (install, dev, build, test, lint)
- Project-specific conventions and patterns Claude must always follow
- What NOT to do (anti-patterns for this project)

## 2. Project Structure
Specify the exact folder layout, for example:
\`\`\`
/
├── CLAUDE.md
├── src/
│   ├── core/
│   ├── services/
│   ├── api/
│   ├── web/
│   │   ├── pages/
│   │   ├── components/
│   │   └── hooks/
│   ├── lib/
│   └── types/
├── tests/
│   ├── unit/
│   ├── integration/
│   └── e2e/
└── docs/
\`\`\`

## 3. Tech Stack — state explicitly: language, framework, DB, ORM, auth, testing, linting

## 4. Core Requirements — numbered atomic tasks, each independently verifiable

## 5. Data Models & Types — define all TypeScript interfaces upfront

## 6. API Contract — all endpoints/function signatures with input/output types

## 7. Error Handling — Result<T,E> pattern, no silent failures

## 8. Testing — unit/integration/e2e with coverage threshold

## 9. Code Style — no any types, functions max 40 lines, composition over inheritance

## 10. Definition of Done checklist Claude must satisfy per task

---

Now generate the full mega prompt for the following idea. Output ONLY the mega prompt text.`,
};

// ── Helpers ──

async function checkQuota(userId: string, secretKey: string): Promise<{ allowed: boolean; remaining: number }> {
  const autumn = new Autumn({ secretKey });
  const result = await autumn.check({ customerId: userId, featureId: "prompts", requiredBalance: 1 });
  return { allowed: result.allowed, remaining: result.balance?.remaining ?? 0 };
}

async function trackUsage(userId: string, secretKey: string) {
  const autumn = new Autumn({ secretKey });
  await autumn.track({ customerId: userId, featureId: "prompts", value: 1 });
}

/** Returns the active planId for a user. Falls back to "free". */
async function getUserPlan(userId: string, secretKey: string): Promise<string> {
  try {
    const autumn = new Autumn({ secretKey });
    const customer = await autumn.customers.getOrCreate({ customerId: userId });
    const sub = customer?.subscriptions?.[0];
    return (sub as { planId?: string } | undefined)?.planId ?? "free";
  } catch {
    return "free";
  }
}

/** True if user's plan rank >= required plan rank */
function hasPlan(planId: string, required: string): boolean {
  return (PLAN_RANK[planId] ?? 0) >= (PLAN_RANK[required] ?? 0);
}

/** Model to use for Generic LLM based on plan — Pro/Agency get sonnet */
function modelForPlan(planId: string): string {
  return hasPlan(planId, "pro") ? "anthropic/claude-sonnet-4-5" : "anthropic/claude-haiku-4.5";
}

// ── Generate (Generic LLM) ──
app.post('/generate', authMiddleware, authenticatedOnly, async (c) => {
  try {
    const user = c.get("user")!;
    const { idea, type } = await c.req.json<{ idea: string; type: string }>();
    if (!idea || !type) return c.json({ error: "Missing idea or type" }, 400);

    const [{ allowed, remaining }, planId] = await Promise.all([
      checkQuota(user.id, c.env.AUTUMN_SECRET_KEY),
      getUserPlan(user.id, c.env.AUTUMN_SECRET_KEY),
    ]);
    if (!allowed) return c.json({ error: "quota_exceeded", remaining: 0 }, 402);

    // Feature: Priority generation — Pro/Agency use claude-sonnet-4-5
    const model = modelForPlan(planId);
    const openai = createOpenAI({ baseURL: c.env.AI_GATEWAY_BASE_URL, apiKey: c.env.AI_GATEWAY_API_KEY });
    const system = SYSTEM_PROMPTS[type] || SYSTEM_PROMPTS.chat;
    const { text } = await generateText({ model: openai.chat(model), system, prompt: `Idea: ${idea}`, maxTokens: 1024 });

    await trackUsage(user.id, c.env.AUTUMN_SECRET_KEY);
    return c.json({ generated: text, remaining: remaining - 1, model });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

// ── Generate (Claude v2.3) — Pro+ only ──
app.post('/generate-claude', authMiddleware, authenticatedOnly, async (c) => {
  try {
    const user = c.get("user")!;
    const { request, location, industry, language } = await c.req.json<{ request: string; location?: string; industry?: string; language?: string }>();
    if (!request?.trim()) return c.json({ error: "Missing request" }, 400);

    const [{ allowed, remaining }, planId] = await Promise.all([
      checkQuota(user.id, c.env.AUTUMN_SECRET_KEY),
      getUserPlan(user.id, c.env.AUTUMN_SECRET_KEY),
    ]);

    // Feature: Claude v2.3 is Pro+ only
    if (!hasPlan(planId, "pro")) {
      return c.json({ error: "plan_required", requiredPlan: "pro", currentPlan: planId }, 403);
    }
    if (!allowed) return c.json({ error: "quota_exceeded", remaining: 0 }, 402);

    const openai = createOpenAI({ baseURL: c.env.AI_GATEWAY_BASE_URL, apiKey: c.env.AI_GATEWAY_API_KEY });
    const userMessage = [
      `<user_request>${request}</user_request>`,
      location ? `<location>${location}</location>` : '',
      industry ? `<industry>${industry}</industry>` : '',
      language ? `<language>${language}</language>` : '<language>en</language>',
      `<max_repair_attempts>2</max_repair_attempts>`,
    ].filter(Boolean).join('\n');

    const { text } = await generateText({ model: openai.chat("anthropic/claude-opus-4-5"), system: CLAUDE_SYSTEM_PROMPT, prompt: userMessage, maxTokens: 4096, temperature: 0.2 });

    let parsed: unknown;
    try {
      const clean = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      return c.json({ error: "Claude returned invalid JSON", raw: text }, 500);
    }

    await trackUsage(user.id, c.env.AUTUMN_SECRET_KEY);
    return c.json({ result: parsed, remaining: remaining - 1 });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

// ── Prompts CRUD (user-scoped) ──
app.post('/prompts', authMiddleware, authenticatedOnly, async (c) => {
  try {
    const user = c.get("user")!;
    const { title, inputIdea, generatedPrompt, promptType, promptMode } = await c.req.json<{ title: string; inputIdea: string; generatedPrompt: string; promptType: string; promptMode?: string }>();
    const db = drizzle(c.env.DB);
    const id = crypto.randomUUID();
    await db.insert(prompts).values({ id, userId: user.id, title: title || inputIdea.slice(0, 60), inputIdea, generatedPrompt, promptType, promptMode: promptMode || "generic", rating: 0, createdAt: Date.now() });
    return c.json({ id });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

app.get('/prompts', authMiddleware, authenticatedOnly, async (c) => {
  try {
    const user = c.get("user")!;
    const db = drizzle(c.env.DB);
    const all = await db.select().from(prompts).where(eq(prompts.userId, user.id)).orderBy(desc(prompts.createdAt));
    return c.json({ prompts: all });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

app.patch('/prompts/:id/rating', authMiddleware, authenticatedOnly, async (c) => {
  try {
    const user = c.get("user")!;
    const id = c.req.param('id');
    const { rating } = await c.req.json<{ rating: number }>();
    const db = drizzle(c.env.DB);
    await db.update(prompts).set({ rating }).where(and(eq(prompts.id, id), eq(prompts.userId, user.id)));
    return c.json({ ok: true });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

app.delete('/prompts/:id', authMiddleware, authenticatedOnly, async (c) => {
  try {
    const user = c.get("user")!;
    const id = c.req.param('id');
    const db = drizzle(c.env.DB);
    await db.delete(prompts).where(and(eq(prompts.id, id), eq(prompts.userId, user.id)));
    return c.json({ ok: true });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

// ── Bulk export — Agency only ──
app.get('/prompts/export', authMiddleware, authenticatedOnly, async (c) => {
  try {
    const user = c.get("user")!;
    const format = c.req.query("format") ?? "md"; // "md" | "csv"

    const planId = await getUserPlan(user.id, c.env.AUTUMN_SECRET_KEY);
    if (!hasPlan(planId, "agency")) {
      return c.json({ error: "plan_required", requiredPlan: "agency", currentPlan: planId }, 403);
    }

    const db = drizzle(c.env.DB);
    const all = await db.select().from(prompts).where(eq(prompts.userId, user.id)).orderBy(desc(prompts.createdAt));

    if (format === "csv") {
      const header = "id,title,promptType,promptMode,rating,createdAt,inputIdea,generatedPrompt\n";
      const escape = (s: string) => `"${String(s).replace(/"/g, '""')}"`;
      const rows = all.map(p =>
        [p.id, escape(p.title), p.promptType, p.promptMode ?? "generic", p.rating, new Date(p.createdAt).toISOString(), escape(p.inputIdea), escape(p.generatedPrompt)].join(",")
      ).join("\n");
      return new Response(header + rows, {
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="megaprompt-export-${Date.now()}.csv"`,
        },
      });
    }

    // Default: markdown bundle
    const sections = all.map(p => [
      `# ${p.title}`,
      `> **Type:** ${p.promptType} · **Mode:** ${p.promptMode ?? "generic"} · **Rating:** ${"★".repeat(p.rating || 0)}${"☆".repeat(5 - (p.rating || 0))} · **Date:** ${new Date(p.createdAt).toLocaleDateString()}`,
      ``,
      `## Input`,
      p.inputIdea,
      ``,
      `## Generated Prompt`,
      p.generatedPrompt,
      ``,
      `---`,
    ].join("\n"));

    const md = `# MegaPrompt Export\n> Exported ${all.length} prompt(s) on ${new Date().toLocaleDateString()}\n\n` + sections.join("\n\n");

    return new Response(md, {
      headers: {
        "Content-Type": "text/markdown",
        "Content-Disposition": `attachment; filename="megaprompt-export-${Date.now()}.md"`,
      },
    });
  } catch (err: unknown) {
    return c.json({ error: err instanceof Error ? err.message : "Unknown error" }, 500);
  }
});

// ── Admin routes ── (gated by email allowlist)
const ADMIN_EMAILS = ["abd.rabo.940@gmail.com", "Ibrahim@al-ai.ai"];

function adminOnly(email: string | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.some(e => e.toLowerCase() === email.toLowerCase());
}

// GET /api/admin/users — list all users with their plans
app.get('/admin/users', authMiddleware, authenticatedOnly, async (c) => {
  const user = c.get("user")!;
  if (!adminOnly(user.email)) return c.json({ error: "forbidden" }, 403);

  const db = drizzle(c.env.DB);
  const autumn = new Autumn({ secretKey: c.env.AUTUMN_SECRET_KEY });

  // Get all users from DB
  const users = await db.select({
    id: userTable.id,
    name: userTable.name,
    email: userTable.email,
    createdAt: userTable.createdAt,
  }).from(userTable).orderBy(desc(userTable.createdAt));

  // Get prompt counts per user
  const promptCounts = await db.select({
    userId: prompts.userId,
    count: count(),
  }).from(prompts).groupBy(prompts.userId);

  const countMap = Object.fromEntries(promptCounts.map(r => [r.userId, r.count]));

  // Fetch plans from Autumn in parallel (batch of max 20 to avoid rate limits)
  const planResults = await Promise.allSettled(
    users.map(u => autumn.customers.getOrCreate({ customerId: u.id }))
  );

  const enriched = users.map((u, i) => {
    const result = planResults[i];
    let plan = "free";
    let autumnId: string | undefined;
    if (result.status === "fulfilled") {
      const cust = result.value;
      const sub = cust?.subscriptions?.[0] as { planId?: string } | undefined;
      plan = sub?.planId ?? "free";
      autumnId = cust?.id;
    }
    return {
      ...u,
      plan,
      autumnId,
      promptCount: countMap[u.id] ?? 0,
    };
  });

  return c.json({ users: enriched });
});

// GET /api/admin/stats — usage stats
app.get('/admin/stats', authMiddleware, authenticatedOnly, async (c) => {
  const user = c.get("user")!;
  if (!adminOnly(user.email)) return c.json({ error: "forbidden" }, 403);

  const db = drizzle(c.env.DB);

  // Total prompts
  const [{ total }] = await db.select({ total: count() }).from(prompts);

  // By type
  const byType = await db.select({
    promptType: prompts.promptType,
    count: count(),
  }).from(prompts).groupBy(prompts.promptType);

  // By mode
  const byMode = await db.select({
    promptMode: prompts.promptMode,
    count: count(),
  }).from(prompts).groupBy(prompts.promptMode);

  // Total users
  const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(userTable);

  // Prompts over last 30 days (daily)
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = await db.select({
    day: sql<number>`cast(${prompts.createdAt} / 86400000 as integer)`,
    count: count(),
  }).from(prompts)
    .where(sql`${prompts.createdAt} > ${thirtyDaysAgo}`)
    .groupBy(sql`cast(${prompts.createdAt} / 86400000 as integer)`)
    .orderBy(sql`cast(${prompts.createdAt} / 86400000 as integer)`);

  // Convert day epochs to dates
  const dailyActivity = recent.map(r => ({
    date: new Date(r.day * 86400000).toISOString().slice(0, 10),
    count: r.count,
  }));

  return c.json({ total, totalUsers, byType, byMode, dailyActivity });
});

// GET /api/admin/revenue — pull subscription data from Autumn
app.get('/admin/revenue', authMiddleware, authenticatedOnly, async (c) => {
  const user = c.get("user")!;
  if (!adminOnly(user.email)) return c.json({ error: "forbidden" }, 403);

  // Hit Autumn REST API directly to list customers
  const res = await fetch("https://api.useautumn.com/v1/customers?limit=100", {
    headers: {
      "Authorization": `Bearer ${c.env.AUTUMN_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text();
    return c.json({ error: "autumn_error", detail: text }, 502);
  }

  const data = await res.json() as { customers?: unknown[] };
  return c.json(data);
});

// PATCH /api/admin/users/:id/plan — change a user's plan
app.patch('/admin/users/:id/plan', authMiddleware, authenticatedOnly, async (c) => {
  const user = c.get("user")!;
  if (!adminOnly(user.email)) return c.json({ error: "forbidden" }, 403);

  const targetId = c.req.param("id");
  const { plan } = await c.req.json<{ plan: string }>();

  if (!["free", "starter", "pro", "agency"].includes(plan)) {
    return c.json({ error: "invalid_plan" }, 400);
  }

  // Use Autumn API to update subscription
  const autumnClient = new Autumn({ secretKey: c.env.AUTUMN_SECRET_KEY });
  try {
    if (plan === "free") {
      // Cancel all subscriptions — attach to free product
      await autumnClient.attach({
        customerId: targetId,
        productId: "free",
        successUrl: "",
        cancelUrl: "",
      });
    } else {
      await autumnClient.attach({
        customerId: targetId,
        productId: plan,
        successUrl: "",
        cancelUrl: "",
      });
    }
    return c.json({ ok: true, plan });
  } catch (err) {
    // Fallback: try direct REST
    const res = await fetch(`https://api.useautumn.com/v1/customers/${targetId}/entitlements`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${c.env.AUTUMN_SECRET_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ product_id: plan }),
    });
    if (!res.ok) {
      const detail = await res.text();
      return c.json({ error: "autumn_error", detail }, 502);
    }
    return c.json({ ok: true, plan });
  }
});

// DELETE /api/admin/users/:id — delete user + all their prompts
app.delete('/admin/users/:id', authMiddleware, authenticatedOnly, async (c) => {
  const user = c.get("user")!;
  if (!adminOnly(user.email)) return c.json({ error: "forbidden" }, 403);

  const targetId = c.req.param("id");
  if (targetId === user.id) return c.json({ error: "cannot_delete_self" }, 400);

  const db = drizzle(c.env.DB);

  // Delete prompts first (FK constraint)
  await db.delete(prompts).where(eq(prompts.userId, targetId));

  // Delete user (cascades sessions/accounts via FK)
  await db.delete(userTable).where(eq(userTable.id, targetId));

  return c.json({ ok: true });
});

export default app;
