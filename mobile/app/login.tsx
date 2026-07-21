import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { Redirect, useRouter } from "expo-router";
import * as Application from "expo-application";
import * as Linking from "expo-linking";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useAuth } from "@/auth";
import { API_BASE_URL, ApiError } from "@/api";
import { Button, Field } from "@/components";
import { colors } from "@/theme";

const schema = z.object({ email: z.email("Informe um e-mail válido."), password: z.string().min(1, "Informe sua senha.") });
type Form = z.infer<typeof schema>;

export default function Login() {
  const { account, login } = useAuth(), router = useRouter(), [visible, setVisible] = useState(false), [message, setMessage] = useState("");
  const { control, handleSubmit, formState: { errors, isSubmitting } } = useForm<Form>({ resolver: zodResolver(schema), defaultValues: { email: "", password: "" } });
  if (account) return <Redirect href="/separations"/>;
  const submit = handleSubmit(async values => { try { setMessage(""); await login(values.email, values.password); router.replace("/separations"); } catch (error) { setMessage(error instanceof ApiError ? error.message : "Não foi possível entrar."); } });
  return <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: colors.green }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 24 }}><View style={{ alignItems: "center", marginBottom: 32 }}><Text style={{ fontSize: 50 }}>⚽</Text><Text style={{ color: "#fff", fontSize: 31, fontWeight: "900" }}>Pelada</Text><Text style={{ color: "#BFE3D4", fontSize: 18, fontWeight: "700" }}>Pede Mais Uma</Text></View><View style={{ backgroundColor: colors.cream, padding: 20, borderRadius: 22, gap: 16 }}><Text accessibilityRole="header" style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>Entre para a partida</Text><Controller control={control} name="email" render={({ field }) => <Field label="E-mail" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.email?.message}/>}/><Controller control={control} name="password" render={({ field }) => <Field label="Senha" secureTextEntry={!visible} autoComplete="current-password" value={field.value} onChangeText={field.onChange} onBlur={field.onBlur} error={errors.password?.message}/>}/><Pressable accessibilityRole="button" onPress={() => setVisible(value => !value)} style={{ minHeight: 44, justifyContent: "center" }}><Text style={{ color: colors.green, fontWeight: "700" }}>{visible ? "Ocultar senha" : "Mostrar senha"}</Text></Pressable>{message ? <Text accessibilityRole="alert" style={{ color: colors.danger, fontWeight: "700" }}>{message}</Text> : null}<Button title="Entrar" busy={isSubmitting} onPress={submit}/><Pressable onPress={() => Linking.openURL(API_BASE_URL)} style={{ minHeight: 44, justifyContent: "center", alignItems: "center" }}><Text style={{ color: colors.green }}>Primeiro acesso ou esqueceu a senha? Use a aplicação web.</Text></Pressable></View><Text style={{ color: "#BFE3D4", textAlign: "center", fontSize: 12, marginTop: 20 }}>Versão {Application.nativeApplicationVersion || "desenvolvimento"} · {process.env.EXPO_PUBLIC_APP_ENV || "local"}\n{API_BASE_URL || "Servidor não configurado"}</Text></ScrollView></KeyboardAvoidingView>;
}
