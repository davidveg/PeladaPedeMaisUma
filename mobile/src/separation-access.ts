import type { Account } from "./types";
import { hasPermission, MODERATOR_PERMISSIONS } from "./moderator-permissions.ts";

export function manualSeparationEntryVisible(account: Account | null | undefined, manualSeparationEnabled: boolean) {
  return hasPermission(account, MODERATOR_PERMISSIONS.SEPARATIONS_MANAGE) && manualSeparationEnabled;
}

export function separationBuilderAllowed(
  account: Account | null | undefined,
  manualSeparationEnabled: boolean,
  matchId?: string,
) {
  return hasPermission(account, MODERATOR_PERMISSIONS.SEPARATIONS_MANAGE) && (manualSeparationEnabled || Boolean(matchId));
}
