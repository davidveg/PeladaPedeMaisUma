CREATE TABLE IF NOT EXISTS `account_notification_preferences` (
  `id` text PRIMARY KEY NOT NULL,
  `account_type` text NOT NULL CHECK(`account_type` IN ('administrator','member')),
  `account_id` text NOT NULL,
  `attendance_in_app` integer DEFAULT 1 NOT NULL,
  `attendance_push` integer DEFAULT 1 NOT NULL,
  `matches_in_app` integer DEFAULT 1 NOT NULL,
  `matches_push` integer DEFAULT 1 NOT NULL,
  `separations_in_app` integer DEFAULT 1 NOT NULL,
  `separations_push` integer DEFAULT 1 NOT NULL,
  `career_votes_push` integer DEFAULT 1 NOT NULL,
  `page_size` integer DEFAULT 10 NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `account_notification_preferences_account_unique`
  ON `account_notification_preferences` (`account_type`,`account_id`);
