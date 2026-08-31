import { useState, type PropsWithChildren, type ReactNode } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, useWindowDimensions, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { API_BASE_URL } from "./api";
import { Button, Card } from "./components";
import { useMobileBranding } from "./branding";
import { contrastTextColor } from "./team-colors";
import { currentPeriod, dateLabel, monthLabel, monthRange, validatePeriod, type Period, type StatsMatch, type StatsPlayer, type Streak } from "./statistics";

export const s = StyleSheet.create({
  content: { padding: 16, paddingBottom: 36, gap: 16, width: "100%", maxWidth: 760, alignSelf: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 10 }, grow: { flex: 1, minWidth: 0 },
  title: { color: "#183E30", fontSize: 20, fontWeight: "800", flexShrink: 1 },
  text: { color: "#233A30", fontSize: 14, lineHeight: 21 }, muted: { color: "#56675F", fontSize: 12, lineHeight: 18 },
  label: { color: "#466453", fontWeight: "800", fontSize: 11, letterSpacing: .4 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { flexGrow: 1, flexBasis: "45%", minWidth: 0, padding: 12, backgroundColor: "#F0F5F2", borderRadius: 12, gap: 5 },
  value: { color: "#174D3A", fontSize: 22, fontWeight: "900", flexShrink: 1, fontVariant: ["tabular-nums"] },
  separator: { borderTopColor: "#E1E9E4", borderTopWidth: 1, paddingTop: 12, gap: 10 },
  pill: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, minHeight: 44, justifyContent: "center" },
  pillText: { fontWeight: "800", fontSize: 13 },
  input: { minHeight: 48, borderWidth: 1, borderColor: "#C9D8CF", borderRadius: 12, padding: 12, fontSize: 16, color: "#183E30", backgroundColor: "#fff" },
});
export function Note({ children }: PropsWithChildren) { return <Text style={s.muted}>{children}</Text>; }
export function Help({ title, message }: { title: string; message: string }) {
  const { palette } = useMobileBranding();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Sobre ${title}`} hitSlop={5} onPress={() => Alert.alert(title, message)} style={{ padding: 10, minHeight: 44, minWidth: 44, alignItems: "center", justifyContent: "center" }}><Ionicons name="help-circle-outline" size={21} color={palette.green}/></Pressable>;
}
export function Panel({ title, note, help, children }: PropsWithChildren<{ title: string; note?: string; help?: string }>) {
  return <Card style={{ gap: 14 }}><View style={s.row}><Text accessibilityRole="header" style={[s.title, s.grow]}>{title}</Text>{help && <Help title={title} message={help}/>}</View>{note && <Note>{note}</Note>}{children}</Card>;
}
export function Metric({ label, value, help }: { label: string; value: string | number; help?: string }) {
  const { width, fontScale } = useWindowDimensions();
  return <View style={[s.metric, (width < 360 || fontScale > 1.3) && { flexBasis: "100%" }]}><View style={s.row}><Text style={[s.muted, s.grow]}>{label}</Text>{help && <Help title={label} message={help}/>}</View><Text style={[s.value, String(value).length > 12 && { fontSize: 16 }]}>{value}</Text></View>;
}
export function Chips({ value, options, onChange }: { value: string; options: { value: string; label: string }[]; onChange(value: string): void }) {
  const { palette } = useMobileBranding();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 2 }} style={{ flexGrow: 0 }}>
    {options.map(option => <Pressable key={option.value} accessibilityRole="tab" accessibilityState={{ selected: value === option.value }} onPress={() => onChange(option.value)} style={[s.pill, { backgroundColor: value === option.value ? palette.green : "#fff", borderColor: palette.border }]}><Text style={[s.pillText, { color: value === option.value ? contrastTextColor(palette.green) : palette.green }]}>{option.label}</Text></Pressable>)}
  </ScrollView>;
}
export function Avatar({ player, size = 42 }: { player: StatsPlayer; size?: number }) {
  const [failedUri, setFailedUri] = useState<string | null>(null), uri = player.photoUrl ? (/^https?:\/\//i.test(player.photoUrl) ? player.photoUrl : `${API_BASE_URL}${player.photoUrl.startsWith("/") ? "" : "/"}${player.photoUrl}`) : null;
  const style = { width: size, height: size, borderRadius: size / 2, backgroundColor: "#DEEAE2", flexShrink: 0 } as const;
  return uri && uri !== failedUri ? <Image source={{ uri }} alt={`Foto de ${player.displayName}`} accessibilityLabel={`Foto de ${player.displayName}`} onError={() => setFailedUri(uri)} resizeMode="cover" style={style}/> : <View accessible accessibilityLabel={player.displayName} style={[style, { alignItems: "center", justifyContent: "center" }]}><Ionicons name="person" size={size * .48} color="#5B7566"/></View>;
}
export function Person({ player, detail, trailing, rank }: { player: StatsPlayer; detail?: string; trailing?: ReactNode; rank?: number }) {
  return <View style={s.row}>{rank != null && <Text style={[s.label, { minWidth: 20 }]}>{rank}º</Text>}<Avatar player={player}/><View style={s.grow}><Text style={[s.text, { fontWeight: "800" }]}>{player.displayName}</Text>{detail && <Note>{detail}</Note>}</View>{trailing}</View>;
}
export function Select({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string; player?: StatsPlayer }[]; onChange(value: string): void }) {
  const [open, setOpen] = useState(false), [search, setSearch] = useState("");
  const normalized = (text: string) => text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");
  const items = options.filter(option => normalized(option.label).includes(normalized(search)));
  return <View style={{ gap: 6 }}><Text style={s.label}>{label}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${options.find(option => option.value === value)?.label || "Escolher"}`} onPress={() => { setSearch(""); setOpen(true); }} style={[s.input, s.row]}><Text style={[s.text, s.grow]}>{options.find(option => option.value === value)?.label || "Escolher"}</Text><Ionicons name="chevron-down" size={16} color="#466453"/></Pressable>
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><SafeAreaView style={{ flex: 1, backgroundColor: "#F5F8F5", padding: 18, gap: 14 }}><View style={s.row}><Text accessibilityRole="header" style={[s.title, s.grow]}>{label}</Text><Button title="Fechar" variant="secondary" onPress={() => setOpen(false)}/></View><TextInput accessibilityLabel={`Buscar em ${label}`} placeholder="Buscar…" placeholderTextColor="#687C70" value={search} onChangeText={setSearch} autoCorrect={false} style={s.input}/><FlatList keyboardShouldPersistTaps="handled" data={items} keyExtractor={item => item.value} ListEmptyComponent={<Note>Nenhuma opção encontrada.</Note>} renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityState={{ selected: item.value === value }} onPress={() => { onChange(item.value); setOpen(false); }} style={[s.row, { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#DEE6DF" }]}>{item.player && <Avatar player={item.player}/>}<Text style={[s.text, s.grow]}>{item.label}</Text>{item.value === value && <Ionicons name="checkmark-circle" size={22} color="#174D3A"/>}</Pressable>}/></SafeAreaView></Modal>
  </View>;
}
export const playerOptions = (players: StatsPlayer[]) => players.map(player => ({ value: player.id, label: player.displayName, player })).sort((a, b) => a.label.localeCompare(b.label, "pt-BR"));
export function PeriodFilter({ value, onChange, closedMonths, compact = false }: { value: Period; onChange(value: Period): void; closedMonths?: string[]; compact?: boolean }) {
  const [expanded, setExpanded] = useState(!compact);
  const [open, setOpen] = useState(false), [from, setFrom] = useState(""), [to, setTo] = useState(""), [error, setError] = useState("");
  const period = currentPeriod("month"), year = currentPeriod("year"), active = value.from === period.from && value.to === period.to ? "month" : value.from === year.from && value.to === year.to ? "year" : "custom";
  const mask = (text: string) => text.replace(/\D/g, "").slice(0, 8).replace(/^(\d{2})(\d)/, "$1/$2").replace(/^(\d{2}\/\d{2})(\d)/, "$1/$2");
  return <Panel title="Período da consulta"><Text style={s.text}>{dateLabel(value.from)} — {dateLabel(value.to)}</Text>
    {compact && <Button title={expanded ? "Recolher período" : "Alterar período"} variant="secondary" onPress={() => setExpanded(value => !value)}/>}
    {expanded && <Chips value={active} options={[{ value: "month", label: "Este mês" }, { value: "year", label: "Este ano" }, { value: "custom", label: "Outras datas" }]} onChange={next => { if (next === "custom") { setFrom(dateLabel(value.from)); setTo(dateLabel(value.to)); setError(""); setOpen(true); } else onChange(currentPeriod(next as "month" | "year")); }}/>}
    {expanded && closedMonths && <Select label={`Mês encerrado · ${value.to.slice(0, 4)}`} value={closedMonths.find(month => monthRange(month).from === value.from && monthRange(month).to === value.to) || ""} options={[{ value: "", label: closedMonths.length ? "Consultar um mês fechado" : "Nenhum mês fechado neste ano" }, ...closedMonths.map(month => ({ value: month, label: monthLabel(month) }))]} onChange={month => { if (month) onChange(monthRange(month)); }}/>} 
    <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}><SafeAreaView style={{ flex: 1, backgroundColor: "#F5F8F5" }}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, gap: 18 }}><Text accessibilityRole="header" style={s.title}>Consultar outro período</Text><Note>Use dia/mês/ano. Para consultar temporadas anteriores, escolha as datas daquele ano.</Note>{[{ label: "De", value: from, set: setFrom }, { label: "Até", value: to, set: setTo }].map(field => <View key={field.label} style={{ gap: 8 }}><Text style={s.label}>{field.label}</Text><TextInput accessibilityLabel={`Data ${field.label}`} placeholder="DD/MM/AAAA" placeholderTextColor="#687C70" keyboardType="number-pad" maxLength={10} value={field.value} onChangeText={text => field.set(mask(text))} style={s.input}/></View>)}{error && <Text accessibilityRole="alert" style={{ color: "#AF2929" }}>{error}</Text>}<Button title="Aplicar período" onPress={() => { const dates = validatePeriod(from, to); if (!dates) { setError("Informe datas válidas; a data inicial não pode ser posterior à final."); return; } onChange(dates); setOpen(false); }}/><Button title="Cancelar" variant="secondary" onPress={() => setOpen(false)}/></ScrollView></KeyboardAvoidingView></SafeAreaView></Modal>
  </Panel>;
}
export function RecordCard({ title, record }: { title: string; record: Streak }) {
  return <Panel title={title}><View style={s.row}><Text style={[s.value, { fontSize: 32 }]}>{record.length}</Text><Note>jogos consecutivos no período</Note></View>{record.players.map(player => <Person key={player.id} player={player}/>)}{!record.players.length && <Note>Ainda não há sequência registrada.</Note>}</Panel>;
}
export function MatchLink({ match }: { match: StatsMatch }) {
  const router = useRouter(), { palette, config } = useMobileBranding();
  return <Pressable accessibilityRole="button" accessibilityLabel={`Ver ${match.title}, ${dateLabel(match.date)}, placar ${match.blueScore} a ${match.yellowScore}`} onPress={() => router.push({ pathname: "/separations/[id]", params: { id: match.separationId } })} style={[s.separator, { paddingBottom: 8 }]}><Text style={[s.text, { fontWeight: "800" }]}>{match.title}</Text><Note>{dateLabel(match.date)}</Note><View style={s.row}>{[{ color: palette.blue, name: config.teamBlueName, score: match.blueScore }, { color: palette.yellow, name: config.teamYellowName, score: match.yellowScore }].map((team, index) => <View key={index} style={{ flex: 1, minWidth: 0, padding: 10, borderRadius: 12, backgroundColor: team.color }}><Text style={{ color: contrastTextColor(team.color), fontWeight: "800" }}>{team.name}</Text><Text style={{ color: contrastTextColor(team.color), fontSize: 24, fontWeight: "900" }}>{team.score}</Text></View>)}</View><Text style={s.label}>Ver partida →</Text></Pressable>;
}
export function MoreList<T>({ items, render, pageSize = 15 }: { items: T[]; render(item: T, index: number): ReactNode; pageSize?: number }) {
  const [page, setPage] = useState({ items, limit: pageSize });
  const limit = page.items === items ? page.limit : pageSize;
  return <View style={{ gap: 14 }}>{items.slice(0, limit).map(render)}{!items.length && <Note>Sem registros para os filtros selecionados.</Note>}{items.length > limit && <Button title={`Ver mais (${items.length - limit} restantes)`} variant="secondary" onPress={() => setPage({ items, limit: limit + pageSize })}/>}</View>;
}
export function Loading() { return <View style={{ padding: 32, gap: 12, alignItems: "center" }}><ActivityIndicator color="#174D3A"/><Note>Carregando estatísticas…</Note></View>; }
