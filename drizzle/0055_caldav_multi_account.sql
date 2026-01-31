CREATE TABLE `caldav_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`server_url` text NOT NULL,
	`auth_type` text NOT NULL DEFAULT 'basic',
	`username` text,
	`password` text,
	`google_client_id` text,
	`google_client_secret` text,
	`oauth_tokens` text,
	`sync_interval_minutes` integer DEFAULT 15,
	`enabled` integer DEFAULT true,
	`last_synced_at` text,
	`last_sync_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
ALTER TABLE `caldav_calendars` ADD `account_id` text;
--> statement-breakpoint
CREATE TABLE `caldav_copy_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text,
	`source_calendar_id` text NOT NULL,
	`dest_calendar_id` text NOT NULL,
	`enabled` integer DEFAULT true,
	`last_executed_at` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `caldav_copied_events` (
	`id` text PRIMARY KEY NOT NULL,
	`rule_id` text NOT NULL,
	`source_event_id` text NOT NULL,
	`dest_event_id` text NOT NULL,
	`source_etag` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
