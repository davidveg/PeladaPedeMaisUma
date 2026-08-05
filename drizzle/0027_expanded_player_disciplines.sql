ALTER TABLE players ADD COLUMN tactical_intelligence REAL NOT NULL DEFAULT 3;
ALTER TABLE players ADD COLUMN competitiveness REAL NOT NULL DEFAULT 3;
ALTER TABLE players ADD COLUMN goalkeeper_safety REAL NOT NULL DEFAULT 3;
ALTER TABLE players ADD COLUMN goalkeeper_leadership REAL NOT NULL DEFAULT 3;

ALTER TABLE system_configuration ADD COLUMN tactical_intelligence_weight REAL NOT NULL DEFAULT 0.20;
ALTER TABLE system_configuration ADD COLUMN competitiveness_weight REAL NOT NULL DEFAULT 0.05;
ALTER TABLE system_configuration ADD COLUMN goalkeeper_defenses_weight REAL NOT NULL DEFAULT 0.40;
ALTER TABLE system_configuration ADD COLUMN goalkeeper_positioning_weight REAL NOT NULL DEFAULT 0.25;
ALTER TABLE system_configuration ADD COLUMN goalkeeper_safety_weight REAL NOT NULL DEFAULT 0.20;
ALTER TABLE system_configuration ADD COLUMN goalkeeper_footwork_weight REAL NOT NULL DEFAULT 0.10;
ALTER TABLE system_configuration ADD COLUMN goalkeeper_leadership_weight REAL NOT NULL DEFAULT 0.05;

UPDATE system_configuration
SET speed_weight = 0.35,
    skill_weight = 0.25,
    marking_weight = 0.15,
    tactical_intelligence_weight = 0.20,
    competitiveness_weight = 0.05,
    goalkeeper_defenses_weight = 0.40,
    goalkeeper_positioning_weight = 0.25,
    goalkeeper_safety_weight = 0.20,
    goalkeeper_footwork_weight = 0.10,
    goalkeeper_leadership_weight = 0.05;
