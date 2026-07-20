ALTER TABLE career_configuration ADD COLUMN card_tiers_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE career_configuration ADD COLUMN card_bronze_max REAL NOT NULL DEFAULT 2.4;
ALTER TABLE career_configuration ADD COLUMN card_silver_max REAL NOT NULL DEFAULT 3.9;
ALTER TABLE career_configuration ADD COLUMN card_gold_max REAL NOT NULL DEFAULT 4.5;
