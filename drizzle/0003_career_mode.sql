ALTER TABLE players ADD COLUMN momentum REAL NOT NULL DEFAULT 0;

CREATE TABLE career_configuration (
  id INTEGER PRIMARY KEY,
  enabled INTEGER NOT NULL DEFAULT 1,
  winner_bonus REAL NOT NULL DEFAULT 0.1,
  loser_penalty REAL NOT NULL DEFAULT -0.1,
  motm_third REAL NOT NULL DEFAULT 0.1,
  motm_second REAL NOT NULL DEFAULT 0.2,
  motm_first REAL NOT NULL DEFAULT 0.3,
  dotm_third REAL NOT NULL DEFAULT -0.1,
  dotm_second REAL NOT NULL DEFAULT -0.2,
  dotm_first REAL NOT NULL DEFAULT -0.3,
  voting_days INTEGER NOT NULL DEFAULT 5,
  updated_at TEXT NOT NULL
);

INSERT INTO career_configuration (id,enabled,winner_bonus,loser_penalty,motm_third,motm_second,motm_first,dotm_third,dotm_second,dotm_first,voting_days,updated_at)
VALUES (1,1,0.1,-0.1,0.1,0.2,0.3,-0.1,-0.2,-0.3,5,CURRENT_TIMESTAMP);

CREATE TABLE career_matches (
  id TEXT PRIMARY KEY,
  separation_id TEXT NOT NULL UNIQUE,
  blue_score INTEGER NOT NULL,
  yellow_score INTEGER NOT NULL,
  winner_team TEXT NOT NULL,
  voting_token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'OPEN',
  closes_at TEXT NOT NULL,
  closed_at TEXT,
  created_by_administrator_id TEXT NOT NULL,
  config_snapshot TEXT NOT NULL,
  results_snapshot TEXT,
  team_momentum_applied INTEGER NOT NULL DEFAULT 0,
  votes_momentum_applied INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE career_votes (
  id TEXT PRIMARY KEY,
  career_match_id TEXT NOT NULL,
  voter_player_id TEXT NOT NULL,
  motm_third_id TEXT NOT NULL,
  motm_second_id TEXT NOT NULL,
  motm_first_id TEXT NOT NULL,
  dotm_third_id TEXT NOT NULL,
  dotm_second_id TEXT NOT NULL,
  dotm_first_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(career_match_id,voter_player_id)
);

CREATE INDEX career_votes_match_idx ON career_votes(career_match_id);
