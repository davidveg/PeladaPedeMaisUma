CREATE TABLE IF NOT EXISTS `players` (`id` text PRIMARY KEY NOT NULL,`full_name` text NOT NULL,`display_name` text NOT NULL,`nickname` text,`aliases` text DEFAULT '[]' NOT NULL,`type` text DEFAULT 'monthly' NOT NULL,`primary_position` text NOT NULL,`speed` real NOT NULL,`skill` real NOT NULL,`photo_url` text,`active` integer DEFAULT true NOT NULL,`notes` text,`deleted_at` text,`created_at` text NOT NULL,`updated_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `administrators` (`id` text PRIMARY KEY NOT NULL,`email` text NOT NULL,`password_hash` text NOT NULL,`active` integer DEFAULT true NOT NULL,`must_change_password` integer DEFAULT true NOT NULL,`last_login_at` text,`created_at` text NOT NULL,`updated_at` text NOT NULL);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `administrators_email_unique` ON `administrators` (`email`);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `sessions` (`id` text PRIMARY KEY NOT NULL,`administrator_id` text NOT NULL,`expires_at` text NOT NULL,`created_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `password_reset_tokens` (`id` text PRIMARY KEY NOT NULL,`administrator_id` text NOT NULL,`token_hash` text NOT NULL,`expires_at` text NOT NULL,`used_at` text,`created_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `team_separations` (`id` text PRIMARY KEY NOT NULL,`match_title` text NOT NULL,`match_date` text,`location` text,`original_text` text NOT NULL,`snapshot` text NOT NULL,`manually_adjusted` integer DEFAULT false NOT NULL,`balance_score` real NOT NULL,`balance_classification` text NOT NULL,`confirmed_at` text NOT NULL,`deleted_at` text,`created_at` text NOT NULL,`updated_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `system_configuration` (`id` integer PRIMARY KEY DEFAULT 1 NOT NULL,`default_player_count` integer DEFAULT 22 NOT NULL,`minimum_recommended_players` integer DEFAULT 14 NOT NULL,`maximum_recommended_players` integer DEFAULT 30 NOT NULL,`speed_weight` real DEFAULT 0.6 NOT NULL,`skill_weight` real DEFAULT 0.4 NOT NULL,`maximum_position_difference` integer DEFAULT 1 NOT NULL,`protected_top_players_percentage` real DEFAULT 0.25 NOT NULL,`default_reserve_count` integer DEFAULT 0 NOT NULL,`algorithm_attempts` integer DEFAULT 2500 NOT NULL,`updated_at` text NOT NULL);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `audit_logs` (`id` text PRIMARY KEY NOT NULL,`administrator_id` text,`action` text NOT NULL,`entity_type` text NOT NULL,`entity_id` text,`previous_data` text,`new_data` text,`created_at` text NOT NULL);
