import { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, Switch, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";
import { useFocusEffect, useRouter } from "expo-router";
import { apiFetch } from "@/api";
import { useAuth } from "@/auth";
import { useMobileBranding } from "@/branding";
import { Button, ErrorState, Header, Screen, UpdatedAt } from "@/components";
import { MonthlyHonors } from "@/statistics-awards";
import { Chips, Loading, MatchLink, Metric, MoreList, Note, Panel, PeriodFilter, Person, RecordCard, Select, playerOptions, s } from "@/statistics-ui";
import { currentPeriod, fmt, sortAttendance, sortScorers, statisticsPath, type GeneralStatistics } from "@/statistics";

export default function StatisticsScreen() {
  const { account } = useAuth(), { palette } = useMobileBranding(), router = useRouter(), network = useNetInfo();
  const [period, setPeriod] = useState(() => currentPeriod("month"));
  const [section, setSection] = useState("highlights"), [includeGuests, setIncludeGuests] = useState(false);
  const [playerA, setPlayerA] = useState(""), [playerB, setPlayerB] = useState("");
  const [sort, setSort] = useState<"goals" | "assists" | "participations">("participations"), [ascending, setAscending] = useState(false);
  const [attendanceSort, setAttendanceSort] = useState<"presences" | "rate" | "name">("presences"), [attendanceAscending, setAttendanceAscending] = useState(false);
  const query = useQuery({
    queryKey: ["statistics", account?.id, period, playerA, playerB],
    queryFn: ({ signal }) => apiFetch<GeneralStatistics>(statisticsPath(false, { ...period, playerA, playerB }), { signal }),
    enabled: Boolean(account),
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => { void refetch(); }, [refetch]));
  const data = query.data;
  const scorers = useMemo(() => sortScorers(data?.leaderboard || [], includeGuests, sort, ascending), [data?.leaderboard, includeGuests, sort, ascending]);
  const attendance = useMemo(() => sortAttendance(data?.attendance || [], includeGuests, attendanceSort, attendanceAscending), [data?.attendance, includeGuests, attendanceSort, attendanceAscending]);
  const versus = data?.versus;
  return <Screen>
    <Header eyebrow="NÚMEROS DA PELADA" title="Estatísticas"/>
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><Chips value={section} onChange={setSection} options={[
      { value: "highlights", label: "Destaques" }, { value: "rankings", label: "Rankings" }, { value: "versus", label: "Confrontos" },
    ]}/></View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={palette.green}/>}>
      <View style={s.grid}>
        <View style={{ flexGrow: 1 }}><Button title="← Partidas" variant="secondary" onPress={() => router.navigate("/matches" as never)}/></View>
        <View style={{ flexGrow: 1 }}><Button title="Avançadas →" icon="line-chart" onPress={() => router.push("/advanced-statistics" as never)}/></View>
      </View>
      <PeriodFilter value={period} onChange={setPeriod} closedMonths={data?.careerHighlights.history.map(entry => entry.month)}/>
      <UpdatedAt value={query.dataUpdatedAt} offline={network.isConnected === false}/>
      {query.isError && <ErrorState message={query.error.message} retry={() => { void query.refetch(); }}/>} 
      {query.isPending && (network.isConnected === false ? <Note>Conecte-se à internet para carregar este período.</Note> : <Loading/>)}
      {data && <>
        <View style={s.grid}><Metric label="Partidas com resultado" value={data.coverage.matches}/><Metric label="Súmulas detalhadas" value={data.coverage.matchesWithContributions}/></View>
        {section === "highlights" && <>
          <RecordCard title="Maior sequência de vitórias" record={data.streaks.winning}/>
          <RecordCard title="Maior sequência invicta" record={data.streaks.unbeaten}/>
          <MonthlyHonors key={`${period.from}:${period.to}`} highlights={data.careerHighlights}/>
        </>}
        {section === "rankings" && <>
          <Panel title="Jogadores nos rankings"><View style={s.row}><View style={s.grow}><Text style={s.text}>Incluir convidados</Text><Note>Não altera a elegibilidade das premiações.</Note></View><Switch accessibilityLabel="Incluir convidados nos rankings" value={includeGuests} onValueChange={setIncludeGuests} trackColor={{ true: palette.green }}/></View></Panel>
          <Panel title="Gols e assistências" note="Somente súmulas detalhadas. Gols contra não são creditados ao jogador.">
            <Chips value={sort} onChange={value => setSort(value as typeof sort)} options={[{ value: "participations", label: "Participações" }, { value: "goals", label: "Gols" }, { value: "assists", label: "Assistências" }]}/>
            <Button title={ascending ? "Menor → maior ↑" : "Maior → menor ↓"} variant="secondary" onPress={() => setAscending(value => !value)}/>
            <MoreList items={scorers} render={(entry, index) => <View key={entry.player.id} style={s.separator}>
              <Person rank={index + 1} player={entry.player}/>
              <Text style={s.text}>{entry.goals} gols · {entry.assists} assistências · {entry.goals + entry.assists} participações</Text>
            </View>}/>
          </Panel>
          <Panel title="Ranking de assiduidade" note="Presenças nas equipes com resultado confirmado no período.">
            <Select label="Ordenar por" value={attendanceSort} options={[{ value: "presences", label: "Presenças" }, { value: "rate", label: "Assiduidade" }, { value: "name", label: "Nome" }]} onChange={value => setAttendanceSort(value as typeof attendanceSort)}/>
            <Button title={attendanceAscending ? "Ordem crescente ↑" : "Ordem decrescente ↓"} variant="secondary" onPress={() => setAttendanceAscending(value => !value)}/>
            <MoreList items={attendance} render={(entry, index) => <View key={entry.player.id} style={s.separator}>
              <Person rank={index + 1} player={entry.player} detail={`${entry.presences} de ${data.coverage.matches} partidas · ${fmt(entry.rate, 1, "%")}`}/>
              <View accessible accessibilityLabel={`${fmt(entry.rate, 1, "%")} de assiduidade`} style={{ height: 6, backgroundColor: "#E4ECE6", borderRadius: 3, overflow: "hidden" }}><View style={{ width: `${Math.max(0, Math.min(100, entry.rate))}%`, height: "100%", backgroundColor: palette.green }}/></View>
            </View>}/>
          </Panel>
        </>}
        {section === "versus" && <Panel title="Jogador versus jogador" note="Conta somente partidas em que os jogadores estiveram em equipes adversárias.">
          <Select label="Primeiro jogador" value={playerA} options={[{ value: "", label: "Escolha um jogador" }, ...playerOptions(data.players.filter(player => player.id !== playerB))]} onChange={setPlayerA}/>
          <Select label="Segundo jogador" value={playerB} options={[{ value: "", label: "Escolha outro jogador" }, ...playerOptions(data.players.filter(player => player.id !== playerA))]} onChange={setPlayerB}/>
          {versus?.playerA && versus.playerB ? <>
            <View style={s.separator}><Person player={versus.playerA} detail={`${versus.winsA} vitórias`}/><Person player={versus.playerB} detail={`${versus.winsB} vitórias`}/></View>
            <View style={s.grid}><Metric label="Confrontos" value={versus.totalMatches ?? versus.matches.length}/><Metric label="Empates" value={versus.draws}/></View>
            {versus.matchDetailsRestricted ? <Note>Entre novamente na sua conta para consultar as partidas.</Note> : <MoreList items={versus.matches} render={match => <View key={match.id} style={{ gap: 6 }}>
              <MatchLink match={match}/><Text style={s.label}>{match.result === "DRAW" ? "Empate" : `${match.result === "A" ? versus.playerA!.displayName : versus.playerB!.displayName} venceu`}</Text>
            </View>}/>}
          </> : <Note>Selecione dois jogadores para consultar o retrospecto.</Note>}
        </Panel>}
      </>}
    </ScrollView>
  </Screen>;
}
