import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("cartões administrativos móveis seguem o overall e a paleta configurável", async () => {
  const [admin, styles] = await Promise.all([
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);

  assert.match(admin, /import \{ playerCardTier \} from "\.\.\/\.\.\/lib\/player-card-tier"/);
  assert.match(admin, /PlayerTables players=\{filtered\} config=\{\{\.\.\.defaultConfig,\.\.\.config,\.\.\.\(career\?\.config\|\|\{\}\)\}\}/);
  assert.match(admin, /tier-\$\{playerCardTier\(score\(player,config\),config\)\}/);
  assert.match(styles, /\.player-table \.player-tr\.tier-bronze\{--admin-player-tier-accent:#c77d50\}/);
  assert.match(styles, /\.player-table \.player-tr\.tier-silver\{--admin-player-tier-accent:#a8b4b9\}/);
  assert.match(styles, /\.player-table \.player-tr\.tier-gold\{--admin-player-tier-accent:#d9b83f\}/);
  assert.match(styles, /\.player-table \.player-tr\.tier-legendary\{--admin-player-tier-accent:#8061c8\}/);
  assert.match(styles, /\.player-table \.player-tr:not\(\.th\)>span:not\(\.person\)\{[^}]*var\(--control-surface[^}]*var\(--control-text/);
});
