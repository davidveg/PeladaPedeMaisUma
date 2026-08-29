import { useMemo, useState } from "react";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Image, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { API_BASE_URL, apiFetch } from "@/api";
import { useAuth } from "@/auth";
import { Card, EmptyState, ErrorState, Header, Screen, UpdatedAt } from "@/components";
import { colors } from "@/theme";

type Player = { id: string; displayName: string; photoUrl?: string | null; primaryPosition?: string | null };
type PlayerStatistics = {
  player: Player; position: string; games: number; wins: number; draws: number; losses: number;
  goals: number; assists: number; contributionGames: number; goalsFor: number; goalsAgainst: number; plusMinus: number; plusMinusPerGame: number;
  utilization: number; consistency: number | null; ipi: { value: number; confidence: string } | null;
  recent: { sequence: string[]; utilization: number; trend: number | null; contributionGames: number; goals: number; assists: number; plusMinus: number };
  impact: { utilizationDifference: number | null; plusMinusDifference: number | null };
};
type Partnership = { playerA: Player; playerB: Player; games: number; utilization: number; plusMinus: number; chemistry: number };
type Payload = { version: number; players: PlayerStatistics[]; partnerships: Partnership[]; coverage: { matches: number } };

const fmt = (value: number | null | undefined, digits = 1) => value == null ? "Dados insuficientes" : value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits });
const signed = (value: number | null | undefined, suffix = "") => value == null ? "Dados insuficientes" : `${value > 0 ? "+" : ""}${fmt(value)}${suffix}`;

export default function AdvancedStatisticsScreen() {
  const router = useRouter(), { account } = useAuth();
  const [recent, setRecent] = useState<5 | 10 | 20>(5);
  const year = new Date().getFullYear();
  const query = useQuery({
    queryKey: ["advanced-statistics", year, recent],
    queryFn: () => apiFetch<Payload>(`/api/public-statistics/advanced?from=${year}-01-01&to=${year}-12-31&recent=${recent}&minimumGames=1&partnershipMinimumGames=3`),
  });
  const own = query.data?.players.find(entry => entry.player.id === account?.playerId) || null;
  const partner = useMemo(() => query.data?.partnerships.find(pair => pair.playerA.id === account?.playerId || pair.playerB.id === account?.playerId), [account?.playerId, query.data?.partnerships]);
  if (query.isError && !query.data) return <Screen><Header title="Estatísticas avançadas"/><ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/></Screen>;
  return <Screen><ScrollView contentContainerStyle={styles.content}>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.back}><Ionicons name="arrow-back" size={18} color={colors.green}/><Text style={styles.backText}>Meu card</Text></Pressable>
    <Header eyebrow="ANÁLISE DE PERFORMANCE" title="Estatísticas avançadas"/>
    <UpdatedAt value={query.dataUpdatedAt}/>
    <View style={styles.windows}>{([5, 10, 20] as const).map(value => <Pressable key={value} onPress={() => setRecent(value)} style={[styles.window, recent === value && styles.windowActive]}><Text style={[styles.windowText, recent === value && styles.windowTextActive]}>Últimos {value}</Text></Pressable>)}</View>
    {own ? <>
      <Card style={styles.identity}><Avatar player={own.player}/><View style={styles.identityText}><Text style={styles.name}>{own.player.displayName}</Text><Text style={styles.muted}>{own.position} · {own.games} partidas</Text></View><View style={styles.ipi}><Text style={styles.ipiValue}>{own.ipi ? fmt(own.ipi.value) : "—"}</Text><Text style={styles.ipiLabel}>IPI / 100</Text></View></Card>
      <Card style={styles.panel}><Text style={styles.sectionTitle}>Seu desempenho</Text><View style={styles.metrics}><Metric label="Confiança" value={own.ipi?.confidence || "Dados insuficientes"}/><Metric label="Aproveitamento" value={`${fmt(own.utilization)}%`}/><Metric label="+/- total" value={signed(own.plusMinus)}/><Metric label="+/- por jogo" value={signed(own.plusMinusPerGame)}/><Metric label="Consistência" value={own.consistency == null ? "Dados insuficientes" : `${fmt(own.consistency)}%`}/><Metric label="Impacto observado" value={signed(own.impact.utilizationDifference, " p.p.")}/></View></Card>
      <Card style={styles.panel}><Text style={styles.sectionTitle}>Forma recente</Text><View style={styles.sequence}>{own.recent.sequence.map((result, index) => <Text key={`${result}-${index}`} style={[styles.result, result === "V" ? styles.win : result === "D" ? styles.loss : styles.draw]}>{result}</Text>)}</View><Text style={styles.muted}>{signed(own.recent.trend, " p.p.")} em relação às partidas anteriores · {own.recent.contributionGames ? `${own.recent.goals} gols · ${own.recent.assists} assistências · ` : "gols e assistências sem cobertura · "}saldo {signed(own.recent.plusMinus)}</Text></Card>
      <Card style={styles.panel}><Text style={styles.sectionTitle}>Melhor parceria</Text>{partner ? <PartnershipRow pair={partner} playerId={own.player.id}/> : <Text style={styles.muted}>Dados insuficientes para formar uma dupla com amostra mínima.</Text>}</Card>
    </> : query.isLoading ? <Card style={styles.panel}><Text style={styles.muted}>Calculando seu histórico real…</Text></Card> : <EmptyState title="Dados insuficientes" message="Ainda não há partidas válidas para calcular suas estatísticas neste ano."/>}
    {query.data?.players.length ? <Card style={styles.panel}><Text style={styles.sectionTitle}>Ranking IPI</Text>{query.data.players.slice(0, 10).map((entry, index) => <View style={styles.ranking} key={entry.player.id}><Text style={styles.rank}>{index + 1}</Text><Avatar player={entry.player} small/><View style={styles.rankingText}><Text style={styles.playerName}>{entry.player.displayName}</Text><Text style={styles.muted}>{entry.position} · {entry.games} jogos</Text></View><Text style={styles.score}>{entry.ipi ? fmt(entry.ipi.value) : "—"}</Text></View>)}</Card> : null}
    <Text style={styles.note}>IPI v{query.data?.version || 1}. Componentes sem dados não são tratados como zero. Impacto com/sem representa associação estatística, não causalidade.</Text>
  </ScrollView></Screen>;
}

function Avatar({ player, small = false }: { player: Player; small?: boolean }) { const uri = player.photoUrl ? (player.photoUrl.startsWith("http") ? player.photoUrl : `${API_BASE_URL}${player.photoUrl}`) : null; return uri ? <Image alt={`Foto de ${player.displayName}`} source={{ uri }} style={[styles.avatar, small && styles.avatarSmall]}/> : <View style={[styles.avatar, styles.avatarFallback, small && styles.avatarSmall]}><Ionicons name="person" size={small ? 18 : 25} color={colors.muted}/></View>; }
function Metric({ label, value }: { label: string; value: string }) { return <View style={styles.metric}><Text style={styles.metricLabel}>{label}</Text><Text style={styles.metricValue}>{value}</Text></View>; }
function PartnershipRow({ pair, playerId }: { pair: Partnership; playerId: string }) { const partner = pair.playerA.id === playerId ? pair.playerB : pair.playerA; return <View style={styles.partnership}><Avatar player={partner} small/><View style={styles.rankingText}><Text style={styles.playerName}>{partner.displayName}</Text><Text style={styles.muted}>{pair.games} jogos · {fmt(pair.utilization)}% · saldo {signed(pair.plusMinus)}</Text></View><Text style={styles.score}>{fmt(pair.chemistry)}</Text></View>; }

const styles = StyleSheet.create({
  content: { paddingBottom: 36, gap: 12 }, back: { marginTop: 14, marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 6 }, backText: { color: colors.green, fontWeight: "800" },
  windows: { flexDirection: "row", gap: 8, paddingHorizontal: 20 }, window: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.border, backgroundColor: "#fff" }, windowActive: { backgroundColor: colors.green, borderColor: colors.green }, windowText: { color: colors.text, fontSize: 12, fontWeight: "800" }, windowTextActive: { color: "#fff" },
  panel: { marginHorizontal: 20 }, identity: { marginHorizontal: 20, flexDirection: "row", alignItems: "center", gap: 12 }, identityText: { flex: 1 }, name: { color: colors.text, fontSize: 22, fontWeight: "900" }, avatar: { width: 58, height: 58, borderRadius: 29, backgroundColor: "#E6EFEA" }, avatarSmall: { width: 40, height: 40, borderRadius: 20 }, avatarFallback: { alignItems: "center", justifyContent: "center" }, ipi: { alignItems: "flex-end" }, ipiValue: { color: colors.green, fontSize: 27, fontWeight: "900" }, ipiLabel: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 12 }, metrics: { flexDirection: "row", flexWrap: "wrap", gap: 8 }, metric: { width: "48%", minHeight: 74, padding: 12, borderRadius: 12, backgroundColor: "#F2F6F3" }, metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, metricValue: { color: colors.text, fontSize: 17, fontWeight: "900", marginTop: 5 }, muted: { color: colors.muted, fontSize: 12, lineHeight: 18 },
  sequence: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginBottom: 10 }, result: { width: 32, height: 32, textAlign: "center", textAlignVertical: "center", borderRadius: 16, overflow: "hidden", color: "#fff", fontWeight: "900" }, win: { backgroundColor: colors.success }, loss: { backgroundColor: colors.danger }, draw: { backgroundColor: colors.muted },
  ranking: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 58, borderTopWidth: 1, borderTopColor: "#EDF1EE" }, rank: { width: 20, color: colors.green, fontWeight: "900" }, rankingText: { flex: 1 }, playerName: { color: colors.text, fontWeight: "800" }, score: { color: colors.green, fontSize: 18, fontWeight: "900" }, partnership: { flexDirection: "row", alignItems: "center", gap: 10 }, note: { marginHorizontal: 20, color: colors.muted, fontSize: 11, lineHeight: 17 },
});
