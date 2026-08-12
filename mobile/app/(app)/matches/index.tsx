import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Switch, Text, View } from "react-native";
import { apiFetch } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, EmptyState, ErrorState, Header, Screen } from "@/components";
import { colors } from "@/theme";
import type { MatchListPayload, ScheduledMatch } from "@/types";

export default function MatchesScreen() {
  const { account } = useAuth(), router = useRouter();
  const [onlyActiveOrSeparated, setOnlyActiveOrSeparated] = useState(true);
  const query = useQuery({
    queryKey: ["matches"],
    queryFn: () => apiFetch<MatchListPayload>(account?.role === "admin" ? "/api/admin/matches" : "/api/matches"),
  });
  const refetch = query.refetch;
  const visibleMatches = (query.data?.matches || []).filter(item => !onlyActiveOrSeparated || isActiveOrSeparated(item));
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  return <Screen><Header eyebrow="AGENDA DA PELADA" title="Partidas" action={account?.role === "admin" ? <Button title="+ Criar" onPress={() => router.push("/matches/manage" as never)}/> : null}/>
    {query.isError && !query.data ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/> : <FlatList
      contentContainerStyle={styles.list} data={visibleMatches} keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.green}/>}
      ListHeaderComponent={<View style={styles.filter}><View style={{ flex: 1, gap: 3 }}><Text style={styles.filterTitle}>Somente abertas ou com times gerados</Text><Text style={styles.filterHelp}>Oculta canceladas e listas encerradas sem separação.</Text></View><Switch accessibilityLabel="Somente partidas abertas ou com times gerados" value={onlyActiveOrSeparated} onValueChange={setOnlyActiveOrSeparated} trackColor={{ false: colors.border, true: colors.green }} thumbColor="#FFFFFF"/></View>}
      ListEmptyComponent={<EmptyState title="Nenhuma partida" message="Nenhuma partida corresponde ao filtro atual."/>}
      renderItem={({ item }) => <MatchCard item={item} onPress={() => router.push(`/matches/${item.id}` as never)}/>}
    />}</Screen>;
}

function MatchCard({ item, onPress }: { item: ScheduledMatch; onPress(): void }) {
  const own = item.viewer.status === "PRESENT" ? "Você vai jogar" : item.viewer.status === "ABSENT" ? "Você não irá" : "Confirmação pendente";
  return <Pressable onPress={onPress}><Card style={[styles.card, item.status === "CANCELLED" && styles.cancelled]}>
    <View style={styles.top}><View style={{ flex: 1 }}><Text style={[styles.state, item.status === "OPEN" ? styles.open : item.status === "CANCELLED" ? styles.cancelledState : styles.closed]}>{status(item.status, item.acceptingResponses)}</Text><Text style={styles.title}>{item.title}</Text><Text style={styles.date}>{dateTime(item.matchAt)}{item.location ? ` · ${item.location}` : ""}</Text></View><View style={styles.count}><Text style={styles.countValue}>{item.counts.present}</Text><Text style={styles.countLabel}>presentes</Text></View></View>
    <View style={styles.summary}><Text style={styles.present}>{item.counts.present} presentes</Text><Text style={styles.absent}>{item.counts.absent} ausentes</Text><Text style={styles.pending}>{item.counts.pending} pendentes</Text></View>
    <Text style={[styles.viewer, !item.viewer.status && item.status === "OPEN" && styles.viewerPending]}>{own}</Text>
    <CompactWeather weather={item.weather}/>
  </Card></Pressable>;
}
function CompactWeather({ weather }: { weather?: ScheduledMatch["weather"] }) {
  if (!weather || weather.status !== "AVAILABLE") return null;
  const temperature = weather.temperatureMin === weather.temperatureMax ? `${weather.temperatureMin}°` : `${weather.temperatureMin}–${weather.temperatureMax}°`;
  return <View style={styles.weatherSummary}>
    <Text style={styles.weatherItem}>{weather.icon || "🌤️"} {temperature}</Text>
    <Text style={styles.weatherItem}>💧 {weather.precipitationProbability ?? 0}%</Text>
    <Text style={styles.weatherItem}>💨 {weather.windSpeed ?? 0} km/h</Text>
    <Text style={styles.weatherItem}>🌧️ {weather.precipitation ?? 0} mm</Text>
  </View>;
}
function status(value: string, accepting: boolean) { return value === "OPEN" ? accepting ? "CONFIRMAÇÕES ABERTAS" : "PRAZO ENCERRADO" : value === "CLOSED" ? "LISTA ENCERRADA" : "CANCELADA"; }
function isActiveOrSeparated(item: ScheduledMatch) { return item.status !== "CANCELLED" && (item.status === "OPEN" || Boolean(item.separationId)); }
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
const styles = StyleSheet.create({
  list: { padding: 20, paddingTop: 8, gap: 12, flexGrow: 1 }, filter: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 13, backgroundColor: "#F2F7F4" }, filterTitle: { color: colors.text, fontWeight: "900" }, filterHelp: { color: colors.muted, fontSize: 11, lineHeight: 16 }, card: { gap: 12 }, cancelled: { opacity: .65 },
  top: { flexDirection: "row", gap: 12 }, state: { alignSelf: "flex-start", fontSize: 9, fontWeight: "900", letterSpacing: .6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  open: { color: colors.success, backgroundColor: "#E5F4EA" }, closed: { color: colors.muted, backgroundColor: "#EEF1EF" }, cancelledState: { color: colors.danger, backgroundColor: colors.dangerSoft },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", marginTop: 8 }, date: { color: colors.muted, marginTop: 4 },
  count: { width: 72, height: 68, alignItems: "center", justifyContent: "center", borderRadius: 14, backgroundColor: "#E9F3EC" },
  countValue: { color: colors.green, fontSize: 27, fontWeight: "900" }, countLabel: { color: colors.muted, fontSize: 9 },
  summary: { flexDirection: "row", flexWrap: "wrap", gap: 6 }, present: { color: colors.success, backgroundColor: "#E5F4EA", padding: 6, borderRadius: 8, fontWeight: "800" },
  absent: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: 6, borderRadius: 8, fontWeight: "800" }, pending: { color: colors.muted, backgroundColor: "#EEF1EF", padding: 6, borderRadius: 8, fontWeight: "800" },
  viewer: { color: colors.green, fontWeight: "800" }, viewerPending: { color: colors.danger },
  weatherSummary: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 10, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 9 },
  weatherItem: { color: colors.muted, fontSize: 11, fontWeight: "700" },
});
