export function manualSeparationEntryVisible(role: string | undefined, manualSeparationEnabled: boolean) {
  return role === "admin" && manualSeparationEnabled;
}

export function separationBuilderAllowed(
  role: string | undefined,
  manualSeparationEnabled: boolean,
  matchId?: string,
) {
  return role === "admin" && (manualSeparationEnabled || Boolean(matchId));
}
