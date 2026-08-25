import { StyleSheet, Text, View } from "react-native";
import { Card } from "./components";
import { colors } from "./theme";
import { useMobileBranding } from "./branding";
import type { TeamAdvantage, TeamDelta, TeamMetrics, TeamResult } from "./types";

type MetricKey = "players"|"defenders"|"midfielders"|"attackers"|"speed"|"skill"|"marking"|"tacticalIntelligence"|"competitiveness"|"momentum"|"historicalLearning"|"score";

const explanations: Record<string, string> = {
  "Excelente equilíbrio": "Diferenças muito pequenas entre posições, atributos e pontuação.",
  "Bom equilíbrio": "Times próximos, com pequenas diferenças que não comprometem a partida.",
  "Equilíbrio aceitável": "Há diferenças perceptíveis, mas a divisão ainda tende a ser competitiva.",
  "Equilíbrio limitado": "Existem diferenças relevantes de quantidade, posições ou nível entre os times.",
};

function tone(rating: string) {
  if (rating.startsWith("Excelente")) return { color: colors.success, soft: "#EDF8F1" };
  if (rating.startsWith("Bom")) return { color: colors.blue, soft: colors.blueSoft };
  if (rating.startsWith("Aceitável")) return { color: colors.yellow, soft: colors.yellowSoft };
  return { color: colors.danger, soft: colors.dangerSoft };
}

export function BalanceDetails({ result, fallbackRating }: { result: TeamResult; fallbackRating?: string }) {
  const { config: brand, palette: teamPalette } = useMobileBranding();
  const rating = result.rating || fallbackRating || "Equilíbrio não informado", palette = tone(rating);
  const delta = result.delta || emptyDelta,usesBaseTeams=Boolean(delta.baseTeams||result.extraId),blueAverageMetrics=result.blueBaseMetrics||result.blueMetrics,yellowAverageMetrics=result.yellowBaseMetrics||result.yellowMetrics;
  const metrics: { key:MetricKey; label:string; value:number; decimals:number }[] = [
    {key:"players",label:"Jogadores",value:delta.players,decimals:0},{key:"defenders",label:"Defensores",value:delta.defenders,decimals:0},{key:"midfielders",label:"Meio-campo",value:delta.midfielders,decimals:0},
    {key:"attackers",label:"Atacantes",value:delta.attackers,decimals:0},{key:"speed",label:"Físico / Pos.",value:delta.speed,decimals:1},{key:"skill",label:"Técnica / Def.",value:delta.skill,decimals:1},
    {key:"marking",label:"Marcação / Pés",value:delta.marking,decimals:1},{key:"tacticalIntelligence",label:"Tática / Segurança",value:delta.tacticalIntelligence,decimals:1},
    {key:"competitiveness",label:"Comp. / Liderança",value:delta.competitiveness,decimals:1},{key:"momentum",label:"Momentum",value:delta.momentum,decimals:1},
    ...(result.historicalLearningEnabled||Number(delta.historicalLearning??0)!==0?[{key:"historicalLearning" as const,label:"Histórico observado",value:Number(delta.historicalLearning??0),decimals:2}]:[]),
    {key:"score",label:"Pontuação",value:delta.score,decimals:2},
  ];
  const metricSide=(key:MetricKey,value:number)=>value===0?"EVEN":delta.advantage?.[key]||advantageFromMetrics(key,result.blueMetrics,result.yellowMetrics);
  const sideLabel=(side:TeamAdvantage)=>side==="BLUE"?`Time ${brand.teamBlueName}`:side==="YELLOW"?`Time ${brand.teamYellowName}`:"Sem diferença";
  const sideColor=(side:TeamAdvantage)=>side==="BLUE"?teamPalette.blue:side==="YELLOW"?teamPalette.yellow:colors.muted;
  return <Card style={styles.card}>
    <View style={[styles.rating, { backgroundColor: palette.soft, borderColor: palette.color }]}>
      <Text style={[styles.ratingLabel, { color: palette.color }]}>INDICADOR ATUAL</Text>
      <Text style={[styles.ratingTitle, { color: palette.color }]}>{rating}</Text>
      <Text style={styles.explanation}>{explanations[rating] || "Classificação registrada para esta separação."}</Text>
    </View>
    <View style={styles.section}>
      <Text style={styles.heading}>Diferenças entre os times</Text>
      <Text style={styles.hint}>{usesBaseTeams?"Os atributos e a pontuação comparam times-base do mesmo tamanho; o jogador adicional fica fora desses indicadores.":"Quanto mais próximo de zero, mais semelhantes estão os times."}</Text>
      <View style={styles.metricGrid}>{metrics.map(metric=>{const side=metricSide(metric.key,Number(metric.value||0));return <View key={metric.key} style={styles.metric}><Text style={styles.metricLabel}>{metric.label}</Text><Text style={styles.metricValue}>{Number(metric.value||0).toFixed(metric.decimals)}</Text><Text style={[styles.metricSide,{color:sideColor(side)}]}>{sideLabel(side)}</Text></View>})}</View>
    </View>
    {blueAverageMetrics && yellowAverageMetrics ? <View style={styles.teamAverages}>
      <View style={[styles.teamAverage, { backgroundColor: teamPalette.blueSoft }]}><Text style={{ color: teamPalette.blue, fontWeight: "900" }}>{brand.teamBlueName.toLocaleUpperCase("pt-BR")}</Text><Text style={styles.averageValue}>{blueAverageMetrics.scoreAvg.toFixed(2)}</Text><Text style={styles.metricLabel}>{usesBaseTeams?"média do time-base":"média geral"}</Text></View>
      <View style={[styles.teamAverage, { backgroundColor: teamPalette.yellowSoft }]}><Text style={{ color: teamPalette.yellow, fontWeight: "900" }}>{brand.teamYellowName.toLocaleUpperCase("pt-BR")}</Text><Text style={styles.averageValue}>{yellowAverageMetrics.scoreAvg.toFixed(2)}</Text><Text style={styles.metricLabel}>{usesBaseTeams?"média do time-base":"média geral"}</Text></View>
    </View> : null}
    <View style={styles.section}>
      <Text style={styles.heading}>Como o algoritmo classificou</Text>
      <Text style={styles.hint}>Custo atual: {Number(result.cost || 0).toFixed(1)} — menor é melhor.</Text>
      <Text style={styles.ranges}>Excelente: abaixo de 35 · Bom: 35–79 · Aceitável: 80–149 · Limitado: 150 ou mais</Text>
      <Text style={styles.config}>Linha: Físico {Math.round(Number(result.speedWeight || 0) * 100)}% · Técnica {Math.round(Number(result.skillWeight || 0) * 100)}% · Marcação {Math.round(Number(result.markingWeight || 0) * 100)}% · Tática {Math.round(Number(result.tacticalIntelligenceWeight || 0) * 100)}% · Competitividade {Math.round(Number(result.competitivenessWeight || 0) * 100)}%</Text>
      <Text style={styles.config}>Goleiros: Defesas {Math.round(Number(result.goalkeeperDefensesWeight || 0) * 100)}% · Posicionamento {Math.round(Number(result.goalkeeperPositioningWeight || 0) * 100)}% · Segurança {Math.round(Number(result.goalkeeperSafetyWeight || 0) * 100)}% · Jogo com os pés {Math.round(Number(result.goalkeeperFootworkWeight || 0) * 100)}% · Liderança {Math.round(Number(result.goalkeeperLeadershipWeight || 0) * 100)}%</Text>
      <Text style={styles.config}>Diferença máx. por posição: {result.maximumPositionDifference ?? "—"} · Melhores protegidos: {result.protectedTopPlayersPercentage == null ? "—" : `${Math.round(result.protectedTopPlayersPercentage * 100)}%`} · Tentativas: {result.algorithmAttempts ?? "—"}</Text>
    </View>
  </Card>;
}

function advantageFromMetrics(key:MetricKey,blue?:TeamMetrics,yellow?:TeamMetrics):TeamAdvantage {
  if(!blue||!yellow)return "EVEN";
  const values:Record<MetricKey,[number,number]>={
    players:[blue.count,yellow.count],defenders:[blue.positions.Defesa,yellow.positions.Defesa],midfielders:[blue.positions["Meio-campo"],yellow.positions["Meio-campo"]],attackers:[blue.positions.Ataque,yellow.positions.Ataque],
    speed:[blue.speed,yellow.speed],skill:[blue.skill,yellow.skill],marking:[blue.marking,yellow.marking],tacticalIntelligence:[blue.tacticalIntelligence,yellow.tacticalIntelligence],competitiveness:[blue.competitiveness,yellow.competitiveness],
    momentum:[blue.momentum,yellow.momentum],historicalLearning:[Number(blue.historicalLearning??0),Number(yellow.historicalLearning??0)],score:[blue.total,yellow.total],
  };
  const [blueValue,yellowValue]=values[key];return blueValue===yellowValue?"EVEN":blueValue>yellowValue?"BLUE":"YELLOW";
}

const emptyDelta: TeamDelta = { players: 0, defenders: 0, midfielders: 0, attackers: 0, speed: 0, skill: 0, marking: 0, tacticalIntelligence:0, competitiveness:0, momentum: 0, score: 0 };
const styles = StyleSheet.create({
  card: { gap: 16 }, rating: { gap: 4, padding: 12, borderRadius: 12, borderWidth: 1 }, ratingLabel: { fontSize: 11, fontWeight: "900", letterSpacing: 1 }, ratingTitle: { fontSize: 20, fontWeight: "900" }, explanation: { color: colors.text, lineHeight: 20 }, section: { gap: 6 }, heading: { color: colors.text, fontSize: 17, fontWeight: "900" }, hint: { color: colors.muted, lineHeight: 19 }, metricGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 }, metric: { width: "31%", minWidth: 88, minHeight:92, padding: 9, borderRadius: 10, backgroundColor: colors.cream }, metricLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" }, metricValue: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop:3 }, metricSide:{fontSize:10,fontWeight:"900",marginTop:4}, teamAverages: { flexDirection: "row", gap: 10 }, teamAverage: { flex: 1, padding: 11, borderRadius: 11 }, averageValue: { color: colors.text, fontSize: 20, fontWeight: "900" }, ranges: { color: colors.text, lineHeight: 20, fontWeight: "700" }, config: { color: colors.muted, lineHeight: 19 },
});
