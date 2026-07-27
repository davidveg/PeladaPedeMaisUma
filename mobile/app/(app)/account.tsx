import { useState } from "react";
import { Alert, KeyboardAvoidingView, Modal, Platform, ScrollView, Text, View } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { API_BASE_URL, ApiError, apiFetch, jsonMutation } from "@/api";
import { Button, Card, Field, Header, Screen } from "@/components";
import { passwordResetEndpoint } from "@/password-recovery";
import { colors } from "@/theme";
import type { Account } from "@/types";

export default function AccountScreen() {
  const { account, logout } = useAuth(), router = useRouter(), client = useQueryClient();
  const [recovery, setRecovery] = useState(false);
  const confirm = () => Alert.alert("Sair do aplicativo?", "A sessão deste aparelho será revogada.", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: async () => { await logout(); client.clear(); router.replace("/login"); } }]);
  return <Screen><Header title="Conta"/><ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}><Card style={{ gap: 8 }}><Text style={{ fontSize: 18, color: colors.text, fontWeight: "800" }}>{account?.email}</Text><Text style={{ color: colors.muted }}>{account?.role === "admin" ? "Administrador" : "Jogador"}</Text>{!account?.playerId ? <Text style={{ color: colors.yellow, fontWeight: "700" }}>Esta conta ainda não está associada a um jogador. Faça a associação no site.</Text> : null}</Card><Card style={{ gap: 10 }}><Text style={{ fontWeight: "900", color: colors.text, fontSize: 17 }}>Segurança</Text><Text style={{ color: colors.muted, lineHeight: 20 }}>Solicite um link de uso único para redefinir sua senha. O link expira em 30 minutos.</Text><Button title="Redefinir minha senha" variant="secondary" onPress={() => setRecovery(true)}/></Card><Card style={{ gap: 8 }}><Text style={{ fontWeight: "800", color: colors.text }}>Ambiente</Text><Text style={{ color: colors.muted }}>Versão {Application.nativeApplicationVersion || "desenvolvimento"}</Text><Text selectable style={{ color: colors.muted }}>{API_BASE_URL}</Text></Card><Button title="Sair com segurança" variant="danger" onPress={confirm}/></ScrollView>{account && recovery ? <AccountPasswordRecovery account={account} onClose={() => setRecovery(false)}/> : null}</Screen>;
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
