ALTER TABLE `instance_configuration` ADD `guest_preconfirmation_enabled` integer DEFAULT 0 NOT NULL;
ALTER TABLE `instance_configuration` ADD `guest_confirmation_threshold` integer DEFAULT 16 NOT NULL;

CREATE TABLE `match_guest_preconfirmations` (
  `id` text PRIMARY KEY NOT NULL,
  `match_id` text NOT NULL,
  `player_id` text NOT NULL,
  `created_by_administrator_id` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE UNIQUE INDEX `match_guest_preconfirmation_unique`
  ON `match_guest_preconfirmations` (`match_id`,`player_id`);
CREATE INDEX `match_guest_preconfirmations_match_idx`
  ON `match_guest_preconfirmations` (`match_id`);
