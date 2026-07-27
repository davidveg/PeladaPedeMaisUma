ALTER TABLE `account_notifications` ADD `action_url` text;
--> statement-breakpoint
ALTER TABLE `account_notification_preferences` ADD `app_updates_in_app` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `account_notification_preferences` ADD `app_updates_push` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
CREATE TABLE `mobile_release_configuration` (
  `id` integer PRIMARY KEY DEFAULT 1 NOT NULL,
  `latest_version` text DEFAULT '1.0.0' NOT NULL,
  `android_build` integer DEFAULT 1 NOT NULL,
  `ios_build` integer DEFAULT 1 NOT NULL,
  `minimum_android_build` integer DEFAULT 1 NOT NULL,
  `minimum_ios_build` integer DEFAULT 1 NOT NULL,
  `android_enabled` integer DEFAULT 0 NOT NULL,
  `ios_enabled` integer DEFAULT 0 NOT NULL,
  `android_url` text,
  `ios_url` text,
  `release_notes` text DEFAULT '' NOT NULL,
  `published_at` text,
  `published_by_administrator_id` text,
  `updated_at` text NOT NULL
);
