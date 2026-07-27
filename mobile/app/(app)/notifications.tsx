import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { apiFetch, jsonMutation } from "@/api";
import { EmptyState, ErrorState, Header, Screen } from "@/components";
import { colors } from "@/theme";
import type { AppNotification } from "@/types";

export default function NotificationsScreen() {
  const router = useRouter(), client = useQueryClient();
  const query = useQuery({ queryKey: ["notifications"], queryFn: () => apiFetch<{ unread: number; notifications: AppNotification[] }>("/api/notifications") });
  const read = useMutation({
    mutationFn: (value: { id?: string; all?: boolean }) => apiFetch("/api/notifications", jsonMutation("PATCH", value)),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  function open(item: AppNotification) {
    if (!item.readAt) read.mutate({ id: item.id });
    if (item.matchId) router.push(`/matches/${item.matchId}` as never);
  }
  return <Screen><Header eyebrow="ATUALIZAÇÕES DA PELADA" title="Notificações" action={query.data?.unread ? <Pressable onPress={() => read.mutate({ all: true })}><Text style={styles.readAll}>Ler todas</Text></Pressable> : null}/>
    {query.isError && !query.data ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/> : <FlatList
      contentContainerStyle={styles.list} data={query.data?.notifications || []} keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.green}/>}
      ListEmptyComponent={<EmptyState title="Tudo em dia" message="As novidades sobre partidas aparecerão aqui."/>}
      renderItem={({ item }) => <Pressable style={[styles.item, !item.readAt && styles.unread]} onPress={() => open(item)}><View style={styles.icon}><Text>{icon(item.type)}</Text></View><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleString("pt-BR")}</Text></View>{item.matchId ? <Text style={styles.arrow}>›</Text> : null}</Pressable>}
    />}</Screen>;
}
function icon(type: string) { return type === "MATCH_CREATED" ? "📅" : type === "ATTENDANCE_CHANGED" ? "✅" : type === "MATCH_CANCELLED" ? "🚫" : "📣"; }
const styles = StyleSheet.create({
  readAll: { color: colors.green, fontWeight: "900" }, list: { padding: 20, paddingTop: 8, gap: 9, flexGrow: 1 },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  unread: { borderColor: "#86AF9C", backgroundColor: "#F3FBF6" }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1EC" },
  title: { color: colors.text, fontWeight: "900" }, body: { color: colors.muted, lineHeight: 19, marginTop: 3 }, date: { color: "#8A958F", fontSize: 10, marginTop: 5 }, arrow: { color: colors.green, fontSize: 28 },
});
