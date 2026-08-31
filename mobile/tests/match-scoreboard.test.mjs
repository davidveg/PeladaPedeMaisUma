import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { runInNewContext } from "node:vm";
import * as jsxRuntime from "react/jsx-runtime";
import ts from "typescript";
import { contrastTextColor } from "../src/team-colors.ts";

// Exercise the real presentation component without requiring a native device.
const source = await readFile(new URL("../src/match-scoreboard.tsx", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
function component(branding = {
  config: { teamBlueName: "Azul", teamYellowName: "Amarelo" },
  palette: { blue: "#1768E5", yellow: "#F4BF20", muted: "#66756E", border: "#DDE4DF" },
}) {
  const exports = {};
  const imports = {
    "react/jsx-runtime": jsxRuntime,
    "react-native": { View: "View", Text: "Text", StyleSheet: { create: styles => styles } },
    "./branding": { useMobileBranding: () => branding },
    "./team-colors": { contrastTextColor },
  };
  runInNewContext(compiled, { exports, require: name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  } });
  return exports.MatchScoreboard;
}
function nodes(element) {
  if (element == null || typeof element !== "object") return [];
  if (Array.isArray(element)) return element.flatMap(nodes);
  if (typeof element.type === "function") return nodes(element.type(element.props));
  return [element, ...nodes(element.props?.children)];
}
const style = node => Object.assign({}, ...[node.props.style].flat().filter(Boolean));

test("placar aparece somente com resultado completo, incluindo zero e empate", () => {
  const Scoreboard = component();
  for (const [blueScore, yellowScore] of [[null, null], [null, 7], [3, null]]) assert.equal(Scoreboard({ blueScore, yellowScore }), null);
  for (const [blueScore, yellowScore] of [[0, 0], [3, 7], [10, 12], [2, 2]]) {
    const rendered = Scoreboard({ blueScore, yellowScore });
    assert.equal(rendered.props.accessibilityLabel, `Placar final: Azul ${blueScore} a ${yellowScore} Amarelo`);
    assert.deepEqual(nodes(rendered).filter(node => typeof node.props.children === "number").map(node => node.props.children), [blueScore, yellowScore]);
  }
});

test("usa identidade da instância e contraste também para times de cores claras", () => {
  const Scoreboard = component({
    config: { teamBlueName: "Vermelho da pelada", teamYellowName: "Equipe de nome bastante longo para a listagem" },
    palette: { blue: "#A80000", yellow: "#FFFFFF", muted: "#66756E", border: "#DDE4DF" },
  });
  const rendered = Scoreboard({ blueScore: 12, yellowScore: 3 }), elements = nodes(rendered);
  assert.match(rendered.props.accessibilityLabel, /Equipe de nome bastante longo para a listagem/);
  const teams = elements.filter(node => style(node).flex === 1);
  assert.deepEqual(teams.map(node => style(node).backgroundColor), ["#A80000", "#FFFFFF"]);
  const numbers = elements.filter(node => typeof node.props.children === "number");
  assert.deepEqual(numbers.map(node => style(node).color), ["#FFFFFF", "#17221D"]);
});

test("mantém dois lados flexíveis, nomes limitados e números ajustáveis sem altura fixa", () => {
  const elements = nodes(component()({ blueScore: 10, yellowScore: 12 }));
  const row = elements.find(node => style(node).flexDirection === "row");
  assert.notEqual(style(row).flexWrap, "wrap");
  for (const team of elements.filter(node => style(node).flex === 1)) {
    assert.equal(style(team).minWidth, 0);
    assert.equal(style(team).height, undefined);
    assert.equal(style(team).width, undefined);
  }
  for (const number of elements.filter(node => typeof node.props.children === "number")) {
    assert.equal(number.props.numberOfLines, 1);
    assert.equal(number.props.adjustsFontSizeToFit, true);
    assert.equal(style(number).fontSize, 36);
  }
  const names = elements.filter(node => node.props.numberOfLines === 2);
  assert.equal(names.length, 2);
  assert.ok(names.every(node => style(node).width === "100%"));
});

test("cards de Partidas usam o novo placar sem alterar navegação", async () => {
  const screen = await readFile(new URL("../app/(app)/matches/index.tsx", import.meta.url), "utf8");
  assert.match(screen, /<MatchScoreboard blueScore=\{item.blueScore\} yellowScore=\{item.yellowScore\}\/>/);
  assert.doesNotMatch(screen, /styles\.score/);
  assert.match(screen, /Ver partida →/);
});
