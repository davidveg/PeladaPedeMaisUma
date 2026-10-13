import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { API_BASE_URL } from "@/api";

function achievementBadgeKey(id: string) {
  const canonicalId = String(id || "").split(":", 1)[0];
  return /^perfect_season_\d+$/.test(canonicalId) ? "perfect_season" : canonicalId;
}

export function AchievementBadge({ id, icon, title, size = 54 }: { id: string; icon?: string; title: string; size?: number }) {
  const uri = API_BASE_URL ? `${API_BASE_URL}/achievements/${encodeURIComponent(achievementBadgeKey(id))}.png` : "";
  const [failedUri, setFailedUri] = useState("");
  const failed = !uri || failedUri === uri;
  return <View accessible accessibilityRole="image" accessibilityLabel={title} style={[styles.frame, { width: size, height: size }]}> 
    {failed ? <Text style={[styles.fallback, { fontSize: Math.round(size * .45) }]}>{icon || "🏆"}</Text> : <Image source={{ uri }} resizeMode="contain" style={styles.image} onError={() => setFailedUri(uri)}/>} 
  </View>;
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  image: { width: "100%", height: "100%" },
  fallback: { textAlign: "center" },
});
