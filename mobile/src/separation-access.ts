import type { Account } from "./types";
import { hasPermission, MODERATOR_PERMISSIONS } from "./moderator-permissions.ts";

// This route is only a builder for a scheduled match, never a standalone entry.
export function separationBuilderAllowed(account: Account | null | undefined, matchId?: string) {
  return hasPermission(account, MODERATOR_PERMISSIONS.SEPARATIONS_MANAGE) && Boolean(matchId?.trim());
}
