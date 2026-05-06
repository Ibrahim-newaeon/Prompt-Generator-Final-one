CREATE TABLE `prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`input_idea` text NOT NULL,
	`generated_prompt` text NOT NULL,
	`prompt_type` text NOT NULL,
	`rating` integer DEFAULT 0,
	`created_at` integer NOT NULL
);
