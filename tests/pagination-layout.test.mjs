import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("todos os paginadores preservam seus resumos em uma linha", async () => {
  const [admin, matches, notifications, matchHub, theme] = await Promise.all([
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/MatchesPanel.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/notificacoes/NotificationsApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/partidas/MatchHubApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);

  assert.equal((admin.match(/className="pagination-summary"/g) || []).length, 2);
  assert.match(matches, /className="pagination-summary"/);
  assert.match(notifications, /className="pagination-summary"/);
  assert.match(matchHub, /className="pagination-summary"/);
  assert.match(theme, /grid-template-columns:\s*minmax\(110px, 1fr\) max-content minmax\(110px, 1fr\)/);
  assert.match(theme, /\.pagination-summary > \.pagination-range \{[\s\S]*white-space:\s*nowrap/);
  assert.match(theme, /\.match-admin-pagination \.ghost \{[\s\S]*white-space:\s*nowrap/);
  assert.match(theme, /@media \(max-width: 760px\) \{[\s\S]*grid-template-columns:\s*1fr 1fr/);
});
