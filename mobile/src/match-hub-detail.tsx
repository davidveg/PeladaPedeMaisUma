import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "./api";
import { EmptyState, ErrorState, Screen } from "./components";
import { useMobileBranding } from "./branding";
import { colors } from "./theme";
import type { MatchHubPayload } from "./match-hub";
import { matchDetailPanel } from "./match-detail-panel";
import MatchAttendance from "./match-attendance";
import SeparationDetail from "./separation-detail";

const tabs = [{ id: "attendance", label: "Presenças" }, { id: "teams", label: "Times" }, { id: "result", label: "Súmula e resultado" }, { id: "voting", label: "Votação" }];
export default function MatchHubDetail({ matchId, separationId, initialTab }: { matchId?: string; separationId?: string; initialTab?: string }) {
  const router = useRouter(), { palette } = useMobileBranding(), [selected, setSelected] = useState<string | null>(tabs.some(tab => tab.id === initialTab) ? initialTab! : null);
  const params = new URLSearchParams(matchId ? { match: matchId } : { separation: separationId || "" });
  const query = useQuery({ queryKey: ["match-hub", "detail", matchId, separationId], queryFn: () => apiFetch<MatchHubPayload>(`/api/match-hub?${params}`) });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const item = query.data?.items[0], tab = selected || (item?.separationId ? "teams" : "attendance");
  const panel = item ? matchDetailPanel(item, tab) : null;
  if (query.isPending) return <Screen><EmptyState title="Carregando partida…" message="Aguarde os detalhes."/></Screen>;
  if (query.isError) return <Screen><ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/></Screen>;
  return <View style={{ flex: 1, backgroundColor: palette.cream }}>
    <Pressable accessibilityRole="button" onPress={() => router.replace("/matches" as never)} style={styles.back}><Text style={{ color: palette.green, fontWeight: "800" }}>← Todas as partidas</Text></Pressable>
    {!item ? <EmptyState title="Partida não encontrada" message="Este registro não está mais disponível."/> : <>
      <View style={styles.tabs}>{tabs.map(value => <Pressable key={value.id} accessibilityRole="tab" accessibilityState={{ selected: tab === value.id }} onPress={() => setSelected(value.id)} style={[styles.tab, { backgroundColor: tab === value.id ? palette.green : palette.card }]}><Text style={[styles.tabText, { color: tab === value.id ? "#fff" : palette.green }]}>{value.label}</Text></Pressable>)}</View>
      {panel === "attendance" && item.matchId ? <MatchAttendance key={item.matchId} id={item.matchId}/> : null}
      {panel === "legacy-attendance" ? <EmptyState title="Escalação do histórico" message="Esta escalação antiga não tem partida agendada vinculada nem lista de presenças registrada."/> : null}
      {panel === "separation" && item.separationId ? <SeparationDetail key={`${item.separationId}:${tab}`} id={item.separationId} section={tab}/> : null}
      {panel === "awaiting-teams" ? <EmptyState title="Times ainda não publicados" message="Os times desta partida aparecerão aqui após a publicação da escalação."/> : null}
      {panel === "unavailable" ? <EmptyState title="Ainda indisponível" message="A súmula e a votação ficam disponíveis após a publicação dos times."/> : null}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  back: { paddingHorizontal: 20, paddingVertical: 12, minHeight: 44 }, tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tab: { width: "48%", flexGrow: 1, minHeight: 44, justifyContent: "center", alignItems: "center", padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, tabText: { fontSize: 12, fontWeight: "800", textAlign: "center" },
});
