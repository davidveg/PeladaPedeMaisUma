import { useState } from "react";
import { StyleSheet, Text, useWindowDimensions, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { Avatar, Metric, Note, Panel, Person, Select, s } from "./statistics-ui";
import { closedAward, dateLabel, formationRows, monthLabel, momentum as signed, pitchColumns, type GeneralStatistics, type MonthlyAward, type MonthlyStanding } from "./statistics";

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
  if (!standing) return <Note>Sem jogador elegível.</Note>;
  return <LinearGradient colors={["#205F48", "#123E30"]} style={styles.champion}>
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
  </LinearGradient>;
}

export function MonthlyPitch({ award }: { award: MonthlyAward }) {
  const { fontScale } = useWindowDimensions();
  const [width, setWidth] = useState(0);
  const rows = formationRows(award), total = rows.reduce((sum, row) => sum + row.slots, 0);
  const columns = pitchColumns(width || 270, fontScale);
  return <View style={{ gap: 12 }}>
    <View style={s.row}><Text style={[s.title, s.grow]}>Seleção do mês</Text><Text style={s.label}>{award.selection.length}/{total}</Text></View>
    <View testID="monthly-pitch" onLayout={event => setWidth(event.nativeEvent.layout.width)} style={styles.pitch}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        <View style={styles.stripes}>{Array.from({ length: 6 }, (_, index) => <View key={index} style={{ flex: 1, backgroundColor: index % 2 ? "transparent" : "rgba(255,255,255,.035)" }}/>)}</View>
        <View style={styles.halfway}/><View style={styles.centerCircle}/><View style={[styles.box, { top: 0 }]}/><View style={[styles.box, { bottom: 0 }]}/>
      </View>
      {rows.map(row => <View key={row.role} style={styles.fieldRow}>
        <Text style={styles.fieldLabel}>{row.role.toLocaleUpperCase("pt-BR")}</Text>
        <View style={styles.formation}>
          {row.players.map(entry => <View key={entry.player.id} style={[styles.fieldPlayer, { width: `${100 / columns}%` }]}>
            <View style={styles.fieldPhoto}><Avatar player={entry.player} size={52}/></View>
            <Text style={styles.fieldName}>{entry.player.displayName}</Text>
            <Text style={styles.fieldScore}>{signed(entry.totalMomentum)} momentum</Text>
          </View>)}
          {Array.from({ length: Math.max(0, row.slots - row.players.length) }, (_, index) => <View key={`vacant-${index}`} style={[styles.fieldPlayer, { width: `${100 / columns}%` }]}>
            <View style={styles.vacant}><Ionicons name="person-outline" size={25} color="#E0F0E5"/></View>
            <Text style={styles.fieldScore}>Vaga disponível</Text>
          </View>)}
        </View>
      </View>)}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  champion: { padding: 18, borderRadius: 18, gap: 12, alignItems: "center" },
  championLabel: { color: "#DCFA6B", fontSize: 11, fontWeight: "900", letterSpacing: .7, flexShrink: 1, textAlign: "center" },
  championName: { color: "#FFFFFF", fontSize: 26, fontWeight: "900", textAlign: "center" },
  championNote: { color: "#E0F0E5", fontSize: 13, lineHeight: 20, textAlign: "center" },
  portrait: { padding: 14, borderRadius: 90, borderWidth: 1, borderColor: "#82AE96", marginTop: 4 },
  momentum: { color: "#DCFA6B", fontSize: 38, fontWeight: "900", fontVariant: ["tabular-nums"] },
  medal: { borderWidth: 1, borderLeftWidth: 5, borderRadius: 14, padding: 14, gap: 10, backgroundColor: "#F8FAF8" },
  pitch: { backgroundColor: "#216D45", borderWidth: 3, borderColor: "#BFDDC9", borderRadius: 16, paddingVertical: 18, paddingHorizontal: 8, overflow: "hidden", gap: 14 },
  stripes: { position: "absolute", top: 0, right: 0, bottom: 0, left: 0, flexDirection: "row" },
  halfway: { position: "absolute", top: "50%", width: "100%", borderTopWidth: 1, borderColor: "#8EBDA1" },
  centerCircle: { position: "absolute", top: "50%", left: "50%", width: 80, height: 80, borderRadius: 40, borderWidth: 1, borderColor: "#8EBDA1", transform: [{ translateX: -40 }, { translateY: -40 }] },
  box: { position: "absolute", left: "22%", width: "56%", height: 36, borderWidth: 1, borderColor: "#8EBDA1" },
  fieldRow: { gap: 8 }, fieldLabel: { color: "#DEF0E3", fontSize: 10, fontWeight: "800", paddingHorizontal: 6 },
  formation: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", rowGap: 14 },
  fieldPlayer: { alignItems: "center", paddingHorizontal: 4, gap: 5, minWidth: 0 },
  fieldPhoto: { borderRadius: 30, borderWidth: 2, borderColor: "#FFFFFF", overflow: "hidden" },
  fieldName: { color: "#FFFFFF", backgroundColor: "#103F2B", borderRadius: 6, overflow: "hidden", paddingVertical: 4, paddingHorizontal: 6, textAlign: "center", fontSize: 12, fontWeight: "800", maxWidth: "100%" },
  fieldScore: { color: "#FFFFFF", fontSize: 10, lineHeight: 15, textAlign: "center" },
  vacant: { width: 52, height: 52, borderRadius: 26, borderWidth: 1, borderStyle: "dashed", borderColor: "#C5DFC9", justifyContent: "center", alignItems: "center" },
});
