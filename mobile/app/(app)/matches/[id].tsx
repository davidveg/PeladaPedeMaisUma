import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch, jsonMutation } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, ErrorState, Header, Screen } from "@/components";
import { colors } from "@/theme";
import type { MatchListPayload, MatchPlayer, ScheduledMatch } from "@/types";
import { shareText } from "@/sharing";

export default function MatchDetail() {
  const { id } = useLocalSearchParams<{ id: string }>(), { account } = useAuth(), router = useRouter(), client = useQueryClient();
  const query = useQuery({ queryKey: ["matches"], queryFn: () => apiFetch<MatchListPayload>(account?.role === "admin" ? "/api/admin/matches" : "/api/matches") });
  const item = query.data?.matches.find(match => match.id === id);
  const mutation = useMutation({
    mutationFn: ({ playerId, status }: { playerId?: string; status: "PRESENT" | "ABSENT" }) => account?.role === "admin" && playerId
      ? apiFetch("/api/admin/matches", jsonMutation("PATCH", { action: "attendance", matchId: id, playerId, status }))
      : apiFetch("/api/matches", jsonMutation("PUT", { matchId: id, status })),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["matches"] }); await client.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: error => Alert.alert("Não foi possível confirmar", (error as Error).message),
  });
  if (query.isError) return <Screen><ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/></Screen>;
  if (!item) return <Screen><ErrorState message="Partida não encontrada." retry={() => query.refetch()}/></Screen>;
  const attendanceByPlayer = Object.fromEntries(item.attendance.map(answer => [answer.playerId, answer]));
  const players = account?.role === "admin" ? query.data?.players || [] : [];
  const goalkeeperLimitReached = Boolean(item.viewer.isGoalkeeper && item.viewer.status !== "PRESENT" && (item.goalkeepers?.present || 0) >= (item.goalkeepers?.max || 2));
  function answer(status: "PRESENT" | "ABSENT") {
    const current = item!;
    const consumes = current.viewer.status && current.viewer.status !== status;
    if (consumes) Alert.alert("Alterar resposta?", `Isso consumirá uma das ${current.maxChanges} remarcações permitidas.`, [{ text: "Cancelar", style: "cancel" }, { text: "Alterar", onPress: () => mutation.mutate({ status }) }]);
    else mutation.mutate({ status });
  }
  return <Screen><FlatList
    contentContainerStyle={styles.content}
    data={players}
    keyExtractor={(player: MatchPlayer) => player.id}
    ListHeaderComponent={<><Header eyebrow={item.status === "OPEN" ? item.acceptingResponses ? "CONFIRMAÇÕES ABERTAS" : "PRAZO ENCERRADO" : item.status === "CLOSED" ? "LISTA ENCERRADA" : "PARTIDA CANCELADA"} title={item.title}/>
      <MobileWeather weather={item.weather}/>
      <Card style={styles.info}><Text style={styles.date}>{dateTime(item.matchAt)}</Text>{item.location ? <Text style={styles.location}>📍 {item.location}</Text> : null}<Text style={styles.deadline}>Responda até {dateTime(item.confirmationDeadline)}</Text><View style={styles.counts}><Count value={item.counts.present} label="Presentes" color={colors.success}/><Count value={item.counts.absent} label="Ausentes" color={colors.danger}/><Count value={item.counts.pending} label="Pendentes" color={colors.muted}/></View></Card>
      {account?.role !== "admin" ? <Card style={styles.answer}><Text style={styles.answerTitle}>{item.viewer.status ? `Sua resposta: ${item.viewer.status === "PRESENT" ? "Vou jogar" : "Não vou"}` : "Confirme sua presença"}</Text><Text style={styles.help}>{goalkeeperLimitReached ? "Os dois lugares de goleiro já estão preenchidos." : `${item.viewer.changesRemaining} de ${item.maxChanges} remarcações restantes.`}</Text>{item.viewer.playerId ? <View style={styles.buttons}><Button title="✓ Vou jogar" busy={mutation.isPending} disabled={!item.viewer.canRespond || goalkeeperLimitReached} onPress={() => answer("PRESENT")}/><Button title="× Não vou" busy={mutation.isPending} disabled={!item.viewer.canRespond} variant="danger" onPress={() => answer("ABSENT")}/></View> : <Text style={styles.warning}>Associe sua conta a um jogador para responder.</Text>}</Card> : <Text style={styles.adminTitle}>Confirmação administrativa</Text>}
      {item.status === "OPEN" && (account?.role === "admin" || item.shareMessage) ? <View style={styles.matchActions}>{account?.role === "admin" ? <Button title="Editar data e regras" variant="secondary" onPress={() => router.push(`/matches/manage?id=${item.id}` as never)}/> : null}{item.shareMessage ? <Button title="Compartilhar parcial no WhatsApp" icon="whatsapp" variant="secondary" onPress={() => shareText(item.shareMessage).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/> : null}</View> : null}
      {account?.role !== "admin" && <Roster item={item}/>}
    </>}
    renderItem={({ item: player }: { item: MatchPlayer }) => { const response = attendanceByPlayer[player.id], goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro", goalkeeperBlocked = goalkeeper && response?.status !== "PRESENT" && (item.goalkeepers?.present || 0) >= (item.goalkeepers?.max || 2); return <View style={styles.player}><View style={{ flex: 1 }}><Text style={styles.playerName}>{player.displayName}</Text><Text style={styles.playerMeta}>{player.primaryPosition} · {response ? `${response.changeCount}/${item.maxChanges} remarcações` : goalkeeperBlocked ? "2 goleiros já confirmados" : "Sem resposta"}</Text></View><Pressable disabled={goalkeeperBlocked} style={[styles.smallButton, response?.status === "PRESENT" && styles.smallPresent, goalkeeperBlocked && styles.smallDisabled]} onPress={() => mutation.mutate({ playerId: player.id, status: "PRESENT" })}><Text style={response?.status === "PRESENT" ? styles.smallOnText : styles.smallPresentText}>✓</Text></Pressable><Pressable style={[styles.smallButton, response?.status === "ABSENT" && styles.smallAbsent]} onPress={() => mutation.mutate({ playerId: player.id, status: "ABSENT" })}><Text style={response?.status === "ABSENT" ? styles.smallOnText : styles.smallAbsentText}>×</Text></Pressable></View>; }}
    ListFooterComponent={<View style={styles.footer}>{item.separationId ? <Button title="Abrir separação gerada" variant="secondary" onPress={() => router.push({ pathname: "/separations/[id]", params: { id: item.separationId! } })}/> : null}{account?.role === "admin" && item.status === "OPEN" ? <Button title="Fechar lista e gerar times" disabled={item.counts.present < 4} onPress={() => router.push({ pathname: "/new-separation", params: { matchId: item.id } } as never)}/> : null}</View>}
  /></Screen>;
}
function Count({ value, label, color }: { value: number; label: string; color: string }) { return <View style={styles.count}><Text style={[styles.countValue, { color }]}>{value}</Text><Text style={styles.countLabel}>{label}</Text></View>; }
function Roster({ item }: { item: ScheduledMatch }) { return <Card style={styles.roster}><Text style={styles.rosterTitle}>Presentes</Text><Text style={styles.names}>{item.attendance.filter(row => row.status === "PRESENT").map(row => row.playerName).join(", ") || "Ninguém ainda"}</Text><Text style={[styles.rosterTitle, { marginTop: 12 }]}>Ausentes</Text><Text style={styles.names}>{item.attendance.filter(row => row.status === "ABSENT").map(row => row.playerName).join(", ") || "Ninguém ainda"}</Text></Card>; }
function MobileWeather({ weather }: { weather?: ScheduledMatch["weather"] }) {
  if (!weather) return <Card style={styles.weather}><Text style={styles.weatherTitle}>🌤️ Previsão do tempo</Text><Text style={styles.weatherHelp}>Aguardando atualização do servidor.</Text></Card>;
  if (weather.status !== "AVAILABLE") return <Card style={styles.weather}><Text style={styles.weatherTitle}>🌤️ Previsão do tempo</Text><Text style={styles.weatherHelp}>{weather.message || "Previsão indisponível."}</Text></Card>;
  const temperature = weather.temperatureMin === weather.temperatureMax ? `${weather.temperatureMin} °C` : `${weather.temperatureMin}–${weather.temperatureMax} °C`;
  return <Card style={styles.weather}><Text style={styles.weatherTitle}>{weather.icon || "🌤️"} {weather.description} · {temperature}</Text><View style={styles.weatherMetrics}><Text>💧 {weather.precipitationProbability ?? 0}% chuva</Text><Text>💨 {weather.windSpeed ?? 0} km/h</Text><Text>🌧️ {weather.precipitation ?? 0} mm</Text></View>{weather.usedDefaultLocation ? <Text style={styles.weatherWarning}>Local não encontrado; previsão pelo endereço padrão.</Text> : null}<Text style={styles.weatherHelp}>Previsão para 2 horas · atualizada {new Date(weather.fetchedAt).toLocaleString("pt-BR")} · {weather.source || "Serviço meteorológico"}</Text></Card>;
}
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 }, info: { gap: 8 }, date: { color: colors.text, fontSize: 17, fontWeight: "900" }, location: { color: colors.muted }, deadline: { color: colors.yellow, fontWeight: "800" },
  weather: { gap: 8, backgroundColor: "#F2F7F4" }, weatherTitle: { color: colors.text, fontSize: 17, fontWeight: "900" }, weatherMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, weatherHelp: { color: colors.muted, fontSize: 11, lineHeight: 16 }, weatherWarning: { color: colors.yellow, fontSize: 11, fontWeight: "800" },
  counts: { flexDirection: "row", gap: 8, marginTop: 6 }, count: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: "#F2F5F3", alignItems: "center" }, countValue: { fontSize: 24, fontWeight: "900" }, countLabel: { color: colors.muted, fontSize: 10 },
  answer: { gap: 10 }, answerTitle: { color: colors.text, fontSize: 18, fontWeight: "900" }, help: { color: colors.muted }, buttons: { gap: 8 }, warning: { color: colors.danger, fontWeight: "700" },
  roster: { marginTop: 12 }, rosterTitle: { color: colors.green, fontWeight: "900" }, names: { color: colors.muted, lineHeight: 20, marginTop: 5 }, adminTitle: { color: colors.green, fontSize: 18, fontWeight: "900", marginTop: 10 },
  player: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  playerName: { color: colors.text, fontWeight: "900" }, playerMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, smallButton: { width: 40, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  smallPresent: { backgroundColor: colors.success, borderColor: colors.success }, smallAbsent: { backgroundColor: colors.danger, borderColor: colors.danger }, smallOnText: { color: "#fff", fontSize: 18, fontWeight: "900" }, smallPresentText: { color: colors.success, fontSize: 18, fontWeight: "900" }, smallAbsentText: { color: colors.danger, fontSize: 18, fontWeight: "900" },
  footer: { gap: 10, marginTop: 8 }, matchActions: { gap: 12, marginVertical: 12 }, smallDisabled: { opacity: .35 },
});
