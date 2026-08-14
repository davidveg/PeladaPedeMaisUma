import { useCallback, useMemo, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import { apiFetch, jsonMutation } from "@/api";
import { useAuth } from "@/auth";
import { BalanceDetails } from "@/balance-details";
import { Button, Card, EmptyState, ErrorState, Header, Screen } from "@/components";
import { CareerVotingResults } from "@/career-voting-results";
import { CareerVoting } from "@/career-voting";
import { colors } from "@/theme";
import { contrastTextColor, useMobileBranding } from "@/branding";
import { playerOverall } from "@/player-card";
import { recalculateTeamResult } from "@/team-balance";
import type { Contribution, Player, Separation, TeamResult } from "@/types";
import { careerResultsMessage, formatDate, separationMessage, shareText, votingMessage } from "@/sharing";
import { hasPermission, MODERATOR_PERMISSIONS } from "@/moderator-permissions";

type DraftPayload = { enabled: boolean; trackContributions: boolean; officialResultConfirmed: boolean; players: { blue: Player[]; yellow: Player[] }; draft: { contributions: Contribution[]; blueScore: number; yellowScore: number; updatedAt?: string } };

export default function SeparationDetail() {
  const { config: brand, palette } = useMobileBranding();
  const { id } = useLocalSearchParams<{ id: string }>(), { account } = useAuth(), client = useQueryClient();
  const canManageSeparation = hasPermission(account, MODERATOR_PERMISSIONS.SEPARATIONS_MANAGE);
  const canManageResults = hasPermission(account, MODERATOR_PERMISSIONS.MATCH_RESULTS_MANAGE);
  const refreshSeparations = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["separations"] });
  }, [client]);
  const listQuery = useQuery({
    queryKey: ["separations"],
    queryFn: () => apiFetch<{ separations: Separation[] }>("/api/mobile/separations"),
    refetchInterval: query => {
      const data = query.state.data as { separations: Separation[] } | undefined;
      return data?.separations.find(value => value.id === id)?.career?.status === "OPEN" ? 30_000 : false;
    },
  });
  const publicQuery = useQuery({ queryKey: ["public-config"], queryFn: () => apiFetch<{ baseUrl: string }>("/api/public-config") });
  useFocusEffect(useCallback(() => {
    void listQuery.refetch();
  }, [listQuery.refetch]));
  const item = listQuery.data?.separations.find(value => value.id === id);
  if (listQuery.isError && !listQuery.data) return <Screen><Header title="Detalhes"/><ErrorState message={(listQuery.error as Error).message} retry={() => listQuery.refetch()}/></Screen>;
  if (!item) return <Screen><Header title="Detalhes"/><EmptyState title="Separação não encontrada" message="Atualize a lista e tente novamente."/></Screen>;
  return <Screen><Header eyebrow={formatDate(item.matchDate || item.confirmedAt)} title={item.matchTitle}/><ScrollView refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={listQuery.refetch} tintColor={colors.green}/>} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }}>
    {item.career ? <Card style={{ alignItems: "center", gap: 4 }}><Text style={{ color: colors.muted }}>PLACAR CONFIRMADO</Text><Text style={{ fontSize: 39, fontWeight: "900", color: colors.text }}><Text style={{ color: palette.blue }}>{item.career.blueScore}</Text> × <Text style={{ color: palette.yellow }}>{item.career.yellowScore}</Text></Text><Text style={{ color: colors.muted }}>Votação {item.career.status === "OPEN" ? `aberta até ${formatDate(item.career.closesAt)}` : "encerrada"}</Text></Card> : <Card><Text style={{ color: colors.yellow, textAlign: "center", fontWeight: "800" }}>Resultado pendente</Text></Card>}
    {canManageSeparation && !item.career ? <TeamAssignmentEditor key={`${item.snapshot.blue.map(player=>player.id).join("-")}|${item.snapshot.yellow.map(player=>player.id).join("-")}`} item={item} onSaved={() => client.invalidateQueries({ queryKey: ["separations"] })}/> : null}
    {item.career?.status === "OPEN" ? <CareerVoting token={item.career.votingToken} onChanged={refreshSeparations}/> : null}
    {item.career?.status === "CLOSED" ? <CareerVotingResults item={item}/> : null}
    <TeamCard title={`TIME ${brand.teamBlueName.toLocaleUpperCase("pt-BR")}`} color={palette.blue} soft={palette.blueSoft} players={item.snapshot.blue} config={item.snapshot}/><TeamCard title={`TIME ${brand.teamYellowName.toLocaleUpperCase("pt-BR")}`} color={palette.yellow} soft={palette.yellowSoft} players={item.snapshot.yellow} config={item.snapshot}/>
    <BalanceDetails result={item.snapshot} fallbackRating={item.balanceClassification}/>
    {item.career?.contributions?.length ? <Card style={{ gap: 8 }}><Text style={{ fontWeight: "800", color: colors.text }}>Gols e assistências</Text>{item.career.contributions.map((goal, index) => <GoalRow key={index} goal={goal}/>)}</Card> : null}
    {canManageSeparation ? <><Button title="Compartilhar times no WhatsApp" icon="whatsapp" variant="secondary" disabled={!publicQuery.data?.baseUrl} onPress={() => publicQuery.data?.baseUrl && shareText(separationMessage(item, publicQuery.data.baseUrl,{teamBlueName:brand.teamBlueName,teamYellowName:brand.teamYellowName,teamBlueColor:brand.teamBlueColor,teamYellowColor:brand.teamYellowColor})).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/><ArrivalEditor item={item} onSaved={() => client.invalidateQueries({ queryKey: ["separations"] })}/></> : null}
    {canManageResults ? <><MatchPanel item={item} onSaved={() => client.invalidateQueries({ queryKey: ["separations"] })}/>{item.career?.status === "CLOSED" ? <Button title="Compartilhar resultado no WhatsApp" icon="whatsapp" disabled={!publicQuery.data?.baseUrl} onPress={() => publicQuery.data?.baseUrl && shareText(careerResultsMessage(item, publicQuery.data.baseUrl, { siteName: brand.appName, teamBlueName: brand.teamBlueName, teamYellowName: brand.teamYellowName, teamBlueColor: brand.teamBlueColor, teamYellowColor: brand.teamYellowColor })).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/> : item.career?.votingUrl ? <Button title="Compartilhar votação no WhatsApp" icon="whatsapp" onPress={() => shareText(votingMessage(item, item.career!.votingUrl!,{teamBlueName:brand.teamBlueName,teamYellowName:brand.teamYellowName,teamBlueColor:brand.teamBlueColor,teamYellowColor:brand.teamYellowColor})).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/> : null}</> : null}
  </ScrollView></Screen>;
}

function TeamCard({ title, color, soft, players, config }: { title: string; color: string; soft: string; players: Player[]; config: TeamResult }) { return <Card style={{ gap: 7, borderColor: color }}><Text style={{ color, fontSize: 18, fontWeight: "900" }}>{title}</Text>{players.map((player, index) => <View key={player.id} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, backgroundColor: soft, borderRadius: 9 }}><Text style={{ color, fontWeight: "900", width: 22 }}>{index + 1}</Text><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "800" }}>{player.displayName}</Text><Text style={{ color: colors.muted }}>{player.primaryPosition} · overall registrado {registeredOverall(player, config).toFixed(1)}</Text></View></View>)}</Card>; }
const registeredOverall = (player: Player, config: TeamResult) => playerOverall(player,config as any);

function TeamAssignmentEditor({ item, onSaved }: { item: Separation; onSaved: () => void }) {
  const { config: brand, palette } = useMobileBranding();
  const [editing, setEditing] = useState(false), [draft, setDraft] = useState(item.snapshot);
  const mutation = useMutation({
    mutationFn: () => apiFetch<{ snapshot: TeamResult; message: string }>("/api/mobile/separations", jsonMutation("PATCH", { action: "teams", id: item.id, blue: draft.blue.map(player => player.id), yellow: draft.yellow.map(player => player.id) })),
    onSuccess: result => { setDraft(result.snapshot); setEditing(false); onSaved(); Alert.alert("Times atualizados", result.message); },
    onError: (error: Error) => Alert.alert("Não foi possível atualizar", error.message),
  });
  const move = (from: "blue" | "yellow", playerId: string) => {
    const source = draft[from];
    if (source.length <= 1) return Alert.alert("Movimento indisponível", "Os dois times precisam ter pelo menos um jogador.");
    const player = source.find(value => value.id === playerId);
    if (!player) return;
    const blue = from === "blue" ? draft.blue.filter(value => value.id !== playerId) : [...draft.blue, player];
    const yellow = from === "yellow" ? draft.yellow.filter(value => value.id !== playerId) : [...draft.yellow, player];
    setDraft(recalculateTeamResult(draft, blue, yellow));
  };
  if (!editing) return <Card style={styles.teamEditorIntro}><View style={{ flex: 1, gap: 4 }}><Text style={styles.teamEditorEyebrow}>AJUSTE ANTES DO RESULTADO</Text><Text style={styles.teamEditorTitle}>Distribuição dos jogadores</Text><Text style={styles.teamEditorHelp}>Transfira jogadores caso um time fique desfalcado. Depois que o resultado for salvo, os times serão bloqueados.</Text></View><Button title="Editar times" variant="secondary" onPress={() => setEditing(true)}/></Card>;
  const confirm = () => Alert.alert("Salvar novos times?", "A ordem de chegada e um eventual rascunho de súmula serão limpos para evitar inconsistências.", [{ text: "Cancelar", style: "cancel" }, { text: "Salvar", onPress: () => mutation.mutate() }]);
  return <Card style={styles.teamEditor}><Text style={styles.teamEditorTitle}>Editar distribuição</Text><Text style={styles.teamEditorHelp}>Use a seta ao lado do jogador para transferi-lo ao outro time.</Text><EditableTeam title={brand.teamBlueName} color={palette.blue} soft={palette.blueSoft} direction="→" players={draft.blue} onMove={id => move("blue", id)}/><EditableTeam title={brand.teamYellowName} color={palette.yellow} soft={palette.yellowSoft} direction="←" players={draft.yellow} onMove={id => move("yellow", id)}/><BalanceDetails result={draft}/><View style={styles.teamEditorActions}><Button title="Cancelar" variant="secondary" disabled={mutation.isPending} onPress={() => { setDraft(item.snapshot); setEditing(false); }}/><Button title="Salvar times" busy={mutation.isPending} onPress={confirm}/></View></Card>;
}

function EditableTeam({ title, color, soft, direction, players, onMove }: { title: string; color: string; soft: string; direction: string; players: Player[]; onMove: (id: string) => void }) {
  return <View style={[styles.editableTeam, { borderColor: color }]}><View style={styles.editableTeamHead}><Text style={{ color, fontWeight: "900" }}>TIME {title.toLocaleUpperCase("pt-BR")}</Text><Text style={{ color }}>{players.length} jogadores</Text></View>{players.map(player => <View key={player.id} style={[styles.editablePlayer, { backgroundColor: soft }]}><View style={{ flex: 1 }}><Text style={styles.editablePlayerName}>{player.displayName}</Text><Text style={styles.editablePlayerPosition}>{player.primaryPosition}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Transferir ${player.displayName} para o outro time`} onPress={() => onMove(player.id)} style={[styles.transferButton, { borderColor: color }]}><Text style={{ color, fontSize: 21, fontWeight: "900" }}>{direction}</Text></Pressable></View>)}</View>;
}

function ArrivalEditor({ item, onSaved }: { item: Separation; onSaved: () => void }) {
  const { config: brand, palette } = useMobileBranding();
  const initial = item.arrivalOrder || { blue: item.snapshot.blue.map(player => player.id), yellow: item.snapshot.yellow.map(player => player.id) }, [blue, setBlue] = useState(initial.blue), [yellow, setYellow] = useState(initial.yellow);
  const mutation = useMutation({ mutationFn: () => apiFetch("/api/mobile/separations", jsonMutation("PATCH", { id: item.id, arrivalOrder: { blue, yellow } })), onSuccess: () => { onSaved(); Alert.alert("Tudo certo", "Ordens de chegada salvas."); }, onError: (error: Error) => Alert.alert("Não foi possível salvar", error.message) });
  return <Card style={{ gap: 12 }}><Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>Ordem de chegada</Text><Text style={{ color: colors.muted }}>Segure e arraste, ou use os botões de subir e descer. O primeiro da lista chegou primeiro.</Text><ArrivalTeam title={brand.teamBlueName} color={palette.blue} ids={blue} players={item.snapshot.blue} setIds={setBlue}/><ArrivalTeam title={brand.teamYellowName} color={palette.yellow} ids={yellow} players={item.snapshot.yellow} setIds={setYellow}/><Button title="Salvar ordem" busy={mutation.isPending} onPress={() => Alert.alert("Confirmar ordem?", "A ordem pode ser corrigida e salva novamente depois.", [{ text: "Cancelar", style: "cancel" }, { text: "Salvar", onPress: () => mutation.mutate() }])}/></Card>;
}

function ArrivalTeam({ title, color, ids, players, setIds }: { title: string; color: string; ids: string[]; players: Player[]; setIds: (ids: string[]) => void }) {
  const names = Object.fromEntries(players.map(player => [player.id, player.displayName])), move = (index: number, delta: number) => { const target = index + delta; if (target < 0 || target >= ids.length) return; const next = [...ids]; [next[index], next[target]] = [next[target], next[index]]; setIds(next); };
  const render = ({ item, drag, isActive, getIndex }: RenderItemParams<string>) => { const index = getIndex() ?? 0; return <ScaleDecorator><Pressable onLongPress={drag} disabled={isActive} style={{ minHeight: 50, flexDirection: "row", alignItems: "center", padding: 8, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: isActive ? colors.cream : "#fff" }}><Text style={{ width: 28, color, fontWeight: "900" }}>{index + 1}</Text><Text style={{ flex: 1, fontWeight: "700", color: colors.text }}>{names[item]}</Text><Pressable accessibilityLabel={`Subir ${names[item]}`} disabled={index === 0} onPress={() => move(index, -1)} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}><Text>↑</Text></Pressable><Pressable accessibilityLabel={`Descer ${names[item]}`} disabled={index === ids.length - 1} onPress={() => move(index, 1)} style={{ minWidth: 44, minHeight: 44, justifyContent: "center", alignItems: "center" }}><Text>↓</Text></Pressable></Pressable></ScaleDecorator>; };
  return <View><Text style={{ color, fontWeight: "900", marginBottom: 4 }}>TIME {title.toUpperCase()}</Text><DraggableFlatList data={ids} keyExtractor={value => value} renderItem={render} onDragEnd={({ data }) => setIds(data)} scrollEnabled={false}/></View>;
}

function MatchPanel({ item, onSaved }: { item: Separation; onSaved: () => void }) {
  const { config: brand, palette } = useMobileBranding();
  const query = useQuery({ queryKey: ["match-draft", item.id], queryFn: () => apiFetch<DraftPayload>(`/api/career/draft?separationId=${encodeURIComponent(item.id)}`) }), [editedContributions, setEditedContributions] = useState<Contribution[] | null>(null), [editedBlueScore, setEditedBlueScore] = useState<number | null>(null), [editedYellowScore, setEditedYellowScore] = useState<number | null>(null), [modal, setModal] = useState(false);
  const names = useMemo(() => Object.fromEntries([...item.snapshot.blue, ...item.snapshot.yellow].map(player => [player.id, player.displayName])), [item.snapshot.blue, item.snapshot.yellow]);
  const contributions = useMemo(() => editedContributions || (item.career?.contributions || query.data?.draft.contributions || []).map(goal => ({ ...goal, scorerName: goal.scorerName || names[goal.scorerPlayerId], assistName: goal.assistName || (goal.assistPlayerId ? names[goal.assistPlayerId] : null) })), [editedContributions, item.career?.contributions, names, query.data?.draft.contributions]);
  const blueScore = editedBlueScore ?? item.career?.blueScore ?? query.data?.draft.blueScore ?? 0, yellowScore = editedYellowScore ?? item.career?.yellowScore ?? query.data?.draft.yellowScore ?? 0;
  const scores = useMemo(() => ({ blue: contributions.filter(goal => goal.team === "BLUE").length, yellow: contributions.filter(goal => goal.team === "YELLOW").length }), [contributions]), track = Boolean(query.data?.trackContributions);
  const saveDraft = useMutation({ mutationFn: () => apiFetch(`/api/career/draft?separationId=${encodeURIComponent(item.id)}`, jsonMutation("PUT", { contributions })), onSuccess: () => Alert.alert("Rascunho salvo", "O resultado ainda não é oficial."), onError: (error: Error) => Alert.alert("Não foi possível salvar", error.message) });
  const confirm = useMutation({ mutationFn: () => { const body = { ...(item.career ? { matchId: item.career.id } : { separationId: item.id }), blueScore: track ? scores.blue : blueScore, yellowScore: track ? scores.yellow : yellowScore, contributions: track ? contributions : [] }; return apiFetch(item.career ? "/api/mobile/career/match" : "/api/mobile/career/match", jsonMutation(item.career ? "PUT" : "POST", body, Crypto.randomUUID())); }, onSuccess: () => { onSaved(); Alert.alert("Resultado confirmado", "Estatísticas e votação foram atualizadas."); }, onError: (error: Error) => Alert.alert("Não foi possível confirmar", error.message) });
  if (query.isError && !item.career) return null;
  if (!query.data?.enabled && !item.career) return null;
  return <Card style={{ gap: 12 }}><Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>{item.career ? "Correção administrativa" : "Súmula e resultado"}</Text>{track ? <><Text style={{ fontSize: 28, textAlign: "center", fontWeight: "900" }}><Text style={{ color: palette.blue }}>{scores.blue}</Text> × <Text style={{ color: palette.yellow }}>{scores.yellow}</Text></Text>{contributions.map((goal, index) => <Pressable key={index} onPress={() => setEditedContributions(contributions.filter((_, position) => position !== index))}><GoalRow goal={goal}/></Pressable>)}<Button title="Adicionar gol" variant="secondary" onPress={() => setModal(true)}/>{!item.career ? <Button title="Salvar rascunho" variant="secondary" busy={saveDraft.isPending} onPress={() => saveDraft.mutate()}/> : null}</> : <View style={{ flexDirection: "row", gap: 12 }}><ScoreField label={brand.teamBlueName} color={palette.blue} value={blueScore} setValue={setEditedBlueScore}/><ScoreField label={brand.teamYellowName} color={palette.yellow} value={yellowScore} setValue={setEditedYellowScore}/></View>}<Button title={item.career ? "Confirmar correção" : "Confirmar resultado final"} variant={item.career ? "danger" : "primary"} busy={confirm.isPending} onPress={() => Alert.alert(item.career ? "Corrigir resultado?" : "Confirmar resultado?", "Esta ação afeta estatísticas, vitórias, derrotas, momentum e votação. Ela ficará registrada na auditoria.", [{ text: "Cancelar", style: "cancel" }, { text: "Confirmar", style: item.career ? "destructive" : "default", onPress: () => confirm.mutate() }])}/>{modal ? <GoalModal visible blue={item.snapshot.blue} yellow={item.snapshot.yellow} onClose={() => setModal(false)} onAdd={goal => { setEditedContributions([...contributions, goal]); setModal(false); }}/> : null}</Card>;
}

function GoalRow({ goal }: { goal: Contribution }) { const {config:brand,palette}=useMobileBranding(),blue=goal.team==="BLUE",color=blue?palette.blue:palette.yellow,soft=blue?palette.blueSoft:palette.yellowSoft,name=blue?brand.teamBlueName:brand.teamYellowName;return <View style={{ padding: 10, borderRadius: 9, backgroundColor: soft, borderLeftWidth:4,borderLeftColor:color,flexDirection: "row", gap: 8 }}><View accessibilityLabel={`Gol do time ${name}`} style={{width:12,height:12,borderRadius:6,backgroundColor:color,marginTop:3}}/><Text style={{ flex: 1, color: colors.text, fontWeight: "700" }}>{goal.scorerName || goal.scorerPlayerId}{goal.assistName ? ` · assistência ${goal.assistName}` : ""}</Text>{goal.ownGoal ? <Text style={{ color: colors.danger, fontWeight: "900" }}>GC</Text> : null}</View>; }
function ScoreField({ label, color, value, setValue }: { label: string; color: string; value: number; setValue: (value: number) => void }) { return <View style={{ flex: 1, gap: 6 }}><Text style={{ color,fontWeight: "800" }}>{label}</Text><TextInput accessibilityLabel={`Placar ${label}`} keyboardType="number-pad" value={String(value)} onChangeText={text => setValue(Math.min(99, Number(text.replace(/\D/g, "")) || 0))} style={{ minHeight: 50, borderWidth: 2, borderColor: color, borderRadius: 10, textAlign: "center", fontSize: 22, fontWeight: "900",color }}/></View>; }

function GoalModal({ visible, blue, yellow, onClose, onAdd }: { visible: boolean; blue: Player[]; yellow: Player[]; onClose: () => void; onAdd: (goal: Contribution) => void }) {
  const [team, setTeam] = useState<"BLUE" | "YELLOW">("BLUE"), [ownGoal, setOwnGoal] = useState(false), [scorer, setScorer] = useState<Player | null>(null), [assist, setAssist] = useState<Player | null>(null);
  const benefiting = team === "BLUE" ? blue : yellow, scorers = ownGoal ? (team === "BLUE" ? yellow : blue) : benefiting;
  const changeTeam = (next: "BLUE" | "YELLOW") => { setTeam(next); setScorer(null); setAssist(null); }, changeOwnGoal = (next: boolean) => { setOwnGoal(next); setScorer(null); setAssist(null); };
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
    <ScrollView contentContainerStyle={{ padding: 24, gap: 14, backgroundColor: colors.cream, flexGrow: 1 }}>
      <Header title="Adicionar gol"/>
      <View accessibilityRole="radiogroup" style={{ flexDirection: "row", gap: 10 }}>
        <TeamButton team="BLUE" selected={team === "BLUE"} onPress={() => changeTeam("BLUE")}/>
        <TeamButton team="YELLOW" selected={team === "YELLOW"} onPress={() => changeTeam("YELLOW")}/>
      </View>
      <Card style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}><Text style={{ fontWeight: "800", color: colors.text }}>Gol contra (GC)</Text><Switch value={ownGoal} onValueChange={changeOwnGoal} trackColor={{ true: colors.danger }}/></Card>
      <Text style={{ fontWeight: "900", color: colors.text }}>{ownGoal ? "Jogador adversário que marcou contra" : "Autor do gol"}</Text>
      {scorers.map(player => <Choice key={player.id} selected={scorer?.id === player.id} label={player.displayName} onPress={() => setScorer(player)}/>)}
      {!ownGoal ? <><Text style={{ fontWeight: "900", color: colors.text }}>Assistência opcional</Text><Choice selected={!assist} label="Sem assistência" onPress={() => setAssist(null)}/>{benefiting.filter(player => player.id !== scorer?.id).map(player => <Choice key={player.id} selected={assist?.id === player.id} label={player.displayName} onPress={() => setAssist(player)}/>)}</> : null}
      <Button title="Adicionar à súmula" disabled={!scorer} onPress={() => scorer && onAdd({ team, scorerPlayerId: scorer.id, scorerName: scorer.displayName, assistPlayerId: assist?.id || null, assistName: assist?.displayName || null, ownGoal })}/>
      <Button title="Cancelar" variant="secondary" onPress={onClose}/>
    </ScrollView>
  </Modal>;
}

function TeamButton({ team, selected, onPress }: { team: "BLUE" | "YELLOW"; selected: boolean; onPress: () => void }) {
  const { config: brand, palette } = useMobileBranding();
  const blue = team === "BLUE", color = blue ? palette.blue : palette.yellow, soft = blue ? palette.blueSoft : palette.yellowSoft;
  const textColor = selected ? contrastTextColor(color) : color;
  return <Pressable
    accessibilityRole="radio"
    accessibilityLabel={`Time ${blue ? brand.teamBlueName : brand.teamYellowName}`}
    accessibilityState={{ selected }}
    onPress={onPress}
    style={({ pressed }) => ({ flex: 1, minHeight: 52, borderRadius: 14, borderWidth: 2, borderColor: color, backgroundColor: selected ? color : soft, paddingHorizontal: 10, alignItems: "center", justifyContent: "center", opacity: pressed ? .8 : 1 })}
  >
    <Text numberOfLines={1} adjustsFontSizeToFit minimumFontScale={.8} style={{ color: textColor, fontSize: 16, fontWeight: "900" }}>{selected ? "✓ " : ""}Time {blue ? brand.teamBlueName : brand.teamYellowName}</Text>
  </Pressable>;
}

function Choice({ selected, label, onPress }: { selected: boolean; label: string; onPress: () => void }) { return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={{ minHeight: 48, borderRadius: 10, padding: 12, backgroundColor: selected ? colors.green : "#fff", borderWidth: 1, borderColor: selected ? colors.green : colors.border }}><Text style={{ color: selected ? "#fff" : colors.text, fontWeight: "700" }}>{label}</Text></Pressable>; }

const styles = {
  teamEditorIntro: { gap: 12 } as const,
  teamEditor: { gap: 12 } as const,
  teamEditorEyebrow: { color: colors.green, fontSize: 10, fontWeight: "900" as const, letterSpacing: 1 },
  teamEditorTitle: { color: colors.text, fontSize: 18, fontWeight: "900" as const },
  teamEditorHelp: { color: colors.muted, lineHeight: 19 },
  editableTeam: { gap: 7, padding: 10, borderWidth: 1, borderRadius: 12 },
  editableTeamHead: { flexDirection: "row" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingBottom: 3 },
  editablePlayer: { minHeight: 52, flexDirection: "row" as const, alignItems: "center" as const, gap: 8, paddingLeft: 11, borderRadius: 10, overflow: "hidden" as const },
  editablePlayerName: { color: colors.text, fontWeight: "800" as const },
  editablePlayerPosition: { color: colors.muted, fontSize: 11, marginTop: 2 },
  transferButton: { width: 52, alignSelf: "stretch" as const, alignItems: "center" as const, justifyContent: "center" as const, borderLeftWidth: 1, backgroundColor: "#fff" },
  teamEditorActions: { flexDirection: "row" as const, gap: 9 },
};
