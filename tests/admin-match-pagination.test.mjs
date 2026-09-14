import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [panel, styles] = await Promise.all([
  readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("partidas administrativas são paginadas em grupos de dez", () => {
  assert.match(panel, /pageSize = 10/);
  assert.match(panel, /visibleMatches\.slice\(pageStart, pageEnd\)/);
  assert.match(panel, /Paginação das partidas/);
  assert.match(panel, /Página \{page\} de \{totalPages\}/);
  assert.match(styles, /\.match-admin-pagination/);
});

test("filtro reinicia a consulta administrativa na primeira página", () => {
  assert.match(panel, /setOnlyActiveOrSeparated\(event\.target\.checked\); setPage\(1\)/);
});
