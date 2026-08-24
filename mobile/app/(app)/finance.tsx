import Ionicons from "@expo/vector-icons/Ionicons";
import { useQuery } from "@tanstack/react-query";
import { Alert, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { API_BASE_URL, apiFetch } from "@/api";
import { useMobileBranding } from "@/branding";
import { Button, Card, EmptyState, ErrorState, Header, Screen } from "@/components";
import {
  competenceLabel, financeStatusLabels, type FinanceCharge, type FinancePayload, money, monthlyPaymentsMessage, moveCompetence,
} from "@/finance";
import { shareText } from "@/sharing";
import { colors } from "@/theme";
import { useState } from "react";

export default function FinanceScreen() {
  const { config, palette } = useMobileBranding();
  const [competence, setCompetence] = useState(new Date().toISOString().slice(0, 7));
  const query = useQuery({
    queryKey: ["finance", competence],
    queryFn: () => apiFetch<FinancePayload>(`/api/finance?competence=${competence}`),
    enabled: config.financeEnabled,
  });
  const data = query.data;
  if (!config.financeEnabled) return <Screen><Header title="Financeiro"/><EmptyState title="Módulo indisponível" message="A gestão financeira está desativada para esta pelada."/></Screen>;
  return <Screen><Header eyebrow={data?.viewer.canManage ? "GESTÃO FINANCEIRA" : "MEU FINANCEIRO"} title={data?.viewer.canManage ? "Financeiro da pelada" : "Minhas cobranças"}/>
    {query.isError && !data ? <ErrorState message={(query.error as Error).message} retry={() => query.refetch()}/> : <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={query.isRefetching} onRefresh={query.refetch} tintColor={palette.green}/>}
    >
      {data?.viewer.canManage ? <ManagerFinance data={data} competence={competence} setCompetence={setCompetence}/> : data ? <PlayerFinance data={data}/> : <Text style={[styles.muted, { color: palette.muted }]}>Carregando informações financeiras…</Text>}
    </ScrollView>}
  </Screen>;
}

function ManagerFinance({ data, competence, setCompetence }: { data: FinancePayload; competence: string; setCompetence(value: string): void }) {
  const { palette } = useMobileBranding();
  const summary = data.summary;
  const monthly = data.charges.filter(charge => charge.type === "MONTHLY_FEE");
  async function share() {
    try { await shareText(monthlyPaymentsMessage(data)); }
    catch (cause) { Alert.alert("Não foi possível compartilhar", cause instanceof Error ? cause.message : "Tente novamente."); }
  }
  return <>
    <MonthPicker value={competence} onChange={setCompetence}/>
    {summary ? <View style={styles.metrics}>
      <Metric label="Saldo atual" value={money(summary.currentBalanceCents)} positive={summary.currentBalanceCents >= 0}/>
      <Metric label="Receitas do mês" value={money(summary.incomeCents)} positive/>
      <Metric label="Despesas do mês" value={money(summary.expenseCents)} negative/>
      <Metric label="Resultado do mês" value={money(summary.resultCents)} positive={summary.resultCents >= 0} negative={summary.resultCents < 0}/>
      <Metric label="A receber" value={money(summary.receivableCents)}/>
      <Metric label="A pagar" value={money(summary.payableCents)}/>
    </View> : null}
    <Card style={styles.actions}><Text style={[styles.cardTitle, { color: palette.text }]}>Parcial de pagamentos</Text><Text style={[styles.muted, { color: palette.muted }]}>Compartilhe com o grupo quem já pagou a mensalidade de {competenceLabel(competence).toLocaleLowerCase("pt-BR")}.</Text><Button title="Compartilhar no WhatsApp" icon="whatsapp" disabled={!monthly.length} onPress={share}/></Card>
    {summary ? <Card style={styles.playerSummary}><Text style={[styles.cardTitle, { color: palette.text }]}>Situação dos mensalistas</Text><View style={styles.playerSummaryRow}><PlayerCount value={summary.players.current} label="Em dia" color={colors.success}/><PlayerCount value={summary.players.pending} label="Pendentes" color={colors.yellow}/><PlayerCount value={summary.players.overdue} label="Atrasados" color={colors.danger}/></View></Card> : null}
    <FinanceChargeList charges={monthly}/>
    <Button title="Abrir gestão completa no site" variant="secondary" onPress={() => Linking.openURL(`${API_BASE_URL}/financeiro`)}/>
  </>;
}

function PlayerFinance({ data }: { data: FinancePayload }) {
  const { palette } = useMobileBranding();
  return <><Card style={styles.pendingCard}><Text style={[styles.metricLabel, { color: palette.muted }]}>TOTAL PENDENTE</Text><Text style={[styles.pendingValue, { color: Number(data.totalPendingCents || 0) > 0 ? colors.danger : colors.success }]}>{money(data.totalPendingCents || 0)}</Text><Text style={[styles.muted, { color: palette.muted }]}>{data.payments?.length || 0} pagamento(s) registrado(s)</Text></Card><FinanceChargeList charges={data.charges}/></>;
}

function MonthPicker({ value, onChange }: { value: string; onChange(value: string): void }) {
  const { palette } = useMobileBranding();
  return <View style={[styles.monthPicker, { borderColor: palette.border, backgroundColor: palette.card }]}><Pressable accessibilityRole="button" accessibilityLabel="Mês anterior" style={styles.monthButton} onPress={() => onChange(moveCompetence(value, -1))}><Ionicons name="chevron-back" size={23} color={palette.green}/></Pressable><View style={styles.monthCopy}><Text style={[styles.monthEyebrow, { color: palette.muted }]}>COMPETÊNCIA</Text><Text style={[styles.monthValue, { color: palette.text }]}>{competenceLabel(value)}</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Próximo mês" style={styles.monthButton} onPress={() => onChange(moveCompetence(value, 1))}><Ionicons name="chevron-forward" size={23} color={palette.green}/></Pressable></View>;
}

function FinanceChargeList({ charges }: { charges: FinanceCharge[] }) {
  const { palette } = useMobileBranding();
  if (!charges.length) return <EmptyState title="Nenhuma cobrança" message="Não existem cobranças financeiras para apresentar."/>;
  return <View style={styles.list}><Text style={[styles.sectionTitle, { color: palette.text }]}>Cobranças</Text>{charges.map(charge => <Card key={charge.id} style={styles.charge}><View style={styles.chargeHead}><View style={styles.chargeCopy}><Text style={[styles.chargeTitle, { color: palette.text }]}>{charge.playerName || charge.description}</Text><Text style={[styles.muted, { color: palette.muted }]}>{competenceLabel(charge.competence)} · vence {dateLabel(charge.dueDate)}</Text></View><Status value={charge.status}/></View><View style={styles.amounts}><Amount label="Cobrado" value={charge.amountCents}/><Amount label="Pago" value={charge.paidCents}/><Amount label="Restante" value={charge.remainingCents}/></View></Card>)}</View>;
}

function Metric({ label, value, positive, negative }: { label: string; value: string; positive?: boolean; negative?: boolean }) {
  const { palette } = useMobileBranding();
  return <Card style={styles.metric}><Text style={[styles.metricLabel, { color: palette.muted }]}>{label}</Text><Text numberOfLines={1} adjustsFontSizeToFit style={[styles.metricValue, { color: negative ? colors.danger : positive ? colors.success : palette.text }]}>{value}</Text></Card>;
}
function PlayerCount({ value, label, color }: { value: number; label: string; color: string }) { return <View style={styles.playerCount}><Text style={[styles.playerCountValue, { color }]}>{value}</Text><Text style={styles.playerCountLabel}>{label}</Text></View>; }
function Amount({ label, value }: { label: string; value: number }) { return <View><Text style={styles.amountLabel}>{label}</Text><Text style={styles.amountValue}>{money(value)}</Text></View>; }
function Status({ value }: { value: string }) { const tone = value === "PAID" || value === "EXEMPT" ? styles.statusGood : value === "OVERDUE" ? styles.statusBad : value === "CANCELLED" ? styles.statusMuted : styles.statusPending; return <View style={[styles.status, tone]}><Text style={styles.statusText}>{financeStatusLabels[value] || value}</Text></View>; }
function dateLabel(value: string) { return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeZone: "UTC" }).format(new Date(`${value.slice(0, 10)}T12:00:00.000Z`)); }

const styles = StyleSheet.create({
  content: { padding: 20, paddingTop: 4, paddingBottom: 34, gap: 14 }, muted: { lineHeight: 20 }, cardTitle: { fontSize: 18, fontWeight: "900" },
  monthPicker: { minHeight: 68, borderWidth: 1, borderRadius: 17, flexDirection: "row", alignItems: "center" }, monthButton: { width: 54, minHeight: 66, alignItems: "center", justifyContent: "center" }, monthCopy: { flex: 1, alignItems: "center", gap: 3 }, monthEyebrow: { fontSize: 9, fontWeight: "900", letterSpacing: 1.1 }, monthValue: { fontSize: 17, fontWeight: "800" },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 }, metric: { width: "48%", flexGrow: 1, minHeight: 96, justifyContent: "space-between", gap: 10 }, metricLabel: { fontSize: 10, fontWeight: "900", letterSpacing: .7, textTransform: "uppercase" }, metricValue: { fontSize: 20, fontWeight: "900" },
  actions: { gap: 10 }, playerSummary: { gap: 14 }, playerSummaryRow: { flexDirection: "row", justifyContent: "space-around" }, playerCount: { alignItems: "center", gap: 3, flex: 1 }, playerCountValue: { fontSize: 25, fontWeight: "900" }, playerCountLabel: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  pendingCard: { gap: 7 }, pendingValue: { fontSize: 31, fontWeight: "900" }, list: { gap: 10 }, sectionTitle: { fontSize: 20, fontWeight: "900", marginTop: 2 }, charge: { gap: 14 }, chargeHead: { flexDirection: "row", alignItems: "flex-start", gap: 10 }, chargeCopy: { flex: 1, gap: 3 }, chargeTitle: { fontSize: 16, fontWeight: "900" },
  amounts: { flexDirection: "row", justifyContent: "space-between", gap: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 }, amountLabel: { color: colors.muted, fontSize: 9, fontWeight: "800", textTransform: "uppercase" }, amountValue: { color: colors.text, fontSize: 13, fontWeight: "900", marginTop: 3 },
  status: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 5 }, statusGood: { backgroundColor: "#E5F4EA" }, statusBad: { backgroundColor: colors.dangerSoft }, statusPending: { backgroundColor: colors.yellowSoft }, statusMuted: { backgroundColor: "#EDF0EE" }, statusText: { color: colors.text, fontSize: 10, fontWeight: "900" },
});
