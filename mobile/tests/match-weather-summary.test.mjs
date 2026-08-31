import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";

const source = await readFile(new URL("../src/match-weather-summary.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const palette = { cream: "#f6f4ec", card: "#ffffff", muted: "#66756e", border: "#dde4df", text: "#17221d" };
function component(width = 390, fontScale = 1) {
  const exports = {};
  const imports = {
    "react/jsx-runtime": jsxRuntime,
    "react-native": { View: "View", Text: "Text", StyleSheet: { create: styles => styles }, useWindowDimensions: () => ({ width, fontScale }) },
    "./branding": { useMobileBranding: () => ({ palette }) },
  };
  runInNewContext(compiled, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports.MatchWeatherSummary;
}
function nodes(element) {
  if (element == null || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  return [element, ...nodes(element.props?.children)];
}
const style = node => Object.assign({}, ...[node.props.style].flat().filter(Boolean));
const texts = element => nodes(element).filter(node => node.type === "Text").map(node => node.props.children);
const weather = { description: "Chuva", icon: "🌧️", temperatureMin: 20.3, temperatureMax: 20.4, windSpeed: 15.1, usedDefaultLocation: false };

test("apresenta tempo, temperatura e vento com ícones abaixo dos rótulos", () => {
  const rendered = component()({ weather });
  assert.deepEqual(texts(rendered), ["PREVISÃO REGISTRADA", "Tempo", "🌧️", "Chuva", "Temperatura", "🌡️", "20,3–20,4 °C", "Vento", "💨", "15,1 km/h"]);
  const metrics = nodes(rendered).filter(node => style(node).borderWidth === 1);
  assert.equal(metrics.length, 3);
  for (const metric of metrics) {
    assert.equal(style(metric).backgroundColor, palette.cream);
    assert.equal(style(metric).borderColor, palette.border);
  }
});

test("sem previsão salva ou com payload antigo mostra aviso sem valores fictícios", () => {
  for (const value of [undefined, null]) {
    const values = texts(component()({ weather: value }));
    assert.ok(values.includes("Não há previsão do tempo registrada para esta partida."));
    assert.ok(!values.some(value => /°C|km\/h/.test(value)));
  }
});

test("mantém zero e valores negativos de temperatura, sem transformar ausências em zero", () => {
  const Summary = component();
  assert.ok(texts(Summary({ weather: { ...weather, temperatureMin: -2, temperatureMax: 0, windSpeed: 0 } })).includes("-2–0 °C"));
  const zero = texts(Summary({ weather: { ...weather, temperatureMin: 0, temperatureMax: 0, windSpeed: 0 } }));
  assert.ok(zero.includes("0 °C")); assert.ok(zero.includes("0 km/h"));
  const partial = texts(Summary({ weather: { ...weather, temperatureMin: null, temperatureMax: 12, windSpeed: null } }));
  assert.ok(partial.includes("12 °C")); assert.ok(partial.includes("Não informado"));
  const missing = texts(Summary({ weather: { description: "Chuva" } }));
  assert.ok(missing.includes("Não informada")); assert.ok(missing.includes("Não informado"));
  for (const windSpeed of [NaN, Infinity, -1]) assert.ok(texts(Summary({ weather: { ...weather, windSpeed } })).includes("Não informado"));
});

test("informa quando a previsão é do local padrão e oculta ícones decorativos da leitura", () => {
  const rendered = component()({ weather: { ...weather, usedDefaultLocation: true } });
  assert.ok(texts(rendered).includes("Previsão para o local padrão da pelada."));
  const icons = nodes(rendered).filter(node => node.props.importantForAccessibility === "no");
  assert.equal(icons.length, 3);
  assert.ok(icons.every(node => node.props.accessible === false));
});

test("layout flexível empilha em telas estreitas ou fonte ampliada sem cortar texto", () => {
  for (const [width, fontScale, direction] of [[390, 1, "row"], [320, 1, "column"], [390, 1.5, "column"]]) {
    const elements = nodes(component(width, fontScale)({ weather: { ...weather, description: "Parcialmente nublado com possibilidade de chuva" } }));
    const grid = elements.find(node => style(node).alignItems === "stretch");
    assert.equal(style(grid).flexDirection, direction);
    for (const metric of elements.filter(node => style(node).borderWidth === 1)) {
      assert.equal(style(metric).minWidth, 0);
      assert.equal(style(metric).height, undefined);
      assert.equal(style(metric).width, undefined);
      assert.equal(style(metric).flex, direction === "column" ? 0 : 1);
    }
    for (const text of elements.filter(node => node.type === "Text")) {
      assert.equal(text.props.numberOfLines, undefined);
      assert.equal(text.props.allowFontScaling, undefined);
    }
  }
});

test("listagem usa o resumo da mesma consulta, mantendo placar e navegação", async () => {
  const screen = await readFile(new URL("../app/(app)/matches/index.tsx", import.meta.url), "utf8");
  assert.match(screen, /<MatchWeatherSummary weather=\{item.weatherSummary\}\/\>/);
  assert.match(screen, /<MatchScoreboard blueScore=\{item.blueScore\} yellowScore=\{item.yellowScore\}\/\>/);
  assert.match(screen, /Ver partida →/);
  assert.doesNotMatch(source, /apiFetch|fetch\(|useQuery/);
});
