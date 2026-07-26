import { useState } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as Application from "expo-application";
import * as Linking from "expo-linking";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/auth";
import { API_BASE_URL, ApiError, apiFetch, jsonMutation } from "@/api";
import { Button, Field } from "@/components";
import { colors } from "@/theme";

const schema = z.object({ email: z.email("Informe um e-mail válido."), password: z.string().min(1, "Informe sua senha.") });
type Form = z.infer<typeof schema>;

export default function Login() {
  const { account, login } = useAuth(), router = useRouter(), [visible, setVisible] = useState(false), [recovery, setRecovery] = useState(false), [message, setMessage] = useState("");
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  if (account) return <Redirect href="/separations"/>;
  const submit = handleSubmit(async values => { try { setMessage(""); await login(values.email, values.password); router.replace("/separations"); } catch (error) { setMessage(error instanceof ApiError ? error.message : "Não foi possível entrar."); } });
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.green }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}><View style={{ alignItems: "center", marginBottom: 32 }}><Text style={{ fontSize: 50 }}>⚽</Text><Text style={{ color: "#fff", fontSize: 31, fontWeight: "900" }}>Pelada</Text><Text style={{ color: "#BFE3D4", fontSize: 18, fontWeight: "700" }}>Pede Mais Uma</Text></View><View style={{ backgroundColor: colors.cream, padding: 20, borderRadius: 22, gap: 16 }}><Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>Entre para a partida</Text><Controller control={control} name="email" render={({ field }) => <Field label="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message}/>}/><Controller control={control} name="password" render={({ field }) => <Field label="Senha" secureTextEntry={!visible} autoComplete="current-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message}/>}/><View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}><Pressable accessibilityRole="button" onPress={() => setVisible(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.green, fontWeight: "700" }}>{visible ? "Ocultar senha" : "Mostrar senha"}</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setRecovery(true)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.green, fontWeight: "800" }}>Esqueci minha senha</Text></Pressable></View>{message ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: "700" }}>{message}</Text> : null}<Button title="Entrar" busy={isSubmitting} onPress={submit}/><Pressable onPress={() => API_BASE_URL && Linking.openURL(`${API_BASE_URL}/conta`)} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.green }}>Primeiro acesso? Use a aplicação web.</Text></Pressable></View><Text style={{ color: "#BFE3D4", textAlign: "center", fontSize: 12, marginTop: 20 }}>Versão {Application.nativeApplicationVersion || "desenvolvimento"} · {process.env.EXPO_PUBLIC_APP_ENV || "local"}\n{API_BASE_URL || "Servidor não configurado"}</Text></ScrollView><PasswordRecoveryModal visible={recovery} onClose={() => setRecovery(false)}/></KeyboardAvoidingView>;
}

function PasswordRecoveryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [email, setEmail] = useState(""), [busy, setBusy] = useState(false), [error, setError] = useState(""), [notice, setNotice] = useState("");
  async function send() {
    if (!z.email().safeParse(email.trim()).success) { setError("Informe um e-mail válido."); return; }
    setBusy(true); setError(""); setNotice("");
    try {
      const result = await apiFetch<{ message: string }>("/api/member-password-reset", jsonMutation("POST", { email }));
      setNotice(result.message);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Não foi possível solicitar a recuperação.");
    } finally { setBusy(false); }
  }
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.cream }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24, gap: 16 }}><Text style={{ fontSize: 44, textAlign: "center" }}>✉️</Text><Text accessibilityRole="header" style={{ color: colors.text, fontSize: 26, fontWeight: "900", textAlign: "center" }}>Recuperar senha</Text><Text style={{ color: colors.muted, textAlign: "center", lineHeight: 21 }}>Enviaremos um link de uso único para o e-mail da sua conta de jogador.</Text>{error ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: "700" }}>{error}</Text> : null}{notice ? <Text accessibilityRole="alert" style={{ color: colors.success, fontWeight: "800", lineHeight: 21 }}>{notice}</Text> : null}<Field label="E-mail cadastrado" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail}/><Button title="Enviar link de recuperação" busy={busy} onPress={send}/><Button title="Voltar ao login" variant="secondary" onPress={onClose}/></ScrollView></KeyboardAvoidingView></Modal>;
}
