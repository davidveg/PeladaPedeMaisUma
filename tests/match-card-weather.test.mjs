import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const source = await readFile(new URL("../app/partidas/MatchCardWeather.tsx", import.meta.url), "utf8");
const css = await readFile(new URL("../app/partidas/match-hub.css", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
runInNewContext(compiled, { exports, require(name) {
  if (name === "react/jsx-runtime") return jsxRuntime;
  throw new Error(`Unexpected import: ${name}`);
} });
const render = weather => renderToStaticMarkup(jsxRuntime.jsx(exports.MatchCardWeather, { weather }));
const weather = { description: "Chuva", icon: "🌧️", temperatureMin: 20.3, temperatureMax: 20.4, windSpeed: 15.1, usedDefaultLocation: false };

test("cartão apresenta três campos com ícones abaixo dos rótulos e números em português", () => {
  const html = render(weather);
  for (const [label, icon] of [["Tempo", "🌧️"], ["Temperatura", "🌡️"], ["Vento", "💨"]]) {
    assert.ok(html.includes(`<dt>${label}</dt><dd><span class="match-hub-weather-icon" aria-hidden="true">${icon}</span>`));
  }
  assert.match(html, /20,3–20,4 °C/);
  assert.match(html, /15,1 km\/h/);
  assert.match(html, /Previsão registrada/);
});

test("sem previsão o cartão mostra aviso, sem inventar temperatura ou vento", () => {
  for (const value of [null, undefined]) {
    const html = render(value);
    assert.match(html, /Não há previsão do tempo registrada para esta partida/);
    assert.doesNotMatch(html, /°C|km\/h|<dl/);
  }
  const partial = render({ ...weather, temperatureMin: null, temperatureMax: null, windSpeed: null });
  assert.match(partial, /Não informada/);
  assert.match(partial, /Não informado/);
  assert.doesNotMatch(partial, /NaN|undefined|0 km\/h/);
});

test("zero, temperatura única e uso do local padrão ficam explícitos", () => {
  const html = render({ ...weather, temperatureMin: 0, temperatureMax: 0, windSpeed: 0, usedDefaultLocation: true });
  assert.match(html, /<strong>0 °C<\/strong>/);
  assert.match(html, /<strong>0 km\/h<\/strong>/);
  assert.match(html, /Previsão para o local padrão da pelada/);
  assert.match(render({ ...weather, temperatureMin: null, temperatureMax: 12 }), /<strong>12 °C<\/strong>/);
});

test("resumo usa colunas flexíveis, sem altura fixa nem corte das descrições", () => {
  assert.match(css, /\.match-hub-weather-grid\{[^}]*grid-template-columns:repeat\(3,minmax\(0,1fr\)\)/);
  assert.match(css, /\.match-hub-weather\{[^}]*width:100%;max-width:520px;min-width:0/);
  assert.match(css, /\.match-hub-weather-grid strong\{[^}]*overflow-wrap:anywhere/);
  const declarations = [...css.matchAll(/(\.match-hub-weather[^{}]*)\{([^{}]*)\}/g)].map(match => match[2]).join(";");
  assert.doesNotMatch(declarations, /(?:^|;)height:|white-space:nowrap|overflow:hidden/);
});
