import { useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { API_BASE_URL } from "@/api";

const badgeFiles: Record<string, string> = {
  games: "games.png",
  wins: "wins.png",
  goals: "goals.png",
  assists: "assists.png",
  motmAwards: "motm-awards.png",
  socialAwards: "social-awards.png",
};

export function HallRecordBadge({ id, icon, title, size = 62 }: { id: string; icon?: string; title: string; size?: number }) {
  const file = badgeFiles[id];
  const uri = file && API_BASE_URL ? `${API_BASE_URL.replace(/\/$/, "")}/hall-of-fame/records/${file}` : "";
  const [failedUri, setFailedUri] = useState("");
  const failed = !uri || failedUri === uri;

  return <View accessible accessibilityRole="image" accessibilityLabel={title} style={[styles.frame, { width: size, height: size }]}> 
    {failed ? <Text style={[styles.fallback, { fontSize: Math.round(size * .42) }]}>{icon || "🏆"}</Text> : <Image source={{ uri }} resizeMode="contain" style={styles.image} onError={() => setFailedUri(uri)}/>} 
  </View>;
}

const styles = StyleSheet.create({
  frame: { alignItems: "center", justifyContent: "center", flexShrink: 0 },
  image: { width: "100%", height: "100%" },
  fallback: { textAlign: "center" },
});
