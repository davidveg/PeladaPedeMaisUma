import { useCallback, useMemo, useRef, useState } from "react";
import { Alert, Modal, Pressable, RefreshControl, ScrollView, Switch, Text, TextInput, View } from "react-native";
import { useFocusEffect } from "expo-router";
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from "react-native-draggable-flatlist";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as Crypto from "expo-crypto";
import Share from "react-native-share";
import { captureRef, releaseCapture } from "react-native-view-shot";
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

type DraftPayload = { enabled: boolean; trackContributions: boolean; officialResultConfirmed: boolean; players: { blue: Player[]; yellow: Player[] }; participation: { reviewed: boolean; blueIds: string[]; yellowIds: string[] }; eligiblePlayers: Player[]; draft: { contributions: Contribution[]; blueScore: number; yellowScore: number; updatedAt?: string } };

export default function SeparationDetail({ id, section = "all" }: { id: string; section?: string }) {
  const { config: brand, palette } = useMobileBranding();
  const { account } = useAuth(), client = useQueryClient();
  const canManageSeparation = hasPermission(account, MODERATOR_PERMISSIONS.SEPARATIONS_MANAGE);
  const canManageResults = hasPermission(account, MODERATOR_PERMISSIONS.MATCH_RESULTS_MANAGE);
  const showTeams = section === "all" || section === "teams", showResult = section === "all" || section === "result", showVoting = section === "all" || section === "voting";
  const refreshSeparations = useCallback(() => {
    void client.invalidateQueries({ queryKey: ["separations"] });
    void client.invalidateQueries({ queryKey: ["match-hub"] });
  }, [client]);
  const listQuery = useQuery({
    queryKey: ["separations", id],
    queryFn: () => apiFetch<{ separations: Separation[] }>(`/api/mobile/separations?id=${encodeURIComponent(id)}`),
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
  if (listQuery.isPending) return <Screen><EmptyState title="Carregando partida…" message="Aguarde os detalhes."/></Screen>;
  if (!item) return <Screen><Header title="Detalhes"/><EmptyState title="Escalação não encontrada" message="Atualize a lista e tente novamente."/></Screen>;
  return <Screen><Header eyebrow={item.matchDate ? formatDate(item.matchDate) : "Data da partida não informada"} title={item.matchTitle}/><ScrollView refreshControl={<RefreshControl refreshing={listQuery.isRefetching} onRefresh={listQuery.refetch} tintColor={colors.green}/>} contentContainerStyle={{ padding: 20, paddingTop: 8, gap: 14 }}>
    {item.career ? <Card style={{ alignItems: "center", gap: 4 }}><Text style={{ color: colors.muted }}>PLACAR CONFIRMADO</Text><Text style={{ fontSize: 39, fontWeight: "900", color: colors.text }}><Text style={{ color: palette.blue }}>{item.career.blueScore}</Text> × <Text style={{ color: palette.yellow }}>{item.career.yellowScore}</Text></Text><Text style={{ color: colors.muted }}>Votação {item.career.status === "OPEN" ? `aberta até ${formatDate(item.career.closesAt)}` : "encerrada"}</Text><ParticipationSummary item={item}/></Card> : <Card><Text style={{ color: colors.yellow, textAlign: "center", fontWeight: "800" }}>Resultado pendente</Text></Card>}
    {showResult&&item.career?.recap?<RoundRecap item={item} baseUrl={publicQuery.data?.baseUrl}/>:null}
    {showTeams && canManageSeparation && !item.career ? <TeamAssignmentEditor key={`${item.snapshot.blue.map(player=>player.id).join("-")}|${item.snapshot.yellow.map(player=>player.id).join("-")}`} item={item} onSaved={refreshSeparations}/> : null}
    {showVoting && item.career?.status === "OPEN" ? <CareerVoting token={item.career.votingToken} onChanged={refreshSeparations}/> : null}
    {showVoting && item.career?.status === "CLOSED" ? <CareerVotingResults item={item}/> : null}
    {showVoting && !item.career ? <EmptyState title="Votação ainda indisponível" message="A votação é aberta após a confirmação do resultado, quando o Modo Carreira estiver habilitado."/> : null}
    {showTeams && <><TeamCard title={`TIME ${brand.teamBlueName.toLocaleUpperCase("pt-BR")}`} color={palette.blue} soft={palette.blueSoft} players={item.snapshot.blue} config={item.snapshot}/><TeamCard title={`TIME ${brand.teamYellowName.toLocaleUpperCase("pt-BR")}`} color={palette.yellow} soft={palette.yellowSoft} players={item.snapshot.yellow} config={item.snapshot}/>
    <BalanceDetails result={item.snapshot} fallbackRating={item.balanceClassification}/></>}
    {showResult && item.career?.contributions?.length ? <Card style={{ gap: 8 }}><Text style={{ fontWeight: "800", color: colors.text }}>Gols e assistências</Text>{item.career.contributions.map((goal, index) => <GoalRow key={index} goal={goal}/>)}</Card> : null}
    {showTeams && canManageSeparation ? <><Button title="Compartilhar times no WhatsApp" icon="whatsapp" variant="secondary" disabled={!publicQuery.data?.baseUrl} onPress={() => publicQuery.data?.baseUrl && shareText(separationMessage(item, publicQuery.data.baseUrl,{teamBlueName:brand.teamBlueName,teamYellowName:brand.teamYellowName,teamBlueColor:brand.teamBlueColor,teamYellowColor:brand.teamYellowColor})).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/><ArrivalEditor item={item} onSaved={refreshSeparations}/></> : null}
    {showResult && canManageResults ? <><MatchPanel item={item} onSaved={refreshSeparations}/>{item.career?.status === "CLOSED" ? <Button title="Compartilhar resultado no WhatsApp" icon="whatsapp" disabled={!publicQuery.data?.baseUrl} onPress={() => publicQuery.data?.baseUrl && shareText(careerResultsMessage(item, publicQuery.data.baseUrl, { siteName: brand.appName, teamBlueName: brand.teamBlueName, teamYellowName: brand.teamYellowName, teamBlueColor: brand.teamBlueColor, teamYellowColor: brand.teamYellowColor })).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/> : item.career?.votingUrl ? <Button title="Compartilhar votação no WhatsApp" icon="whatsapp" onPress={() => shareText(votingMessage(item, item.career!.votingUrl!,{teamBlueName:brand.teamBlueName,teamYellowName:brand.teamYellowName,teamBlueColor:brand.teamBlueColor,teamYellowColor:brand.teamYellowColor})).catch(error => Alert.alert("Compartilhamento indisponível", error.message))}/> : null}</> : null}
  </ScrollView></Screen>;
}

function RoundRecap({item,baseUrl}:{item:Separation;baseUrl?:string}){
  const {config:brand,palette}=useMobileBranding(),recap=item.career!.recap!,link=baseUrl?`${baseUrl.replace(/\/$/,"")}/separacoes-salvas?separation=${encodeURIComponent(item.id)}`:"",stories=recap.stories?.filter(story=>story.kind!=="record"&&story.kind!=="achievement")||recap.highlights.map(text=>({kind:"highlight",label:"Destaque da rodada",text,icon:"•"})),records=recap.records||[],milestones=recap.milestones||[],result=recap.result;
  const newspaperRef=useRef<View>(null),[sharingImage,setSharingImage]=useState(false);
  const shareNewspaper=async()=>{let uri="";setSharingImage(true);try{uri=await captureRef(newspaperRef,{format:"png",quality:1,result:"tmpfile"});await Share.open({title:recap.title,subject:recap.title,message:`${recap.shareText}\n\n${link}`,url:uri,type:"image/png",filename:"gazeta-da-pelada",failOnCancel:false,useInternalStorage:true})}catch(error:any){Alert.alert("Compartilhamento indisponível",error?.message||"Não foi possível gerar a imagem do jornal.")}finally{if(uri)releaseCapture(uri);setSharingImage(false)}};
  return <Card style={{gap:0,padding:0,overflow:"hidden",backgroundColor:"#FBF7ED",borderColor:"#D9CFB8"}}>
    <View ref={newspaperRef} collapsable={false} style={{backgroundColor:"#FBF7ED"}}>
    <View style={{padding:17,alignItems:"center",borderBottomWidth:3,borderBottomColor:"#363228",backgroundColor:"#F3ECD9"}}><Text style={{color:"#756A54",fontSize:8,fontWeight:"900",letterSpacing:1.5}}>DESDE O PRIMEIRO APITO</Text><Text style={{color:"#27251F",fontFamily:"serif",fontSize:26,fontWeight:"900"}}>A Gazeta da Pelada</Text><Text style={{color:"#756A54",fontSize:8,fontWeight:"800"}}>RESULTADO OFICIAL</Text></View>
    <View style={{padding:18,gap:10}}><Text style={{color:"#8A4C32",fontSize:9,fontWeight:"900",letterSpacing:1}}>RESENHA DA RODADA</Text><Text style={{color:"#27251F",fontFamily:"serif",fontSize:25,fontWeight:"900"}}>{recap.title.replace(/^Resenha da rodada · /,"")}</Text><Text style={{color:"#675F50",fontFamily:"serif",fontSize:15,lineHeight:22}}>{recap.deck||"Os fatos e destaques registrados oficialmente nesta partida."}</Text>{result?<View style={{flexDirection:"row",alignItems:"center",justifyContent:"center",gap:15,padding:14,borderWidth:2,borderColor:"#363228",backgroundColor:"#FFFDF7"}}><View style={{alignItems:"center"}}><Text style={{color:palette.blue,fontSize:9,fontWeight:"900"}}>{brand.teamBlueName.toUpperCase()}</Text><Text style={{color:"#27251F",fontSize:36,fontWeight:"900"}}>{result.blueScore}</Text></View><Text style={{fontSize:20,fontWeight:"900"}}>×</Text><View style={{alignItems:"center"}}><Text style={{color:palette.yellow,fontSize:9,fontWeight:"900"}}>{brand.teamYellowName.toUpperCase()}</Text><Text style={{color:"#27251F",fontSize:36,fontWeight:"900"}}>{result.yellowScore}</Text></View></View>:<Text style={{color:colors.green,fontSize:16,fontWeight:"800"}}>{recap.headline}</Text>}</View>
    <View style={{padding:18,borderTopWidth:1,borderTopColor:"#CFC4AD",gap:10}}><Text style={{color:"#27251F",fontFamily:"serif",fontSize:17,fontWeight:"900",textTransform:"uppercase"}}>Destaques do jogo</Text>{stories.length?stories.map((story,index)=><View key={`${story.kind}-${index}`} style={{flexDirection:"row",gap:10,paddingVertical:10,borderTopWidth:1,borderTopColor:"#DDD3BD"}}><Text style={{fontSize:20}}>{story.icon}</Text><View style={{flex:1}}><Text style={{color:"#8A4C32",fontSize:8,fontWeight:"900",letterSpacing:.7}}>{story.label.toUpperCase()}</Text><Text style={{color:"#27251F",fontFamily:"serif",lineHeight:19}}>{story.text}</Text></View></View>):<Text style={{color:"#756C5C",fontStyle:"italic"}}>A súmula ainda não possui destaques individuais.</Text>}</View>
    <View style={{padding:18,borderTopWidth:1,borderTopColor:"#CFC4AD",backgroundColor:"#F3ECD9",gap:9}}><Text style={{color:"#27251F",fontFamily:"serif",fontSize:17,fontWeight:"900",textTransform:"uppercase"}}>Recordes e marcas</Text>{records.map((record,index)=><Text key={`record-${index}`} style={{color:"#27251F",fontFamily:"serif",lineHeight:19}}>📈 {record}</Text>)}{milestones.slice(0,4).map((milestone,index)=><Text key={`${milestone.id}-${index}`} style={{color:"#27251F",fontFamily:"serif",lineHeight:19}}>{milestone.icon||"🏆"} <Text style={{fontWeight:"900"}}>{milestone.playerName ? `${milestone.playerName} — ` : ""}{milestone.title}:</Text> {milestone.description}</Text>)}{!records.length&&!milestones.length?<Text style={{color:"#756C5C",fontStyle:"italic"}}>Nenhum recorde foi quebrado nesta rodada.</Text>:null}</View>
    </View>
    <View style={{padding:18,gap:10,borderTopWidth:3,borderTopColor:"#363228",backgroundColor:"#FFFDF7"}}><Text style={{color:"#27251F",fontFamily:"serif",fontSize:16,fontWeight:"900"}}>Leve a notícia para o grupo.</Text><Text style={{color:"#756C5C",fontSize:12}}>O compartilhamento inclui a imagem do jornal, a legenda e o link da partida.</Text><Button title="Compartilhar jornal com imagem" icon="whatsapp" busy={sharingImage} disabled={!link} onPress={shareNewspaper}/></View>
  </Card>;
}

function TeamCard({ title, color, soft, players, config }: { title: string; color: string; soft: string; players: Player[]; config: TeamResult }) { return <Card style={{ gap: 7, borderColor: color }}><Text style={{ color, fontSize: 18, fontWeight: "900" }}>{title}</Text>{players.map((player, index) => <View key={player.id} style={{ minHeight: 44, flexDirection: "row", alignItems: "center", gap: 10, padding: 8, backgroundColor: soft, borderRadius: 9 }}><Text style={{ color, fontWeight: "900", width: 22 }}>{index + 1}</Text><View style={{ flex: 1 }}><Text style={{ color: colors.text, fontWeight: "800" }}>{player.displayName}</Text><Text style={{ color: colors.muted }}>{player.primaryPosition}{player.secondaryPosition ? ` / ${player.secondaryPosition}` : ""} · overall registrado {registeredOverall(player, config).toFixed(1)}{player.id===config.extraId?" · jogador adicional":""}</Text></View></View>)}</Card>; }
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
  return <View style={[styles.editableTeam, { borderColor: color }]}><View style={styles.editableTeamHead}><Text style={{ color, fontWeight: "900" }}>TIME {title.toLocaleUpperCase("pt-BR")}</Text><Text style={{ color }}>{players.length} jogadores</Text></View>{players.map(player => <View key={player.id} style={[styles.editablePlayer, { backgroundColor: soft }]}><View style={{ flex: 1 }}><Text style={styles.editablePlayerName}>{player.displayName}</Text><Text style={styles.editablePlayerPosition}>{player.primaryPosition}{player.secondaryPosition ? ` / ${player.secondaryPosition}` : ""}</Text></View><Pressable accessibilityRole="button" accessibilityLabel={`Transferir ${player.displayName} para o outro time`} onPress={() => onMove(player.id)} style={[styles.transferButton, { borderColor: color }]}><Text style={{ color, fontSize: 21, fontWeight: "900" }}>{direction}</Text></Pressable></View>)}</View>;
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
  const initialBlueIds=(item.career?.participation?.blue||item.snapshot.blue).map(player=>player.id),initialYellowIds=(item.career?.participation?.yellow||item.snapshot.yellow).map(player=>player.id);
  const query = useQuery({ queryKey: ["match-draft", item.id], queryFn: () => apiFetch<DraftPayload>(`/api/career/draft?separationId=${encodeURIComponent(item.id)}`) }), [editedContributions, setEditedContributions] = useState<Contribution[] | null>(null), [editedBlueScore, setEditedBlueScore] = useState<number | null>(null), [editedYellowScore, setEditedYellowScore] = useState<number | null>(null), [modal, setModal] = useState(false),[blueParticipantOverride,setBlueParticipantIds]=useState<string[]|null>(null),[yellowParticipantOverride,setYellowParticipantIds]=useState<string[]|null>(null);
  const blueParticipantIds=blueParticipantOverride??(query.data?.participation.reviewed?query.data.participation.blueIds:initialBlueIds),yellowParticipantIds=yellowParticipantOverride??(query.data?.participation.reviewed?query.data.participation.yellowIds:initialYellowIds);
  const eligiblePlayers=query.data?.eligiblePlayers||[...item.snapshot.blue,...item.snapshot.yellow],playersById=Object.fromEntries(eligiblePlayers.map(player=>[player.id,player]));
  const actualBlue=blueParticipantIds.map(id=>playersById[id]).filter(Boolean),actualYellow=yellowParticipantIds.map(id=>playersById[id]).filter(Boolean);
  const names = Object.fromEntries(eligiblePlayers.map(player => [player.id, player.displayName]));
  const contributions = useMemo(() => editedContributions || (item.career?.contributions || query.data?.draft.contributions || []).map(goal => ({ ...goal, scorerName: goal.scorerName || names[goal.scorerPlayerId], assistName: goal.assistName || (goal.assistPlayerId ? names[goal.assistPlayerId] : null) })), [editedContributions, item.career?.contributions, names, query.data?.draft.contributions]);
  const blueScore = editedBlueScore ?? item.career?.blueScore ?? query.data?.draft.blueScore ?? 0, yellowScore = editedYellowScore ?? item.career?.yellowScore ?? query.data?.draft.yellowScore ?? 0;
  const scores = useMemo(() => ({ blue: contributions.filter(goal => goal.team === "BLUE").length, yellow: contributions.filter(goal => goal.team === "YELLOW").length }), [contributions]), track = Boolean(query.data?.trackContributions);
  const saveDraft = useMutation({ mutationFn: () => apiFetch(`/api/career/draft?separationId=${encodeURIComponent(item.id)}`, jsonMutation("PUT", { contributions })), onSuccess: () => Alert.alert("Rascunho salvo", "O resultado ainda não é oficial."), onError: (error: Error) => Alert.alert("Não foi possível salvar", error.message) });
  const confirm = useMutation({ mutationFn: () => { const body = { ...(item.career ? { matchId: item.career.id } : { separationId: item.id }), blueScore: track ? scores.blue : blueScore, yellowScore: track ? scores.yellow : yellowScore, contributions: track ? contributions : [],participationReviewed:true,participation:{blueIds:blueParticipantIds,yellowIds:yellowParticipantIds} }; return apiFetch("/api/mobile/career/match", jsonMutation(item.career ? "PUT" : "POST", body, Crypto.randomUUID())); }, onSuccess: () => { onSaved(); Alert.alert("Resultado confirmado", "Participação efetiva, estatísticas e votação foram atualizadas."); }, onError: (error: Error) => Alert.alert("Não foi possível confirmar", error.message) });
  if (query.isError && !item.career) return null;
  if (!query.data?.enabled && !item.career) return null;
  const noShows=[...item.snapshot.blue,...item.snapshot.yellow].filter(player=>![...blueParticipantIds,...yellowParticipantIds].includes(player.id));
  const confirmMessage=`Confirme o placar e os ${blueParticipantIds.length+yellowParticipantIds.length} jogadores que realmente entraram em campo.${noShows.length?` Não participaram: ${noShows.map(player=>player.displayName).join(", ")}.`:""} Somente os participantes efetivos receberão jogos, resultado, momentum, estatísticas e acesso à votação.`;
  return <Card style={{ gap: 12 }}><Text style={{ fontSize: 18, fontWeight: "900", color: colors.text }}>{item.career ? "Correção administrativa" : "Súmula e resultado"}</Text><ParticipationEditor blueLineup={item.snapshot.blue} yellowLineup={item.snapshot.yellow} eligiblePlayers={eligiblePlayers} blueIds={blueParticipantIds} yellowIds={yellowParticipantIds} setBlueIds={setBlueParticipantIds} setYellowIds={setYellowParticipantIds}/>{track ? <><Text style={{ fontSize: 28, textAlign: "center", fontWeight: "900" }}><Text style={{ color: palette.blue }}>{scores.blue}</Text> × <Text style={{ color: palette.yellow }}>{scores.yellow}</Text></Text>{contributions.map((goal, index) => <Pressable key={index} onPress={() => setEditedContributions(contributions.filter((_, position) => position !== index))}><GoalRow goal={goal}/></Pressable>)}<Button title="Adicionar gol" variant="secondary" onPress={() => setModal(true)}/>{!item.career ? <Button title="Salvar rascunho" variant="secondary" busy={saveDraft.isPending} onPress={() => saveDraft.mutate()}/> : null}</> : <View style={{ flexDirection: "row", gap: 12 }}><ScoreField label={brand.teamBlueName} color={palette.blue} value={blueScore} setValue={setEditedBlueScore}/><ScoreField label={brand.teamYellowName} color={palette.yellow} value={yellowScore} setValue={setEditedYellowScore}/></View>}<Button title={item.career ? "Confirmar correção" : "Confirmar resultado final"} variant={item.career ? "danger" : "primary"} busy={confirm.isPending} onPress={() => Alert.alert(item.career ? "Corrigir resultado e participação?" : "Confirmar resultado e participação?", confirmMessage, [{ text: "Revisar", style: "cancel" }, { text: "Confirmar", style: item.career ? "destructive" : "default", onPress: () => confirm.mutate() }])}/>{modal ? <GoalModal visible blue={actualBlue} yellow={actualYellow} onClose={() => setModal(false)} onAdd={goal => { setEditedContributions([...contributions, goal]); setModal(false); }}/> : null}</Card>;
}

function ParticipationEditor({blueLineup,yellowLineup,eligiblePlayers,blueIds,yellowIds,setBlueIds,setYellowIds}:{blueLineup:Player[];yellowLineup:Player[];eligiblePlayers:Player[];blueIds:string[];yellowIds:string[];setBlueIds:(ids:string[])=>void;setYellowIds:(ids:string[])=>void}){
  const {config:brand,palette}=useMobileBranding(),[addTeam,setAddTeam]=useState<"BLUE"|"YELLOW"|null>(null),lineupIds=new Set([...blueLineup,...yellowLineup].map(player=>player.id)),selected=new Set([...blueIds,...yellowIds]),available=eligiblePlayers.filter(player=>!selected.has(player.id));
  const setParticipant=(id:string,team:"BLUE"|"YELLOW",playing:boolean)=>{const own=team==="BLUE"?blueIds:yellowIds,other=team==="BLUE"?yellowIds:blueIds,setOwn=team==="BLUE"?setBlueIds:setYellowIds,setOther=team==="BLUE"?setYellowIds:setBlueIds;setOwn(playing?[...new Set([...own,id])]:own.filter(value=>value!==id));if(playing)setOther(other.filter(value=>value!==id))};
  const team=(label:string,color:string,lineup:Player[],ids:string[],side:"BLUE"|"YELLOW")=><View style={[styles.participationTeam,{borderTopColor:color}]}><View style={styles.participationHead}><Text style={{color,fontWeight:"900"}}>TIME {label.toUpperCase()}</Text><Text style={{color:colors.muted}}>{ids.length} jogaram</Text></View>{lineup.map(player=>{const played=ids.includes(player.id);return <View key={player.id} style={[styles.participationPlayer,!played&&styles.noShow]}><View style={{flex:1}}><Text style={styles.editablePlayerName}>{player.displayName}</Text><Text style={{color:played?colors.muted:colors.danger,fontSize:11,fontWeight:played?"500":"800"}}>{played?"Jogou":"Não jogou"}</Text></View><Switch value={played} onValueChange={value=>setParticipant(player.id,side,value)} trackColor={{false:"#D9DEDB",true:color}}/></View>})}{ids.filter(id=>!lineupIds.has(id)).map(id=>{const player=eligiblePlayers.find(value=>value.id===id);return player?<View key={id} style={[styles.participationPlayer,{backgroundColor:"#EEF8F2"}]}><View style={{flex:1}}><Text style={styles.editablePlayerName}>{player.displayName}</Text><Text style={{color:colors.green,fontSize:11}}>Adicionado no fechamento</Text></View><Pressable accessibilityLabel={`Remover ${player.displayName}`} onPress={()=>setParticipant(id,side,false)} style={styles.removeParticipant}><Text style={{color:colors.danger,fontWeight:"900"}}>×</Text></Pressable></View>:null})}<Pressable onPress={()=>setAddTeam(side)} style={styles.addParticipant}><Text style={{color,fontWeight:"900"}}>+ Adicionar quem jogou</Text></Pressable></View>;
  return <View style={{gap:10}}><View><Text style={styles.teamEditorTitle}>Participação efetiva</Text><Text style={styles.teamEditorHelp}>Confirme quem realmente entrou em campo. Apenas esses jogadores recebem resultado, estatísticas e votação.</Text></View>{team(brand.teamBlueName,palette.blue,blueLineup,blueIds,"BLUE")}{team(brand.teamYellowName,palette.yellow,yellowLineup,yellowIds,"YELLOW")}<Modal visible={Boolean(addTeam)} animationType="slide" presentationStyle="pageSheet" onRequestClose={()=>setAddTeam(null)}><ScrollView contentContainerStyle={{padding:24,gap:10,backgroundColor:colors.cream,flexGrow:1}}><Header title="Adicionar participante"/><Text style={styles.teamEditorHelp}>Selecione um jogador que participou, mas não estava na escalação publicada.</Text>{available.map(player=><Choice key={player.id} selected={false} label={`${player.displayName} · ${player.primaryPosition}`} onPress={()=>{if(addTeam)setParticipant(player.id,addTeam,true);setAddTeam(null)}}/>) }{!available.length?<EmptyState title="Nenhum jogador disponível" message="Todos os jogadores elegíveis já estão registrados na partida."/>:null}<Button title="Cancelar" variant="secondary" onPress={()=>setAddTeam(null)}/></ScrollView></Modal></View>;
}

function ParticipationSummary({item}:{item:Separation}){
  const participation=item.career?.participation;
  if(!participation)return <View style={{marginTop:8,paddingTop:8,borderTopWidth:1,borderTopColor:colors.border}}><Text style={{color:colors.muted,fontSize:11,textAlign:"center"}}>Participação presumida pela escalação (resultado anterior ao novo controle).</Text></View>;
  const actual=new Set([...participation.blue,...participation.yellow].map(player=>player.id)),lineup=[...item.snapshot.blue,...item.snapshot.yellow],noShows=lineup.filter(player=>!actual.has(player.id)),added=[...participation.blue,...participation.yellow].filter(player=>!lineup.some(value=>value.id===player.id));
  return <View style={{marginTop:8,paddingTop:10,borderTopWidth:1,borderTopColor:colors.border,alignSelf:"stretch",gap:3}}><Text style={{color:colors.text,fontWeight:"900",textAlign:"center"}}>{actual.size} participantes efetivos</Text><Text style={{color:noShows.length?colors.danger:colors.muted,fontSize:11,lineHeight:16,textAlign:"center"}}>{noShows.length?`${noShows.map(player=>player.displayName).join(", ")} não participou${noShows.length===1?"":"aram"} e não recebeu resultado ou estatísticas.`:"Todos os escalados participaram."}{added.length?` ${added.length} jogador${added.length===1?" foi adicionado":"es foram adicionados"} no fechamento.`:""}</Text></View>;
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
  participationTeam:{borderWidth:1,borderColor:colors.border,borderTopWidth:4,borderRadius:13,overflow:"hidden" as const,backgroundColor:"#fff"},
  participationHead:{minHeight:45,paddingHorizontal:12,flexDirection:"row" as const,alignItems:"center" as const,justifyContent:"space-between" as const,borderBottomWidth:1,borderBottomColor:colors.border},
  participationPlayer:{minHeight:55,paddingHorizontal:12,flexDirection:"row" as const,alignItems:"center" as const,gap:10,borderBottomWidth:1,borderBottomColor:colors.border},
  noShow:{backgroundColor:"#FFF2EF"},
  addParticipant:{minHeight:48,alignItems:"center" as const,justifyContent:"center" as const,padding:10},
  removeParticipant:{width:40,height:40,alignItems:"center" as const,justifyContent:"center" as const,borderWidth:1,borderColor:colors.border,borderRadius:10},
};
