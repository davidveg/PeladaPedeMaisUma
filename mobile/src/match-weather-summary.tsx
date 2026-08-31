import { StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { useMobileBranding } from "./branding";
import type { MatchHubWeather } from "./match-hub";

const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);

export function MatchWeatherSummary({ weather }: { weather?: MatchHubWeather | null }) {
  const { palette } = useMobileBranding();
  const { width, fontScale } = useWindowDimensions();
  const stacked = width < 350 || fontScale > 1.3;
  if (!weather) return <View style={styles.empty}>
    <Text accessible={false} importantForAccessibility="no" style={styles.emptyIcon}>☁️</Text>
    <Text style={[styles.notice, { color: palette.muted }]}>Não há previsão do tempo registrada para esta partida.</Text>
  </View>;

  const min = finite(weather.temperatureMin) ? weather.temperatureMin : null;
  const max = finite(weather.temperatureMax) ? weather.temperatureMax : null;
  const temperature = min !== null && max !== null && min !== max
    ? `${number.format(min)}–${number.format(max)} °C`
    : min !== null || max !== null ? `${number.format((min ?? max)!)} °C` : "Não informada";
  const metrics = [
    { label: "Tempo", icon: weather.icon || "☁️", value: weather.description || "Não informado" },
    { label: "Temperatura", icon: "🌡️", value: temperature },
    { label: "Vento", icon: "💨", value: finite(weather.windSpeed) && weather.windSpeed >= 0 ? `${number.format(weather.windSpeed)} km/h` : "Não informado" },
  ];
  return <View style={styles.summary}>
    <Text style={[styles.caption, { color: palette.muted }]}>PREVISÃO REGISTRADA</Text>
    <View style={[styles.metrics, stacked && styles.stacked]}>
      {metrics.map(metric => <View key={metric.label} style={[styles.metric, stacked && styles.stackedMetric, { backgroundColor: palette.cream, borderColor: palette.border }]}>
        <Text style={[styles.label, { color: palette.muted }]}>{metric.label}</Text>
        <Text accessible={false} importantForAccessibility="no" style={styles.icon}>{metric.icon}</Text>
        <Text style={[styles.value, { color: palette.text }]}>{metric.value}</Text>
      </View>)}
    </View>
    {weather.usedDefaultLocation && <Text style={[styles.note, { color: palette.muted }]}>Previsão para o local padrão da pelada.</Text>}
  </View>;
}

const styles = StyleSheet.create({
  summary: { alignSelf: "stretch", minWidth: 0, gap: 8, marginVertical: 5 },
  caption: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  metrics: { flexDirection: "row", alignItems: "stretch", gap: 8, minWidth: 0 },
  stacked: { flexDirection: "column" },
  stackedMetric: { flex: 0 },
  metric: { flex: 1, minWidth: 0, paddingVertical: 10, paddingHorizontal: 6, borderWidth: 1, borderRadius: 10, alignItems: "center", gap: 6 },
  label: { width: "100%", fontSize: 11, fontWeight: "700", textAlign: "center" },
  icon: { fontSize: 23 },
  value: { width: "100%", fontSize: 12, fontWeight: "700", textAlign: "center", fontVariant: ["tabular-nums"] },
  note: { fontSize: 11, lineHeight: 16 },
  empty: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0, marginVertical: 5 },
  emptyIcon: { fontSize: 18 },
  notice: { flex: 1, minWidth: 0, fontSize: 12, lineHeight: 18 },
});
