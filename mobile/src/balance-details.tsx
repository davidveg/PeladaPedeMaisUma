import { StyleSheet, Text, View } from "react-native";
import { Card } from "./components";
import { colors } from "./theme";
import type { TeamDelta, TeamResult } from "./types";

const explanations: Record<string, string> = {
  "Excelente equilíbrio": "Diferenças muito pequenas entre posições, atributos e pontuação.",
  "Bom equilíbrio": "Times próximos, com pequenas diferenças que não comprometem a partida.",
  "Equilíbrio aceitável": "Há diferenças perceptíveis, mas a divisão ainda tende a ser competitiva.",
  "Equilíbrio limitado": "Existem diferenças relevantes de quantidade, posições ou nível entre os times.",
};

function tone(rating: string) {
  if (rating.startsWith("Excelente")) return { color: colors.success, soft: "#EDF8F1" };
  if (rating.startsWith("Bom")) return { color: colors.blue, soft: colors.blueSoft };
  if (rating.startsWith("Aceitável")) return { color: colors.yellow, soft: colors.yellowSoft };
  return { color: colors.danger, soft: colors.dangerSoft };
}

export function BalanceDetails({ result, fallbackRating }: { result: TeamResult; fallbackRating?: string }) {
  const rating = result.rating || fallbackRating || "Equilíbrio não informado", palette = tone(rating);
  const delta = result.delta || emptyDelta;
  const metrics = [
    ["Jogadores", delta.players, 0], ["Defensores", delta.defenders, 0], ["Meio-campo", delta.midfielders, 0],
    ["Atacantes", delta.attackers, 0], ["Velocidade", delta.speed, 1], ["Habilidade", delta.skill, 1],
    ["Marcação", delta.marking, 1], ["Momentum", delta.momentum, 1], ["Pontuação", delta.score, 1],
  ] as const;
  return <Card style={styles.card}>
    <View style={[styles.rating, { backgroundColor: palette.soft, borderColor: palette.color }]}>
      <Text style={[styles.ratingLabel, { color: palette.color }]}>INDICADOR ATUAL</Text>
      <Text style={[styles.ratingTitle, { color: palette.color }]}>{rating}</Text>
      <Text style={styles.explanation}>{explanations[rating] || "Classificação registrada para esta separação."}</Text>
    </View>
    <View style={styles.section}>
      <Text style={styles.heading}>Diferenças entre os times</Text>
      <Text style={styles.hint}>Quanto mais próximo de zero, mais semelhantes estão os times.</Text>
      <View style={styles.metricGrid}>{metrics.map(([label, value, decimals]) => <View key={label} style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{Number(value || 0).toFixed(decimals)}</Text></View>)}</View>
    </View>
    {result.blueMetrics && result.yellowMetrics ? <View style={styles.teamAverages}>
      <View style={[styles.teamAverage, { backgroundColor: colors.blueSoft }]}><Text style={{ color: colors.blue, fontWeight: "900" }}>AZUL</Text><Text style={styles.averageValue}>{result.blueMetrics.scoreAvg.toFixed(2)}</Text><Text style={styles.metricLabel}>média geral</Text></View>
      <View style={[styles.teamAverage, { backgroundColor: colors.yellowSoft }]}><Text style={{ color: colors.yellow, fontWeight: "900" }}>AMARELO</Text><Text style={styles.averageValue}>{result.yellowMetrics.scoreAvg.toFixed(2)}</Text><Text style={styles.metricLabel}>média geral</Text></View>
    </View> : null}
    <View style={styles.section}>
      <Text style={styles.heading}>Como o algoritmo classificou</Text>
      <Text style={styles.hint}>Custo atual: {Number(result.cost || 0).toFixed(1)} — menor é melhor.</Text>
      <Text style={styles.ranges}>Excelente: abaixo de 35 · Bom: 35–79 · Aceitável: 80–149 · Limitado: 150 ou mais</Text>
      <Text style={styles.config}>Pesos: Vel {Math.round(Number(result.speedWeight || 0) * 100)}% · Hab {Math.round(Number(result.skillWeight || 0) * 100)}% · Mar {Math.round(Number(result.markingWeight || 0) * 100)}%</Text>
      <Text style={styles.config}>Diferença máx. por posição: {result.maximumPositionDifference ?? "—"} · Melhores protegidos: {result.protectedTopPlayersPercentage == null ? "—" : `${Math.round(result.protectedTopPlayersPercentage * 100)}%`} · Tentativas: {result.algorithmAttempts ?? "—"}</Text>
    </View>
  </Card>;
}

const emptyDelta: TeamDelta = { players: 0, defenders: 0, midfielders: 0, attackers: 0, speed: 0, skill: 0, marking: 0, momentum: 0, score: 0 };
const styles = StyleSheet.create({
  card: { gap: 16 }, rating: { gap: 4, padding: 12, borderRadius: 12, borderWidth: 1 }, ratingLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1 }, ratingTitle: { fontSize: 20, fontWeight: "900" }, explanation: { color: colors.text, lineHeight: 20 }, section: { gap: 6 }, heading: { color: colors.text, fontSize: 17, fontWeight: "900" }, hint: { color: colors.muted, lineHeight: 19 }, metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }, metric: { width: "31%", minWidth: 88, padding: 9, borderRadius: 10, backgroundColor: colors.cream }, metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, metricValue: { color: colors.text, fontSize: 18, fontWeight: "900" }, teamAverages: { flexDirection: "row", gap: 10 }, teamAverage: { flex: 1, padding: 11, borderRadius: 11 }, averageValue: { color: colors.text, fontSize: 20, fontWeight: "900" }, ranges: { color: colors.text, lineHeight: 20, fontWeight: "700" }, config: { color: colors.muted, lineHeight: 19 },
});
