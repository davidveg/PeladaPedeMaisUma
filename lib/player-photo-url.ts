export function playerPhotoThumbnailUrl(photoUrl: string | null | undefined) {
  if (!photoUrl) return null;
  try {
    const relative = photoUrl.startsWith("/");
    const url = new URL(photoUrl, "https://player-photo.local");
    const key = url.searchParams.get("key") || "";
    if (url.pathname !== "/api/upload" || !key.startsWith("players/")) return photoUrl;
    url.searchParams.set("variant", "thumbnail");
    return relative ? `${url.pathname}?${url.searchParams.toString()}` : url.toString();
  } catch {
    return photoUrl;
  }
}
