export function mobilePlayerPhotoUrl(photoUrl: string | null | undefined, apiBaseUrl: string, thumbnail = true) {
  if (!photoUrl) return null;
  const absolute = /^https?:\/\//i.test(photoUrl)
    ? photoUrl
    : `${apiBaseUrl.replace(/\/$/, "")}/${photoUrl.replace(/^\//, "")}`;
  if (!thumbnail) return absolute;
  try {
    const url = new URL(absolute);
    if (url.pathname === "/api/upload" && (url.searchParams.get("key") || "").startsWith("players/")) {
      url.searchParams.set("variant", "thumbnail");
    }
    return url.toString();
  } catch {
    return absolute;
  }
}
