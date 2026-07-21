import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useNetInfo } from "@react-native-community/netinfo";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/api";
import { Card, EmptyState, ErrorState, Header, Screen, UpdatedAt } from "@/components";
import { colors } from "@/theme";
import type { Separation } from "@/types";
import { formatDate } from "@/sharing";

export default function Separations() {
  const router = useRouter(), network = useNetInfo();
  const query = useQuery({ queryKey: ["separations"], queryFn: () => apiFetch<{ separations: Separation[] }>("/api/mobile/separations"), refetchOnMount: true });
  return <Screen><Header eyebrow="DIA DE JOGO" title="Separações salvas"/><UpdatedAt value={query.dataUpdatedAt} offline={network.isConnected === false}/>{query.isError && !query.data ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/> : <FlatList contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 12, flexGrow: 1 }} data={query.data?.separations || []} keyExtractor={item => item.id} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.green}/>} ListEmptyComponent={<EmptyState title="Nenhuma separação" message="As separações salvas no site aparecerão aqui."/>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${item.matchTitle}`} onPress={() => router.push({ pathname: "/separations/[id]", params: { id: item.id } })}><Card style={{ gap: 11 }}><View style={{ flexDirection: "row", justifyContent: "space-between", gap: 12 }}><View style={{ flex: 1 }}><Text style={{ fontSize: 18, fontWeight: "800", color: colors.text }}>{item.matchTitle}</Text><Text style={{ color: colors.muted }}>{formatDate(item.matchDate || item.confirmedAt)}{item.location ? ` · ${item.location}` : ""}</Text></View><View style={{ alignItems: "flex-end" }}>{item.career ? <Text style={{ fontSize: 23, fontWeight: "900", color: colors.text }}>{item.career.blueScore} × {item.career.yellowScore}</Text> : <Text style={{ color: colors.yellow, fontWeight: "800" }}>Resultado pendente</Text>}</View></View><View style={{ flexDirection: "row", gap: 8 }}><Text style={{ backgroundColor: colors.blueSoft, color: colors.blue, padding: 7, borderRadius: 8, fontWeight: "700" }}>Azul {item.snapshot.blue.length}</Text><Text style={{ backgroundColor: colors.yellowSoft, color: colors.yellow, padding: 7, borderRadius: 8, fontWeight: "700" }}>Amarelo {item.snapshot.yellow.length}</Text></View><Text style={{ color: colors.green, fontWeight: "700" }}>{item.balanceClassification}</Text></Card></Pressable>}/>}</Screen>;
}
