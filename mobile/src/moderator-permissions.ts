import type { Account } from "./types";

export const MODERATOR_PERMISSIONS = {
  PLAYERS_MANAGE: "PLAYERS_MANAGE",
  MATCHES_MANAGE: "MATCHES_MANAGE",
  MATCH_ATTENDANCE_MANAGE: "MATCH_ATTENDANCE_MANAGE",
  MATCHES_CANCEL: "MATCHES_CANCEL",
  SEPARATIONS_MANAGE: "SEPARATIONS_MANAGE",
  MATCH_RESULTS_MANAGE: "MATCH_RESULTS_MANAGE",
  CAREER_VOTES_MANAGE: "CAREER_VOTES_MANAGE",
  BALANCE_CONFIG_MANAGE: "BALANCE_CONFIG_MANAGE",
} as const;

export type ModeratorPermission = typeof MODERATOR_PERMISSIONS[keyof typeof MODERATOR_PERMISSIONS];

export function hasPermission(account: Account | null | undefined, permission: ModeratorPermission) {
  return account?.role === "admin" || (account?.role === "moderator" && account.permissions?.includes(permission) === true);
}

export function hasAnyPermission(account: Account | null | undefined, permissions: ModeratorPermission[]) {
  return permissions.some(permission => hasPermission(account, permission));
}

export function isStaff(account: Account | null | undefined) {
  return account?.role === "admin" || account?.role === "moderator";
}
