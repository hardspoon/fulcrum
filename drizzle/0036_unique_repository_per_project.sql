-- Enforce 1:N relationship: each repository can only belong to one project
-- Safety: Remove any remaining duplicate entries (keep oldest per repository)
DELETE FROM `project_repositories`
WHERE `id` NOT IN (
  SELECT MIN(`id`) FROM `project_repositories` GROUP BY `repository_id`
);--> statement-breakpoint

-- Recreate table with unique constraint on repository_id
CREATE TABLE `project_repositories_new` (
  `id` text PRIMARY KEY NOT NULL,
  `project_id` text NOT NULL,
  `repository_id` text NOT NULL UNIQUE,
  `is_primary` integer DEFAULT false,
  `created_at` text NOT NULL
);--> statement-breakpoint

-- Copy data
INSERT INTO `project_repositories_new` SELECT * FROM `project_repositories`;--> statement-breakpoint

-- Replace tables
DROP TABLE `project_repositories`;--> statement-breakpoint
ALTER TABLE `project_repositories_new` RENAME TO `project_repositories`;
