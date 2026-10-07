import { useEffect, useRef, useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch, jsonMutation } from "@/api";
import { BalanceDetails } from "@/balance-details";
import { Button, Card, Header, Screen } from "@/components";
import { recalculateTeamResult } from "@/team-balance";
import { colors } from "@/theme";
import { contrastTextColor, useMobileBranding } from "@/branding";
import { useAuth } from "@/auth";
import { separationBuilderAllowed } from "@/separation-access";
import type { Player, TeamResult } from "@/types";

type TeamKey = "blue" | "yellow";
type SaveMode = "draft" | "publish";
type Proposal = {
  match?: { id: string; title: string; date: string; location?: string | null; presentCount: number };
  players: Player[];
  result: TeamResult;
  config: Record<string, unknown>;
  draft?: { exists: boolean; stale: boolean; manuallyAdjusted?: boolean; updatedAt?: string | null } | null;
};

export default function NewSeparation() {
  const { config: brand } = useMobileBranding();
  const { account } = useAuth();
  const { matchId, draft } = useLocalSearchParams<{ matchId?: string; draft?: string }>();
  const draftMode = Boolean(matchId && draft === "1");
  const [step, setStep] = useState(2);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [selected, setSelected] = useState<string[]>([]);
  const [nonce, setNonce] = useState(0);
  const [manual, setManual] = useState(false);
  const [manualPicking, setManualPicking] = useState(false);
  const [manualAssignments, setManualAssignments] = useState<Record<string, TeamKey>>({});
  const [swap, setSwap] = useState<{ team: TeamKey; id: string } | null>(null);
  const [title, setTitle] = useState("Pelada");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const loadedMatch = useRef("");
  const router = useRouter(), client = useQueryClient();
  const builderAllowed = separationBuilderAllowed(account, matchId);
  const proposalMutation = useMutation({
    mutationFn: (body: unknown) => apiFetch<Proposal>("/api/mobile/separations/proposal", jsonMutation("POST", body)),
    onError: (error: Error) => Alert.alert("Revise a lista", error.message),
  });
  const saveMutation = useMutation({
    mutationFn: async (mode: SaveMode) => {
      if (!matchId) throw new Error("Abra uma partida para montar os times pelas presenças.");
      if (draftMode && mode === "draft") {
        const saved = await apiFetch<{ result: TeamResult; draft: Proposal["draft"] }>("/api/admin/separation-drafts", jsonMutation("PUT", {
          matchId, result: proposal?.result, manuallyAdjusted: manual,
        }));
        return { ...saved, mode };
      }
      const closed = await apiFetch<{ separationId: string }>("/api/admin/matches", jsonMutation("PATCH", {
        action: "close", matchId, result: proposal?.result, manuallyAdjusted: manual,
      }));
      return { id: closed.separationId, mode: "publish" as const };
    },
    onSuccess: (saved) => {
      client.invalidateQueries({ queryKey: ["separations"] });
      client.invalidateQueries({ queryKey: ["matches"] });
      client.invalidateQueries({ queryKey: ["match-hub"] });
      client.invalidateQueries({ queryKey: ["notifications"] });
      if (saved.mode === "draft") {
        setProposal(current => current ? { ...current, result: saved.result, draft: saved.draft } : current);
        Alert.alert("Rascunho salvo", "A lista continua aberta. Você pode continuar ajustando os times ou fechar a lista e publicar esta escalação.");
        return;
      }
      router.replace({ pathname: "/separations/[id]", params: { id: saved.id! } });
    },
    onError: (error: Error) => Alert.alert("Não foi possível salvar", error.message),
  });

  useEffect(() => {
    const loadKey = `${matchId}:${draftMode}:${brand.separationDraftsEnabled}`;
    if (!builderAllowed || !matchId || loadedMatch.current === loadKey) return;
    loadedMatch.current = loadKey;
    void proposalMutation.mutateAsync({ matchId, nonce: 0, loadDraft: draftMode }).then(next => {
      setProposal(next);
      setSelected(next.players.map(player => player.id));
      setTitle(next.match?.title || "Pelada");
      setDate(next.match?.date || "");
      setLocation(next.match?.location || "");
      setNonce(Math.max(0, Number(next.result?.proposal || 1) - 1));
      const validDraft=Boolean(next.draft?.exists&&!next.draft?.stale);
      setManual(Boolean(validDraft&&next.draft?.manuallyAdjusted));
      setManualPicking(false);
      setStep(validDraft?3:2);
    }).catch(() => {
      loadedMatch.current = "";
    });
  // The mutation object is intentionally excluded to avoid reloading the draft after each render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, draftMode, brand.separationDraftsEnabled, builderAllowed]);

  const generate = async (retry = false) => {
    const nextNonce = retry ? nonce + 1 : nonce;
    if (!builderAllowed) return;
    const body = { matchId, nonce: nextNonce };
    const next = await proposalMutation.mutateAsync(body).catch(() => null);
    if (!next) return;
    setSelected(next.players.map(player => player.id));
    setNonce(nextNonce);
    setProposal({...next,result:{...next.result,selectionMethod:"automatic"}});
    setManual(false);
    setManualPicking(false);
    setSwap(null);
    setStep(3);
  };

  const startManualSelection = () => {
    setManualAssignments({});
    setManual(true);
    setManualPicking(true);
    setSwap(null);
    setStep(3);
  };

  const finishManualSelection = () => {
    if (!proposal) return;
    const blue=proposal.players.filter(player=>manualAssignments[player.id]==="blue");
    const yellow=proposal.players.filter(player=>manualAssignments[player.id]==="yellow");
    if(blue.length+yellow.length!==proposal.players.length||!blue.length||!yellow.length){
      Alert.alert("Distribuição incompleta", "Escolha um time para cada jogador e mantenha pelo menos um jogador em cada equipe.");
      return;
    }
    setProposal(current=>current?{...current,result:{...recalculateTeamResult(current.result,blue,yellow),selectionMethod:"manual"}}:current);
    setManual(true);
    setManualPicking(false);
    setSwap(null);
  };

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

  const reviewPlayers = proposal?.players || [];

  if (!builderAllowed) return <Screen>
    <Header eyebrow="MONTAGEM DE TIMES" title={matchId ? "Acesso restrito" : "Abra uma partida"}/>
    <View style={styles.content}>
      <Card style={styles.gap}>
        <Text style={styles.muted}>{matchId ? "Sua conta não tem permissão para montar times." : "A montagem de times é feita pelas presenças de uma partida. A criação de escalações avulsas foi encerrada."}</Text>
      </Card>
      <Button title="Ir para Partidas" onPress={() => router.replace("/matches")}/>
    </View>
  </Screen>;

  return <Screen>
    <Header eyebrow={`PARTIDA · ETAPA ${step - 1} DE 3`} title={step === 2 ? "Escolher método" : step === 3 ? manualPicking?"Escolher jogadores":"Ajuste fino dos times" : "Confirmar e salvar"}/>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {step === 2 ? <>
        <Card>
          <Text style={styles.sectionTitle}>{selected.length} presentes confirmados</Text>
          <Text style={styles.muted}>A lista veio das confirmações da partida e será validada novamente antes do fechamento.</Text>
          <Text style={{ color: selected.length % 2 ? colors.yellow : colors.muted }}>{selected.length % 2 ? "Lista ímpar: um time terá um jogador extra." : "Quantidade par de jogadores."}</Text>
        </Card>
        {reviewPlayers.map(player => <Card key={player.id} style={[styles.playerChoice, styles.playerChoiceSelected]}>
          <View><Text style={styles.playerName}>{player.displayName}</Text><Text style={styles.muted}>{player.primaryPosition} · Presença confirmada</Text></View>
          <Text style={styles.choiceMark}>✓</Text>
        </Card>)}
        <Card style={styles.methodCard}>
          <Text style={styles.sectionTitle}>Como deseja montar os times?</Text>
          <Text style={styles.muted}>Use o equilíbrio automático ou escolha manualmente o time de cada jogador confirmado.</Text>
          <Button title="Gerar times automaticamente" busy={proposalMutation.isPending} disabled={selected.length < 4} onPress={() => generate()}/>
          <Button title="Escolher jogadores manualmente" variant="secondary" disabled={selected.length < 4} onPress={startManualSelection}/>
        </Card>
        <Button title="Voltar à partida" variant="secondary" onPress={() => router.back()}/>
      </> : null}

      {step === 3 && proposal && manualPicking ? <ManualTeamPicker players={proposal.players} assignments={manualAssignments} onAssign={(id,team)=>setManualAssignments(current=>({...current,[id]:team}))} onFinish={finishManualSelection} onBack={()=>{setManualPicking(false);setManual(false);setStep(2)}} onAutomatic={()=>generate(false)}/> : null}

      {step === 3 && proposal && !manualPicking ? <>
        <Card style={styles.instructions}>
          <Text style={styles.sectionTitle}>Como ajustar</Text>
          <Text style={styles.muted}>Toque em um jogador de cada equipe para trocá-los, ou use a seta para transferir apenas aquele jogador ao outro time.</Text>
          {manual ? <Text style={styles.manual}>✓ Indicadores recalculados após ajuste manual.</Text> : <Text style={styles.official}>Proposta oficial do algoritmo.</Text>}
        </Card>
        <TeamEditor team="blue" players={proposal.result.blue} extraId={proposal.result.extraId} selectedId={swap?.team === "blue" ? swap.id : null} onSelect={id => chooseSwap("blue", id)} onMove={id => movePlayer("blue", id)}/>
        <TeamEditor team="yellow" players={proposal.result.yellow} extraId={proposal.result.extraId} selectedId={swap?.team === "yellow" ? swap.id : null} onSelect={id => chooseSwap("yellow", id)} onMove={id => movePlayer("yellow", id)}/>
        {(proposal.result.delta?.players || 0) > 1 ? <Card style={styles.warning}><Text style={styles.warningTitle}>Atenção à quantidade</Text><Text style={styles.muted}>Os times estão com diferença de {proposal.result.delta?.players} jogadores. O indicador abaixo considera essa diferença.</Text></Card> : null}
        <BalanceDetails result={proposal.result}/>
        <Button title="Continuar" onPress={() => setStep(4)}/>
        <Button title="Refazer por escolha manual" variant="secondary" onPress={startManualSelection}/>
        {manual ? <Button title="Desfazer ajustes manuais" variant="secondary" busy={proposalMutation.isPending} onPress={() => generate(false)}/> : null}
        <Button title="Gerar outra proposta" variant="secondary" busy={proposalMutation.isPending} onPress={() => generate(true)}/>
      </> : null}

      {step === 4 && proposal ? <>
        <Card style={styles.gap}>
          <><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.muted}>{date}{location ? ` · ${location}` : ""}</Text><Text style={draftMode?styles.draft:styles.official}>{draftMode?"O rascunho será salvo sem encerrar a lista ou notificar os jogadores.":"A lista será fechada somente após esta confirmação."}</Text>{draftMode&&proposal.draft?.updatedAt?<Text style={styles.muted}>Último rascunho: {new Date(proposal.draft.updatedAt).toLocaleString("pt-BR")}</Text>:null}</>
          <Text style={styles.muted}>{proposal.result.blue.length} no {brand.teamBlueName} · {proposal.result.yellow.length} no {brand.teamYellowName} · {proposal.result.selectionMethod==="manual" ? "Escolha manual" : manual ? "Proposta ajustada" : "Proposta automática"} · {proposal.result.rating}</Text>
        </Card>
        {draftMode?<Button title="Salvar rascunho" variant="secondary" busy={saveMutation.isPending} onPress={() => Alert.alert("Salvar rascunho?", "A proposta ficará disponível somente aos administradores. A lista continuará aberta e ninguém será notificado.", [{ text: "Cancelar", style: "cancel" }, { text: "Salvar", onPress: () => saveMutation.mutate("draft") }])}/>:null}
        <Button title={draftMode?"Fechar lista e publicar":"Fechar lista e salvar"} busy={saveMutation.isPending} onPress={() => Alert.alert(draftMode?"Fechar lista e publicar?":"Fechar lista e salvar?", "A lista da partida será encerrada, os times serão publicados e os jogadores serão notificados.", [{ text: "Cancelar", style: "cancel" }, { text: draftMode?"Publicar":"Salvar", onPress: () => saveMutation.mutate("publish") }])}/>
        <Button title="Voltar aos times" variant="secondary" onPress={() => setStep(3)}/>
      </> : null}
    </ScrollView>
  </Screen>;
}

function ManualTeamPicker({players,assignments,onAssign,onFinish,onBack,onAutomatic}:{players:Player[];assignments:Record<string,TeamKey>;onAssign:(id:string,team:TeamKey)=>void;onFinish:()=>void;onBack:()=>void;onAutomatic:()=>void}){
  const {config:brand,palette}=useMobileBranding();
  const blue=players.filter(player=>assignments[player.id]==="blue").length,yellow=players.filter(player=>assignments[player.id]==="yellow").length,assigned=blue+yellow,remaining=players.length-assigned,complete=remaining===0&&blue>0&&yellow>0;
  return <>
    <Card style={styles.instructions}>
      <Text style={styles.sectionTitle}>Distribuição manual</Text>
      <Text style={styles.muted}>Escolha um time para cada jogador. Os indicadores de equilíbrio serão calculados quando a distribuição estiver completa.</Text>
      <View style={styles.assignmentSummary}><Text style={[styles.assignmentCount,{color:palette.blue}]}>{blue} {brand.teamBlueName}</Text><Text style={styles.assignmentRemaining}>{remaining} sem time</Text><Text style={[styles.assignmentCount,{color:palette.yellow}]}>{yellow} {brand.teamYellowName}</Text></View>
    </Card>
    {players.map(player=>{
      const selected=assignments[player.id];
      return <Card key={player.id} style={[styles.manualPlayer,selected==="blue"&&{borderColor:palette.blue},selected==="yellow"&&{borderColor:palette.yellow}]}>
        <View><Text style={styles.playerName}>{player.displayName}</Text><Text style={styles.muted}>{player.primaryPosition}{player.secondaryPosition?` / ${player.secondaryPosition}`:""}</Text></View>
        <View style={styles.teamChoices}>
          <Pressable accessibilityRole="button" accessibilityState={{selected:selected==="blue"}} onPress={()=>onAssign(player.id,"blue")} style={[styles.teamChoice,{borderColor:palette.blue},selected==="blue"&&{backgroundColor:palette.blue}]}><Text style={[styles.teamChoiceText,{color:selected==="blue"?contrastTextColor(palette.blue):palette.blue}]}>{brand.teamBlueName}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityState={{selected:selected==="yellow"}} onPress={()=>onAssign(player.id,"yellow")} style={[styles.teamChoice,{borderColor:palette.yellow},selected==="yellow"&&{backgroundColor:palette.yellow}]}><Text style={[styles.teamChoiceText,{color:selected==="yellow"?contrastTextColor(palette.yellow):palette.yellow}]}>{brand.teamYellowName}</Text></Pressable>
        </View>
      </Card>;
    })}
    {!remaining&&(!blue||!yellow)?<Card style={styles.warning}><Text style={styles.warningTitle}>Os dois times precisam ter jogadores.</Text></Card>:null}
    <Button title={`Revisar times (${assigned}/${players.length})`} disabled={!complete} onPress={onFinish}/>
    <Button title="Usar distribuição automática" variant="secondary" onPress={onAutomatic}/>
    <Button title="Trocar método" variant="secondary" onPress={onBack}/>
  </>;
}

function TeamEditor({ team, players, extraId, selectedId, onSelect, onMove }: { team: TeamKey; players: Player[]; extraId?:string; selectedId: string | null; onSelect: (id: string) => void; onMove: (id: string) => void }) {
  const { config: brand, palette } = useMobileBranding();
  const blue = team === "blue", color = blue ? palette.blue : palette.yellow, soft = blue ? palette.blueSoft : palette.yellowSoft, selectedText=contrastTextColor(color);
  const title = (blue ? brand.teamBlueName : brand.teamYellowName).toLocaleUpperCase("pt-BR"), destination = blue ? brand.teamYellowName : brand.teamBlueName;
  return <Card style={[styles.team, { borderColor: color }]}>
    <View style={styles.teamHeader}><Text style={[styles.teamTitle, { color }]}>TIME {title}</Text><Text style={[styles.teamCount, { color, backgroundColor: soft }]}>{players.length} jogadores</Text></View>
    {players.map(player => {
      const selected = selectedId === player.id;
      return <View key={player.id} style={[styles.teamPlayer, { backgroundColor: selected ? color : soft }]}>
        <Pressable accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`Selecionar ${player.displayName} para troca`} onPress={() => onSelect(player.id)} style={styles.playerIdentity}>
          <Text style={[styles.playerName, selected && { color:selectedText }]}>{player.displayName}</Text>
          <Text style={[styles.playerPosition, selected && { color:selectedText }]}>{player.primaryPosition}{player.id===extraId?" · jogador adicional":""}{selected ? " · selecionado para troca" : ""}</Text>
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
  methodCard: { gap: 12 },
  assignmentSummary: { flexDirection:"row",justifyContent:"space-between",alignItems:"center",gap:8,marginTop:6 },
  assignmentCount: { fontWeight:"900",fontSize:12 },
  assignmentRemaining: { color:colors.muted,fontWeight:"800",fontSize:12 },
  manualPlayer: { gap:10 },
  teamChoices: { flexDirection:"row",gap:8 },
  teamChoice: { flex:1,borderWidth:1,borderRadius:10,paddingHorizontal:8,paddingVertical:10,alignItems:"center" },
  teamChoiceText: { fontSize:12,fontWeight:"900" },
  official: { color: colors.blue, fontWeight: "800" },
  draft: { color: colors.yellow, fontWeight: "800" },
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
