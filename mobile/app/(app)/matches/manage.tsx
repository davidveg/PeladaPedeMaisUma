import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { apiFetch, jsonMutation } from "@/api";
import { useAuth } from "@/auth";
import { Button, Card, ErrorState, Field, Header, Screen } from "@/components";
import { colors } from "@/theme";
import type { MatchListPayload, ScheduledMatch } from "@/types";
import { useMobileBranding } from "@/branding";
import { hasPermission, MODERATOR_PERMISSIONS } from "@/moderator-permissions";

export default function ManageMatch() {
  const { id } = useLocalSearchParams<{ id?: string }>(), { account } = useAuth(), router = useRouter(), client = useQueryClient();
  const canManageMatches = hasPermission(account, MODERATOR_PERMISSIONS.MATCHES_MANAGE);
  const query = useQuery({ queryKey: ["matches"], queryFn: () => apiFetch<MatchListPayload>("/api/admin/matches"), enabled: canManageMatches });
  const existing = query.data?.matches.find(item => item.id === id);
  if (!canManageMatches) return <Screen><ErrorState message="Sua conta não possui permissão para configurar partidas."/></Screen>;
  if (id && query.isLoading) return <Screen><Header title="Configurar partida"/></Screen>;
  if (id && !existing) return <Screen><ErrorState message="Partida não encontrada." retry={() => query.refetch()}/></Screen>;
  return <MatchForm key={existing?.updatedAt || "new"} existing={existing} onSaved={async () => { await client.invalidateQueries({ queryKey: ["matches"] }); router.back(); }} onCancel={() => router.back()}/>;
}

function MatchForm({ existing, onSaved, onCancel }: { existing?: ScheduledMatch; onSaved(): Promise<void>; onCancel(): void }) {
  const { config: instance } = useMobileBranding();
  const [defaults] = useState(() => nextMatchDefaults(instance));
  const matchParts = existing ? dateParts(existing.matchAt) : defaults.match;
  const deadlineParts = existing ? dateParts(existing.confirmationDeadline) : defaults.deadline;
  const defaultGuestOpening = new Date(new Date(brazilianDateTime(matchParts.date, matchParts.time)).getTime() - Number(instance.guestSelfConfirmationLeadHours ?? 48) * 3_600_000).toISOString();
  const guestParts = existing?.guestConfirmation?.opensAt ? dateParts(existing.guestConfirmation.opensAt) : dateParts(defaultGuestOpening);
  const guestOpeningMatchesDefault = Boolean(existing?.guestConfirmation?.opensAt && Math.abs(new Date(existing.matchAt).getTime() - new Date(existing.guestConfirmation.opensAt).getTime() - Number(instance.guestSelfConfirmationLeadHours ?? 48) * 3_600_000) < 1_000);
  const [title, setTitle] = useState(existing?.title || instance.defaultMatchTitle || "Pelada"), [location, setLocation] = useState(existing?.location || instance.defaultMatchLocation || "Rio de Janeiro, Brasil");
  const [matchDate, setMatchDate] = useState(matchParts.date), [matchTime, setMatchTime] = useState(matchParts.time);
  const [deadlineDate, setDeadlineDate] = useState(deadlineParts.date), [deadlineTime, setDeadlineTime] = useState(deadlineParts.time);
  const [guestConfirmationEnabled, setGuestConfirmationEnabled] = useState(existing ? Boolean(existing.guestConfirmation?.opensAt) : Boolean(instance.guestSelfConfirmationEnabled));
  const [guestConfirmationDate, setGuestConfirmationDate] = useState(guestParts.date), [guestConfirmationTime, setGuestConfirmationTime] = useState(guestParts.time);
  const [guestOpeningCustomized, setGuestOpeningCustomized] = useState(Boolean(existing?.guestConfirmation?.opensAt) && !guestOpeningMatchesDefault);
  const [maxChanges, setMaxChanges] = useState(String(existing?.maxChanges ?? 2)), [validation, setValidation] = useState("");
  useEffect(() => {
    if ((existing && !guestOpeningMatchesDefault) || guestOpeningCustomized) return;
    const nextMatchAt = brazilianDateTime(matchDate, matchTime);
    if (!nextMatchAt) return;
    const next = dateParts(new Date(new Date(nextMatchAt).getTime() - Number(instance.guestSelfConfirmationLeadHours ?? 48) * 3_600_000).toISOString());
    setGuestConfirmationDate(next.date); setGuestConfirmationTime(next.time);
  }, [existing, matchDate, matchTime, guestOpeningCustomized, guestOpeningMatchesDefault, instance.guestSelfConfirmationLeadHours]);
  const mutation = useMutation({
    mutationFn: async () => {
      const matchAt = brazilianDateTime(matchDate, matchTime), confirmationDeadline = brazilianDateTime(deadlineDate, deadlineTime);
      const guestConfirmationOpensAt = guestConfirmationEnabled ? guestOpeningCustomized
        ? brazilianDateTime(guestConfirmationDate, guestConfirmationTime)
        : new Date(new Date(matchAt).getTime() - Number(instance.guestSelfConfirmationLeadHours ?? 48) * 3_600_000).toISOString()
        : null;
      const changes = Number(maxChanges);
      if (!title.trim()) throw new Error("Informe o título da partida.");
      if (!matchAt || !confirmationDeadline) throw new Error("Use data DD/MM/AAAA e hora HH:MM válidas.");
      if (guestConfirmationEnabled && !guestConfirmationOpensAt) throw new Error("Informe quando os convidados poderão confirmar.");
      if (!Number.isInteger(changes) || changes < 0 || changes > 20) throw new Error("O limite de remarcações deve ficar entre 0 e 20.");
      if (new Date(confirmationDeadline).getTime() > new Date(matchAt).getTime()) throw new Error("O prazo deve terminar antes do início do jogo.");
      if (guestConfirmationOpensAt && new Date(guestConfirmationOpensAt).getTime() > new Date(confirmationDeadline).getTime()) throw new Error("A liberação dos convidados deve ocorrer antes do prazo geral.");
      return apiFetch("/api/admin/matches", jsonMutation(existing ? "PATCH" : "POST", {
        ...(existing ? { action: "update", matchId: existing.id } : {}),
        title: title.trim(), location: location.trim(), matchAt, confirmationDeadline, guestConfirmationEnabled, guestConfirmationOpensAt, maxChanges: changes,
      }));
    },
    onSuccess: () => onSaved(),
    onError: error => setValidation((error as Error).message),
  });
  return <Screen><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><Header eyebrow="ADMINISTRAÇÃO" title={existing ? "Editar partida" : "Criar partida"}/><Card style={styles.form}><Text style={styles.help}>A data sugerida usa {weekdayLabel(instance.defaultMatchWeekday)} às {instance.defaultMatchTime}, com confirmações encerradas {leadLabel(instance.confirmationLeadMinutes)} antes. Todos os campos continuam editáveis.</Text>{validation ? <Text style={styles.error}>{validation}</Text> : null}<Field label="Título" value={title} onChangeText={setTitle} maxLength={120}/><Field label="Local" value={location} onChangeText={setLocation} maxLength={160}/><Field label="Data do jogo (DD/MM/AAAA)" value={matchDate} onChangeText={setMatchDate} keyboardType="numbers-and-punctuation" maxLength={10}/><Field label="Hora do jogo (HH:MM)" value={matchTime} onChangeText={setMatchTime} keyboardType="numbers-and-punctuation" maxLength={5}/><Field label="Confirmar até (DD/MM/AAAA)" value={deadlineDate} onChangeText={setDeadlineDate} keyboardType="numbers-and-punctuation" maxLength={10}/><Field label="Horário limite (HH:MM)" value={deadlineTime} onChangeText={setDeadlineTime} keyboardType="numbers-and-punctuation" maxLength={5}/><Field label="Máximo de remarcações" value={maxChanges} onChangeText={setMaxChanges} keyboardType="number-pad" maxLength={2}/>{instance.guestSelfConfirmationEnabled?<><View style={styles.switchRow}><View style={styles.switchCopy}><Text style={styles.switchTitle}>Liberar esta partida para convidados</Text><Text style={styles.help}>Ativada por padrão com {instance.guestSelfConfirmationLeadHours??48} horas de antecedência. Você pode ajustar ou desativar nesta partida.</Text></View><Switch value={guestConfirmationEnabled} onValueChange={setGuestConfirmationEnabled}/></View>{guestConfirmationEnabled?<><Field label="Liberar convidados em (DD/MM/AAAA)" value={guestConfirmationDate} onChangeText={value=>{setGuestOpeningCustomized(true);setGuestConfirmationDate(value);}} keyboardType="numbers-and-punctuation" maxLength={10}/><Field label="Horário de liberação (HH:MM)" value={guestConfirmationTime} onChangeText={value=>{setGuestOpeningCustomized(true);setGuestConfirmationTime(value);}} keyboardType="numbers-and-punctuation" maxLength={5}/></>:null}</>:null}<Button title={existing ? "Salvar e notificar" : "Criar e notificar"} busy={mutation.isPending} onPress={() => { setValidation(""); mutation.mutate(); }}/><Button title="Cancelar" variant="secondary" disabled={mutation.isPending} onPress={() => Alert.alert("Descartar alterações?", "", [{ text: "Continuar editando", style: "cancel" }, { text: "Descartar", style: "destructive", onPress: onCancel }])}/></Card></ScrollView></KeyboardAvoidingView></Screen>;
}

function nextMatchDefaults(config: { defaultMatchWeekday: number; defaultMatchTime: string; confirmationLeadMinutes: number }) {
  const now = new Date(), weekday = Number(config.defaultMatchWeekday ?? 0);
  const [hour, minute] = String(config.defaultMatchTime || "09:00").split(":").map(Number);
  let days = (weekday - now.getDay() + 7) % 7;
  const todayMatch = new Date(now); todayMatch.setHours(hour, minute, 0, 0);
  if (days === 0 && todayMatch.getTime() <= now.getTime()) days = 7;
  const match = new Date(now); match.setDate(now.getDate() + days); match.setHours(hour, minute, 0, 0);
  const deadline = new Date(match.getTime() - Number(config.confirmationLeadMinutes ?? 60) * 60_000);
  const parts = (value: Date) => ({ date: `${String(value.getDate()).padStart(2, "0")}/${String(value.getMonth() + 1).padStart(2, "0")}/${value.getFullYear()}`, time: `${String(value.getHours()).padStart(2, "0")}:${String(value.getMinutes()).padStart(2, "0")}` });
  return { match: parts(match), deadline: parts(deadline) };
}
function weekdayLabel(day: number) { return ["domingo","segunda-feira","terça-feira","quarta-feira","quinta-feira","sexta-feira","sábado"][day] || "dia configurado"; }
function leadLabel(minutes: number) { if (minutes % 1440 === 0) return `${minutes / 1440} dia(s)`; if (minutes % 60 === 0) return `${minutes / 60} hora(s)`; return `${minutes} minuto(s)`; }
function dateParts(value: string) {
  const parts = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value));
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find(item => item.type === type)?.value || "";
  return { date: `${part("day")}/${part("month")}/${part("year")}`, time: `${part("hour")}:${part("minute")}` };
}
function brazilianDateTime(dateValue: string, timeValue: string) {
  const date = dateValue.match(/^(\d{2})\/(\d{2})\/(\d{4})$/), time = timeValue.match(/^(\d{2}):(\d{2})$/);
  if (!date || !time) return "";
  const day = Number(date[1]), month = Number(date[2]), year = Number(date[3]), hour = Number(time[1]), minute = Number(time[2]);
  if (year < 2020 || month < 1 || month > 12 || day < 1 || day > new Date(year, month, 0).getDate() || hour > 23 || minute > 59) return "";
  return `${date[3]}-${date[2]}-${date[1]}T${time[1]}:${time[2]}:00-03:00`;
}
const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40 }, form: { gap: 14 }, help: { color: colors.muted, lineHeight: 20 }, error: { color: colors.danger, fontWeight: "800", backgroundColor: colors.dangerSoft, padding: 12, borderRadius: 10 }, switchRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 6 }, switchCopy: { flex: 1 }, switchTitle: { color: colors.text, fontWeight: "800", marginBottom: 4 },
});
