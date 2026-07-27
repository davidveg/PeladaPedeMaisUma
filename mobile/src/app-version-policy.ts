export type ReleasePolicy = {
  enabled: boolean;
  publishedAt: string | null;
  latestBuild: number;
  minimumBuild: number;
};

export function evaluateRelease(installedBuild: number, release: ReleasePolicy) {
  const available = Boolean(release.enabled && release.publishedAt && installedBuild < release.latestBuild);
  return { available, required: available && installedBuild < release.minimumBuild };
}

export function dismissedRecently(dismissedAt: number, now = Date.now(), delay = 24 * 60 * 60 * 1000) {
  return dismissedAt > now - delay;
}
