import { useEffect, useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { API_BASE_URL, ApiError, apiFetch, jsonMutation } from "@/api";
import { Button, Card, Field, Header, Screen } from "@/components";
import { passwordResetEndpoint } from "@/password-recovery";
import { colors } from "@/theme";
import type { Account, NotificationPreferences, PlayerAbsence } from "@/types";

export default function AccountScreen() {
  const { account, logout } = useAuth(), router = useRouter(), client = useQueryClient();
  const [recovery, setRecovery] = useState(false);
  const confirm = () => Alert.alert("Sair do aplicativo?", "A sessão deste aparelho será revogada.", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: async () => { await logout(); client.clear(); router.replace("/login"); } }]);
  return <Screen><Header title="Conta"/><ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}><Card style={{ gap: 8 }}><Text style={{ fontSize: 18, color: colors.text, fontWeight: "800" }}>{account?.email}</Text><Text style={{ color: colors.muted }}>{account?.role === "admin" ? "Administrador" : account?.role === "moderator" ? "Moderador" : "Jogador"}</Text>{!account?.playerId ? <Text style={{ color: colors.yellow, fontWeight: "700" }}>Esta conta ainda não está associada a um jogador. Faça a associação no site.</Text> : null}</Card>
    <Card style={{ gap: 10 }}><Text style={{ fontWeight: "900", color: colors.text, fontSize: 17 }}>Números da pelada</Text><Text style={{ color: colors.muted, lineHeight: 20 }}>Rankings, destaques mensais, confrontos e análises de todos os jogadores.</Text><Button title="Estatísticas da pelada" icon="bar-chart" variant="secondary" onPress={() => router.push("/statistics" as never)}/></Card>
    {account?.playerId ? <PlayerAbsenceCard/> : null}
    <Card style={{ gap: 10 }}><Text style={{ fontWeight: "900", color: colors.text, fontSize: 17 }}>Segurança</Text><Text style={{ color: colors.muted, lineHeight: 20 }}>Solicite um link de uso único para redefinir sua senha. O link expira em 30 minutos.</Text><Button title="Redefinir minha senha" variant="secondary" onPress={() => setRecovery(true)}/></Card><NotificationPreferencesCard/><Card style={{ gap: 8 }}><Text style={{ fontWeight: "800", color: colors.text }}>Ambiente</Text><Text style={{ color: colors.muted }}>Versão {Application.nativeApplicationVersion || "desenvolvimento"}</Text><Text selectable style={{ color: colors.muted }}>{API_BASE_URL}</Text></Card><Button title="Sair com segurança" variant="danger" onPress={confirm}/></ScrollView>{account && recovery ? <AccountPasswordRecovery account={account} onClose={() => setRecovery(false)}/> : null}</Screen>;
}

function PlayerAbsenceCard() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["player-absence"], queryFn: () => apiFetch<{ absence: PlayerAbsence | null }>("/api/player-absence") });
  const [startDate, setStartDate] = useState(""), [endDate, setEndDate] = useState(""), [reason, setReason] = useState("");
  const [formError, setFormError] = useState("");
  const absence = query.data?.absence || null;
  useEffect(() => {
    if (!query.isSuccess) return;
    setStartDate(absence ? isoToBrDate(absence.startDate) : "");
    setEndDate(absence ? isoToBrDate(absence.endDate) : "");
    setReason(absence?.reason || "");
  }, [query.isSuccess, absence?.id, absence?.updatedAt]);
  const save = useMutation({
    mutationFn: async () => {
      const start = brDateToIso(startDate), end = brDateToIso(endDate);
      if (!start || !end) throw new Error("Informe as datas no formato DD/MM/AAAA.");
      return apiFetch<{ absence: PlayerAbsence; message: string }>("/api/player-absence", jsonMutation("PUT", { startDate: start, endDate: end, reason }));
    },
    onMutate: () => setFormError(""),
    onSuccess: result => {
      client.setQueryData(["player-absence"], { absence: result.absence });
      Alert.alert("Ausência programada", result.message);
    },
    onError: error => setFormError((error as Error).message),
  });
  const remove = useMutation({
    mutationFn: () => apiFetch<{ absence: null; message: string }>("/api/player-absence", { method: "DELETE" }),
    onSuccess: result => {
      client.setQueryData(["player-absence"], { absence: null });
      setStartDate(""); setEndDate(""); setReason(""); setFormError("");
      Alert.alert("Período removido", result.message);
    },
    onError: error => setFormError((error as Error).message),
  });
  const confirmRemoval = () => Alert.alert(
    "Remover período de ausência?",
    "As partidas que continuam abertas voltarão ao estado anterior.",
    [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: () => remove.mutate() }],
  );
  return <Card style={{ gap: 14 }}><View style={{ gap: 5 }}><View style={absenceStyles.titleRow}><Text style={absenceStyles.heading}>Período de ausência</Text>{absence ? <Text style={absenceStyles.badge}>Configurado</Text> : null}</View><Text style={absenceStyles.description}>Informe férias, lesão ou outro afastamento. Você será marcado como ausente nas partidas abertas dentro do intervalo, sem consumir remarcações.</Text></View>
    {query.isError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{(query.error as Error).message}</Text> : query.isLoading ? <Text style={{ color: colors.muted }}>Carregando período…</Text> : <>
      <View style={absenceStyles.dateRow}><View style={{ flex: 1 }}><Field label="De" placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} value={startDate} onChangeText={value => setStartDate(formatBrDateInput(value))}/></View><View style={{ flex: 1 }}><Field label="Até" placeholder="DD/MM/AAAA" keyboardType="number-pad" maxLength={10} value={endDate} onChangeText={value => setEndDate(formatBrDateInput(value))}/></View></View>
      <Field label="Motivo (opcional)" placeholder="Ex.: férias ou recuperação de lesão" maxLength={160} value={reason} onChangeText={setReason}/>
      {formError ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: "700" }}>{formError}</Text> : null}
      <Text style={absenceStyles.note}>O intervalo inclui as duas datas. Alterações restauram respostas anteriores apenas nas partidas ainda abertas.</Text>
      <Button title={absence ? "Atualizar período" : "Salvar período"} busy={save.isPending} disabled={remove.isPending} onPress={() => save.mutate()}/>
      {absence ? <Button title="Remover período" variant="danger" busy={remove.isPending} disabled={save.isPending} onPress={confirmRemoval}/> : null}
    </>}
  </Card>;
}

export function formatBrDateInput(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  return [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)].filter(Boolean).join("/");
}

export function brDateToIso(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return "";
  const iso = `${match[3]}-${match[2]}-${match[1]}`;
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : "";
}

function isoToBrDate(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : "";
}

function NotificationPreferencesCard() {
  const client = useQueryClient();
  const query = useQuery({ queryKey: ["notification-preferences"], queryFn: () => apiFetch<{ preferences: NotificationPreferences }>("/api/notification-preferences") });
  const [draft, setDraft] = useState<NotificationPreferences | null>(null);
  const preferences = draft || query.data?.preferences || null;
  const save = useMutation({
    mutationFn: () => apiFetch<{ preferences: NotificationPreferences; message: string }>("/api/notification-preferences", jsonMutation("PUT", preferences)),
    onSuccess: result => {
      setDraft(result.preferences);
      client.setQueryData(["notification-preferences"], { preferences: result.preferences });
      client.invalidateQueries({ queryKey: ["notifications"] });
      Alert.alert("Preferências salvas", result.message);
    },
  });
  const set = (key: keyof NotificationPreferences, value: boolean | number) => {
    if (!preferences) return;
    setDraft({ ...preferences, [key]: value });
  };
  const disableAll = () => {
    if (!preferences) return;
    setDraft({
      ...preferences, attendanceInApp: false, attendancePush: false, matchesInApp: false,
      matchesPush: false, separationsInApp: false, separationsPush: false,
      appUpdatesInApp: false, appUpdatesPush: false, careerVotesPush: false,
    });
  };
  const rows = [
    { label: "Confirmações e ausências", inApp: "attendanceInApp", push: "attendancePush" },
    { label: "Partidas criadas ou alteradas", inApp: "matchesInApp", push: "matchesPush" },
    { label: "Escalações prontas", inApp: "separationsInApp", push: "separationsPush" },
    { label: "Atualizações do aplicativo", inApp: "appUpdatesInApp", push: "appUpdatesPush" },
  ] as const;
  return <Card style={{ gap: 14 }}><View style={{ gap: 5 }}><Text style={preferenceStyles.heading}>Notificações e pushes</Text><Text style={preferenceStyles.description}>Escolha o que aparece em Avisos e o que chega à central de notificações do celular.</Text></View>
    {query.isError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{(query.error as Error).message}</Text> : !preferences ? <Text style={{ color: colors.muted }}>Carregando preferências…</Text> : <>
      <View style={preferenceStyles.header}><Text style={{ flex: 1 }}>Tipo</Text><Text style={preferenceStyles.column}>Avisos</Text><Text style={preferenceStyles.column}>Push</Text></View>
      {rows.map(row => <View key={row.label} style={preferenceStyles.row}><Text style={preferenceStyles.label}>{row.label}</Text><Switch accessibilityLabel={`${row.label} nos avisos`} value={preferences[row.inApp]} onValueChange={value => set(row.inApp, value)} trackColor={{ true: "#79A894" }} thumbColor={preferences[row.inApp] ? colors.green : "#F1F1F1"}/><Switch accessibilityLabel={`${row.label} por push`} value={preferences[row.push]} onValueChange={value => set(row.push, value)} trackColor={{ true: "#79A894" }} thumbColor={preferences[row.push] ? colors.green : "#F1F1F1"}/></View>)}
      <View style={preferenceStyles.row}><Text style={preferenceStyles.label}>Votações pós-jogo</Text><Text style={preferenceStyles.notAvailable}>—</Text><Switch accessibilityLabel="Votações pós-jogo por push" value={preferences.careerVotesPush} onValueChange={value => set("careerVotesPush", value)} trackColor={{ true: "#79A894" }} thumbColor={preferences.careerVotesPush ? colors.green : "#F1F1F1"}/></View>
      <View style={{ gap: 8 }}><Text style={preferenceStyles.pageTitle}>Notificações por página</Text><View style={preferenceStyles.pageSizes}>{[10, 20, 50].map(size => <View key={size} style={{ flex: 1 }}><Button title={String(size)} variant={preferences.pageSize === size ? "primary" : "secondary"} onPress={() => set("pageSize", size)}/></View>)}</View></View>
      {save.isError ? <Text accessibilityRole="alert" style={{ color: colors.danger }}>{(save.error as Error).message}</Text> : null}
      <Button title="Desativar tudo" variant="secondary" onPress={disableAll}/><Button title="Salvar preferências" busy={save.isPending} onPress={() => save.mutate()}/>
    </>}
  </Card>;
}

function AccountPasswordRecovery({ account, onClose }: { account: Account; onClose(): void }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function send() {
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiFetch<{ message: string }>(passwordResetEndpoint(account.role), jsonMutation("POST", { email: account.email }));
      setNotice(result.message);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível solicitar a redefinição.");
    } finally { setBusy(false); }
  }
  return <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.cream }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 }}><Text style={{ fontSize: 44, textAlign: "center" }}>🔐</Text><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center" }}>Redefinir minha senha</Text><Text style={{ color: colors.muted, textAlign: "center", lineHeight: 21 }}>Enviaremos um link de uso único para o e-mail autenticado. Ao concluir a troca, todas as sessões web e mobile serão encerradas.</Text>{error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: "700" }}>{error}</Text> : null}{notice ? <View style={{ backgroundColor: "#E5F4EA", padding: 14, borderRadius: 12, gap: 5 }}><Text accessibilityRole="alert" style={{ color: colors.success, fontWeight: "900" }}>{notice}</Text><Text style={{ color: colors.muted, lineHeight: 20 }}>Confira também a pasta de spam. Depois de trocar a senha, entre novamente no aplicativo.</Text></View> : null}<Field label="E-mail da conta" value={account.email} editable={false}/><Button title={notice ? "Solicitar novo link" : "Enviar link de redefinição"} busy={busy} onPress={send}/><Button title="Voltar para a conta" variant="secondary" disabled={busy} onPress={onClose}/></ScrollView></KeyboardAvoidingView></Modal>;
}

const preferenceStyles = {
  heading: { fontWeight: "900", color: colors.text, fontSize: 17 } as const,
  description: { color: colors.muted, lineHeight: 20 } as const,
  header: { flexDirection: "row", alignItems: "center", paddingBottom: 4 } as const,
  column: { width: 56, textAlign: "center", color: colors.muted, fontSize: 11, fontWeight: "800" } as const,
  row: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 52, borderTopWidth: 1, borderTopColor: colors.border } as const,
  label: { flex: 1, color: colors.text, fontWeight: "700", fontSize: 13 } as const,
  notAvailable: { width: 50, textAlign: "center", color: colors.muted } as const,
  pageTitle: { color: colors.text, fontWeight: "800", fontSize: 13 } as const,
  pageSizes: { flexDirection: "row", gap: 8 } as const,
};

const absenceStyles = {
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 } as const,
  heading: { flex: 1, fontWeight: "900", color: colors.text, fontSize: 17 } as const,
  badge: { color: colors.green, backgroundColor: "#E5F4EA", borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5, fontWeight: "900", fontSize: 10 } as const,
  description: { color: colors.muted, lineHeight: 20 } as const,
  dateRow: { flexDirection: "row", gap: 10 } as const,
  note: { color: colors.muted, fontSize: 12, lineHeight: 18 } as const,
};
