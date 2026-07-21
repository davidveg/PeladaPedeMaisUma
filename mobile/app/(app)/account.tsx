import { Alert, ScrollView, Text } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/auth";
import { API_BASE_URL } from "@/api";
import { Button, Card, Header, Screen } from "@/components";
import { colors } from "@/theme";

export default function AccountScreen() { const { account, logout } = useAuth(), router = useRouter(), client = useQueryClient(); const confirm = () => Alert.alert("Sair do aplicativo?", "A sessão deste aparelho será revogada.", [{ text: "Cancelar", style: "cancel" }, { text: "Sair", style: "destructive", onPress: async () => { await logout(); client.clear(); router.replace("/login"); } }]); return <Screen><Header title="Conta"/><ScrollView contentContainerStyle={{ padding: 20, gap: 14 }}><Card style={{ gap: 8 }}><Text style={{ fontSize: 18, color: colors.text, fontWeight: "800" }}>{account?.email}</Text><Text style={{ color: colors.muted }}>{account?.role === "admin" ? "Administrador" : "Jogador"}</Text>{!account?.playerId ? <Text style={{ color: colors.yellow, fontWeight: "700" }}>Esta conta ainda não está associada a um jogador. Faça a associação no site.</Text> : null}</Card><Card style={{ gap: 8 }}><Text style={{ fontWeight: "800", color: colors.text }}>Ambiente</Text><Text style={{ color: colors.muted }}>Versão {Application.nativeApplicationVersion || "desenvolvimento"}</Text><Text selectable style={{ color: colors.muted }}>{API_BASE_URL}</Text></Card><Button title="Sair com segurança" variant="danger" onPress={confirm}/></ScrollView></Screen>; }
