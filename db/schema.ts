import { integer, real, sqliteTable, text } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
};

export const players = sqliteTable("players", {
  id: text("id").primaryKey(), fullName: text("full_name").notNull(), displayName: text("display_name").notNull(),
  nickname: text("nickname"), aliases: text("aliases").notNull().default("[]"), type: text("type").notNull().default("monthly"),
  primaryPosition: text("primary_position").notNull(), speed: real("speed").notNull(), skill: real("skill").notNull(),
  photoUrl: text("photo_url"), active: integer("active", { mode: "boolean" }).notNull().default(true), notes: text("notes"),
  deletedAt: text("deleted_at"), ...timestamps,
});

export const administrators = sqliteTable("administrators", {
  id: text("id").primaryKey(), email: text("email").notNull().unique(), passwordHash: text("password_hash").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true), mustChangePassword: integer("must_change_password", { mode: "boolean" }).notNull().default(true),
  lastLoginAt: text("last_login_at"), ...timestamps,
});

export const sessions = sqliteTable("sessions", { id: text("id").primaryKey(), administratorId: text("administrator_id").notNull(), expiresAt: text("expires_at").notNull(), createdAt: text("created_at").notNull() });
export const passwordResetTokens = sqliteTable("password_reset_tokens", { id: text("id").primaryKey(), administratorId: text("administrator_id").notNull(), tokenHash: text("token_hash").notNull(), expiresAt: text("expires_at").notNull(), usedAt: text("used_at"), createdAt: text("created_at").notNull() });

export const separations = sqliteTable("team_separations", {
  id: text("id").primaryKey(), matchTitle: text("match_title").notNull(), matchDate: text("match_date"), location: text("location"),
  originalText: text("original_text").notNull(), snapshot: text("snapshot").notNull(), manuallyAdjusted: integer("manually_adjusted", { mode: "boolean" }).notNull().default(false),
  balanceScore: real("balance_score").notNull(), balanceClassification: text("balance_classification").notNull(), confirmedAt: text("confirmed_at").notNull(), deletedAt: text("deleted_at"), ...timestamps,
});

export const configurations = sqliteTable("system_configuration", {
  id: integer("id").primaryKey().default(1), defaultPlayerCount: integer("default_player_count").notNull().default(22), minimumRecommendedPlayers: integer("minimum_recommended_players").notNull().default(14),
  maximumRecommendedPlayers: integer("maximum_recommended_players").notNull().default(30), speedWeight: real("speed_weight").notNull().default(.6), skillWeight: real("skill_weight").notNull().default(.4),
  maximumPositionDifference: integer("maximum_position_difference").notNull().default(1), protectedTopPlayersPercentage: real("protected_top_players_percentage").notNull().default(.25),
  defaultReserveCount: integer("default_reserve_count").notNull().default(0), algorithmAttempts: integer("algorithm_attempts").notNull().default(2500), updatedAt: text("updated_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", { id: text("id").primaryKey(), administratorId: text("administrator_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), previousData: text("previous_data"), newData: text("new_data"), createdAt: text("created_at").notNull() });
