import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { useRouter } from "expo-router";
import { apiFetch, jsonMutation } from "@/api";
import { BalanceDetails } from "@/balance-details";
import { Button, Card, Field, Header, Screen } from "@/components";
import { recalculateTeamResult } from "@/team-balance";
import { colors } from "@/theme";
import type { Player, TeamResult } from "@/types";

type TeamKey = "blue" | "yellow";
type Proposal = { parsed?: { title: string; date: string }; players: Player[]; result: TeamResult; config: Record<string, unknown> };

export default function NewSeparation() {
  const [step, setStep] = useState(1);
  const [text, setText] = useState("");
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const [manual, setManual] = useState(false);
  const [swap, setSwap] = useState<{ team: TeamKey; id: string } | null>(null);
  const [title, setTitle] = useState("Pelada");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const router = useRouter(), client = useQueryClient();
  const playersQuery = useQuery({ queryKey: ["admin-players"], queryFn: () => apiFetch<{ players: Player[] }>("/api/players") });
  const proposalMutation = useMutation({
    mutationFn: (body: unknown) => apiFetch<Proposal>("/api/mobile/separations/proposal", jsonMutation("POST", body)),
    onError: (error: Error) => Alert.alert("Revise a lista", error.message),
  });
  const saveMutation = useMutation({
    mutationFn: async () => {
      const key = Crypto.randomUUID();
      return apiFetch<{ id: string }>("/api/mobile/separations", jsonMutation("POST", { title, date: date || null, location: location || null, originalText: text, result: proposal?.result, manuallyAdjusted: manual }, key));
    },
    onSuccess: ({ id }) => {
      client.invalidateQueries({ queryKey: ["separations"] });
      router.replace({ pathname: "/separations/[id]", params: { id } });
    },
    onError: (error: Error) => Alert.alert("Não foi possível salvar", error.message),
  });

  const importList = async () => {
    const next = await proposalMutation.mutateAsync({ originalText: text, nonce: 0 }).catch(() => null);
    if (!next) return;
    setProposal(next);
    setSelected(next.players.map(player => player.id));
    setTitle(next.parsed?.title || "Pelada");
    setDate(next.parsed?.date || "");
    setStep(2);
  };

  const generate = async (retry = false) => {
    const nextNonce = retry ? nonce + 1 : nonce;
    const next = await proposalMutation.mutateAsync({ playerIds: selected, nonce: nextNonce }).catch(() => null);
    if (!next) return;
    setNonce(nextNonce);
    setProposal(next);
    setManual(false);
    setSwap(null);
    setStep(3);
  };

  const toggle = (id: string) => setSelected(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);

  const applyTeams = (blue: Player[], yellow: Player[]) => {
    setProposal(current => current ? { ...current, result: recalculateTeamResult(current.result, blue, yellow) } : current);
    setManual(true);
    setSwap(null);
  };

  const chooseSwap = (team: TeamKey, id: string) => {
    if (!proposal) return;
    if (!swap || swap.team === team) {
      setSwap(current => current?.team === team && current.id === id ? null : { team, id });
      return;
    }
    const first = proposal.result[swap.team].find(player => player.id === swap.id);
    const second = proposal.result[team].find(player => player.id === id);
    if (!first || !second) return;
    const replace = (players: Player[], playerId: string, replacement: Player) => players.map(player => player.id === playerId ? replacement : player);
    const blue = swap.team === "blue"
      ? replace(proposal.result.blue, first.id, second)
      : replace(proposal.result.blue, second.id, first);
    const yellow = swap.team === "yellow"
      ? replace(proposal.result.yellow, first.id, second)
      : replace(proposal.result.yellow, second.id, first);
    applyTeams(blue, yellow);
  };

  const movePlayer = (from: TeamKey, id: string) => {
    if (!proposal) return;
    const source = proposal.result[from];
    if (source.length <= 1) {
      Alert.alert("Movimento indisponível", "Um time não pode ficar sem jogadores.");
      return;
    }
    const player = source.find(value => value.id === id);
    if (!player) return;
    const blue = from === "blue" ? proposal.result.blue.filter(value => value.id !== id) : [...proposal.result.blue, player];
    const yellow = from === "yellow" ? proposal.result.yellow.filter(value => value.id !== id) : [...proposal.result.yellow, player];
    applyTeams(blue, yellow);
  };

  return <Screen>
    <Header eyebrow={`ETAPA ${step} DE 4`} title={step === 1 ? "Importar confirmações" : step === 2 ? "Revisar jogadores" : step === 3 ? "Ajuste fino dos times" : "Confirmar e salvar"}/>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {step === 1 ? <Card style={styles.gap}>
        <Text style={styles.muted}>Cole a lista com as seções Goleiros, Mensalistas e Convidados. Somente os confirmados serão usados.</Text>
        <Field label="Lista do WhatsApp" multiline value={text} onChangeText={setText} placeholder={"PELADA - 25/07\n\nGoleiros:\n1 - João: ✅"}/>
        <Button title="Processar confirmações" busy={proposalMutation.isPending} disabled={!text.trim()} onPress={importList}/>
      </Card> : null}

      {step === 2 ? <>
        <Card>
          <Text style={styles.sectionTitle}>{selected.length} jogadores selecionados</Text>
          <Text style={{ color: selected.length % 2 ? colors.yellow : colors.muted }}>{selected.length % 2 ? "Lista ímpar: um time terá um jogador extra." : "Quantidade par de jogadores."}</Text>
        </Card>
        {(playersQuery.data?.players || []).map(player => <Pressable key={player.id} accessibilityRole="checkbox" accessibilityState={{ checked: selected.includes(player.id) }} onPress={() => toggle(player.id)}>
          <Card style={[styles.playerChoice, selected.includes(player.id) && styles.playerChoiceSelected]}>
            <View><Text style={styles.playerName}>{player.displayName}</Text><Text style={styles.muted}>{player.primaryPosition} · {player.type === "goalkeeper" ? "Goleiro" : player.type === "monthly" ? "Mensalista" : "Convidado"}</Text></View>
            <Text style={styles.choiceMark}>{selected.includes(player.id) ? "✓" : "+"}</Text>
          </Card>
        </Pressable>)}
        <Button title="Gerar times" busy={proposalMutation.isPending} disabled={selected.length < 4} onPress={() => generate()}/>
        <Button title="Voltar" variant="secondary" onPress={() => setStep(1)}/>
      </> : null}

      {step === 3 && proposal ? <>
        <Card style={styles.instructions}>
          <Text style={styles.sectionTitle}>Como ajustar</Text>
          <Text style={styles.muted}>Toque em um jogador de cada equipe para trocá-los, ou use a seta para transferir apenas aquele jogador ao outro time.</Text>
          {manual ? <Text style={styles.manual}>✓ Indicadores recalculados após ajuste manual.</Text> : <Text style={styles.official}>Proposta oficial do algoritmo.</Text>}
        </Card>
        <TeamEditor team="blue" players={proposal.result.blue} selectedId={swap?.team === "blue" ? swap.id : null} onSelect={id => chooseSwap("blue", id)} onMove={id => movePlayer("blue", id)}/>
        <TeamEditor team="yellow" players={proposal.result.yellow} selectedId={swap?.team === "yellow" ? swap.id : null} onSelect={id => chooseSwap("yellow", id)} onMove={id => movePlayer("yellow", id)}/>
        {(proposal.result.delta?.players || 0) > 1 ? <Card style={styles.warning}><Text style={styles.warningTitle}>Atenção à quantidade</Text><Text style={styles.muted}>Os times estão com diferença de {proposal.result.delta?.players} jogadores. O indicador abaixo considera essa diferença.</Text></Card> : null}
        <BalanceDetails result={proposal.result}/>
        <Button title="Continuar" onPress={() => setStep(4)}/>
        {manual ? <Button title="Desfazer ajustes manuais" variant="secondary" busy={proposalMutation.isPending} onPress={() => generate(false)}/> : null}
        <Button title="Gerar outra proposta" variant="secondary" busy={proposalMutation.isPending} onPress={() => generate(true)}/>
      </> : null}

      {step === 4 && proposal ? <>
        <Card style={styles.gap}>
          <Field label="Título" value={title} onChangeText={setTitle}/>
          <Field label="Data (AAAA-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none"/>
          <Field label="Local (opcional)" value={location} onChangeText={setLocation}/>
          <Text style={styles.muted}>{proposal.result.blue.length} no Azul · {proposal.result.yellow.length} no Amarelo · {manual ? "Ajuste manual" : "Proposta oficial"} · {proposal.result.rating}</Text>
        </Card>
        <Button title="Confirmar e salvar" busy={saveMutation.isPending} onPress={() => Alert.alert("Salvar separação?", "Os times e os indicadores atuais serão gravados na mesma base da aplicação web.", [{ text: "Cancelar", style: "cancel" }, { text: "Salvar", onPress: () => saveMutation.mutate() }])}/>
        <Button title="Voltar aos times" variant="secondary" onPress={() => setStep(3)}/>
      </> : null}
    </ScrollView>
  </Screen>;
}

function TeamEditor({ team, players, selectedId, onSelect, onMove }: { team: TeamKey; players: Player[]; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string) => void }) {
  const blue = team === "blue", color = blue ? colors.blue : colors.yellow, soft = blue ? colors.blueSoft : colors.yellowSoft;
  const title = blue ? "AZUL" : "AMARELO", destination = blue ? "Amarelo" : "Azul";
  return <Card style={[styles.team, { borderColor: color }]}>
    <View style={styles.teamHeader}><Text style={[styles.teamTitle, { color }]}>TIME {title}</Text><Text style={[styles.teamCount, { color, backgroundColor: soft }]}>{players.length} jogadores</Text></View>
    {players.map(player => {
      const selected = selectedId === player.id;
      return <View key={player.id} style={[styles.teamPlayer, { backgroundColor: selected ? color : soft }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Selecionar ${player.displayName} para troca`} onPress={() => onSelect(player.id)} style={styles.playerIdentity}>
          <Text style={[styles.playerName, selected && styles.selectedText]}>{player.displayName}</Text>
          <Text style={[styles.playerPosition, selected && styles.selectedText]}>{player.primaryPosition}{selected ? " · selecionado para troca" : ""}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={`Mover ${player.displayName} para o time ${destination}`} onPress={() => onMove(player.id)} style={[styles.moveButton, { borderColor: color }]}>
          <Text style={[styles.moveArrow, { color }]}>{blue ? "→" : "←"}</Text>
          <Text style={[styles.moveLabel, { color }]}>{destination}</Text>
        </Pressable>
      </View>;
    })}
  </Card>;
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 8, gap: 14 },
  gap: { gap: 12 },
  muted: { color: colors.muted, lineHeight: 20 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  playerChoice: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  playerChoiceSelected: { backgroundColor: "#E9F5EF" },
  playerName: { color: colors.text, fontWeight: "800" },
  choiceMark: { fontSize: 22, color: colors.green, fontWeight: "900" },
  instructions: { gap: 7 },
  official: { color: colors.blue, fontWeight: "800" },
  manual: { color: colors.success, fontWeight: "800" },
  warning: { gap: 4, backgroundColor: colors.yellowSoft, borderColor: colors.yellow },
  warningTitle: { color: colors.yellow, fontWeight: "900" },
  team: { gap: 8 },
  teamHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  teamTitle: { fontSize: 18, fontWeight: "900" },
  teamCount: { paddingHorizontal: 9, paddingVertical: 5, borderRadius: 9, fontWeight: "800", fontSize: 12 },
  teamPlayer: { minHeight: 58, borderRadius: 11, flexDirection: "row", alignItems: "stretch", overflow: "hidden" },
  playerIdentity: { flex: 1, justifyContent: "center", paddingHorizontal: 11, paddingVertical: 8 },
  playerPosition: { color: colors.muted, fontSize: 12, marginTop: 2 },
  selectedText: { color: "#fff" },
  moveButton: { width: 70, borderLeftWidth: 1, backgroundColor: "#fff", alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  moveArrow: { fontSize: 20, lineHeight: 21, fontWeight: "900" },
  moveLabel: { fontSize: 10, fontWeight: "800" },
});
