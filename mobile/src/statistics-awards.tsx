import { useRef, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import * as Clipboard from "expo-clipboard";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { captureRef, releaseCapture } from "react-native-view-shot";
import { useMobileBranding } from "./branding";
import { Button } from "./components";
import { Avatar, Metric, Note, Panel, Person, Select, s } from "./statistics-ui";
import { closedAward, dateLabel, formationRows, monthLabel, momentum as signed, pitchColumns, type GeneralStatistics, type MonthlyAward, type MonthlyMomentumDetail, type MonthlyStanding } from "./statistics";

export function MonthlyHonors({ highlights }: { highlights: GeneralStatistics["careerHighlights"] }) {
  const [selectedMonth, setSelectedMonth] = useState("");
  const availableMonth = highlights.history.some(entry => entry.month === selectedMonth) ? selectedMonth : "";
  const award = closedAward(highlights, availableMonth);
  return <>
    <Panel title="Jogador e seleção do mês" note="Destaques pelo momentum de resultados e votações. Somente mensalistas e goleiros elegíveis; convidados não participam.">
      <Select label="Histórico de premiações" value={availableMonth} options={[
        { value: "", label: `Mês consultado · ${monthLabel(highlights.focusMonth)}` },
        ...highlights.history.map(entry => ({ value: entry.month, label: monthLabel(entry.month) })),
      ]} onChange={setSelectedMonth}/>
      {award ? <>
        <Text style={s.title}>{monthLabel(award.month)}</Text>
        <Note>{award.matchCount} partidas consideradas · resultado mensal fechado e preservado</Note>
        <PlayerOfMonth standing={award.playerOfMonth}/>
        <MonthlyPitch award={award}/>
      </> : <View style={[s.metric, { flexBasis: "auto", flexGrow: 0, gap: 8 }]}>
        <Ionicons name={highlights.focusMonthClosed ? "calendar-outline" : "hourglass-outline"} size={26} color="#174D3A"/>
        <Text style={s.title}>{highlights.focusMonthClosed ? "Sem premiação neste mês" : "Premiação em apuração"}</Text>
        <Note>{highlights.focusMonthClosed ? "Não houve partidas suficientes para registrar os destaques." : "Os resultados aparecerão após o fechamento do mês, o encerramento da última votação ou a antecipação feita por um administrador."}</Note>
      </View>}
    </Panel>
    <Panel title={`MVPs de ${highlights.year}`} note="O pódio considera aparições na seleção mensal. Jogador do mês e momentum acumulado desempatam a classificação.">
      {!highlights.annualMvpAvailable ? <View style={{ gap: 10 }}>
        <Ionicons name="lock-closed-outline" size={26} color="#174D3A"/>
        <Text style={s.text}>Premiação ainda em disputa</Text>
        <Note>Ouro, Prata e Bronze serão revelados no encerramento da temporada, previsto para {dateLabel(highlights.annualMvpAvailableAt)}.</Note>
      </View> : highlights.annualMvp.length ? [...highlights.annualMvp].sort((a, b) => a.place - b.place).map(entry => <View key={entry.player.id} style={[styles.medal, { borderColor: entry.place === 1 ? "#C99A20" : entry.place === 2 ? "#98A8AF" : "#AC7045" }]}>
        <Text style={s.label}>{entry.place}º · {entry.medal}</Text>
        <Person player={entry.player} detail={`${entry.selections} seleções · ${entry.playerOfMonthAwards}× jogador do mês`}/>
        <Note>{signed(entry.momentum)} momentum acumulado</Note>
      </View>) : <Note>Não houve meses encerrados suficientes para formar o pódio.</Note>}
    </Panel>
  </>;
}

export function PlayerOfMonth({ standing }: { standing: MonthlyStanding | null }) {
  const { config: brand } = useMobileBranding();
  const highlightRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);
  if (!standing) return <Note>Sem jogador elegível.</Note>;
  const shareHighlight=async()=>{let uri="";setSharing(true);try{if(!await Sharing.isAvailableAsync())throw new Error("O compartilhamento de arquivos não está disponível neste aparelho.");uri=await captureRef(highlightRef,{format:"png",quality:1,result:"tmpfile"});await Clipboard.setStringAsync(`⭐ Jogador do mês · ${standing.player.displayName}\n${signed(standing.totalMomentum)} de momentum · ${brand.appName}`);await Sharing.shareAsync(uri,{dialogTitle:`Jogador do mês · ${standing.player.displayName}`,mimeType:"image/png",UTI:"public.png"});Alert.alert("Legenda copiada","Escolha o WhatsApp e cole a legenda na conversa após anexar a imagem.")}catch(error:any){Alert.alert("Compartilhamento indisponível",error?.message||"Não foi possível gerar a imagem do destaque.")}finally{if(uri)releaseCapture(uri);setSharing(false)}};
  return <View style={{gap:12}}><View ref={highlightRef} collapsable={false}><LinearGradient colors={["#205F48", "#123E30"]} style={styles.champion}>
    <View style={s.row}><Ionicons name="star" size={22} color="#DCFA6B"/><Text style={styles.championLabel}>JOGADOR DO MÊS</Text></View>
    <View style={styles.portrait}><Avatar player={standing.player} size={112}/></View>
    <View style={{ gap: 6, alignItems: "center" }}>
      <Text style={styles.championName}>{standing.player.displayName}</Text>
      <Text style={styles.championNote}>{standing.player.primaryPosition || "Jogador"}</Text>
    </View>
    <Text style={styles.momentum}>{signed(standing.totalMomentum)}</Text>
    <Text style={styles.championLabel}>MOMENTUM TOTAL</Text>
    <View style={[s.grid, { width: "100%" }]}>
      <Metric label="Resultados" value={signed(standing.resultMomentum)}/>
      <Metric label="Votações" value={signed(standing.votingMomentum)}/>
    </View>
    <Text style={styles.championNote}>{standing.games} jogos · {standing.wins}V · {standing.draws}E · {standing.losses}D</Text>
  </LinearGradient></View><Button title={sharing ? "Gerando imagem…" : "Compartilhar destaque no WhatsApp"} icon="whatsapp" busy={sharing} onPress={shareHighlight}/></View>;
}

export function MonthlyPitch({ award }: { award: MonthlyAward }) {
  const { fontScale } = useWindowDimensions();
  const { config: brand } = useMobileBranding();
  const router = useRouter();
  const selectionRef = useRef<View>(null);
  const [width, setWidth] = useState(0), [sharing, setSharing] = useState(false);
  const [selected, setSelected] = useState<(MonthlyStanding & { role: string }) | null>(null);
  const rows = formationRows(award), total = rows.reduce((sum, row) => sum + row.slots, 0);
  const columns = pitchColumns(width || 270, fontScale);
  const shareSelection=async()=>{let uri="";setSharing(true);try{if(!await Sharing.isAvailableAsync())throw new Error("O compartilhamento de arquivos não está disponível neste aparelho.");uri=await captureRef(selectionRef,{format:"png",quality:1,result:"tmpfile"});await Clipboard.setStringAsync(`⚽ Seleção do mês · ${monthLabel(award.month)}\n${brand.appName}`);await Sharing.shareAsync(uri,{dialogTitle:`Seleção do mês · ${monthLabel(award.month)}`,mimeType:"image/png",UTI:"public.png"});Alert.alert("Legenda copiada","Escolha o WhatsApp e cole a legenda na conversa após anexar a imagem.")}catch(error:any){Alert.alert("Compartilhamento indisponível",error?.message||"Não foi possível gerar a imagem da seleção.")}finally{if(uri)releaseCapture(uri);setSharing(false)}};
  return <View style={{ gap: 12 }}>
    <View ref={selectionRef} collapsable={false} style={styles.selectionCapture}>
    <View style={s.row}><View style={[s.grow,{gap:2}]}><Text style={s.title}>Seleção do mês</Text><Text style={s.label}>{monthLabel(award.month)}</Text></View><Text style={s.label}>{award.selection.length}/{total}</Text></View>
    <View testID="monthly-pitch" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.pitch}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.stripes}>{Array.from({ length: 6 }, (_, index) => <View key={index} style={{ flex: 1, backgroundColor: index % 2 ? "transparent" : "rgba(255,255,255,.035)" }}/>)}</View>
        <View style={styles.halfway}/><View style={styles.centerCircle}/><View style={[styles.box, { top: 0 }]}/><View style={[styles.box, { bottom: 0 }]}/>
      </View>
      {rows.map(row => <View key={row.role} style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{row.role.toLocaleUpperCase("pt-BR")}</Text>
        <View style={styles.formation}>
          {row.players.map(entry => <Pressable accessibilityRole="button" accessibilityLabel={`Ver composição do momentum de ${entry.player.displayName}`} onPress={() => setSelected(entry)} key={entry.player.id} style={({ pressed }) => [styles.fieldPlayer, { width: `${100 / columns}%` }, pressed && styles.fieldPlayerPressed]}>
            <View style={styles.fieldPhoto}><Avatar player={entry.player} size={52}/></View>
            <Text style={styles.fieldName}>{entry.player.displayName}</Text>
            <Text style={styles.fieldScore}>{signed(entry.totalMomentum)} momentum</Text>
          </Pressable>)}
          {Array.from({ length: Math.max(0, row.slots - row.players.length) }, (_, index) => <View key={`vacant-${index}`} style={[styles.fieldPlayer, { width: `${100 / columns}%` }]}>
            <View style={styles.vacant}><Ionicons name="person-outline" size={25} color="#E0F0E5"/></View>
            <Text style={styles.fieldScore}>Vaga disponível</Text>
          </View>)}
        </View>
      </View>)}
    </View>
    </View>
    <Button title={sharing ? "Gerando imagem…" : "Compartilhar seleção no WhatsApp"} icon="whatsapp" busy={sharing} onPress={shareSelection}/>
    <MomentumDetailModal standing={selected} onClose={() => setSelected(null)} onOpenMatch={separationId => { setSelected(null); router.push({ pathname: "/separations/[id]", params: { id: separationId } } as never); }}/>
  </View>;
}

function resultLabel(value: MonthlyMomentumDetail["result"]) {
  return value === "WIN" ? "Vitória" : value === "DRAW" ? "Empate" : value === "LOSS" ? "Derrota" : "Reconhecimento";
}

function momentumDetailText(entry: MonthlyMomentumDetail) {
  return [
    entry.resultMomentum ? `${resultLabel(entry.result)} ${signed(entry.resultMomentum)}` : entry.result !== "VOTE" ? resultLabel(entry.result) : "",
    ...entry.votes.map(vote => `${vote.label} ${signed(vote.momentum)}`),
    entry.attendanceBonus ? `Presença ${signed(entry.attendanceBonus)}` : "",
  ].filter(Boolean).join(" · ");
}

export function MomentumDetailModal({ standing, onClose, onOpenMatch }: { standing: MonthlyStanding | null; onClose(): void; onOpenMatch(separationId: string): void }) {
  if (!standing) return null;
  const details = standing.momentumDetails || [];
  const recognitions = details.reduce((sum, entry) => sum + entry.votes.length, 0);
  return <Modal visible transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhamento do momentum" onPress={onClose} style={StyleSheet.absoluteFill}/>
      <View style={styles.momentumPanel}>
        <View style={styles.momentumHeader}>
          <Avatar player={standing.player} size={64}/>
          <View style={styles.momentumIdentity}><Text style={styles.momentumEyebrow}>COMPOSIÇÃO DO MÊS</Text><Text style={styles.momentumName}>{standing.player.displayName}</Text><Text style={styles.momentumPosition}>{standing.player.primaryPosition || "Jogador"}</Text></View>
          <View style={styles.momentumTotal}><Text style={styles.momentumTotalValue}>{signed(standing.totalMomentum)}</Text><Text style={styles.momentumTotalLabel}>MOMENTUM TOTAL</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar detalhamento" hitSlop={10} onPress={onClose} style={styles.closeButton}><Ionicons name="close" size={22} color="#FFFFFF"/></Pressable>
        </View>
        <Text style={styles.momentumIntro}>A pontuação reúne os resultados das partidas e os reconhecimentos recebidos nas votações do mês.</Text>
        <View style={styles.momentumSummary}>
          <View style={styles.momentumSummaryRow}><View><Text style={styles.momentumSummaryTitle}>Resultados</Text><Text style={styles.momentumSummaryNote}>{standing.wins}V · {standing.draws}E · {standing.losses}D</Text></View><Text style={[styles.momentumSummaryValue, standing.resultMomentum < 0 && styles.negative]}>{signed(standing.resultMomentum)}</Text></View>
          <View style={styles.momentumSummaryRow}><View><Text style={styles.momentumSummaryTitle}>Votações</Text><Text style={styles.momentumSummaryNote}>{recognitions} reconhecimentos</Text></View><Text style={[styles.momentumSummaryValue, standing.votingMomentum < 0 && styles.negative]}>{signed(standing.votingMomentum)}</Text></View>
        </View>
        <View style={styles.momentumListHead}><Text style={styles.momentumListTitle}>PARTIDAS E VOTOS</Text><Text style={styles.momentumListOrder}>mais recente primeiro</Text></View>
        <ScrollView style={styles.momentumList} contentContainerStyle={styles.momentumListContent} showsVerticalScrollIndicator={false}>
          {details.length ? details.map(entry => <Pressable accessibilityRole="button" accessibilityLabel={`Abrir ${entry.title}`} onPress={() => onOpenMatch(entry.separationId)} key={entry.matchId} style={({ pressed }) => [styles.momentumMatch, pressed && styles.momentumMatchPressed]}>
            <Text style={styles.momentumDate}>{new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", timeZone: "UTC" }).format(new Date(`${entry.date}T12:00:00Z`)).replace(".", "")}</Text>
            <View style={styles.momentumMatchCopy}><Text style={styles.momentumMatchTitle}>{resultLabel(entry.result)} · {entry.title}</Text><Text style={styles.momentumMatchNote}>{momentumDetailText(entry) || "Sem alteração no momentum"}</Text></View>
            <Text style={[styles.momentumMatchValue, entry.totalMomentum < 0 && styles.negative]}>{signed(entry.totalMomentum)}</Text>
          </Pressable>) : <Text style={styles.momentumEmpty}>O detalhamento por partida não estava disponível quando este mês foi consolidado.</Text>}
        </ScrollView>
        <View style={styles.momentumFooter}><Text style={styles.momentumEquation}>{signed(standing.resultMomentum)} RESULTADOS + {signed(standing.votingMomentum)} VOTAÇÕES</Text><Text style={styles.momentumEquationTotal}>= {signed(standing.totalMomentum)}</Text></View>
      </View>
    </View>
  </Modal>;
}

const styles = StyleSheet.create({
  champion: { padding: 18, borderRadius: 18, gap: 12, alignItems: "center" },
  championLabel: { color: "#DCFA6B", fontSize: 11, fontWeight: "900", letterSpacing: .7, flexShrink: 1, textAlign: "center" },
  championName: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", textAlign: "center" },
  championNote: { color: "#E0F0E5", fontSize: 13, lineHeight: 20, textAlign: "center" },
  portrait: { padding: 14, borderRadius: 90, borderWidth: 1, borderColor: "#82AE96", marginTop: 4 },
  momentum: { color: "#DCFA6B", fontSize: 38, fontWeight: "900", fontVariant: ["tabular-nums"] },
  medal: { borderWidth: 1, borderLeftWidth: 5, borderRadius: 14, padding: 14, gap: 10, backgroundColor: "#F8FAF8" },
  selectionCapture: { gap: 12, padding: 12, marginHorizontal: -12, backgroundColor: "#FFFFFF" },
  pitch: { backgroundColor: "#216D45", borderWidth: 3, borderColor: "#BFDDC9", borderRadius: 16, paddingVertical: 18, paddingHorizontal: 8, overflow: "hidden", gap: 14 },
  stripes: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row" },
  halfway: { position: "absolute", top: "50%", width: "100%", borderTopWidth: 1, borderColor: "#8EBDA1" },
  centerCircle: { position: "absolute", top: "50%", left: "50%", width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: "#8EBDA1", transform: [{ translateX: -40 }, { translateY: -40 }] },
  box: { position: "absolute", left: "22%", width: "56%", height: 36, borderWidth: 1, borderColor: "#8EBDA1" },
  fieldRow: { gap: 8 }, fieldLabel: { color: "#DEF0E3", fontSize: 10, fontWeight: "800", paddingHorizontal: 6 },
  formation: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: 14 },
  fieldPlayer: { alignItems: "center", paddingHorizontal: 4, gap: 5, minWidth: 0 },
  fieldPlayerPressed: { opacity: .72, transform: [{ scale: .98 }] },
  fieldPhoto: { borderRadius: 30, borderWidth: 2, borderColor: "#FFFFFF", overflow: "hidden" },
  fieldName: { color: "#FFFFFF", backgroundColor: "#103F2B", borderRadius: 6, overflow: "hidden", paddingVertical: 4, paddingHorizontal: 6, textAlign: "center", fontSize: 12, fontWeight: "800", maxWidth: "100%" },
  fieldScore: { color: "#FFFFFF", fontSize: 10, lineHeight: 15, textAlign: "center" },
  vacant: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderStyle: "dashed", borderColor: "#C5DFC9", justifyContent: "center", alignItems: "center" },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(4, 18, 13, .62)" },
  momentumPanel: { maxHeight: "91%", backgroundColor: "#0C3026", borderTopLeftRadius: 24, borderTopRightRadius: 24, borderWidth: 1, borderBottomWidth: 0, borderColor: "#C99A20", padding: 16, gap: 14, overflow: "hidden" },
  momentumHeader: { flexDirection: "row", alignItems: "center", gap: 11, paddingRight: 30 },
  momentumIdentity: { flex: 1, minWidth: 0, gap: 2 },
  momentumEyebrow: { color: "#E0B43C", fontSize: 9, fontWeight: "900", letterSpacing: 1.1 },
  momentumName: { color: "#FFFFFF", fontSize: 20, fontWeight: "900" },
  momentumPosition: { color: "#AFC9BF", fontSize: 11 },
  momentumTotal: { alignItems: "flex-end", gap: 1 },
  momentumTotalValue: { color: "#F4C53D", fontSize: 23, fontWeight: "900", fontVariant: ["tabular-nums"] },
  momentumTotalLabel: { color: "#83AA9A", fontSize: 7, fontWeight: "900", letterSpacing: .6 },
  closeButton: { position: "absolute", top: -2, right: 0, width: 28, height: 28, borderRadius: 14, backgroundColor: "rgba(255,255,255,.08)", alignItems: "center", justifyContent: "center" },
  momentumIntro: { color: "#D2E2DB", fontSize: 12, lineHeight: 18, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.11)" },
  momentumSummary: { gap: 0 },
  momentumSummaryRow: { minHeight: 52, flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,.1)" },
  momentumSummaryTitle: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  momentumSummaryNote: { color: "#8FB0A2", fontSize: 9, marginTop: 2 },
  momentumSummaryValue: { color: "#43E69B", fontSize: 17, fontWeight: "900", fontVariant: ["tabular-nums"] },
  negative: { color: "#FF8D84" },
  momentumListHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  momentumListTitle: { color: "#B7CCC3", fontSize: 9, fontWeight: "900", letterSpacing: .7 },
  momentumListOrder: { color: "#79988B", fontSize: 8 },
  momentumList: { flexGrow: 0, maxHeight: 250 },
  momentumListContent: { gap: 8 },
  momentumMatch: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 12, backgroundColor: "rgba(255,255,255,.045)", borderWidth: 1, borderColor: "rgba(255,255,255,.08)" },
  momentumMatchPressed: { backgroundColor: "rgba(255,255,255,.1)" },
  momentumDate: { width: 37, color: "#AFC6BC", fontSize: 9, fontWeight: "800", textTransform: "uppercase" },
  momentumMatchCopy: { flex: 1, minWidth: 0, gap: 3 },
  momentumMatchTitle: { color: "#FFFFFF", fontSize: 11, fontWeight: "800" },
  momentumMatchNote: { color: "#9EB8AD", fontSize: 9, lineHeight: 13 },
  momentumMatchValue: { color: "#43E69B", fontSize: 12, fontWeight: "900", fontVariant: ["tabular-nums"] },
  momentumEmpty: { color: "#AFC6BC", fontSize: 11, lineHeight: 17, paddingVertical: 16, textAlign: "center" },
  momentumFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, borderWidth: 1, borderColor: "#C99A20", borderRadius: 12, padding: 12, backgroundColor: "rgba(201,154,32,.07)" },
  momentumEquation: { flex: 1, color: "#E4B940", fontSize: 8, fontWeight: "900" },
  momentumEquationTotal: { color: "#F4C53D", fontSize: 18, fontWeight: "900", fontVariant: ["tabular-nums"] },
});
