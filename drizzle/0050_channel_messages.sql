-- Create unified channel_messages table for all messaging channels
CREATE TABLE `channel_messages` (
  `id` text PRIMARY KEY NOT NULL,
  `channel_type` text NOT NULL,
  `connection_id` text NOT NULL,
  `direction` text NOT NULL,
  `sender_id` text NOT NULL,
  `sender_name` text,
  `recipient_id` text,
  `content` text NOT NULL,
  `metadata` text,
  `message_timestamp` text NOT NULL,
  `created_at` text NOT NULL
);--> statement-breakpoint
CREATE INDEX `idx_channel_messages_channel_type` ON `channel_messages` (`channel_type`);--> statement-breakpoint
CREATE INDEX `idx_channel_messages_direction` ON `channel_messages` (`direction`);--> statement-breakpoint
CREATE INDEX `idx_channel_messages_timestamp` ON `channel_messages` (`message_timestamp`);--> statement-breakpoint
CREATE INDEX `idx_channel_messages_sender_id` ON `channel_messages` (`sender_id`);--> statement-breakpoint
-- Migrate existing emails to channel_messages
INSERT INTO `channel_messages` (
  `id`,
  `channel_type`,
  `connection_id`,
  `direction`,
  `sender_id`,
  `sender_name`,
  `recipient_id`,
  `content`,
  `metadata`,
  `message_timestamp`,
  `created_at`
)
SELECT
  `id`,
  'email',
  `connection_id`,
  `direction`,
  `from_address`,
  `from_name`,
  CASE
    WHEN `to_addresses` IS NOT NULL THEN json_extract(`to_addresses`, '$[0]')
    ELSE NULL
  END,
  COALESCE(`text_content`, ''),
  json_object(
    'messageId', `message_id`,
    'threadId', `thread_id`,
    'inReplyTo', `in_reply_to`,
    'references', json(`references`),
    'subject', `subject`,
    'toAddresses', json(`to_addresses`),
    'ccAddresses', json(`cc_addresses`),
    'htmlContent', `html_content`,
    'snippet', `snippet`,
    'imapUid', `imap_uid`,
    'folder', `folder`,
    'isRead', `is_read`,
    'isStarred', `is_starred`,
    'labels', json(`labels`)
  ),
  COALESCE(`email_date`, `created_at`),
  `created_at`
FROM `emails`;--> statement-breakpoint
-- Drop the old emails table
DROP TABLE IF EXISTS `emails`;
