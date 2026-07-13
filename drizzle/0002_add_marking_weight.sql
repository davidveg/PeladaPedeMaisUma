ALTER TABLE `system_configuration` ADD COLUMN `marking_weight` real DEFAULT 0.2 NOT NULL;
UPDATE `system_configuration`
SET `speed_weight` = `speed_weight` * 0.8,
    `skill_weight` = `skill_weight` * 0.8;
