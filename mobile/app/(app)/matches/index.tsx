import { useNetInfo } from "@react-native-community/netinfo";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, EmptyState, ErrorState, Header, Screen, UpdatedAt } from "@/components";
import { colors } from "@/theme";
import { hasPermission, MODERATOR_PERMISSIONS } from "@/moderator-permissions";
import { matchHubFilters, matchHubStatusLabel, type MatchHubFilter, type MatchHubPayload } from "@/match-hub";
import { useMobileBranding } from "@/branding";
import { MatchScoreboard } from "@/match-scoreboard";
import { MatchWeatherSummary } from "@/match-weather-summary";

export default function MatchesScreen() {
  const { account } = useAuth(), router = useRouter(), { palette } = useMobileBranding();
  const [filter, setFilter] = useState<MatchHubFilter>("all"), [page, setPage] = useState(1);
  const query = useQuery({ queryKey: ["match-hub", "list", account?.id, filter, page], queryFn: () => apiFetch<MatchHubPayload>(`/api/match-hub?filter=${filter}&page=${page}`) });
  const network = useNetInfo();
  const badges = useQuery({ queryKey: ["match-hub", "badges", account?.id], queryFn: () => apiFetch<{ attendance: number; votes: number; nextVoteSeparationId?: string }>("/api/match-hub/badges") });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  return <Screen><Header eyebrow="AGENDA E HISTÓRICO" title="Partidas" action={hasPermission(account, MODERATOR_PERMISSIONS.MATCHES_MANAGE) ? <Button title="+ Criar" onPress={() => router.push("/matches/manage" as never)}/> : null}/>
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}><Button title="Estatísticas da pelada" icon="bar-chart" variant="secondary" onPress={() => router.push("/statistics" as never)}/></View>
    <UpdatedAt value={query.dataUpdatedAt} offline={network.isConnected === false}/>
    {query.isError && !query.data ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/> : <FlatList
      contentContainerStyle={styles.list} data={query.data?.items || []} keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={palette.green}/>}
      ListHeaderComponent={<>{badges.data?.votes && badges.data.nextVoteSeparationId ? <View style={{ marginBottom: 12 }}><Button title={`${badges.data.votes} votação(ões) pendente(s) · Votar`} onPress={() => router.push({ pathname: "/separations/[id]", params: { id: badges.data!.nextVoteSeparationId!, tab: "voting" } })}/></View> : null}<View style={styles.filters}>{matchHubFilters.map(value => <Pressable key={value.value} accessibilityRole="button" accessibilityState={{ selected: filter === value.value }} onPress={() => { setFilter(value.value); setPage(1); }} style={[styles.filter, filter === value.value && { backgroundColor: palette.green }]}><Text style={[styles.filterText, filter === value.value && { color: "#fff" }]}>{value.label}</Text></Pressable>)}</View><Text style={styles.help}>Presenças, times, súmula e votação. Canceladas aparecem somente no filtro “Canceladas”.</Text></>}
      ListEmptyComponent={<EmptyState title={query.isPending ? "Carregando partidas…" : "Nenhuma partida"} message={query.isPending ? "Aguarde um instante." : "Nenhuma partida neste filtro."}/>}
      ListFooterComponent={<View style={styles.pagination}><Button title="← Anteriores" variant="secondary" disabled={page === 1 || query.isPending} onPress={() => setPage(value => value - 1)}/><Text style={styles.help}>{page}</Text><Button title="Próximas →" variant="secondary" disabled={!query.data?.hasMore} onPress={() => setPage(value => value + 1)}/></View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" onPress={() => router.push(item.matchId ? { pathname: "/matches/[id]", params: { id: item.matchId } } : { pathname: "/separations/[id]", params: { id: item.separationId! } })}><Card style={styles.card}>
        <Text style={[styles.status, { color: item.status === "CANCELLED" ? colors.danger : palette.green }]}>{matchHubStatusLabel[item.status]}</Text><Text style={[styles.title, { color: palette.text }]}>{item.title}</Text>
        <Text style={styles.help}>{item.date ? new Date(item.date.length === 10 ? `${item.date}T12:00:00` : item.date).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", ...(item.date.length > 10 ? { timeStyle: "short" as const } : {}) }) : "Data não informada"}{item.location ? ` · ${item.location}` : ""}</Text>
        <MatchScoreboard blueScore={item.blueScore} yellowScore={item.yellowScore}/>
        <MatchWeatherSummary weather={item.weatherSummary}/>
        <Text style={styles.help}>{item.present !== null ? `${item.present} presentes` : "Escalação do histórico"}{item.votingStatus ? ` · Votação ${item.votingStatus === "OPEN" ? "aberta" : "encerrada"}` : ""}</Text><Text style={{ color: palette.green, fontWeight: "800" }}>Ver partida →</Text>
      </Card></Pressable>}
    />}</Screen>;
}
const styles = StyleSheet.create({
  list: { padding: 16, gap: 12, flexGrow: 1 }, filters: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 10 }, filter: { minHeight: 44, padding: 11, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff", borderRadius: 10, justifyContent: "center" }, filterText: { fontSize: 12, fontWeight: "800", color: colors.green },
  help: { color: colors.muted, fontSize: 12, lineHeight: 18 }, card: { gap: 9 }, status: { fontWeight: "900", fontSize: 11 }, title: { fontSize: 21, fontWeight: "900" }, pagination: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6, marginVertical: 14 },
});
