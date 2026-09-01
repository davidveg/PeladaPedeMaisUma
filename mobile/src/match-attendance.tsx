import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch, jsonMutation } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, ErrorState, Header, Screen } from "@/components";
import { colors } from "@/theme";
import type { MatchListPayload, MatchPlayer, ScheduledMatch } from "@/types";
import { shareText } from "@/sharing";
import { hasAnyPermission, hasPermission, MODERATOR_PERMISSIONS } from "@/moderator-permissions";

export default function MatchAttendance({ id }: { id: string }) {
  const { account } = useAuth(), router = useRouter(), client = useQueryClient();
  const canManageMatches = hasPermission(account, MODERATOR_PERMISSIONS.MATCHES_MANAGE);
  const canManageAttendance = hasPermission(account, MODERATOR_PERMISSIONS.MATCH_ATTENDANCE_MANAGE);
  const canManageSeparations = hasPermission(account, MODERATOR_PERMISSIONS.SEPARATIONS_MANAGE);
  const canReadAdminMatches = hasAnyPermission(account, [MODERATOR_PERMISSIONS.MATCHES_MANAGE, MODERATOR_PERMISSIONS.MATCH_ATTENDANCE_MANAGE, MODERATOR_PERMISSIONS.MATCHES_CANCEL, MODERATOR_PERMISSIONS.SEPARATIONS_MANAGE]);
  const query = useQuery({ queryKey: ["matches", id, canReadAdminMatches], queryFn: () => apiFetch<MatchListPayload>(`${canReadAdminMatches ? "/api/admin/matches" : "/api/matches"}?id=${encodeURIComponent(id)}`) });
  const item = query.data?.matches.find(match => match.id === id);
  const mutation = useMutation({
    mutationFn: ({ playerId, status, guestAction }: { playerId?: string; status?: "PRESENT" | "ABSENT"; guestAction?: "ADD" | "REMOVE" }) => canManageAttendance && playerId
      ? apiFetch("/api/admin/matches", jsonMutation("PATCH", guestAction
        ? { action: "guest-preconfirmation", matchId: id, playerId, guestAction }
        : { action: "attendance", matchId: id, playerId, status }))
      : apiFetch("/api/matches", jsonMutation("PUT", { matchId: id, status })),
    onSuccess: async () => { await client.invalidateQueries({ queryKey: ["match-hub"] }); await client.invalidateQueries({ queryKey: ["matches"] }); await client.invalidateQueries({ queryKey: ["notifications"] }); },
    onError: error => Alert.alert("Não foi possível confirmar", (error as Error).message),
  });
  if (query.isError) return <Screen><ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/></Screen>;
  if (query.isPending) return <Screen><Header title="Carregando presenças…"/></Screen>;
  if (!item) return <Screen><ErrorState message="Partida não encontrada." retry={() => query.refetch()}/></Screen>;
  const attendanceByPlayer = Object.fromEntries(item.attendance.map(answer => [answer.playerId, answer]));
  const players = canManageAttendance ? query.data?.players || [] : [];
  const goalkeeperLimitReached = Boolean(item.viewer.isGoalkeeper && item.viewer.status !== "PRESENT" && (item.goalkeepers?.present || 0) >= (item.goalkeepers?.max || 2));
  const guestManaged = Boolean(item.guestPreconfirmation?.enabled && item.viewer.isGuest);
  const waitingIds = new Set(item.preconfirmedGuestIds || []);
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
      <Card style={styles.info}><Text style={styles.date}>{dateTime(item.matchAt)}</Text>{item.location ? <Text style={styles.location}>📍 {item.location}</Text> : null}<Text style={styles.deadline}>Responda até {dateTime(item.confirmationDeadline)}</Text><View style={styles.counts}><Count value={item.counts.present} label="Presentes" color={colors.success}/><Count value={item.counts.absent} label="Ausentes" color={colors.danger}/>{item.guestPreconfirmation?.enabled ? <Count value={item.counts.preconfirmed || 0} label="Na espera" color={colors.yellow}/> : null}<Count value={item.counts.pending} label="Pendentes" color={colors.muted}/></View></Card>
      <MobileWeather weather={item.weather}/>
      {!canManageAttendance ? <Card style={styles.answer}>
        <Text style={styles.answerTitle}>{guestManaged ? item.viewer.preconfirmed ? "Você está na lista de espera" : item.viewer.status === "PRESENT" ? "Presença aprovada" : item.viewer.status === "ABSENT" ? "Sua resposta: Não vou" : "Presença gerenciada pela organização" : item.viewer.status ? `Sua resposta: ${item.viewer.status === "PRESENT" ? "Vou jogar" : "Não vou"}` : "Confirme sua presença"}</Text>
        <Text style={styles.help}>{guestManaged ? item.viewer.preconfirmed ? "Aguarde a aprovação final de um administrador." : "Convidados entram na lista de espera e são aprovados pelos administradores da pelada." : goalkeeperLimitReached ? "Os dois lugares de goleiro já estão preenchidos." : `${item.viewer.changesRemaining} de ${item.maxChanges} remarcações restantes.`}</Text>
        {item.viewer.playerId ? <View style={styles.buttons}>{!guestManaged && <Button title="✓ Vou jogar" busy={mutation.isPending} disabled={!item.viewer.canConfirmPresence || goalkeeperLimitReached} onPress={() => answer("PRESENT")}/>}<Button title="× Não vou" busy={mutation.isPending} disabled={!item.viewer.canRespond} variant="danger" onPress={() => answer("ABSENT")}/></View> : <Text style={styles.warning}>Associe sua conta a um jogador para responder.</Text>}
      </Card> : <Text style={styles.adminTitle}>Confirmação administrativa</Text>}
      {item.status === "OPEN" && (canReadAdminMatches || item.shareMessage) ? <View style={styles.matchActions}>{canManageMatches ? <Button title="Editar data e regras" variant="secondary" onPress={() => router.push(`/matches/manage?id=${item.id}` as never)}/> : null}{item.shareMessage ? <Button title="Compartilhar parcial no WhatsApp" icon="whatsapp" variant="secondary" onPress={() => shareText(item.shareMessage).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/> : null}</View> : null}
      {!canManageAttendance && <Roster item={item}/>}
    </>}
    renderItem={({ item: player }: { item: MatchPlayer }) => {
      const response = attendanceByPlayer[player.id], guest = player.type === "guest", preconfirmed = waitingIds.has(player.id);
      const goalkeeper = player.type === "goalkeeper" || player.primaryPosition === "Goleiro";
      const goalkeeperBlocked = goalkeeper && response?.status !== "PRESENT" && (item.goalkeepers?.present || 0) >= (item.goalkeepers?.max || 2);
      const guestFlow = guest && item.guestPreconfirmation?.enabled && response?.status !== "PRESENT";
      return <View style={styles.player}><View style={{ flex: 1 }}><Text style={styles.playerName}>{player.displayName}{guest ? " · Convidado" : ""}</Text><Text style={styles.playerMeta}>{player.primaryPosition} · {preconfirmed ? "Na lista de espera · aguardando aprovação" : response ? `${response.changeCount}/${item.maxChanges} remarcações` : goalkeeperBlocked ? "2 goleiros já confirmados" : "Sem resposta"}</Text></View>
        {guestFlow ? preconfirmed ? <>
          <Pressable disabled={!item.guestPreconfirmation?.canApprove} style={[styles.smallButton, !item.guestPreconfirmation?.canApprove && styles.smallDisabled]} onPress={() => mutation.mutate({ playerId: player.id, status: "PRESENT" })}><Text style={styles.smallPresentText}>✓</Text></Pressable>
          <Pressable style={[styles.smallButton, styles.smallWaiting]} onPress={() => mutation.mutate({ playerId: player.id, guestAction: "REMOVE" })}><Text style={styles.smallWaitingText}>↩</Text></Pressable>
        </> : <Pressable style={[styles.smallButton, styles.smallWaiting]} onPress={() => mutation.mutate({ playerId: player.id, guestAction: "ADD" })}><Text style={styles.smallWaitingText}>⏳</Text></Pressable>
        : <Pressable disabled={goalkeeperBlocked} style={[styles.smallButton, response?.status === "PRESENT" && styles.smallPresent, goalkeeperBlocked && styles.smallDisabled]} onPress={() => mutation.mutate({ playerId: player.id, status: "PRESENT" })}><Text style={response?.status === "PRESENT" ? styles.smallOnText : styles.smallPresentText}>✓</Text></Pressable>}
        <Pressable style={[styles.smallButton, response?.status === "ABSENT" && styles.smallAbsent]} onPress={() => mutation.mutate({ playerId: player.id, status: "ABSENT" })}><Text style={response?.status === "ABSENT" ? styles.smallOnText : styles.smallAbsentText}>×</Text></Pressable>
      </View>;
    }}
    ListFooterComponent={<View style={styles.footer}>{item.separationId ? <Button title="Abrir escalação gerada" variant="secondary" onPress={() => router.push({ pathname: "/separations/[id]", params: { id: item.separationId! } })}/> : null}{canManageSeparations && item.status === "OPEN" && item.separationDraft?.enabled ? <Card style={[styles.draftInfo,item.separationDraft.stale&&styles.draftInfoStale]}><Text style={styles.draftTitle}>{item.separationDraft.exists?item.separationDraft.stale?"Rascunho desatualizado":"Rascunho salvo":"Planeje antes de publicar"}</Text><Text style={styles.draftText}>{item.separationDraft.exists&&!item.separationDraft.stale&&item.separationDraft.updatedAt?`Atualizado em ${new Date(item.separationDraft.updatedAt).toLocaleString("pt-BR")}. A lista continua aberta.`:item.separationDraft.stale?"A lista de presentes mudou. Uma nova proposta será iniciada ao abrir.":"Crie uma proposta sem encerrar a lista ou notificar os participantes."}</Text><Button title={item.separationDraft.exists&&!item.separationDraft.stale?"Editar rascunho de escalação":"Criar rascunho de escalação"} variant="secondary" disabled={item.counts.present<4} onPress={()=>router.push({pathname:"/new-separation",params:{matchId:item.id,draft:"1"}} as never)}/></Card>:null}{canManageSeparations && item.status === "OPEN" ? <Button title="Fechar lista e gerar times" disabled={item.counts.present < 4} onPress={() => router.push({ pathname: "/new-separation", params: { matchId: item.id } } as never)}/> : null}</View>}
  /></Screen>;
}
function Count({ value, label, color }: { value: number; label: string; color: string }) { return <View style={styles.count}><Text style={[styles.countValue, { color }]}>{value}</Text><Text style={styles.countLabel}>{label}</Text></View>; }
function Roster({ item }: { item: ScheduledMatch }) { return <Card style={styles.roster}><Text style={styles.rosterTitle}>Presentes</Text><Text style={styles.names}>{item.attendance.filter(row => row.status === "PRESENT").map(row => row.playerName).join(", ") || "Ninguém ainda"}</Text>{item.guestPreconfirmation?.enabled ? <><Text style={[styles.rosterTitle, styles.waitingTitle]}>Lista de espera</Text><Text style={styles.names}>{item.preconfirmedGuests?.map(row => row.playerName).join(", ") || "Ninguém aguardando"}</Text></> : null}<Text style={[styles.rosterTitle, { marginTop: 12 }]}>Ausentes</Text><Text style={styles.names}>{item.attendance.filter(row => row.status === "ABSENT").map(row => row.playerName).join(", ") || "Ninguém ainda"}</Text></Card>; }
function MobileWeather({ weather }: { weather?: ScheduledMatch["weather"] }) {
  if (!weather) return <Card style={styles.weather}><Text style={styles.weatherTitle}>🌤️ Previsão do tempo</Text><Text style={styles.weatherHelp}>Aguardando atualização do servidor.</Text></Card>;
  if (weather.status !== "AVAILABLE") return <Card style={styles.weather}><Text style={styles.weatherTitle}>🌤️ Previsão do tempo</Text><Text style={styles.weatherHelp}>{weather.message || "Previsão indisponível."}</Text></Card>;
  const temperature = weather.temperatureMin === weather.temperatureMax ? `${weather.temperatureMin} °C` : `${weather.temperatureMin}–${weather.temperatureMax} °C`;
  return <Card style={styles.weather}><Text style={styles.weatherTitle}>{weather.icon || "🌤️"} {weather.description} · {temperature}</Text><View style={styles.weatherMetrics}><Text>💧 {weather.precipitationProbability ?? 0}% chuva</Text><Text>💨 {weather.windSpeed ?? 0} km/h</Text><Text>🌧️ {weather.precipitation ?? 0} mm</Text></View>{weather.usedDefaultLocation ? <Text style={styles.weatherWarning}>Local não encontrado; previsão pelo endereço padrão.</Text> : null}<Text style={styles.weatherHelp}>Previsão para 2 horas · atualizada {new Date(weather.fetchedAt).toLocaleString("pt-BR")} · {weather.source || "Serviço meteorológico"}</Text></Card>;
}
function dateTime(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "full", timeStyle: "short", timeZone: "America/Sao_Paulo" }).format(new Date(value)); }
const styles = StyleSheet.create({
  content: { padding: 20, gap: 12 }, info: { gap: 8 }, date: { color: colors.text, fontSize: 17, fontWeight: "900" }, location: { color: colors.muted }, deadline: { color: colors.yellow, fontWeight: "800" },
  weather: { gap: 8, marginTop: 14, marginBottom: 14, backgroundColor: "#F2F7F4" }, weatherTitle: { color: colors.text, fontSize: 17, fontWeight: "900" }, weatherMetrics: { flexDirection: "row", flexWrap: "wrap", gap: 12 }, weatherHelp: { color: colors.muted, fontSize: 11, lineHeight: 16 }, weatherWarning: { color: colors.yellow, fontSize: 11, fontWeight: "800" },
  counts: { flexDirection: "row", gap: 8, marginTop: 6 }, count: { flex: 1, padding: 10, borderRadius: 12, backgroundColor: "#F2F5F3", alignItems: "center" }, countValue: { fontSize: 24, fontWeight: "900" }, countLabel: { color: colors.muted, fontSize: 10 },
  answer: { gap: 10 }, answerTitle: { color: colors.text, fontSize: 18, fontWeight: "900" }, help: { color: colors.muted }, buttons: { gap: 8 }, warning: { color: colors.danger, fontWeight: "700" },
  roster: { marginTop: 12 }, rosterTitle: { color: colors.green, fontWeight: "900" }, waitingTitle: { color: colors.yellow, marginTop: 12 }, names: { color: colors.muted, lineHeight: 20, marginTop: 5 }, adminTitle: { color: colors.green, fontSize: 18, fontWeight: "900", marginTop: 10 },
  player: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12 },
  playerName: { color: colors.text, fontWeight: "900" }, playerMeta: { color: colors.muted, fontSize: 11, marginTop: 3 }, smallButton: { width: 40, height: 38, alignItems: "center", justifyContent: "center", borderRadius: 9, borderWidth: 1, borderColor: colors.border },
  smallPresent: { backgroundColor: colors.success, borderColor: colors.success }, smallAbsent: { backgroundColor: colors.danger, borderColor: colors.danger }, smallWaiting: { backgroundColor: "#FFF7D6", borderColor: colors.yellow }, smallOnText: { color: "#fff", fontSize: 18, fontWeight: "900" }, smallPresentText: { color: colors.success, fontSize: 18, fontWeight: "900" }, smallAbsentText: { color: colors.danger, fontSize: 18, fontWeight: "900" }, smallWaitingText: { color: colors.yellow, fontSize: 16, fontWeight: "900" },
  footer: { gap: 10, marginTop: 8 }, matchActions: { gap: 12, marginVertical: 12 }, smallDisabled: { opacity: .35 },
  draftInfo: { gap: 8, backgroundColor: "#F2F7F4" }, draftInfoStale: { backgroundColor: colors.yellowSoft, borderColor: colors.yellow }, draftTitle: { color: colors.text, fontSize: 16, fontWeight: "900" }, draftText: { color: colors.muted, lineHeight: 19 },
});
