ALTER TABLE instance_configuration ADD COLUMN tactical_formations TEXT NOT NULL DEFAULT '[{"defenders":2,"midfielders":3,"attackers":1},{"defenders":2,"midfielders":2,"attackers":2}]';
