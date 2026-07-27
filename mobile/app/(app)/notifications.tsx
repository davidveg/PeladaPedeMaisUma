import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { apiFetch, jsonMutation } from "@/api";
import { EmptyState, ErrorState, Header, Screen } from "@/components";
import { colors } from "@/theme";
import type { AppNotification, NotificationPage, NotificationPreferences } from "@/types";

export default function NotificationsScreen() {
  const router = useRouter(), client = useQueryClient();
  const [page, setPage] = useState(1), [pageSize, setPageSize] = useState<number | null>(null);
  const preferencesQuery = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: () => apiFetch<{ preferences: NotificationPreferences }>("/api/notification-preferences"),
  });
  const effectivePageSize = pageSize || preferencesQuery.data?.preferences.pageSize || 10;
  const query = useQuery({
    queryKey: ["notifications", page, effectivePageSize],
    queryFn: () => apiFetch<NotificationPage>(`/api/notifications?page=${page}&pageSize=${effectivePageSize}`),
  });
  const read = useMutation({
    mutationFn: (value: { id?: string; all?: boolean }) => apiFetch("/api/notifications", jsonMutation("PATCH", value)),
    onSuccess: () => client.invalidateQueries({ queryKey: ["notifications"] }),
  });
  function open(item: AppNotification) {
    if (!item.readAt) read.mutate({ id: item.id });
    if (item.matchId) router.push(`/matches/${item.matchId}` as never);
  }
  const data = query.data;
  const first = data?.total ? (data.page - 1) * data.pageSize + 1 : 0;
  const last = data ? Math.min(data.total, data.page * data.pageSize) : 0;
  return <Screen><Header eyebrow="ATUALIZAÇÕES DA PELADA" title="Notificações" action={data?.unread ? <Pressable onPress={() => read.mutate({ all: true })}><Text style={styles.readAll}>Ler todas</Text></Pressable> : null}/>
    {query.isError && !data ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/> : <FlatList
      contentContainerStyle={styles.list} data={data?.notifications || []} keyExtractor={item => item.id}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.green}/>}
      ListHeaderComponent={<View style={styles.toolbar}><Text style={styles.summary}>{first}–{last} de {data?.total || 0}</Text><View style={styles.sizes}><Text style={styles.sizeLabel}>Por página</Text>{[10, 20, 50].map(size => <Pressable key={size} accessibilityRole="button" style={[styles.size, effectivePageSize === size && styles.sizeOn]} onPress={() => { setPage(1); setPageSize(size); }}><Text style={[effectivePageSize === size && styles.sizeTextOn]}>{size}</Text></Pressable>)}</View></View>}
      ListEmptyComponent={<EmptyState title="Tudo em dia" message="As novidades sobre partidas aparecerão aqui."/>}
      ListFooterComponent={data && data.totalPages > 1 ? <View style={styles.pagination}><Pressable disabled={!data.hasPrevious || query.isFetching} style={[styles.pageButton, !data.hasPrevious && styles.disabled]} onPress={() => setPage(data.page - 1)}><Text style={styles.pageButtonText}>← Anterior</Text></Pressable><Text style={styles.pageLabel}>{data.page}/{data.totalPages}</Text><Pressable disabled={!data.hasNext || query.isFetching} style={[styles.pageButton, !data.hasNext && styles.disabled]} onPress={() => setPage(data.page + 1)}><Text style={styles.pageButtonText}>Próxima →</Text></Pressable></View> : null}
      renderItem={({ item }) => <Pressable style={[styles.item, !item.readAt && styles.unread]} onPress={() => open(item)}><View style={styles.icon}><Text>{icon(item.type)}</Text></View><View style={{ flex: 1 }}><Text style={styles.title}>{item.title}</Text><Text style={styles.body}>{item.body}</Text><Text style={styles.date}>{new Date(item.createdAt).toLocaleString("pt-BR")}</Text></View>{item.matchId ? <Text style={styles.arrow}>›</Text> : null}</Pressable>}
    />}</Screen>;
}
function icon(type: string) { return type === "MATCH_CREATED" ? "📅" : type === "ATTENDANCE_CHANGED" ? "✅" : type === "MATCH_CANCELLED" ? "🚫" : "📣"; }
const styles = StyleSheet.create({
  readAll: { color: colors.green, fontWeight: "900" }, list: { padding: 20, paddingTop: 8, gap: 9, flexGrow: 1 },
  toolbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10, marginBottom: 4 },
  summary: { color: colors.muted, fontSize: 12 }, sizes: { flexDirection: "row", alignItems: "center", gap: 5 }, sizeLabel: { color: colors.muted, fontSize: 11 },
  size: { minWidth: 32, paddingVertical: 6, paddingHorizontal: 7, alignItems: "center", borderWidth: 1, borderColor: colors.border, borderRadius: 8, backgroundColor: "#fff" },
  sizeOn: { backgroundColor: colors.green, borderColor: colors.green }, sizeTextOn: { color: "#fff", fontWeight: "900" },
  item: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, backgroundColor: "#fff", borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  unread: { borderColor: "#86AF9C", backgroundColor: "#F3FBF6" }, icon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "#EAF1EC" },
  title: { color: colors.text, fontWeight: "900" }, body: { color: colors.muted, lineHeight: 19, marginTop: 3 }, date: { color: "#8A958F", fontSize: 10, marginTop: 5 }, arrow: { color: colors.green, fontSize: 28 },
  pagination: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 7, paddingBottom: 8 },
  pageButton: { minHeight: 42, minWidth: 105, alignItems: "center", justifyContent: "center", borderRadius: 12, borderWidth: 1, borderColor: colors.green, backgroundColor: "#fff" },
  pageButtonText: { color: colors.green, fontWeight: "900" }, pageLabel: { color: colors.muted, fontWeight: "800" }, disabled: { opacity: .4 },
});
