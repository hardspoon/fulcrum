-- Drop system_prompt_addition columns and add claude_options columns
-- Note: Existing systemPromptAddition data will be lost (user confirmed OK)

-- Create new columns
ALTER TABLE `repositories` ADD `claude_options` text;--> statement-breakpoint
ALTER TABLE `tasks` ADD `claude_options` text;--> statement-breakpoint

-- SQLite doesn't support DROP COLUMN in older versions, but modern SQLite (3.35+) does
-- For safety, we'll use the new syntax which works in SQLite 3.35+ (Bun ships with modern SQLite)
ALTER TABLE `repositories` DROP COLUMN `system_prompt_addition`;--> statement-breakpoint
ALTER TABLE `tasks` DROP COLUMN `system_prompt_addition`;
