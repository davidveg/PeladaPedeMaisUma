import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [site, mobile, styles] = await Promise.all([
  readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../mobile/src/match-attendance.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("site e aplicativo agrupam a confirmação administrativa por tipo de jogador", () => {
  for (const source of [site, mobile]) {
    assert.match(source, /Goleiros/);
    assert.match(source, /Jogadores mensalistas/);
    assert.match(source, /Jogadores convidados/);
    assert.match(source, /player\.type === "casual"/);
    assert.match(source, /player\.primaryPosition === "Goleiro"/);
    assert.match(source, /player\.type !== "guest"/);
    assert.match(source, /player\.type === "guest"/);
  }
});

test("os grupos têm cabeçalhos e contadores próprios nas duas interfaces", () => {
  assert.match(site, /match-player-group-head/);
  assert.match(styles, /\.match-player-group-head/);
  assert.match(mobile, /SectionList/);
  assert.match(mobile, /renderSectionHeader/);
  assert.match(mobile, /section\.data\.length/);
});

test("a ordem alfabética dos grupos ignora acentos sem alterar o nome exibido", () => {
  for (const source of [site, mobile]) {
    assert.match(source, /normalize\("NFD"\)/);
    assert.match(source, /\\u0300-\\u036f/);
    assert.match(source, /\.sort\(compareAdministrativePlayerNames\)/);
  }
});
