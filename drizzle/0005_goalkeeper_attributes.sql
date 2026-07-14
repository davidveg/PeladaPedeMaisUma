ALTER TABLE players ADD COLUMN goalkeeper_positioning REAL NOT NULL DEFAULT 3;
ALTER TABLE players ADD COLUMN goal_exit REAL NOT NULL DEFAULT 3;

UPDATE players
SET goalkeeper_positioning = speed,
    goal_exit = marking
WHERE primary_position = 'Goleiro' OR type = 'goalkeeper';
