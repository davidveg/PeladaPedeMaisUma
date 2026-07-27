/* Notification preferences are shared by web and mobile accounts. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { db, ensureDb } from "./database";

export type NotificationAccountType = "administrator" | "member";
export type NotificationCategory = "attendance" | "matches" | "separations" | "appUpdates";
export type NotificationPreferences = {
  attendanceInApp: boolean;
  attendancePush: boolean;
  matchesInApp: boolean;
  matchesPush: boolean;
  separationsInApp: boolean;
  separationsPush: boolean;
  appUpdatesInApp: boolean;
  appUpdatesPush: boolean;
  careerVotesPush: boolean;
  pageSize: number;
};

export const defaultNotificationPreferences: NotificationPreferences = {
  attendanceInApp: true,
  attendancePush: true,
  matchesInApp: true,
  matchesPush: true,
  separationsInApp: true,
  separationsPush: true,
  appUpdatesInApp: true,
  appUpdatesPush: true,
  careerVotesPush: true,
  pageSize: 10,
};

export function notificationCategory(type: string): NotificationCategory {
  if (type === "ATTENDANCE_CHANGED") return "attendance";
  if (type === "MATCH_CLOSED") return "separations";
  if (type === "APP_RELEASED") return "appUpdates";
  return "matches";
}

export function normalizeNotificationPreferences(value: any): NotificationPreferences {
  const enabled = (key: keyof NotificationPreferences) =>
    typeof value?.[key] === "boolean" ? value[key] : defaultNotificationPreferences[key];
  const requestedPageSize = Number(value?.pageSize);
  return {
    attendanceInApp: enabled("attendanceInApp") as boolean,
    attendancePush: enabled("attendancePush") as boolean,
    matchesInApp: enabled("matchesInApp") as boolean,
    matchesPush: enabled("matchesPush") as boolean,
    separationsInApp: enabled("separationsInApp") as boolean,
    separationsPush: enabled("separationsPush") as boolean,
    appUpdatesInApp: enabled("appUpdatesInApp") as boolean,
    appUpdatesPush: enabled("appUpdatesPush") as boolean,
    careerVotesPush: enabled("careerVotesPush") as boolean,
    pageSize: [10, 20, 50].includes(requestedPageSize) ? requestedPageSize : 10,
  };
}

export function mapNotificationPreferences(row: any): NotificationPreferences {
  if (!row) return { ...defaultNotificationPreferences };
  const enabled = (value: unknown) => value == null ? true : Number(value) !== 0;
  return normalizeNotificationPreferences({
    attendanceInApp: enabled(row.attendance_in_app),
    attendancePush: enabled(row.attendance_push),
    matchesInApp: enabled(row.matches_in_app),
    matchesPush: enabled(row.matches_push),
    separationsInApp: enabled(row.separations_in_app),
    separationsPush: enabled(row.separations_push),
    appUpdatesInApp: enabled(row.app_updates_in_app),
    appUpdatesPush: enabled(row.app_updates_push),
    careerVotesPush: enabled(row.career_votes_push),
    pageSize: row.page_size == null ? 10 : Number(row.page_size),
  });
}

export function preferenceEnabled(
  preferences: NotificationPreferences,
  category: NotificationCategory,
  channel: "inApp" | "push",
) {
  const key = `${category}${channel === "inApp" ? "InApp" : "Push"}` as keyof NotificationPreferences;
  return Boolean(preferences[key]);
}

export async function getNotificationPreferences(accountType: NotificationAccountType, accountId: string) {
  await ensureDb();
  const row = await db().prepare(
    `SELECT attendance_in_app,attendance_push,matches_in_app,matches_push,
            separations_in_app,separations_push,app_updates_in_app,app_updates_push,career_votes_push,page_size
     FROM account_notification_preferences WHERE account_type=? AND account_id=?`,
  ).bind(accountType, accountId).first();
  return mapNotificationPreferences(row);
}

export async function saveNotificationPreferences(
  accountType: NotificationAccountType,
  accountId: string,
  input: unknown,
) {
  await ensureDb();
  const preferences = normalizeNotificationPreferences(input);
  const now = new Date().toISOString();
  await db().prepare(
    `INSERT INTO account_notification_preferences
     (id,account_type,account_id,attendance_in_app,attendance_push,matches_in_app,matches_push,
      separations_in_app,separations_push,app_updates_in_app,app_updates_push,career_votes_push,page_size,created_at,updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
     ON CONFLICT(account_type,account_id) DO UPDATE SET
      attendance_in_app=excluded.attendance_in_app,attendance_push=excluded.attendance_push,
      matches_in_app=excluded.matches_in_app,matches_push=excluded.matches_push,
      separations_in_app=excluded.separations_in_app,separations_push=excluded.separations_push,
      app_updates_in_app=excluded.app_updates_in_app,app_updates_push=excluded.app_updates_push,
      career_votes_push=excluded.career_votes_push,page_size=excluded.page_size,updated_at=excluded.updated_at`,
  ).bind(
    crypto.randomUUID(), accountType, accountId,
    Number(preferences.attendanceInApp), Number(preferences.attendancePush),
    Number(preferences.matchesInApp), Number(preferences.matchesPush),
    Number(preferences.separationsInApp), Number(preferences.separationsPush),
    Number(preferences.appUpdatesInApp), Number(preferences.appUpdatesPush),
    Number(preferences.careerVotesPush), preferences.pageSize, now, now,
  ).run();
  return preferences;
}
