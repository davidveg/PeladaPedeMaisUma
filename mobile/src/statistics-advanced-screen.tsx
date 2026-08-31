import { useCallback, useState } from "react";
import { RefreshControl, ScrollView, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNetInfo } from "@react-native-community/netinfo";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { apiFetch } from "./api";
import { useAuth } from "./auth";
import { useMobileBranding } from "./branding";
import { Button, ErrorState, Header, Screen, UpdatedAt } from "./components";
import { AdvancedOverview, AdvancedRecords, BalanceAnalysis, ChemistryNetwork, PartnershipCard, PlayerAnalysis, PlayerRanking, statisticsHelp } from "./statistics-advanced-panels";
import { Chips, Loading, Metric, MoreList, Note, Panel, PeriodFilter, Select, playerOptions, s } from "./statistics-ui";
import { currentPeriod, playerPartnerships, positions, resolveStatisticsPlayer, statisticsPath, type AdvancedStatistics } from "./statistics";

const minimumOptions = Array.from({ length: 100 }, (_, index) => ({ value: String(index + 1), label: `${index + 1} ${index ? "jogos" : "jogo"}` }));

export default function AdvancedStatisticsScreen() {
  const { account } = useAuth(), { palette } = useMobileBranding(), router = useRouter(), network = useNetInfo();
  const params = useLocalSearchParams<{ player?: string }>();
  const [period, setPeriod] = useState(() => currentPeriod("year")), [section, setSection] = useState(params.player ? "players" : "overview");
  const [filtersOpen, setFiltersOpen] = useState(false), [season, setSeason] = useState(""), [position, setPosition] = useState("");
  const [recent, setRecent] = useState("5"), [minimumGames, setMinimumGames] = useState("1"), [pairMinimum, setPairMinimum] = useState("3");
  const [selectedPlayer, setSelectedPlayer] = useState(params.player || ""), [networkPlayer, setNetworkPlayer] = useState(params.player || account?.playerId || "");
  const [rankingPosition, setRankingPosition] = useState("");
  const query = useQuery({
    queryKey: ["advanced-statistics", account?.id, period, season, position, recent, minimumGames, pairMinimum],
    queryFn: ({ signal }) => apiFetch<AdvancedStatistics>(statisticsPath(true, { ...period, season, position, recent, minimumGames, partnershipMinimumGames: pairMinimum }), { signal }),
    enabled: Boolean(account),
  });
  const refetch = query.refetch;
  useFocusEffect(useCallback(() => {
    void refetch();
    if (params.player) { setSelectedPlayer(params.player); setSection("players"); }
  }, [params.player, refetch]));
  const data = query.data, selected = resolveStatisticsPlayer(data?.players || [], selectedPlayer, account?.playerId);
  const center = data?.allPlayers.find(player => player.id === networkPlayer) || selected?.player || data?.allPlayers[0];
  const related = playerPartnerships(data?.partnerships || [], center?.id || "");
  const goToPlayer = (id: string) => { setSelectedPlayer(id); setSection("players"); };
  return <Screen>
    <Header eyebrow="ANÁLISE DE PERFORMANCE" title="Estatísticas avançadas"/>
    <View style={{ paddingHorizontal: 16, paddingBottom: 8 }}><Chips value={section} onChange={setSection} options={[
      { value: "overview", label: "Visão geral" }, { value: "players", label: "Jogadores" }, { value: "partners", label: "Entrosamento" }, { value: "records", label: "Recordes" }, { value: "balance", label: "Equilíbrio" },
    ]}/></View>
    <ScrollView contentContainerStyle={s.content} refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={() => { void query.refetch(); }} tintColor={palette.green}/>}>
      <Button title="← Estatísticas gerais" variant="secondary" onPress={() => router.navigate("/statistics" as never)}/>
      <PeriodFilter compact value={period} onChange={value => { setPeriod(value); setSeason(""); }}/>
      <Panel title="Filtros da análise">
        <Note>{position || "Todas as posições"} · {season ? `Temporada ${season}` : "Todas as temporadas"} · forma: últimos {recent} jogos · mínimo: {minimumGames} jogos / {pairMinimum} em dupla</Note>
        <Button title={filtersOpen ? "Recolher filtros" : "Alterar filtros"} variant="secondary" onPress={() => setFiltersOpen(value => !value)}/>
        {filtersOpen && <>
          <Select label="Temporada no período" value={season} options={[{ value: "", label: "Todas" }, ...(data?.seasons || []).map(value => ({ value: String(value), label: `Temporada ${value}` }))]} onChange={setSeason}/>
          <Select label="Posição" value={position} options={[{ value: "", label: "Todas" }, ...positions.map(value => ({ value, label: value }))]} onChange={value => { setPosition(value); setRankingPosition(""); }}/>
          <Select label="Forma recente" value={recent} options={[5, 10, 20].map(value => ({ value: String(value), label: `Últimos ${value} jogos` }))} onChange={setRecent}/>
          <Select label="Mínimo de jogos por jogador" value={minimumGames} options={minimumOptions} onChange={setMinimumGames}/>
          <Select label="Mínimo de jogos da dupla" value={pairMinimum} options={minimumOptions} onChange={setPairMinimum}/>
        </>}
      </Panel>
      <UpdatedAt value={query.dataUpdatedAt} offline={network.isConnected === false}/>
      {query.isError && <ErrorState message={query.error.message} retry={() => { void query.refetch(); }}/>} 
      {query.isPending && (network.isConnected === false ? <Note>Conecte-se à internet para carregar este período.</Note> : <Loading/>)}
      {data && <>
        {section === "overview" && <>
          <View style={s.grid}><Metric label="Partidas analisadas" value={data.coverage.matches}/><Metric label="Com súmula detalhada" value={data.coverage.detailedContributions}/><Metric label="Com votos encerrados" value={data.coverage.closedVotes}/><Metric label="Previsões automáticas" value={data.coverage.automaticPredictions}/></View>
          <Note>Fórmula v{data.version}. Componentes sem cobertura não são tratados como zero.</Note>
          <AdvancedOverview data={data} onPlayer={goToPlayer}/>
        </>}
        {section === "players" && <>
          <Panel title="Análise completa do jogador" help={statisticsHelp.ipi}>
            <Select label="Jogador analisado" value={selected?.player.id || ""} options={playerOptions(data.players.map(entry => entry.player))} onChange={setSelectedPlayer}/>
            {selected ? <PlayerAnalysis entry={selected} partnerships={data.partnerships}/> : <Note>Sem partidas suficientes para os filtros selecionados.</Note>}
          </Panel>
          <Panel title="Ranking IPI e impacto" help={statisticsHelp.ipi}>
            <Select label="Ranking por função" value={rankingPosition} options={[{ value: "", label: "Todas as funções" }, ...positions.map(value => ({ value, label: value }))]} onChange={setRankingPosition}/>
            <PlayerRanking entries={rankingPosition ? data.positionRankings[rankingPosition] || [] : data.players}/>
          </Panel>
        </>}
        {section === "partners" && <>
          <Panel title="Rede de entrosamento" help={statisticsHelp.chemistry} note="As conexões são exibidas em lista para manter fotos e nomes legíveis no celular.">
            <Select label="Centro da rede" value={center?.id || ""} options={playerOptions(data.allPlayers)} onChange={setNetworkPlayer}/>
            <ChemistryNetwork player={center} pairs={related}/>
          </Panel>
          <Panel title="Melhores duplas" help={statisticsHelp.chemistry}>
            <MoreList items={data.partnerships} pageSize={12} render={(pair, index) => <View key={`${pair.playerA.id}:${pair.playerB.id}`} style={s.separator}><Text style={s.label}>{index + 1}º lugar</Text><PartnershipCard pair={pair}/></View>}/>
          </Panel>
        </>}
        {section === "records" && <AdvancedRecords records={data.records}/>}
        {section === "balance" && <BalanceAnalysis data={data}/>}
      </>}
    </ScrollView>
  </Screen>;
}
