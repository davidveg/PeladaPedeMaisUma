import { useNetInfo } from "@react-native-community/netinfo";
import { useQuery } from "@tanstack/react-query";
import { useCallback } from "react";
import { useFocusEffect, useRouter } from "expo-router";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { apiFetch } from "@/api";
import { Card, EmptyState, ErrorState, Header, Screen, UpdatedAt } from "@/components";
import { formatDate } from "@/sharing";
import { colors } from "@/theme";
import type { Separation } from "@/types";

function MatchScore({ blue, yellow }: { blue: number; yellow: number }) {
  return <View accessibilityLabel={`Placar: Azul ${blue}, Amarelo ${yellow}`} style={styles.score}>
    <View style={[styles.scoreTeam, styles.scoreBlue]}>
      <Text style={[styles.scoreLabel, { color: colors.blue }]}>AZUL</Text>
      <Text style={[styles.scoreValue, { color: colors.blue }]}>{blue}</Text>
    </View>
    <Text style={styles.scoreSeparator}>×</Text>
    <View style={[styles.scoreTeam, styles.scoreYellow]}>
      <Text style={[styles.scoreLabel, { color: colors.yellow }]}>AMARELO</Text>
      <Text style={[styles.scoreValue, { color: colors.yellow }]}>{yellow}</Text>
    </View>
  </View>;
}

export default function Separations() {
  const router = useRouter();
  const network = useNetInfo();
  const query = useQuery({
    queryKey: ["separations"],
    queryFn: () => apiFetch<{ separations: Separation[] }>("/api/mobile/separations"),
    refetchOnMount: true,
  });
  useFocusEffect(useCallback(() => {
    void query.refetch();
  }, [query.refetch]));

  return <Screen>
    <Header eyebrow="DIA DE JOGO" title="Separações salvas"/>
    <UpdatedAt value={query.dataUpdatedAt} offline={network.isConnected === false}/>
    {query.isError && !query.data
      ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/>
      : <FlatList
          contentContainerStyle={styles.list}
          data={query.data?.separations || []}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={colors.green}/>}
          ListEmptyComponent={<EmptyState title="Nenhuma separação" message="As separações salvas no site aparecerão aqui."/>}
          renderItem={({ item }) => <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Abrir ${item.matchTitle}`}
            onPress={() => router.push({ pathname: "/separations/[id]", params: { id: item.id } })}
          >
            <Card style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.identity}>
                  <Text style={styles.title}>{item.matchTitle}</Text>
                  <Text style={styles.date}>{formatDate(item.matchDate || item.confirmedAt)}{item.location ? ` · ${item.location}` : ""}</Text>
                </View>
                {item.career
                  ? <MatchScore blue={item.career.blueScore} yellow={item.career.yellowScore}/>
                  : <Text style={styles.pending}>Resultado pendente</Text>}
              </View>
              <View style={styles.teams}>
                <Text style={styles.blueTeam}>Azul {item.snapshot.blue.length}</Text>
                <Text style={styles.yellowTeam}>Amarelo {item.snapshot.yellow.length}</Text>
              </View>
              {item.career ? <Text style={item.career.status === "CLOSED" ? styles.closed : styles.open}>{item.career.status === "CLOSED" ? "Votação encerrada · resultado disponível" : `Votação aberta até ${formatDate(item.career.closesAt)}`}</Text> : null}
              <Text style={styles.balance}>{item.balanceClassification}</Text>
            </Card>
          </Pressable>}
        />}
  </Screen>;
}

const styles = StyleSheet.create({
  list: { padding: 20, paddingTop: 8, gap: 12, flexGrow: 1 },
  card: { gap: 11 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 10 },
  identity: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: "800", color: colors.text },
  date: { color: colors.muted },
  pending: { maxWidth: 120, textAlign: "right", color: colors.yellow, fontWeight: "800" },
  score: { flexDirection: "row", alignItems: "center", gap: 4 },
  scoreTeam: { minWidth: 43, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 4, alignItems: "center" },
  scoreBlue: { backgroundColor: colors.blueSoft },
  scoreYellow: { backgroundColor: colors.yellowSoft },
  scoreLabel: { fontSize: 7, lineHeight: 9, fontWeight: "900", letterSpacing: 0.4 },
  scoreValue: { fontSize: 21, lineHeight: 24, fontWeight: "900" },
  scoreSeparator: { color: colors.muted, fontSize: 17, fontWeight: "800" },
  teams: { flexDirection: "row", gap: 8 },
  blueTeam: { backgroundColor: colors.blueSoft, color: colors.blue, padding: 7, borderRadius: 8, fontWeight: "700" },
  yellowTeam: { backgroundColor: colors.yellowSoft, color: colors.yellow, padding: 7, borderRadius: 8, fontWeight: "700" },
  open: { color: colors.yellow, fontWeight: "700" },
  closed: { color: colors.success, fontWeight: "800" },
  balance: { color: colors.green, fontWeight: "700" },
});
