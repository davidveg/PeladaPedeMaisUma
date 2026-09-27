import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [panel, styles, theme] = await Promise.all([
  readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
]);

test("partidas administrativas são paginadas em grupos de dez", () => {
  assert.match(panel, /pageSize = 10/);
  assert.match(panel, /visibleMatches\.slice\(pageStart, pageEnd\)/);
  assert.match(panel, /Paginação das partidas/);
  assert.match(panel, /Página \{page\} de \{totalPages\}/);
  assert.match(styles, /\.match-admin-pagination/);
});

test("gestão de partidas herda as paletas configuráveis do painel", () => {
  assert.match(theme, /Administrative match management uses the same saved management/);
  assert.match(panel, /className="admin-matches match-admin-surface"/);
  assert.match(theme, /\.match-admin-surface \.match-admin-detail \.weather-preview[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.match-admin-surface \.match-player-group-head \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.match-admin-surface \.match-player-admin-list > div,[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.match-admin-surface \.match-admin-pagination[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.match-admin-surface \.match-player-admin-list \.attendance-present\.on[\s\S]*var\(--management-button/);
});

test("filtro reinicia a consulta administrativa na primeira página", () => {
  assert.match(panel, /setOnlyActiveOrSeparated\(event\.target\.checked\); setPage\(1\)/);
});
