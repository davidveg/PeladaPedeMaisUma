import { StyleSheet, Text, View } from "react-native";
import { useMobileBranding } from "./branding";
import { contrastTextColor } from "./team-colors";

export function MatchScoreboard({ blueScore, yellowScore }: { blueScore: number | null; yellowScore: number | null }) {
  const { config: brand, palette } = useMobileBranding();
  if (blueScore == null || yellowScore == null) return null;

  return <View style={styles.scoreboard} accessible accessibilityLabel={`Placar final: ${brand.teamBlueName} ${blueScore} a ${yellowScore} ${brand.teamYellowName}`}>
    <Text style={[styles.caption, { color: palette.muted }]}>PLACAR FINAL</Text>
    <View style={styles.row}>
      <TeamScore name={brand.teamBlueName} score={blueScore} color={palette.blue} borderColor={palette.border}/>
      <Text style={[styles.separator, { color: palette.muted }]} maxFontSizeMultiplier={1.5}>×</Text>
      <TeamScore name={brand.teamYellowName} score={yellowScore} color={palette.yellow} borderColor={palette.border}/>
    </View>
  </View>;
}

function TeamScore({ name, score, color, borderColor }: { name: string; score: number; color: string; borderColor: string }) {
  const foreground = contrastTextColor(color);
  return <View style={[styles.team, { backgroundColor: color, borderColor }]}>
    <Text style={[styles.number, { color: foreground }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} maxFontSizeMultiplier={1.5}>{score}</Text>
    <Text style={[styles.name, { color: foreground }]} numberOfLines={2} ellipsizeMode="tail">{name}</Text>
  </View>;
}

const styles = StyleSheet.create({
  scoreboard: { alignSelf: "stretch", minWidth: 0, marginVertical: 5, gap: 8 },
  caption: { fontSize: 10, fontWeight: "800", letterSpacing: 1, textAlign: "center" },
  row: { flexDirection: "row", alignItems: "stretch", gap: 8, minWidth: 0 },
  team: { flex: 1, minWidth: 0, borderWidth: 1, borderRadius: 12, paddingHorizontal: 8, paddingVertical: 10, alignItems: "center", gap: 3 },
  number: { width: "100%", fontSize: 36, fontWeight: "900", fontVariant: ["tabular-nums"], textAlign: "center" },
  name: { width: "100%", fontSize: 12, fontWeight: "800", textAlign: "center" },
  separator: { alignSelf: "center", flexShrink: 0, fontSize: 20, fontWeight: "700" },
});
