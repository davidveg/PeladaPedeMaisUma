import { integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
};

export const players = sqliteTable("players", {
  id: text("id").primaryKey(), fullName: text("full_name").notNull(), displayName: text("display_name").notNull(),
  nickname: text("nickname"), aliases: text("aliases").notNull().default("[]"), type: text("type").notNull().default("monthly"),
  primaryPosition: text("primary_position").notNull(), speed: real("speed").notNull(), skill: real("skill").notNull(), marking: real("marking").notNull().default(3),
  tacticalIntelligence: real("tactical_intelligence").notNull().default(3), competitiveness: real("competitiveness").notNull().default(3),
  goalkeeperPositioning: real("goalkeeper_positioning").notNull().default(3), goalExit: real("goal_exit").notNull().default(3),
  goalkeeperSafety: real("goalkeeper_safety").notNull().default(3), goalkeeperLeadership: real("goalkeeper_leadership").notNull().default(3),
  momentum: real("momentum").notNull().default(0), resultMomentum: real("result_momentum").notNull().default(0), votingMomentum: real("voting_momentum").notNull().default(0), photoUrl: text("photo_url"), active: integer("active", { mode: "boolean" }).notNull().default(true), notes: text("notes"),
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
export const mobileSessions = sqliteTable("mobile_sessions", {
  id: text("id").primaryKey(), accountType: text("account_type").notNull(), accountId: text("account_id").notNull(),
  accessTokenHash: text("access_token_hash").notNull().unique(), refreshTokenHash: text("refresh_token_hash").notNull().unique(),
  accessExpiresAt: text("access_expires_at").notNull(), refreshExpiresAt: text("refresh_expires_at").notNull(),
  revokedAt: text("revoked_at"), replacedBySessionId: text("replaced_by_session_id"), deviceName: text("device_name"),
  lastUsedAt: text("last_used_at"), createdAt: text("created_at").notNull(),
});
export const mobileIdempotencyKeys = sqliteTable("mobile_idempotency_keys", {
  id: text("id").primaryKey(), administratorId: text("administrator_id").notNull(), operation: text("operation").notNull(),
  idempotencyKey: text("idempotency_key").notNull(), statusCode: integer("status_code").notNull(), responseJson: text("response_json").notNull(),
  createdAt: text("created_at").notNull(),
}, table => [uniqueIndex("mobile_idempotency_unique").on(table.administratorId, table.operation, table.idempotencyKey)]);
export const scheduledMatches = sqliteTable("scheduled_matches", {
  id: text("id").primaryKey(), title: text("title").notNull(), matchAt: text("match_at").notNull(),
  confirmationDeadline: text("confirmation_deadline").notNull(), location: text("location"),
  maxChanges: integer("max_changes").notNull().default(2), status: text("status").notNull().default("OPEN"),
  createdByAdministratorId: text("created_by_administrator_id").notNull(), separationId: text("separation_id"),
  closedAt: text("closed_at"), ...timestamps,
});
export const matchAttendance = sqliteTable("match_attendance", {
  id: text("id").primaryKey(), matchId: text("match_id").notNull(), playerId: text("player_id").notNull(),
  status: text("status").notNull(), changeCount: integer("change_count").notNull().default(0),
  respondedByAccountType: text("responded_by_account_type"), respondedByAccountId: text("responded_by_account_id"),
  updatedByAdministratorId: text("updated_by_administrator_id"), ...timestamps,
}, table => [uniqueIndex("match_attendance_match_player_unique").on(table.matchId, table.playerId)]);
export const matchGuestPreconfirmations = sqliteTable("match_guest_preconfirmations", {
  id: text("id").primaryKey(), matchId: text("match_id").notNull(), playerId: text("player_id").notNull(),
  createdByAdministratorId: text("created_by_administrator_id").notNull(), ...timestamps,
}, table => [uniqueIndex("match_guest_preconfirmation_unique").on(table.matchId, table.playerId)]);
export const accountNotifications = sqliteTable("account_notifications", {
  id: text("id").primaryKey(), accountType: text("account_type").notNull(), accountId: text("account_id").notNull(),
  type: text("type").notNull(), title: text("title").notNull(), body: text("body").notNull(),
  matchId: text("match_id"), actionUrl: text("action_url"), readAt: text("read_at"), createdAt: text("created_at").notNull(),
});
export const accountNotificationPreferences = sqliteTable("account_notification_preferences", {
  id: text("id").primaryKey(), accountType: text("account_type").notNull(), accountId: text("account_id").notNull(),
  attendanceInApp: integer("attendance_in_app", { mode: "boolean" }).notNull().default(true),
  attendancePush: integer("attendance_push", { mode: "boolean" }).notNull().default(true),
  matchesInApp: integer("matches_in_app", { mode: "boolean" }).notNull().default(true),
  matchesPush: integer("matches_push", { mode: "boolean" }).notNull().default(true),
  separationsInApp: integer("separations_in_app", { mode: "boolean" }).notNull().default(true),
  separationsPush: integer("separations_push", { mode: "boolean" }).notNull().default(true),
  appUpdatesInApp: integer("app_updates_in_app", { mode: "boolean" }).notNull().default(true),
  appUpdatesPush: integer("app_updates_push", { mode: "boolean" }).notNull().default(true),
  careerVotesPush: integer("career_votes_push", { mode: "boolean" }).notNull().default(true),
  pageSize: integer("page_size").notNull().default(10), ...timestamps,
}, table => [uniqueIndex("account_notification_preferences_account_unique").on(table.accountType, table.accountId)]);
export const notificationPushDeliveries = sqliteTable("notification_push_deliveries", {
  id: text("id").primaryKey(), notificationId: text("notification_id").notNull(), pushTokenId: text("push_token_id").notNull(),
  status: text("status").notNull(), ticketId: text("ticket_id"), error: text("error"), ...timestamps,
}, table => [uniqueIndex("notification_push_delivery_unique").on(table.notificationId, table.pushTokenId)]);
export const mobileReleaseConfiguration = sqliteTable("mobile_release_configuration", {
  id: integer("id").primaryKey().default(1),
  latestVersion: text("latest_version").notNull().default("1.0.0"),
  androidBuild: integer("android_build").notNull().default(1),
  iosBuild: integer("ios_build").notNull().default(1),
  minimumAndroidBuild: integer("minimum_android_build").notNull().default(1),
  minimumIosBuild: integer("minimum_ios_build").notNull().default(1),
  androidEnabled: integer("android_enabled", { mode: "boolean" }).notNull().default(false),
  iosEnabled: integer("ios_enabled", { mode: "boolean" }).notNull().default(false),
  androidUrl: text("android_url"),
  iosUrl: text("ios_url"),
  releaseNotes: text("release_notes").notNull().default(""),
  publishedAt: text("published_at"),
  publishedByAdministratorId: text("published_by_administrator_id"),
  updatedAt: text("updated_at").notNull(),
});
export const playerAccountLinks = sqliteTable("player_account_links", { playerId: text("player_id").primaryKey(), accountType: text("account_type").notNull(), accountId: text("account_id").notNull().unique(), createdAt: text("created_at").notNull() });
export const passwordResetTokens = sqliteTable("password_reset_tokens", { id: text("id").primaryKey(), administratorId: text("administrator_id").notNull(), tokenHash: text("token_hash").notNull(), expiresAt: text("expires_at").notNull(), usedAt: text("used_at"), createdAt: text("created_at").notNull() });

export const separations = sqliteTable("team_separations", {
  id: text("id").primaryKey(), matchTitle: text("match_title").notNull(), matchDate: text("match_date"), location: text("location"),
  originalText: text("original_text").notNull(), snapshot: text("snapshot").notNull(), manuallyAdjusted: integer("manually_adjusted", { mode: "boolean" }).notNull().default(false),
  arrivalOrder: text("arrival_order"), matchDraft: text("match_draft"), balanceScore: real("balance_score").notNull(), balanceClassification: text("balance_classification").notNull(), confirmedAt: text("confirmed_at").notNull(), deletedAt: text("deleted_at"), ...timestamps,
});

export const configurations = sqliteTable("system_configuration", {
  id: integer("id").primaryKey().default(1), defaultPlayerCount: integer("default_player_count").notNull().default(22), minimumRecommendedPlayers: integer("minimum_recommended_players").notNull().default(14),
  maximumRecommendedPlayers: integer("maximum_recommended_players").notNull().default(30), speedWeight: real("speed_weight").notNull().default(.35), skillWeight: real("skill_weight").notNull().default(.25), markingWeight: real("marking_weight").notNull().default(.15),
  tacticalIntelligenceWeight: real("tactical_intelligence_weight").notNull().default(.2), competitivenessWeight: real("competitiveness_weight").notNull().default(.05),
  goalkeeperDefensesWeight: real("goalkeeper_defenses_weight").notNull().default(.4), goalkeeperPositioningWeight: real("goalkeeper_positioning_weight").notNull().default(.25),
  goalkeeperSafetyWeight: real("goalkeeper_safety_weight").notNull().default(.2), goalkeeperFootworkWeight: real("goalkeeper_footwork_weight").notNull().default(.1), goalkeeperLeadershipWeight: real("goalkeeper_leadership_weight").notNull().default(.05),
  maximumPositionDifference: integer("maximum_position_difference").notNull().default(1), protectedTopPlayersPercentage: real("protected_top_players_percentage").notNull().default(.25),
  defaultReserveCount: integer("default_reserve_count").notNull().default(0), algorithmAttempts: integer("algorithm_attempts").notNull().default(2500), updatedAt: text("updated_at").notNull(),
});

export const instanceConfigurations = sqliteTable("instance_configuration", {
  id: integer("id").primaryKey().default(1),
  siteName: text("site_name").notNull().default("Pelada Pede Mais Uma"),
  siteShortName: text("site_short_name").notNull().default("Pelada"),
  siteTagline: text("site_tagline").notNull().default("Times equilibrados. Resenha garantida."),
  footerText: text("footer_text").notNull().default("Times equilibrados. Resenha garantida."),
  logoUrl: text("logo_url"),
  faviconUrl: text("favicon_url"),
  shareImageUrl: text("share_image_url"),
  primaryColor: text("primary_color").notNull().default("#174D3B"),
  secondaryColor: text("secondary_color").notNull().default("#D9F36B"),
  backgroundColor: text("background_color").notNull().default("#F5F7F3"),
  surfaceColor: text("surface_color").notNull().default("#FFFFFF"),
  textColor: text("text_color").notNull().default("#15241F"),
  mutedColor: text("muted_color").notNull().default("#68756F"),
  teamBlueColor: text("team_blue_color").notNull().default("#1768E5"),
  teamYellowColor: text("team_yellow_color").notNull().default("#F4BF20"),
  teamBlueName: text("team_blue_name").notNull().default("Azul"),
  teamYellowName: text("team_yellow_name").notNull().default("Amarelo"),
  appName: text("app_name").notNull().default("Pelada Pede Mais Uma"),
  appTagline: text("app_tagline").notNull().default("Entre para a partida"),
  appPrimaryColor: text("app_primary_color").notNull().default("#0B3D2E"),
  appSecondaryColor: text("app_secondary_color").notNull().default("#D9F36B"),
  appBackgroundColor: text("app_background_color").notNull().default("#F6F4EC"),
  appTextColor: text("app_text_color").notNull().default("#17221D"),
  defaultMatchTitle: text("default_match_title").notNull().default("Pelada"),
  defaultMatchWeekday: integer("default_match_weekday").notNull().default(0),
  defaultMatchTime: text("default_match_time").notNull().default("09:00"),
  confirmationLeadMinutes: integer("confirmation_lead_minutes").notNull().default(60),
  manualSeparationEnabled: integer("manual_separation_enabled", { mode: "boolean" }).notNull().default(false),
  guestPreconfirmationEnabled: integer("guest_preconfirmation_enabled", { mode: "boolean" }).notNull().default(false),
  guestConfirmationThreshold: integer("guest_confirmation_threshold").notNull().default(16),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  updatedAt: text("updated_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", { id: text("id").primaryKey(), administratorId: text("administrator_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), previousData: text("previous_data"), newData: text("new_data"), createdAt: text("created_at").notNull() });

export const careerConfiguration = sqliteTable("career_configuration", {
  id: integer("id").primaryKey().default(1), enabled: integer("enabled", { mode: "boolean" }).notNull().default(true),
  trackContributions: integer("track_contributions", { mode: "boolean" }).notNull().default(true),
  cardTiersEnabled: integer("card_tiers_enabled", { mode: "boolean" }).notNull().default(false),
  cardBronzeMax: real("card_bronze_max").notNull().default(2.4),
  cardSilverMax: real("card_silver_max").notNull().default(3.9),
  cardGoldMax: real("card_gold_max").notNull().default(4.5),
  seasonDurationMonths: integer("season_duration_months").notNull().default(12),
  seasonStartedAt: text("season_started_at"),
  nextSeasonResetAt: text("next_season_reset_at"),
  seasonNumber: integer("season_number").notNull().default(1),
  resultMomentumMultiplier: real("result_momentum_multiplier").notNull().default(1),
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
