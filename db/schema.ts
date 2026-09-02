import { sql } from "drizzle-orm";
import { index, integer, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().$defaultFn(() => new Date().toISOString()),
  updatedAt: text("updated_at").notNull().$defaultFn(() => new Date().toISOString()),
};

export const players = sqliteTable("players", {
  id: text("id").primaryKey(), fullName: text("full_name").notNull(), displayName: text("display_name").notNull(),
  nickname: text("nickname"), aliases: text("aliases").notNull().default("[]"), type: text("type").notNull().default("monthly"),
  primaryPosition: text("primary_position").notNull(), secondaryPosition: text("secondary_position"), speed: real("speed").notNull(), skill: real("skill").notNull(), marking: real("marking").notNull().default(3),
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
export const matchSeparationDrafts = sqliteTable("match_separation_drafts", {
  id: text("id").primaryKey(), matchId: text("match_id").notNull().unique(), snapshot: text("snapshot").notNull(),
  manuallyAdjusted: integer("manually_adjusted", { mode: "boolean" }).notNull().default(false),
  presentPlayerIds: text("present_player_ids").notNull(), proposalNumber: integer("proposal_number").notNull().default(1),
  createdByAdministratorId: text("created_by_administrator_id").notNull(), ...timestamps,
});
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
}, table => [index("team_separations_statistics_date_idx").on(table.matchDate, table.deletedAt)]);

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
  separationDraftsEnabled: integer("separation_drafts_enabled", { mode: "boolean" }).notNull().default(false),
  guestPreconfirmationEnabled: integer("guest_preconfirmation_enabled", { mode: "boolean" }).notNull().default(false),
  guestConfirmationThreshold: integer("guest_confirmation_threshold").notNull().default(16),
  financeEnabled: integer("finance_enabled", { mode: "boolean" }).notNull().default(true),
  timezone: text("timezone").notNull().default("America/Sao_Paulo"),
  updatedAt: text("updated_at").notNull(),
});

export const auditLogs = sqliteTable("audit_logs", { id: text("id").primaryKey(), administratorId: text("administrator_id"), action: text("action").notNull(), entityType: text("entity_type").notNull(), entityId: text("entity_id"), previousData: text("previous_data"), newData: text("new_data"), createdAt: text("created_at").notNull() });

// Financial amounts are always stored as integer cents. The application currently
// models one pelada per deployment, represented by the fixed `instance:1` scope.
export const financialSettings = sqliteTable("financial_settings", {
  scopeId: text("scope_id").primaryKey().default("instance:1"),
  defaultMonthlyFeeCents: integer("default_monthly_fee_cents").notNull().default(0),
  defaultDueDay: integer("default_due_day").notNull().default(10),
  openingBalanceCents: integer("opening_balance_cents").notNull().default(0),
  initialCompetence: text("initial_competence"), pixKey: text("pix_key"), ...timestamps,
});
export const financialPlayerSettings = sqliteTable("financial_player_settings", {
  scopeId: text("scope_id").notNull().default("instance:1"), playerId: text("player_id").notNull(),
  monthlyEnabled: integer("monthly_enabled", { mode: "boolean" }).notNull().default(true),
  customMonthlyFeeCents: integer("custom_monthly_fee_cents"), ...timestamps,
}, table => [uniqueIndex("financial_player_settings_scope_player_unique").on(table.scopeId, table.playerId)]);
export const financialCharges = sqliteTable("financial_charges", {
  id: text("id").primaryKey(), scopeId: text("scope_id").notNull().default("instance:1"),
  playerId: text("player_id"), matchId: text("match_id"), type: text("type").notNull(),
  description: text("description").notNull(), category: text("category").notNull(),
  amountCents: integer("amount_cents").notNull(), competence: text("competence").notNull(), dueDate: text("due_date").notNull(),
  status: text("status").notNull().default("PENDING"), createdByAdministratorId: text("created_by_administrator_id").notNull(),
  cancelledAt: text("cancelled_at"), cancelledByAdministratorId: text("cancelled_by_administrator_id"), cancellationReason: text("cancellation_reason"), ...timestamps,
}, table => [
  uniqueIndex("financial_charge_monthly_unique").on(table.scopeId, table.playerId, table.type, table.competence).where(sql`${table.type} = 'MONTHLY_FEE'`),
  index("financial_charge_scope_competence_idx").on(table.scopeId, table.competence),
  index("financial_charge_player_idx").on(table.playerId, table.competence),
]);
export const financialPayments = sqliteTable("financial_payments", {
  id: text("id").primaryKey(), scopeId: text("scope_id").notNull().default("instance:1"), chargeId: text("charge_id").notNull(),
  amountCents: integer("amount_cents").notNull(), paidAt: text("paid_at").notNull(), method: text("method").notNull(), notes: text("notes"),
  status: text("status").notNull().default("COMPLETED"), createdByAdministratorId: text("created_by_administrator_id").notNull(),
  idempotencyKey: text("idempotency_key").notNull(), reversedAt: text("reversed_at"), reversedByAdministratorId: text("reversed_by_administrator_id"), reversalReason: text("reversal_reason"), createdAt: text("created_at").notNull(),
}, table => [
  uniqueIndex("financial_payment_scope_idempotency_unique").on(table.scopeId, table.idempotencyKey),
  index("financial_payment_charge_idx").on(table.chargeId, table.status),
]);
export const financialRecurringExpenses = sqliteTable("financial_recurring_expenses", {
  id: text("id").primaryKey(), scopeId: text("scope_id").notNull().default("instance:1"), description: text("description").notNull(),
  category: text("category").notNull(), amountCents: integer("amount_cents").notNull(), recurrence: text("recurrence").notNull().default("MONTHLY"),
  dueDay: integer("due_day").notNull(), supplier: text("supplier"), notes: text("notes"), active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdByAdministratorId: text("created_by_administrator_id").notNull(), ...timestamps,
}, table => [index("financial_recurring_expense_scope_idx").on(table.scopeId, table.active)]);
export const financialExpenses = sqliteTable("financial_expenses", {
  id: text("id").primaryKey(), scopeId: text("scope_id").notNull().default("instance:1"), recurringExpenseId: text("recurring_expense_id"),
  description: text("description").notNull(), category: text("category").notNull(), amountCents: integer("amount_cents").notNull(),
  competence: text("competence").notNull(), dueDate: text("due_date").notNull(), paidAt: text("paid_at"), method: text("method"),
  status: text("status").notNull().default("PENDING"), supplier: text("supplier"), notes: text("notes"),
  createdByAdministratorId: text("created_by_administrator_id").notNull(), paidByAdministratorId: text("paid_by_administrator_id"),
  paymentIdempotencyKey: text("payment_idempotency_key"), cancelledAt: text("cancelled_at"), cancelledByAdministratorId: text("cancelled_by_administrator_id"), cancellationReason: text("cancellation_reason"), ...timestamps,
}, table => [
  uniqueIndex("financial_expense_recurring_competence_unique").on(table.scopeId, table.recurringExpenseId, table.competence).where(sql`${table.recurringExpenseId} IS NOT NULL`),
  uniqueIndex("financial_expense_payment_idempotency_unique").on(table.scopeId, table.paymentIdempotencyKey).where(sql`${table.paymentIdempotencyKey} IS NOT NULL`),
  index("financial_expense_scope_competence_idx").on(table.scopeId, table.competence),
]);
export const financialMovements = sqliteTable("financial_movements", {
  id: text("id").primaryKey(), scopeId: text("scope_id").notNull().default("instance:1"), direction: text("direction").notNull(),
  category: text("category").notNull(), description: text("description").notNull(), amountCents: integer("amount_cents").notNull(),
  occurredAt: text("occurred_at").notNull(), method: text("method"), playerId: text("player_id"), chargeId: text("charge_id"),
  paymentId: text("payment_id"), expenseId: text("expense_id"), status: text("status").notNull().default("ACTIVE"),
  createdByAdministratorId: text("created_by_administrator_id").notNull(), createdAt: text("created_at").notNull(),
}, table => [
  uniqueIndex("financial_movement_payment_unique").on(table.paymentId).where(sql`${table.paymentId} IS NOT NULL`),
  uniqueIndex("financial_movement_expense_unique").on(table.expenseId).where(sql`${table.expenseId} IS NOT NULL AND ${table.status} = 'ACTIVE'`),
  index("financial_movement_scope_date_idx").on(table.scopeId, table.occurredAt),
]);
export const financialMonthlyClosures = sqliteTable("financial_monthly_closures", {
  id: text("id").primaryKey(), scopeId: text("scope_id").notNull().default("instance:1"), competence: text("competence").notNull(),
  snapshot: text("snapshot").notNull(), closedByAdministratorId: text("closed_by_administrator_id").notNull(), closedAt: text("closed_at").notNull(),
}, table => [uniqueIndex("financial_monthly_closure_scope_competence_unique").on(table.scopeId, table.competence)]);

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
  createdByAdministratorId: text("created_by_administrator_id").notNull(), configSnapshot: text("config_snapshot").notNull(), resultsSnapshot: text("results_snapshot"), participationSnapshot: text("participation_snapshot"),
  teamMomentumApplied: integer("team_momentum_applied", { mode: "boolean" }).notNull().default(false), votesMomentumApplied: integer("votes_momentum_applied", { mode: "boolean" }).notNull().default(false), ...timestamps,
}, table => [index("career_matches_statistics_status_idx").on(table.status, table.closedAt)]);

export const careerVotes = sqliteTable("career_votes", {
  id: text("id").primaryKey(), careerMatchId: text("career_match_id").notNull(), voterPlayerId: text("voter_player_id").notNull(),
  motmThirdId: text("motm_third_id").notNull(), motmSecondId: text("motm_second_id").notNull(), motmFirstId: text("motm_first_id").notNull(),
  dotmThirdId: text("dotm_third_id").notNull(), dotmSecondId: text("dotm_second_id").notNull(), dotmFirstId: text("dotm_first_id").notNull(), createdAt: text("created_at").notNull(),
}, table => [uniqueIndex("career_votes_match_voter_unique").on(table.careerMatchId, table.voterPlayerId)]);

export const careerMatchContributions = sqliteTable("career_match_contributions", {
  id: text("id").primaryKey(), careerMatchId: text("career_match_id").notNull(), scorerPlayerId: text("scorer_player_id").notNull(),
  assistPlayerId: text("assist_player_id"), team: text("team").notNull(), ownGoal: integer("is_own_goal", { mode: "boolean" }).notNull().default(false), createdAt: text("created_at").notNull(),
});

export const monthlyCareerAwards = sqliteTable("monthly_career_awards", {
  month: text("month").primaryKey(), year: integer("year").notNull(), snapshot: text("snapshot").notNull(), finalizedAt: text("finalized_at").notNull(),
}, table => [index("monthly_career_awards_year_idx").on(table.year, table.month)]);

export const careerSeasonAwards = sqliteTable("career_season_awards", {
  seasonNumber: integer("season_number").primaryKey(), year: integer("year").notNull(), startedAt: text("started_at"), endedAt: text("ended_at").notNull(),
  snapshot: text("snapshot").notNull(), finalizedByAdministratorId: text("finalized_by_administrator_id").notNull(), finalizedAt: text("finalized_at").notNull(),
}, table => [index("career_season_awards_year_idx").on(table.year, table.seasonNumber)]);
