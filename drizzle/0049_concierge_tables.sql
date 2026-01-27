CREATE TABLE `actionable_events` (
	`id` text PRIMARY KEY NOT NULL,
	`source_channel` text NOT NULL,
	`source_id` text NOT NULL,
	`source_metadata` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`linked_task_id` text,
	`summary` text,
	`action_log` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`last_evaluated_at` text
);--> statement-breakpoint
CREATE INDEX `idx_actionable_events_status` ON `actionable_events` (`status`);--> statement-breakpoint
CREATE INDEX `idx_actionable_events_channel` ON `actionable_events` (`source_channel`);--> statement-breakpoint
CREATE INDEX `idx_actionable_events_created` ON `actionable_events` (`created_at`);--> statement-breakpoint
CREATE TABLE `sweep_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`started_at` text NOT NULL,
	`completed_at` text,
	`events_processed` integer DEFAULT 0,
	`tasks_updated` integer DEFAULT 0,
	`messages_sent` integer DEFAULT 0,
	`summary` text,
	`status` text NOT NULL
);
