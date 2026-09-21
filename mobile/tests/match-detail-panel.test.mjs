import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { matchDetailPanel } from "../src/match-detail-panel.ts";

const open = { matchId: "match-1", separationId: null };
const published = { matchId: "match-1", separationId: "separation-1" };
const historical = { matchId: null, separationId: "legacy-1" };

test("Times sem publicação exibe estado vazio em vez de presenças", () => {
  for (const status of ["OPEN", "CLOSED", "CANCELLED"]) {
    assert.equal(matchDetailPanel({ ...open, status }, "teams"), "awaiting-teams");
  }
});

test("presenças, súmula e votação mantêm seus estados antes da publicação", () => {
  assert.equal(matchDetailPanel(open, "attendance"), "attendance");
  assert.equal(matchDetailPanel(open, "result"), "unavailable");
  assert.equal(matchDetailPanel(open, "voting"), "unavailable");
});

test("alternar abas não reutiliza a tela de presenças em Times", () => {
  assert.deepEqual(["attendance", "teams", "result", "voting", "teams", "attendance"].map(tab => matchDetailPanel(open, tab)),
    ["attendance", "awaiting-teams", "unavailable", "unavailable", "awaiting-teams", "attendance"]);
});

test("times publicados e histórico continuam abrindo a separação na aba escolhida", () => {
  for (const item of [published, historical]) {
    for (const tab of ["teams", "result", "voting"]) assert.equal(matchDetailPanel(item, tab), "separation");
  }
  assert.equal(matchDetailPanel(published, "attendance"), "attendance");
  assert.equal(matchDetailPanel(historical, "attendance"), "legacy-attendance");
  assert.equal(matchDetailPanel(open, "teams"), "awaiting-teams");
  assert.equal(matchDetailPanel(published, "teams"), "separation");
});

test("tela usa a decisão de conteúdo e mostra mensagem específica para Times", async () => {
  const source = await readFile(new URL("../src/match-hub-detail.tsx", import.meta.url), "utf8");
  assert.match(source, /matchDetailPanel\(item, tab\)/);
  assert.match(source, /panel === "awaiting-teams" \? <EmptyState title="Times ainda não publicados"/);
  assert.equal((source.match(/<MatchAttendance /g) || []).length, 1);
  assert.match(source, /panel === "attendance" && item\.matchId\) return <MatchAttendance/);
});

test("central e abas acompanham a rolagem do conteúdo da partida", async () => {
  const [hub, attendance, separation] = await Promise.all([
    readFile(new URL("../src/match-hub-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/match-attendance.tsx", import.meta.url), "utf8"),
    readFile(new URL("../src/separation-detail.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(hub, /topContent=\{chrome\}/);
  assert.equal((hub.match(/topContent=\{chrome\}/g) || []).length, 2);
  assert.doesNotMatch(hub, /return <View style=\{\{ flex: 1/);
  assert.match(attendance, /ListHeaderComponent=\{<>\{topContent/);
  assert.match(separation, /<ScrollView[^>]+>[\s\S]*\{topContent\}<Header/);
});
