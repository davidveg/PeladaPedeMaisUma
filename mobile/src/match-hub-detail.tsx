import { useCallback, useState } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "./api";
import { EmptyState, ErrorState, Screen } from "./components";
import { useMobileBranding } from "./branding";
import { colors } from "./theme";
import type { MatchHubItem, MatchHubPayload } from "./match-hub";
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
      <RoundCenter item={item} onNavigate={setSelected}/>
      <View style={styles.tabs}>{tabs.map(value => <Pressable key={value.id} accessibilityRole="tab" accessibilityState={{ selected: tab === value.id }} onPress={() => setSelected(value.id)} style={[styles.tab, { backgroundColor: tab === value.id ? palette.green : palette.card }]}><Text style={[styles.tabText, { color: tab === value.id ? "#fff" : palette.green }]}>{value.label}</Text></Pressable>)}</View>
      {panel === "attendance" && item.matchId ? <MatchAttendance key={item.matchId} id={item.matchId}/> : null}
      {panel === "legacy-attendance" ? <EmptyState title="Escalação do histórico" message="Esta escalação antiga não tem partida agendada vinculada nem lista de presenças registrada."/> : null}
      {panel === "separation" && item.separationId ? <SeparationDetail key={`${item.separationId}:${tab}`} id={item.separationId} section={tab}/> : null}
      {panel === "awaiting-teams" ? <EmptyState title="Times ainda não publicados" message="Os times desta partida aparecerão aqui após a publicação da escalação."/> : null}
      {panel === "unavailable" ? <EmptyState title="Ainda indisponível" message="A súmula e a votação ficam disponíveis após a publicação dos times."/> : null}
    </>}
  </View>;
}
function RoundCenter({ item, onNavigate }: { item: MatchHubItem; onNavigate(tab: string): void }) {
  const { palette } = useMobileBranding();
  const attendance: Record<string, string> = { PRESENT: "Presença confirmada", ABSENT: "Ausência informada", WAITLIST: "Lista de espera" };
  const vote: Record<string, string> = { AVAILABLE: "Voto pendente", DONE: "Voto registrado", NOT_PARTICIPANT: "Não participou", CLOSED: "Votação encerrada" };
  const weather = item.weatherSummary?.description ? `${item.weatherSummary.icon || ""} ${item.weatherSummary.description}`.trim() : "Previsão indisponível";
  return <View style={[styles.center, { backgroundColor: palette.card }]}><View style={styles.centerHead}><View style={{ flex: 1 }}><Text style={[styles.centerEyebrow, { color: palette.green }]}>CENTRAL DESTA RODADA</Text><Text style={[styles.centerTitle, { color: palette.text }]}>{item.status === "FINISHED" ? "Resultado e próximos passos" : "Tudo o que importa agora"}</Text></View>{item.nextAction ? <Pressable accessibilityRole="button" onPress={() => onNavigate(item.nextAction!.tab)} style={[styles.centerAction, { backgroundColor: palette.green }]}><Text style={styles.centerActionText}>{item.nextAction.label} →</Text></Pressable> : null}</View><View style={styles.centerGrid}><CenterTile icon="📅" label="Agenda" value={shortDate(item.date)} note={item.confirmationDeadline ? `Até ${shortDate(item.confirmationDeadline)}` : "Sem prazo"}/><CenterTile icon="👟" label="Minha situação" value={item.viewerAttendanceStatus ? attendance[item.viewerAttendanceStatus] || item.viewerAttendanceStatus : item.status === "OPEN" ? "Resposta pendente" : "Rodada encerrada"} note={item.present !== null ? `${item.present} presentes` : "Sem lista"}/><CenterTile icon="📍" label="Local e clima" value={item.location || "Não informado"} note={weather}/><CenterTile icon="🏆" label="Pós-jogo" value={item.viewerVoteStatus ? vote[item.viewerVoteStatus] || item.viewerVoteStatus : item.separationId ? "Times disponíveis" : "Aguardando times"} note={item.nextAction?.description || "Novidades aparecem aqui."}/></View>{item.personalHighlights?.length ? <View style={styles.personal}><Text style={{ color: palette.text, fontWeight: "900" }}>✨ Seus destaques</Text>{item.personalHighlights.map(value => <Text key={value} style={{ color: palette.text, fontSize: 12 }}>{value}</Text>)}</View> : null}</View>;
}
function CenterTile({ icon, label, value, note }: { icon: string; label: string; value: string; note: string }) {
  const { palette } = useMobileBranding();
  return <View style={[styles.centerTile, { borderColor: palette.border }]}><Text style={{ fontSize: 18 }}>{icon}</Text><View style={{ flex: 1 }}><Text style={[styles.centerLabel, { color: palette.green }]}>{label}</Text><Text style={{ color: palette.text, fontWeight: "800", fontSize: 12 }} numberOfLines={2}>{value}</Text><Text style={{ color: palette.muted, fontSize: 10, lineHeight: 14 }} numberOfLines={2}>{note}</Text></View></View>;
}
function shortDate(value?: string | null) {
  if (!value) return "Não informado";
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString("pt-BR", value.length === 10 ? { dateStyle: "short" } : { dateStyle: "short", timeStyle: "short" }) : value;
}
const styles = StyleSheet.create({
  back: { paddingHorizontal: 20, paddingVertical: 12, minHeight: 44 }, tabs: { flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 16, paddingBottom: 12 },
  tab: { width: "48%", flexGrow: 1, minHeight: 44, justifyContent: "center", alignItems: "center", padding: 9, borderWidth: 1, borderColor: colors.border, borderRadius: 10 }, tabText: { fontSize: 12, fontWeight: "800", textAlign: "center" },
  center: { marginHorizontal: 16, marginBottom: 12, padding: 13, borderRadius: 16, gap: 11 }, centerHead: { flexDirection: "row", alignItems: "center", gap: 10 }, centerEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1 }, centerTitle: { fontSize: 17, fontWeight: "900", marginTop: 2 }, centerAction: { maxWidth: "45%", minHeight: 40, justifyContent: "center", borderRadius: 10, paddingHorizontal: 10 }, centerActionText: { color: "#fff", fontSize: 11, fontWeight: "900", textAlign: "center" }, centerGrid: { flexDirection: "row", flexWrap: "wrap", gap: 7 }, centerTile: { width: "48%", flexGrow: 1, minHeight: 75, flexDirection: "row", gap: 7, borderWidth: 1, borderRadius: 10, padding: 9, backgroundColor: "#fff" }, centerLabel: { fontSize: 8, fontWeight: "900", textTransform: "uppercase", letterSpacing: .5 }, personal: { gap: 3, padding: 9, borderRadius: 9, backgroundColor: "#FFF8DC" },
});
