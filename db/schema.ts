import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
};

export const players = sqliteTable("players", {
  id: text("id").primaryKey(), fullName: text("full_name").notNull(), displayName: text("display_name").notNull(),
  nickname: text("nickname"), aliases: text("aliases").notNull().default("[]"), type: text("type").notNull().default("monthly"),
  primaryPosition: text("primary_position").notNull(), speed: real("speed").notNull(), skill: real("skill").notNull(), marking: real("marking").notNull().default(3),
  goalkeeperPositioning: real("goalkeeper_positioning").notNull().default(3), goalExit: real("goal_exit").notNull().default(3),
  momentum: real("momentum").notNull().default(0), photoUrl: text("photo_url"), active: integer("active", { mode: "boolean" }).notNull().default(true), notes: text("notes"),
  deletedAt: text("deleted_at"), ...timestamps,
});

export const administrators = sqliteTable("administrators", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(), passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true), mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: text("last_login_at"), ...timestamps,
});

export const sessions = sqliteTable("sessions", { id: text("id").primaryKey(), administratorId: text("administrator_id").notNull(), expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull() });
export const memberAccounts = sqliteTable("member_accounts", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(), passwordHash: text("password_hash").notNull(),
  playerId: text("player_id").unique(), active: integer("active", { mode: "boolean" }).notNull().default(true), lastLoginAt: text("last_login_at"), ...timestamps,
});
export const memberSessions = sqliteTable("member_sessions", { id: text("id").primaryKey(), memberAccountId: text("member_account_id").notNull(), expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull() });
export const playerAccountLinks = sqliteTable("player_account_links", { playerId: text("player_id").primaryKey(), accountType: text("account_type").notNull(), accountId: text("account_id").notNull().unique(), createdAt: text("created_at").notNull() });
export const passwordResetTokens = sqliteTable("password_reset_tokens", { id: text("id").primaryKey(), administratorId: text("administrator_id").notNull(), tokenHash: text("token_hash").notNull(), expiresAt: text("expires_at").notNull(), usedAt: text("used_at"), createdAt: text("created_at").notNull() });

export const separations = sqliteTable("team_separations", {
  id: text("id").primaryKey(), matchTitle: text("match_title").notNull(), matchDate: text("match_date"), location: text("location"),
  originalText: text("original_text").notNull(), snapshot: text("snapshot").notNull(), manuallyAdjusted: integer("manually_adjusted", { mode: "boolean" }).notNull().default(false),
  arrivalOrder: text("arrival_order"), matchDraft: text("match_draft"), balanceScore: real("balance_score").notNull(), balanceClassification: text("balance_classification").notNull(), confirmedAt: text("confirmed_at").notNull(), deletedAt: text("deleted_at"), ...timestamps,
});

export const configurations = sqliteTable("system_configuration", {
  id: integer("id").primaryKey().default(1), defaultPlayerCount: integer("default_player_count").notNull().default(22), minimumRecommendedPlayers: integer("minimum_recommended_players").notNull().default(14),
  maximumRecommendedPlayers: integer("maximum_recommended_players").notNull().default(30), speedWeight: real("speed_weight").notNull().default(.48), skillWeight: real("skill_weight").notNull().default(.32), markingWeight: real("marking_weight").notNull().default(.2),
  maximumPositionDifference: integer("maximum_position_difference").notNull().default(1), protectedTopPlayersPercentage: real("protected_top_players_percentage").notNull().default(.25),
  defaultReserveCount: integer("default_reserve_count").notNull().default(0), algorithmAttempts: integer("algorithm_attempts").notNull().default(2500), updatedAt: text("updated_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", { id: text("id").primaryKey(), administratorId: text("administrator_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), previousData: text("previous_data"), newData: text("new_data"), createdAt: text("created_at").notNull() });

export const careerConfiguration = sqliteTable("career_configuration", {
  id: integer("id").primaryKey().default(1), enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  trackContributions: integer("track_contributions", { mode: "boolean" }).notNull().default(true),
  momentumMultiplier: real("momentum_multiplier").notNull().default(1),
  winnerBonus: real("winner_bonus").notNull().default(.1), loserPenalty: real("loser_penalty").notNull().default(-.1),
  motmThird: real("motm_third").notNull().default(.1), motmSecond: real("motm_second").notNull().default(.2), motmFirst: real("motm_first").notNull().default(.3),
  dotmThird: real("dotm_third").notNull().default(-.1), dotmSecond: real("dotm_second").notNull().default(-.2), dotmFirst: real("dotm_first").notNull().default(-.3),
  votingDays: integer("voting_days").notNull().default(5), updatedAt: text("updated_at").notNull(),
});

export const careerMatches = sqliteTable("career_matches", {
  id: text("id").primaryKey(), separationId: text("separation_id").notNull().unique(), blueScore: integer("blue_score").notNull(), yellowScore: integer("yellow_score").notNull(),
  winnerTeam: text("winner_team").notNull(), votingToken: text("voting_token").notNull().unique(), status: text("status").notNull().default("OPEN"), closesAt: text("closes_at").notNull(), closedAt: text("closed_at"),
  createdByAdministratorId: text("created_by_administrator_id").notNull(), configSnapshot: text("config_snapshot").notNull(), resultsSnapshot: text("results_snapshot"),
  teamMomentumApplied: integer("team_momentum_applied", { mode: "boolean" }).notNull().default(false), votesMomentumApplied: integer("votes_momentum_applied", { mode: "boolean" }).notNull().default(false), ...timestamps,
});

export const careerVotes = sqliteTable("career_votes", {
  id: text("id").primaryKey(), careerMatchId: text("career_match_id").notNull(), voterPlayerId: text("voter_player_id").notNull(),
  motmThirdId: text("motm_third_id").notNull(), motmSecondId: text("motm_second_id").notNull(), motmFirstId: text("motm_first_id").notNull(),
  dotmThirdId: text("dotm_third_id").notNull(), dotmSecondId: text("dotm_second_id").notNull(), dotmFirstId: text("dotm_first_id").notNull(), createdAt: text("created_at").notNull(),
}, table => [uniqueIndex("career_votes_match_voter_unique").on(table.careerMatchId, table.voterPlayerId)]);

export const careerMatchContributions = sqliteTable("career_match_contributions", {
  id: text("id").primaryKey(), careerMatchId: text("career_match_id").notNull(), scorerPlayerId: text("scorer_player_id").notNull(),
  assistPlayerId: text("assist_player_id"), team: text("team").notNull(), ownGoal: integer("is_own_goal", { mode: "boolean" }).notNull().default(false), createdAt: text("created_at").notNull(),
});
