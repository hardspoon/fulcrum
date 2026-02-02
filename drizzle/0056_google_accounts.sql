CREATE TABLE `google_accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`access_token` text,
	`refresh_token` text,
	`token_expiry` integer,
	`scopes` text,
	`calendar_enabled` integer DEFAULT false,
	`gmail_enabled` integer DEFAULT false,
	`sync_interval_minutes` integer DEFAULT 15,
	`last_calendar_sync_at` text,
	`last_calendar_sync_error` text,
	`last_gmail_sync_at` text,
	`last_gmail_sync_error` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
CREATE TABLE `gmail_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`google_account_id` text NOT NULL,
	`gmail_draft_id` text NOT NULL,
	`gmail_message_id` text,
	`thread_id` text,
	`to` text,
	`cc` text,
	`bcc` text,
	`subject` text,
	`body` text,
	`html_body` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);--> statement-breakpoint
ALTER TABLE `caldav_calendars` ADD `google_account_id` text;
