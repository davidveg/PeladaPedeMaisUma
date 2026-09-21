import { Text, View } from "react-native";
import { Card } from "./components";
import { colors } from "./theme";
import type { CareerResultEntry, Separation } from "./types";

export function CareerVotingResults({ item }: { item: Separation }) {
  const results = item.career?.results;
  const names = Object.fromEntries([...item.snapshot.blue, ...item.snapshot.yellow].map(player => [player.id, player.displayName]));
  const voteCount = Number(results?.voteCount || 0);
  return <Card style={{ gap: 14 }}>
    <View style={{ gap: 4 }}>
      <Text style={{ color: colors.success, fontSize: 12, fontWeight: "900", letterSpacing: 1 }}>VOTAÇÃO ENCERRADA</Text>
      <Text style={{ color: colors.text, fontSize: 21, fontWeight: "900" }}>Resultado final da votação</Text>
      <Text style={{ color: colors.muted }}>{voteCount ? `${voteCount} ${voteCount === 1 ? "voto contabilizado" : "votos contabilizados"}.` : "Encerrada sem votos válidos."}</Text>
    </View>
    {voteCount ? <>
      <ResultPodium title="Man of the Match" entries={results?.motm || []} names={names} positive/>
      <ResultPodium title="Deception of the Match" entries={results?.dotm || []} names={names}/>
      <RecognitionResult icon="🤝" title="Parceiro da rodada" entry={results?.partner?.[0]} names={names}/>
      <RecognitionResult icon="🟢" title="Fair Play" entry={results?.fairPlay?.[0]} names={names}/>
      <RecognitionResult icon="🧤" title="Defesa da rodada" entry={results?.defense?.[0]} names={names}/>
    </> : null}
  </Card>;
}

function RecognitionResult({ icon, title, entry, names }: { icon: string; title: string; entry?: { playerId: string; momentum: number }; names: Record<string, string> }) {
  if (!entry) return null;
  return <View style={{ minHeight: 58, borderRadius: 11, padding: 11, backgroundColor: "#FBF8EA", borderWidth: 1, borderColor: "#DED7B8", flexDirection: "row", alignItems: "center", gap: 10 }}><Text style={{ fontSize: 23 }}>{icon}</Text><View style={{ flex: 1 }}><Text style={{ color: colors.muted, fontSize: 10, fontWeight: "900", textTransform: "uppercase" }}>{title}</Text><Text style={{ color: colors.text, fontWeight: "900" }}>{names[entry.playerId] || "Jogador"}</Text></View><Text style={{ color: colors.success, fontWeight: "900" }}>+{Number(entry.momentum).toFixed(1)}</Text></View>;
}

function ResultPodium({ title, entries, names, positive = false }: { title: string; entries: CareerResultEntry[]; names: Record<string, string>; positive?: boolean }) {
  return <View style={{ gap: 5 }}>
    <Text style={{ color: colors.text, fontWeight: "800" }}>{title}</Text>
    {entries.map(entry => <View key={`${title}-${entry.playerId}`} style={{ minHeight: 42, borderRadius: 9, paddingHorizontal: 11, flexDirection: "row", alignItems: "center", backgroundColor: positive ? "#EDF8F1" : colors.dangerSoft }}>
      <Text style={{ width: 34, color: positive ? colors.success : colors.danger, fontWeight: "900" }}>{entry.place}º</Text>
      <Text style={{ flex: 1, color: colors.text, fontWeight: "700" }}>{names[entry.playerId] || "Jogador"}</Text>
      <Text style={{ color: positive ? colors.success : colors.danger, fontWeight: "900" }}>{entry.momentum > 0 ? "+" : ""}{Number(entry.momentum).toFixed(1)}</Text>
    </View>)}
  </View>;
}
