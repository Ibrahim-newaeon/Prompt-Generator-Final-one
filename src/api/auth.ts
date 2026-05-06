import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import { autumn } from "autumn-js/better-auth";
import * as schema from "./database/schema";

type Env = {
  DB: D1Database;
  BETTER_AUTH_SECRET: string;
  AUTUMN_SECRET_KEY: string;
};

export const createAuth = (baseURL: string, env?: Env, autumnSecretKey?: string) => {
  if (!env?.DB) {
    // CLI / schema-gen stub — never runs in the Worker
    return betterAuth({
      database: drizzleAdapter(drizzle({} as D1Database, { schema }), { provider: "sqlite" }),
      emailAndPassword: { enabled: true },
      secret: "cli-stub",
      baseURL,
    });
  }

  const db = drizzle(env.DB, { schema });
  return betterAuth({
    database: drizzleAdapter(db, { provider: "sqlite" }),
    emailAndPassword: { enabled: true },
    plugins: [autumn({ secretKey: autumnSecretKey || env.AUTUMN_SECRET_KEY })],
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: async (request) => {
      const origin = request?.headers.get("origin");
      if (origin) return [origin];
      return [];
    },
  });
};
