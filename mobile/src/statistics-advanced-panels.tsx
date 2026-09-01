import { Text, View } from "react-native";
import { useRouter } from "expo-router";
import { Button } from "./components";
import { Avatar, MatchLink, Metric, MoreList, Note, Panel, Person, RecordCard, s } from "./statistics-ui";
import { advancedHighlights, dateLabel, fmt, playerPartnerships, signed, type AdvancedStatistics, type Partnership, type PlayerStatistics, type StatsPlayer } from "./statistics";

export const statisticsHelp = {
  ipi: "O Índice de Performance Individual combina resultado, saldo, produção ofensiva, forma recente, consistência e avaliação dos colegas. Os pesos variam conforme a posição. Componentes sem dados não valem zero: o servidor usa apenas os disponíveis. A confiança cresce com o número de jogos.",
  impact: "Compara o aproveitamento dos times com o jogador e a base das partidas sem ele. É uma associação estatística, não uma relação de causa e efeito. Sem amostra para comparação, o campo fica sem dados.",
  plusMinus: "Saldo de gols da equipe nas partidas em que o jogador participou. Não é uma medição de minutos em campo: considera a equipe registrada na escalação.",
  form: "Resultados nas últimas 5, 10 ou 20 partidas do período escolhido, em ordem cronológica. V = vitória, E = empate, D = derrota. A variação compara o aproveitamento recente com o anterior, em pontos percentuais.",
  chemistry: "Índice de entrosamento calculado com partidas juntos, aproveitamento e saldo médio. A amostra mínima filtra duplas com poucos jogos e a confiança cresce com o histórico compartilhado.",
  consistency: "Regularidade do desempenho nas partidas do período. Valores mais altos indicam menor oscilação. Quando a amostra é insuficiente, não há percentual disponível.",
  balance: "A previsão usa apenas escalações automáticas com força registrada. Ajustes manuais ficam fora da correlação entre força prevista e placar. As distribuições de placar consideram todas as partidas do período.",
};

export function AdvancedOverview({ data, onPlayer }: { data: AdvancedStatistics; onPlayer(id: string): void }) {
  return <>
    <Panel title="Quem mais impactou o período">
      {advancedHighlights(data).map(item => <View key={item.label} style={s.separator}>
        <Text style={s.label}>{item.label}</Text><Text style={s.value}>{item.value}</Text>
        {item.player ? <Person player={item.player}/> : <Note>Dados insuficientes para esta comparação.</Note>}
      </View>)}
      <View style={s.separator}><Text style={s.label}>Melhor dupla</Text>{data.partnerships[0] ? <PartnershipCard pair={data.partnerships[0]}/> : <Note>Nenhuma dupla com a amostra mínima escolhida.</Note>}</View>
    </Panel>
    <Panel title="Destaques do ranking IPI" help={statisticsHelp.ipi}>
      {data.players.slice(0, 5).map((entry, index) => <View style={s.separator} key={entry.player.id}>
        <Person player={entry.player} rank={index + 1} detail={`${entry.position} · IPI ${fmt(entry.ipi?.value)} · ${entry.games} jogos`}/>
        <Button title="Ver análise do jogador" variant="secondary" onPress={() => onPlayer(entry.player.id)}/>
      </View>)}
      {!data.players.length && <Note>Sem partidas suficientes para os filtros selecionados.</Note>}
    </Panel>
  </>;
}

export function PlayerAnalysis({ entry, partnerships }: { entry: PlayerStatistics; partnerships: Partnership[] }) {
  const partner = playerPartnerships(partnerships, entry.player.id)[0];
  return <>
    <View style={{ borderRadius: 16, backgroundColor: "#174B38", padding: 18, gap: 12, alignItems: "center" }}>
      <Avatar player={entry.player} size={84}/>
      <Text style={[s.title, { color: "#FFF", textAlign: "center" }]}>{entry.player.displayName}</Text>
      <Text style={{ color: "#E3F0E7", textAlign: "center" }}>{entry.position} · {entry.games} jogos</Text>
      <Text style={{ color: "#DCFA6B", fontSize: 36, fontWeight: "900", textAlign: "center" }}>{entry.ipi ? fmt(entry.ipi.value) : "—"}<Text style={{ fontSize: 14 }}> / 100 IPI</Text></Text>
      <Text style={{ color: "#E3F0E7", textAlign: "center", fontSize: 12 }}>Confiança: {entry.ipi?.confidence || "dados insuficientes"}</Text>
    </View>
    <View style={s.grid}>
      <Metric label="Aproveitamento" value={fmt(entry.utilization, 1, "%")}/>
      <Metric label="Campanha" value={`${entry.wins}V · ${entry.draws}E · ${entry.losses}D`}/>
      <Metric label="Saldo +/− total" value={signed(entry.plusMinus)} help={statisticsHelp.plusMinus}/>
      <Metric label="Saldo por jogo" value={signed(entry.plusMinusPerGame)}/>
      <Metric label="Gols da equipe" value={entry.goalsFor}/><Metric label="Gols sofridos" value={entry.goalsAgainst}/>
      <Metric label="Gols do jogador" value={entry.contributionGames ? entry.goals : "Sem dados"}/>
      <Metric label="Assistências" value={entry.contributionGames ? entry.assists : "Sem dados"}/>
      <Metric label="Participações em gol" value={entry.contributionGames ? entry.goals + entry.assists : "Sem dados"}/>
      <Metric label="Consistência" value={fmt(entry.consistency, 1, "%")} help={statisticsHelp.consistency}/>
      <Metric label="Impacto no aproveitamento" value={signed(entry.impact.utilizationDifference, " p.p.")} help={statisticsHelp.impact}/>
      <Metric label="Impacto no saldo médio" value={signed(entry.impact.plusMinusDifference)}/>
    </View>
    <Note>Gols e assistências têm cobertura em {entry.contributionGames} das {entry.games} partidas. Impacto indica associação, não causalidade.</Note>
    <View style={s.separator}>
      <Text style={s.title}>Forma recente</Text>
      <Note>{entry.recent.games} de até {entry.recent.window} jogos · do mais antigo ao mais recente</Note>
      <View style={[s.grid, { gap: 6 }]}>{entry.recent.sequence.map((result, index) => <View key={index} accessible accessibilityLabel={`Jogo ${index + 1}: ${result === "V" ? "vitória" : result === "E" ? "empate" : "derrota"}`} style={{ minWidth: 32, padding: 8, borderRadius: 10, backgroundColor: result === "V" ? "#21643F" : result === "D" ? "#AF3333" : "#57635E", alignItems: "center" }}><Text style={{ color: "#FFF", fontWeight: "800" }}>{result}</Text></View>)}</View>
      <View style={s.grid}>
        <Metric label="Aproveitamento recente" value={fmt(entry.recent.utilization, 1, "%")}/>
        <Metric label="Variação recente" value={signed(entry.recent.trend, " p.p.")} help={statisticsHelp.form}/>
        <Metric label="Gols recentes" value={entry.recent.contributionGames ? entry.recent.goals : "Sem dados"}/>
        <Metric label="Assistências recentes" value={entry.recent.contributionGames ? entry.recent.assists : "Sem dados"}/>
        <Metric label="Saldo recente" value={signed(entry.recent.plusMinus)}/>
      </View>
    </View>
    <View style={s.separator}><Text style={s.title}>Melhor parceria</Text>{partner ? <PartnershipCard pair={partner} centerId={entry.player.id}/> : <Note>Nenhuma parceria com a amostra mínima selecionada.</Note>}</View>
  </>;
}

export function PlayerRanking({ entries }: { entries: PlayerStatistics[] }) {
  return <MoreList items={entries} render={(entry, index) => <View key={entry.player.id} style={s.separator}>
    <Person rank={index + 1} player={entry.player} detail={`${entry.position} · ${entry.games} jogos`}/>
    <View style={s.grid}>
      <Metric label="IPI" value={fmt(entry.ipi?.value)}/><Metric label="Confiança" value={entry.ipi?.confidence || "Sem dados"}/>
      <Metric label="Saldo +/−" value={signed(entry.plusMinus)}/><Metric label="Aproveitamento" value={fmt(entry.utilization, 1, "%")}/>
      <Metric label="Forma recente" value={signed(entry.recent.trend, " p.p.")}/><Metric label="Consistência" value={fmt(entry.consistency, 1, "%")}/>
    </View>
  </View>}/>;
}

export function PartnershipCard({ pair, centerId }: { pair: Partnership; centerId?: string }) {
  const players = centerId ? [pair.playerA.id === centerId ? pair.playerB : pair.playerA] : [pair.playerA, pair.playerB];
  return <View style={{ gap: 10 }}>
    {players.map(player => <Person key={player.id} player={player}/>)}
    <Text style={[s.text, { fontWeight: "800" }]}>{fmt(pair.chemistry)} / 100 de entrosamento</Text>
    <View style={{ height: 6, borderRadius: 3, backgroundColor: "#DAE6DD", overflow: "hidden" }}><View style={{ height: "100%", width: `${Math.max(0, Math.min(100, pair.chemistry))}%`, backgroundColor: "#276F4E" }}/></View>
    <Note>{pair.games} jogos · {pair.wins}V · {pair.draws}E · {pair.losses}D</Note>
    <Note>{fmt(pair.utilization, 1, "%")} de aproveitamento · saldo {signed(pair.plusMinus)} · confiança {fmt(pair.confidence, 1, "%")}</Note>
  </View>;
}

export function ChemistryNetwork({ player, pairs }: { player?: StatsPlayer; pairs: Partnership[] }) {
  if (!player) return <Note>Selecione um jogador para consultar suas conexões.</Note>;
  return <View style={{ gap: 16 }}>
    <View style={{ borderRadius: 14, backgroundColor: "#EAF3ED", padding: 16, gap: 10, alignItems: "center" }}>
      <Avatar player={player} size={66}/><Text style={[s.title, { textAlign: "center" }]}>{player.displayName}</Text><Note>Parcerias no mesmo time</Note>
    </View>
    <MoreList items={pairs} pageSize={8} render={pair => <View key={`${pair.playerA.id}:${pair.playerB.id}`} style={{ borderLeftWidth: 3, borderColor: "#90B49D", paddingLeft: 14, gap: 8 }}><PartnershipCard pair={pair} centerId={player.id}/></View>}/>
  </View>;
}

export function BalanceAnalysis({ data }: { data: AdvancedStatistics }) {
  const { balance } = data;
  return <Panel title="Qualidade do balanceamento" help={statisticsHelp.balance}>
    <View style={s.grid}>
      <Metric label="Equilíbrio médio previsto" value={fmt(balance.averagePredictedBalance, 1, "%")}/>
      <Metric label="Diferença média do placar" value={fmt(balance.averageGoalDifference)}/>
      <Metric label="Jogos decididos por 1 gol" value={fmt(balance.oneGoalGamesPercentage, 1, "%")}/>
      <Metric label="Empates" value={fmt(balance.drawsPercentage, 1, "%")}/>
      <Metric label="Goleadas (4+ gols)" value={fmt(balance.blowoutsPercentage, 1, "%")}/>
      <Metric label="Correlação previsão × placar" value={fmt(balance.correlation, 3)}/>
    </View>
    <Note>{balance.sample} previsões automáticas utilizáveis, de {data.coverage.matches} partidas analisadas.</Note>
    <Note>{balance.predictionErrorReason}</Note>
  </Panel>;
}

export function AdvancedRecords({ records }: { records: AdvancedStatistics["records"] }) {
  const router = useRouter();
  const aggregates = [
    { title: "Maior saldo acumulado", player: records.highestPlusMinus?.player, value: signed(records.highestPlusMinus?.plusMinus) },
    { title: "Maior aproveitamento", player: records.bestUtilization?.player, value: fmt(records.bestUtilization?.utilization, 1, "%") },
    { title: "Maior IPI", player: records.highestIpi?.player, value: fmt(records.highestIpi?.ipi?.value) },
    { title: "Maior consistência", player: records.highestConsistency?.player, value: fmt(records.highestConsistency?.consistency, 1, "%") },
  ];
  return <>
    {([{ key: "wins", title: "Vitórias seguidas" }, { key: "unbeaten", title: "Invencibilidade" }, { key: "losses", title: "Derrotas seguidas" }, { key: "goals", title: "Jogos seguidos marcando" }, { key: "assists", title: "Jogos seguidos com assistência" }] as const).map(item => <RecordCard key={item.key} title={item.title} record={records[item.key]}/>)}
    <Panel title="Recordes individuais" note="Maior IPI, aproveitamento e consistência exigem pelo menos três jogos.">
      {aggregates.map(item => <View key={item.title} style={s.separator}><Text style={s.label}>{item.title}</Text><Text style={s.value}>{item.value}</Text>{item.player && <Person player={item.player}/>}</View>)}
    </Panel>
    {records.matchDetailsRestricted ? <Panel title="Recordes por partida"><Note>Entre novamente na sua conta para consultar os detalhes das partidas.</Note></Panel> : <>
      {[{ title: "Gols em uma partida", record: records.mostGoals }, { title: "Assistências em uma partida", record: records.mostAssists }].map(item => <Panel key={item.title} title={item.title}>
        {item.record ? <><Text style={s.value}>{item.record.value}</Text><Person player={item.record.player}/><Note>{item.record.title} · {dateLabel(item.record.date)}</Note><Button title="Ver partida" variant="secondary" onPress={() => router.push({ pathname: "/separations/[id]", params: { id: item.record!.separationId } })}/></> : <Note>Sem registros no período.</Note>}
      </Panel>)}
      <Panel title="Maior goleada">{records.biggestBlowout ? <MatchLink match={records.biggestBlowout}/> : <Note>Sem jogos no período.</Note>}</Panel>
      <Panel title="Partida com mais gols">{records.highestScoring ? <><Text style={s.value}>{records.highestScoring.blueScore + records.highestScoring.yellowScore} gols</Text><MatchLink match={records.highestScoring}/></> : <Note>Sem jogos no período.</Note>}</Panel>
    </>}
  </>;
}
