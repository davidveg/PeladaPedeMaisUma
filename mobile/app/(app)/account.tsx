import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { API_BASE_URL, ApiError, apiFetch, jsonMutation } from "@/api";
import { Button, Card, Field, Header, Screen } from "@/components";
import { passwordResetEndpoint } from "@/password-recovery";
import { colors } from "@/theme";
import type { Account, NotificationPreferences } from "@/types";

export default function AccountScreen() {
  const { account, logout } = useAuth(), router = useRouter(), client = useQueryClient();
  const [recovery, setRecovery] = useState(false);
  const confirm = () => Alert.alert("Sair do aplicativo?", "A sessão deste aparelho será revogada.", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: async () => { await logout(); client.clear(); router.replace("/login"); } }]);
  return <Screen><Header title="Conta"/><ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}><Card style={{ gap: 8 }}><Text style={{ fontSize: 18, color: colors.text, fontWeight: "800" }}>{account?.email}</Text><Text style={{ color: colors.muted }}>{account?.role === "admin" ? "Administrador" : "Jogador"}</Text>{!account?.playerId ? <Text style={{ color: colors.yellow, fontWeight: "700" }}>Esta conta ainda não está associada a um jogador. Faça a associação no site.</Text> : null}</Card><Card style={{ gap: 10 }}><Text style={{ fontWeight: "900", color: colors.text, fontSize: 17 }}>Segurança</Text><Text style={{ color: colors.muted, lineHeight: 20 }}>Solicite um link de uso único para redefinir sua senha. O link expira em 30 minutos.</Text><Button title="Redefinir minha senha" variant="secondary" onPress={() => setRecovery(true)}/></Card><NotificationPreferencesCard/><Card style={{ gap: 8 }}><Text style={{ fontWeight: "800", color: colors.text }}>Ambiente</Text><Text style={{ color: colors.muted }}>Versão {Application.nativeApplicationVersion || "desenvolvimento"}</Text><Text selectable style={{ color: colors.muted }}>{API_BASE_URL}</Text></Card><Button title="Sair com segurança" variant="danger" onPress={confirm}/></ScrollView>{account && recovery ? <AccountPasswordRecovery account={account} onClose={() => setRecovery(false)}/> : null}</Screen>;
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
      matchesPush: false, separationsInApp: false, separationsPush: false, careerVotesPush: false,
    });
  };
  const rows = [
    { label: "Confirmações e ausências", inApp: "attendanceInApp", push: "attendancePush" },
    { label: "Partidas criadas ou alteradas", inApp: "matchesInApp", push: "matchesPush" },
    { label: "Separações prontas", inApp: "separationsInApp", push: "separationsPush" },
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
