import { useEffect, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch, jsonMutation } from "./api";
import { Button, Card, ErrorState, Header } from "./components";
import { colors } from "./theme";

type VoteField =
  | "motmThirdId"
  | "motmSecondId"
  | "motmFirstId"
  | "dotmThirdId"
  | "dotmSecondId"
  | "dotmFirstId";
type VotePlayer = { id: string; displayName: string; primaryPosition?: string; team: "BLUE" | "YELLOW" };
type VoteState = Record<VoteField, string>;
type VoteContext = {
  enabled: boolean;
  match: { id: string; status: string; closesAt: string };
  players: VotePlayer[];
  viewer: {
    authenticated: boolean;
    hasPlayerAssociation: boolean;
    player: { id: string; displayName: string; team: "BLUE" | "YELLOW" } | null;
    isParticipant: boolean;
    hasVoted: boolean;
    canVote: boolean;
  };
};

const emptyVote: VoteState = {
  motmThirdId: "", motmSecondId: "", motmFirstId: "",
  dotmThirdId: "", dotmSecondId: "", dotmFirstId: "",
};
const podiums: { title: string; description: string; tone: string; fields: { field: VoteField; place: string }[] }[] = [
  {
    title: "Man of the Match", description: "Escolha quem mais se destacou.", tone: colors.success,
    fields: [{ field: "motmFirstId", place: "1º lugar" }, { field: "motmSecondId", place: "2º lugar" }, { field: "motmThirdId", place: "3º lugar" }],
  },
  {
    title: "Deception of the Match", description: "Escolha quem teve o desempenho mais abaixo.", tone: colors.danger,
    fields: [{ field: "dotmFirstId", place: "1º lugar" }, { field: "dotmSecondId", place: "2º lugar" }, { field: "dotmThirdId", place: "3º lugar" }],
  },
];

export function CareerVoting({ token, onChanged }: { token: string; onChanged: () => void }) {
  const client = useQueryClient();
  const [vote, setVote] = useState<VoteState>(emptyVote);
  const [picker, setPicker] = useState<{ field: VoteField; title: string } | null>(null);
  const query = useQuery({
    queryKey: ["career-vote", token],
    queryFn: () => apiFetch<VoteContext>(`/api/career/vote?token=${encodeURIComponent(token)}`),
    refetchInterval: data => data.state.data?.match.status === "OPEN" ? 30_000 : false,
  });
  const submit = useMutation({
    mutationFn: () => apiFetch<{ message: string }>("/api/career/vote", jsonMutation("POST", { token, ...vote })),
    onSuccess: async data => {
      setVote(emptyVote);
      await client.invalidateQueries({ queryKey: ["career-vote", token] });
      onChanged();
      Alert.alert("Voto registrado", data.message || "Seu voto foi salvo.");
    },
    onError: async (error: Error) => {
      await client.invalidateQueries({ queryKey: ["career-vote", token] });
      Alert.alert("Não foi possível votar", error.message);
    },
  });

  useEffect(() => {
    if (query.data?.match.status && query.data.match.status !== "OPEN") onChanged();
  }, [onChanged, query.data?.match.status]);

  if (query.isLoading) return <Card><Text style={{ color: colors.muted, textAlign: "center" }}>Verificando sua votação…</Text></Card>;
  if (query.isError) return <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/>;
  const data = query.data;
  if (!data) return null;
  if (!data.enabled) return <VotingNotice title="Votação indisponível" message="O Modo Carreira está desativado neste momento."/>;
  if (data.match.status !== "OPEN") return <VotingNotice title="Votação encerrada" message="Os resultados finais estão sendo atualizados."/>;
  if (!data.viewer.hasPlayerAssociation) return <VotingNotice title="Associe seu jogador" message="Sua conta precisa estar associada a um jogador para participar. Faça a associação em Conta."/>;
  if (!data.viewer.isParticipant) return <VotingNotice title="Votação da partida" message="Somente jogadores que participaram desta separação podem votar."/>;
  if (data.viewer.hasVoted) return <VotingNotice title="Seu voto já foi registrado" message="O voto é único por partida. Se você votou pelo site, ele também vale no aplicativo — e vice-versa."/>;
  if (!data.viewer.canVote) return <VotingNotice title="Votação indisponível" message="Não é possível registrar um voto nesta partida."/>;

  const usedIds = Object.values(vote);
  const complete = usedIds.every(Boolean) && new Set(usedIds).size === 6;
  const currentPickerValue = picker ? vote[picker.field] : "";
  const available = data.players.filter(player => player.id !== data.viewer.player?.id && (!usedIds.includes(player.id) || currentPickerValue === player.id));
  const names = Object.fromEntries(data.players.map(player => [player.id, player.displayName]));

  return <>
    <Card style={{ gap: 14 }}>
      <View style={{ gap: 4 }}>
        <Text style={{ color: colors.greenLight, fontSize: 12, fontWeight: "900", letterSpacing: 1 }}>VOTAÇÃO ABERTA</Text>
        <Text style={{ color: colors.text, fontSize: 21, fontWeight: "900" }}>Destaques da partida</Text>
        <Text style={{ color: colors.muted }}>Você vota como {data.viewer.player?.displayName}. Cada jogador pode aparecer apenas uma vez.</Text>
      </View>
      {podiums.map(podium => <View key={podium.title} style={{ gap: 8 }}>
        <View>
          <Text style={{ color: podium.tone, fontSize: 17, fontWeight: "900" }}>{podium.title}</Text>
          <Text style={{ color: colors.muted }}>{podium.description}</Text>
        </View>
        {podium.fields.map(({ field, place }) => <Pressable
          key={field}
          accessibilityRole="button"
          accessibilityLabel={`${place} de ${podium.title}`}
          onPress={() => setPicker({ field, title: `${place} — ${podium.title}` })}
          style={({ pressed }) => ({
            minHeight: 54, padding: 12, borderRadius: 12, borderWidth: 1,
            borderColor: vote[field] ? podium.tone : colors.border, backgroundColor: "#fff",
            flexDirection: "row", alignItems: "center", opacity: pressed ? .75 : 1,
          })}
        >
          <Text style={{ width: 76, color: podium.tone, fontWeight: "900" }}>{place}</Text>
          <Text style={{ flex: 1, color: vote[field] ? colors.text : colors.muted, fontWeight: vote[field] ? "800" : "600" }}>{names[vote[field]] || "Selecionar jogador"}</Text>
          <Text style={{ color: colors.muted }}>›</Text>
        </Pressable>)}
      </View>)}
      <Button
        title="Confirmar meu voto" busy={submit.isPending} disabled={!complete}
        onPress={() => Alert.alert("Confirmar voto?", "O voto será definitivo e ficará registrado tanto no site quanto no aplicativo.", [
          { text: "Revisar", style: "cancel" },
          { text: "Confirmar", onPress: () => submit.mutate() },
        ])}
      />
    </Card>
    <PlayerPicker
      visible={Boolean(picker)} title={picker?.title || "Selecionar jogador"} players={available}
      selectedId={currentPickerValue} onClose={() => setPicker(null)}
      onSelect={playerId => {
        if (picker) setVote(current => ({ ...current, [picker.field]: playerId }));
        setPicker(null);
      }}
    />
  </>;
}

function VotingNotice({ title, message }: { title: string; message: string }) {
  return <Card style={{ gap: 6 }}>
    <Text style={{ color: colors.text, fontSize: 18, fontWeight: "900" }}>{title}</Text>
    <Text style={{ color: colors.muted, lineHeight: 21 }}>{message}</Text>
  </Card>;
}

function PlayerPicker({ visible, title, players, selectedId, onClose, onSelect }: {
  visible: boolean; title: string; players: VotePlayer[]; selectedId: string;
  onClose: () => void; onSelect: (playerId: string) => void;
}) {
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <ScrollView contentContainerStyle={{ padding: 20, gap: 10, backgroundColor: colors.cream, flexGrow: 1 }}>
      <Header title={title}/>
      {players.map(player => {
        const blue = player.team === "BLUE", color = blue ? colors.blue : colors.yellow, soft = blue ? colors.blueSoft : colors.yellowSoft;
        return <Pressable
          key={player.id} accessibilityRole="radio" accessibilityState={{ selected: player.id === selectedId }}
          onPress={() => onSelect(player.id)}
          style={({ pressed }) => ({
            minHeight: 56, padding: 12, borderRadius: 12, borderWidth: player.id === selectedId ? 2 : 1,
            borderColor: color, backgroundColor: soft, flexDirection: "row", alignItems: "center", gap: 10,
            opacity: pressed ? .75 : 1,
          })}
        >
          <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }}/>
          <View style={{ flex: 1 }}>
            <Text style={{ color: colors.text, fontWeight: "900" }}>{player.displayName}</Text>
            <Text style={{ color }}>{blue ? "Time Azul" : "Time Amarelo"}{player.primaryPosition ? ` · ${player.primaryPosition}` : ""}</Text>
          </View>
          {player.id === selectedId ? <Text style={{ color, fontWeight: "900" }}>✓</Text> : null}
        </Pressable>;
      })}
      <Button title="Cancelar" variant="secondary" onPress={onClose}/>
    </ScrollView>
  </Modal>;
}
