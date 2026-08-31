import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import * as statistics from "../src/statistics.ts";
import { contrastTextColor } from "../src/team-colors.ts";
import { buildMonthlyCareerHighlights, buildPublicStatistics } from "../../lib/public-statistics.ts";
import { calculateAdvancedStatistics } from "../../lib/statistics-engine.ts";

// Exercise the real JSX, event handlers and server payloads without a device or network.
// Native views are represented by their names; these tests do not replace device visual QA.
const files = ["statistics-ui", "statistics-awards", "statistics-advanced-panels", "statistics-advanced-screen"];
const sources = new Map();
for (const name of [...files, "general-screen"]) {
  const path = name === "general-screen" ? "../app/(app)/statistics.tsx" : `../src/${name}.tsx`;
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  sources.set(name, ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText);
}
const players = [
  { id: "a", displayName: "Jogador de nome bastante longo para testar o layout", type: "monthly", primaryPosition: "Ataque", photoUrl: "/api/photos/a.jpg" },
  { id: "b", displayName: "Convidado", type: "guest", primaryPosition: "Defesa" },
  { id: "g", displayName: "Goleiro", type: "goalkeeper", primaryPosition: "Goleiro" },
];
const matches = Array.from({ length: 6 }, (_, i) => ({ id: `m${i}`, separationId: `s${i}`, title: `Rodada ${i}`, date: `2026-07-${10 + i}`, status: "CLOSED", seasonNumber: 1, manuallyAdjusted: false, contributionsAvailable: true, blueScore: 2, yellowScore: 1, winnerTeam: "BLUE", blueIds: ["a", "g"], yellowIds: ["b"], blue: [{ playerId: "a", position: "Ataque" }, { playerId: "g", position: "Goleiro" }], yellow: [{ playerId: "b", position: "Defesa" }], contributions: [{ scorerPlayerId: "a", assistPlayerId: "g", ownGoal: false }], votes: [], prediction: { blueStrength: 6, yellowStrength: 5.9 } }));
const highlights = buildMonthlyCareerHighlights(players, matches, 2026, "2026-08-01", "2026-07", "2026-12-31");
const general = { from: "2026-07-01", to: "2026-07-31", players, ...buildPublicStatistics(players, matches, matches.map(m => ({ matchId: m.id, scorerPlayerId: "a", assistPlayerId: "g" })), "a", "b"), careerHighlights: highlights };
const advanced = { from: "2026-07-01", to: "2026-07-31", allPlayers: players, seasons: [1], ...calculateAdvancedStatistics(players, matches) };
const plain = value => value == null || typeof value === "boolean" ? "" : Array.isArray(value) ? value.map(plain).join(" ") : typeof value === "object" ? plain(value.props?.children) : String(value);
const style = element => Object.assign({}, ...[element.props.style].flat(Infinity).filter(Boolean));

function runtime(data = advanced, options = {}) {
  const states = new Map(), modules = new Map(), navigation = [], alerts = [], queries = [], calls = [];
  let context = { key: "", index: 0 };
  const queryResult = { data, dataUpdatedAt: 100000, isPending: !data, isError: false, isRefetching: false, refetch() {}, ...options.query };
  const router = { push: route => navigation.push(route), navigate: route => navigation.push(route) };
  const react = {
    useState(initial) {
      const key = `${context.key}:${context.index++}`;
      if (!states.has(key)) states.set(key, typeof initial === "function" ? initial() : initial);
      return [states.get(key), value => states.set(key, typeof value === "function" ? value(states.get(key)) : value)];
    },
    useMemo: fn => fn(), useCallback: fn => fn,
  };
  const native = Object.fromEntries(["View", "Text", "Image", "Pressable", "ScrollView", "Switch", "TextInput", "Modal", "KeyboardAvoidingView", "ActivityIndicator", "RefreshControl"].map(name => [name, name]));
  Object.assign(native, { StyleSheet: { create: styles => styles, absoluteFill: { position: "absolute", top: 0, left: 0, bottom: 0, right: 0 } }, Platform: { OS: "android" }, Alert: { alert: (...args) => alerts.push(args) }, useWindowDimensions: () => ({ width: 360, height: 800, fontScale: options.fontScale || 1 }), FlatList: ({ data, renderItem, ListEmptyComponent }) => data.length ? data.map(item => renderItem({ item })) : ListEmptyComponent });
  const branding = { useMobileBranding: () => ({ config: { teamBlueName: "Vermelho", teamYellowName: "Branco" }, palette: { blue: "#FF0000", yellow: "#FFFFFF", green: "#174D3A", border: "#D5E2D9" } }) };
  const components = Object.fromEntries(["Screen", "Card", "Button", "Header", "UpdatedAt", "ErrorState"].map(name => [name, name]));
  const api = { API_BASE_URL: "https://test.invalid", apiFetch: (...args) => { calls.push(args); return data; } };
  const imports = {
    react, "react/jsx-runtime": jsxRuntime, "react-native": native,
    "react-native-safe-area-context": { SafeAreaView: "SafeAreaView" }, "@expo/vector-icons/Ionicons": "Icon",
    "expo-linear-gradient": { LinearGradient: "LinearGradient" },
    "expo-router": { useRouter: () => router, useLocalSearchParams: () => options.params || {}, useFocusEffect() {} },
    "@tanstack/react-query": { useQuery: config => { queries.push(config); return queryResult; } },
    "@react-native-community/netinfo": { useNetInfo: () => ({ isConnected: options.online !== false }) },
  };
  function load(name) {
    if (modules.has(name)) return modules.get(name);
    const exports = {};
    const require = path => {
      if (imports[path]) return imports[path];
      const basename = path.replace(/^\.\//, "").replace(/^@\//, "");
      if (basename === "statistics") return statistics;
      if (basename === "team-colors") return { contrastTextColor };
      if (basename === "components") return components;
      if (basename === "branding") return branding;
      if (basename === "api") return api;
      if (basename === "auth") return { useAuth: () => ({ account: options.account === undefined ? { id: "admin", role: "admin", playerId: null } : options.account }) };
      if (sources.has(basename)) return load(basename);
      throw new Error(`Unexpected import: ${path}`);
    };
    runInNewContext(sources.get(name), { exports, require, URLSearchParams, Date, Intl });
    modules.set(name, exports); return exports;
  }
  function visit(element, path = "root") {
    if (element == null || typeof element !== "object") return [];
    if (Array.isArray(element)) return element.flatMap((child, i) => visit(child, `${path}/${child?.key ?? i}`));
    if (typeof element.type === "function") { context = { key: path, index: 0 }; return visit(element.type(element.props), `${path}/render`); }
    if (element.type === "Modal" && !element.props.visible) return [];
    return [element, ...visit(element.props.children, `${path}/children`)];
  }
  return { load, navigation, alerts, queries, calls, queryResult,
    render(name, component = "default", props = {}) { return visit(jsxRuntime.jsx(load(name)[component], props)); },
  };
}
const texts = tree => tree.filter(node => node.type === "Text").map(node => plain(node.props.children)).join("\n");
function tab(tree, title) { const node = tree.find(node => node.type === "Pressable" && plain(node.props.children) === title); assert.ok(node, `Tab/button not found: ${title}`); node.props.onPress(); }

test("navega por todas as áreas gerais com dados calculados pelo servidor", () => {
  const app = runtime(general);
  let tree = app.render("general-screen");
  assert.match(texts(tree), /JOGADOR DO MÊS/);
  tab(tree, "Rankings"); tree = app.render("general-screen");
  assert.match(texts(tree), /Ranking de assiduidade/);
  assert.match(texts(tree), /6\s+gols/);
  assert.equal(tree.find(node => node.type === "Switch").props.value, false);
  tab(tree, "Confrontos"); tree = app.render("general-screen");
  assert.match(texts(tree), /Jogador versus jogador/);
  const match = tree.find(node => node.type === "Pressable" && node.props.accessibilityLabel?.startsWith("Ver Rodada"));
  match.props.onPress(); assert.equal(app.navigation[0].pathname, "/separations/[id]");
});

test("navega por todas as análises, incluindo conta administrativa sem jogador", () => {
  const app = runtime();
  let tree = app.render("statistics-advanced-screen");
  assert.match(texts(tree), /Quem mais impactou/);
  for (const [button, expected] of [["Jogadores", /Análise completa do jogador/], ["Entrosamento", /Rede de entrosamento/], ["Recordes", /Maior goleada/], ["Equilíbrio", /Qualidade do balanceamento/]]) {
    tab(tree, button); tree = app.render("statistics-advanced-screen"); assert.match(texts(tree), expected);
  }
  assert.ok(app.queries.every(query => query.enabled));
  const signal = new AbortController().signal; app.queries[0].queryFn({ signal });
  assert.equal(app.calls[0][1].signal, signal);
});

test("Meu card abre diretamente a análise solicitada e filtros consultam a API", () => {
  const app = runtime(advanced, { params: { player: "g" } });
  const tree = app.render("statistics-advanced-screen");
  assert.match(texts(tree), /Análise completa do jogador/);
  const portrait = tree.find(node => node.type === "View" && node.props.accessibilityLabel === "Goleiro" && style(node).width === 84);
  assert.ok(portrait);
  tree.find(node => node.type === "Button" && node.props.title === "Alterar filtros").props.onPress();
  const expanded = app.render("statistics-advanced-screen");
  assert.match(texts(expanded), /Mínimo de jogos da dupla/);
});

test("mensal aberto e MVP bloqueado não renderizam os vencedores", () => {
  const pending = { ...highlights, focusMonthClosed: false, focus: null };
  const app = runtime();
  const tree = app.render("statistics-awards", "MonthlyHonors", { highlights: pending });
  assert.match(texts(tree), /Premiação em apuração/);
  assert.match(texts(tree), /Premiação ainda em disputa/);
  assert.doesNotMatch(texts(tree), /JOGADOR DO MÊS/);
  const awarded = app.render("statistics-awards", "MonthlyHonors", { highlights: { ...highlights, annualMvpAvailable: true, annualMvp: [{ player: players[0], place: 1, medal: "Bola de Ouro", momentum: 0.012, selections: 1, playerOfMonthAwards: 1 }] } });
  assert.match(texts(awarded), /Bola de Ouro/);
  assert.match(texts(awarded), /\+0,012\s+momentum/);
});

test("fotos preenchem círculos, suportam falha e não sobrepõem o nome do destaque", () => {
  const app = runtime();
  const props = { player: players[0], size: 52 };
  let tree = app.render("statistics-ui", "Avatar", props);
  const photo = tree.find(node => node.type === "Image");
  assert.equal(photo.props.resizeMode, "cover");
  assert.equal(style(photo).borderRadius, 26);
  assert.equal(photo.props.source.uri, "https://test.invalid/api/photos/a.jpg");
  photo.props.onError(); tree = app.render("statistics-ui", "Avatar", props);
  assert.ok(tree.some(node => node.type === "Icon"));
  tree = app.render("statistics-ui", "Avatar", { ...props, player: { ...players[0], photoUrl: "/new.jpg" } });
  assert.ok(tree.some(node => node.type === "Image"));
  const champion = app.render("statistics-awards", "PlayerOfMonth", { standing: highlights.focus.playerOfMonth });
  const name = champion.find(node => node.type === "Text" && plain(node.props.children) === highlights.focus.playerOfMonth.player.displayName);
  assert.equal(style(name).position, undefined); assert.equal(style(name).textAlign, "center");
});

test("campo adapta onze vagas e fontes grandes sem altura fixa", () => {
  const app = runtime(undefined, { fontScale: 2 });
  const award = { selection: [], formation: { goalkeepers: 1, defenders: 4, midfielders: 3, attackers: 3 } };
  let tree = app.render("statistics-awards", "MonthlyPitch", { award });
  tree.find(node => node.props.testID === "monthly-pitch").props.onLayout({ nativeEvent: { layout: { width: 224 } } });
  tree = app.render("statistics-awards", "MonthlyPitch", { award });
  const field = tree.find(node => node.props.testID === "monthly-pitch");
  assert.equal(style(field).height, undefined);
  assert.equal(tree.filter(node => node.type === "Text" && node.props.children === "Vaga disponível").length, 11);
  assert.ok(tree.some(node => style(node).width === "100%" && style(node).minWidth === 0));
});

test("listas carregam mais sob demanda e ajuda abre explicação inteira", () => {
  const app = runtime(), items = Array.from({ length: 20 }, (_, i) => i);
  let tree = app.render("statistics-ui", "MoreList", { items, render: i => jsxRuntime.jsx("Text", { children: i }, i), pageSize: 5 });
  assert.equal(tree.filter(node => node.type === "Text").length, 5);
  tree.find(node => node.type === "Button").props.onPress();
  tree = app.render("statistics-ui", "MoreList", { items, render: i => jsxRuntime.jsx("Text", { children: i }, i), pageSize: 5 });
  assert.equal(tree.filter(node => node.type === "Text").length, 10);
  const help = app.render("statistics-ui", "Help", { title: "IPI", message: "Explicação completa, sem truncamento." });
  help.find(node => node.type === "Pressable").props.onPress();
  assert.equal(app.alerts[0][1], "Explicação completa, sem truncamento.");
});

test("erros, carregamento e offline exibem estados explícitos, sem números fabricados", () => {
  const offline = runtime(null, { online: false }).render("general-screen");
  assert.match(texts(offline), /Conecte-se à internet/);
  const loading = runtime(null).render("statistics-advanced-screen");
  assert.match(texts(loading), /Carregando estatísticas/);
  const error = runtime(null, { query: { isPending: false, isError: true, error: new Error("Falha de conexão") } }).render("general-screen");
  assert.equal(error.find(node => node.type === "ErrorState").props.message, "Falha de conexão");
  const noGames = { ...advanced, ...calculateAdvancedStatistics(players, []) };
  const app = runtime(noGames); let tree = app.render("statistics-advanced-screen");
  assert.match(texts(tree), /Sem partidas suficientes/);
  tab(tree, "Equilíbrio"); tree = app.render("statistics-advanced-screen");
  assert.match(texts(tree), /Sem dados/);
});

test("intervalo personalizado valida datas e aplica o período escolhido", () => {
  const app = runtime(); let applied;
  const props = { value: statistics.monthRange("2026-07"), onChange: value => { applied = value; }, closedMonths: ["2026-06"] };
  let tree = app.render("statistics-ui", "PeriodFilter", props);
  tab(tree, "Outras datas"); tree = app.render("statistics-ui", "PeriodFilter", props);
  tree.find(node => node.type === "TextInput" && node.props.accessibilityLabel === "Data De").props.onChangeText("31022026");
  tree = app.render("statistics-ui", "PeriodFilter", props);
  tree.find(node => node.type === "Button" && node.props.title === "Aplicar período").props.onPress();
  tree = app.render("statistics-ui", "PeriodFilter", props);
  assert.match(texts(tree), /Informe datas válidas/); assert.equal(applied, undefined);
  tree.find(node => node.type === "TextInput" && node.props.accessibilityLabel === "Data De").props.onChangeText("01072026");
  tree = app.render("statistics-ui", "PeriodFilter", props);
  tree.find(node => node.type === "Button" && node.props.title === "Aplicar período").props.onPress();
  assert.equal(applied.from, "2026-07-01"); assert.equal(applied.to, "2026-07-31");
});

test("cartões se empilham com fonte ampliada e nomes continuam sem corte", () => {
  const app = runtime(undefined, { fontScale: 2 });
  const tree = app.render("statistics-ui", "Metric", { label: "Impacto no aproveitamento", value: "+100,0 p.p.", help: "Explicação" });
  assert.equal(style(tree[0]).flexBasis, "100%");
  assert.equal(style(tree[0]).height, undefined);
  assert.ok(tree.filter(node => node.type === "Text").every(node => node.props.numberOfLines === undefined));
});
