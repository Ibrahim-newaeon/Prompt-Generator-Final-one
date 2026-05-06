import { createMiddleware } from "hono/factory";
import { createAuth } from "../auth";

type Env = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  AUTUMN_SECRET_KEY: string;
  AI_GATEWAY_BASE_URL: string;
  AI_GATEWAY_API_KEY: string;
};

const getBaseURL = (request: Request) => {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}`;
};

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: { user: { id: string; name: string; email: string } | null; session: unknown | null } }>(async (c, next) => {
  const auth = createAuth(getBaseURL(c.req.raw), c.env as Env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) {
    c.set("user", null);
    c.set("session", null);
    return next();
  }
  c.set("user", session.user);
  c.set("session", session.session);
  return next();
});

export const authenticatedOnly = createMiddleware(async (c, next) => {
  const session = c.get("session");
  if (!session) {
    return c.json({ message: "Not authenticated" }, 401);
  }
  return next();
});
