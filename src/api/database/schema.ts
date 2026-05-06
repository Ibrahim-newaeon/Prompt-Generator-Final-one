import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export * from "./auth-schema";

export const prompts = sqliteTable("prompts", {
  id: text("id").primaryKey(),
  userId: text("user_id"), // null = anonymous (legacy)
  title: text("title").notNull(),
  inputIdea: text("input_idea").notNull(),
  generatedPrompt: text("generated_prompt").notNull(),
  promptType: text("prompt_type").notNull(),
  promptMode: text("prompt_mode").default("generic"), // "claude" | "generic"
  rating: integer("rating").default(0),
  createdAt: integer("created_at").notNull(),
});
