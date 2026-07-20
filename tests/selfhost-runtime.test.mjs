import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { insertAdministratorSql } from "../lib/administrator-sql.ts";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

test("adaptador SQLite preserva a API D1 usada pela aplicação", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-selfhost-db-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE example (id TEXT PRIMARY KEY, value REAL)").run();
    await bindings.DB.prepare("INSERT INTO example VALUES (?, ?)").bind("one", 4.2).run();
    const row = await bindings.DB.prepare("SELECT * FROM example WHERE id=?").bind("one").first();
    const rows = await bindings.DB.prepare("SELECT * FROM example").all();
    assert.equal(row.value, 4.2);
    assert.equal(rows.results.length, 1);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona configuração e eventos de gols com assistência opcional", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-goal-assists-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE career_configuration (id INTEGER PRIMARY KEY)").run();
    await bindings.DB.prepare("INSERT INTO career_configuration (id) VALUES (1)").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0008_goal_assist_tracking.sql", import.meta.url), "utf8"));
    const config = await bindings.DB.prepare("SELECT track_contributions FROM career_configuration WHERE id=1").first();
    assert.equal(config.track_contributions, 1);
    const now = new Date().toISOString();
    await bindings.DB.prepare("INSERT INTO career_match_contributions VALUES (?,?,?,?,?,?,?)").bind("goal-1", "match-1", "player-1", null, "BLUE", 1, now).run();
    await bindings.DB.prepare("INSERT INTO career_match_contributions VALUES (?,?,?,?,?,?,?)").bind("goal-2", "match-1", "player-2", "player-1", "BLUE", 0, now).run();
    const rows = await bindings.DB.prepare("SELECT scorer_player_id,assist_player_id,is_own_goal FROM career_match_contributions ORDER BY id").all();
    assert.deepEqual(rows.results.map(row => ({ ...row })), [
      { scorer_player_id: "player-1", assist_player_id: null, is_own_goal: 1 },
      { scorer_player_id: "player-2", assist_player_id: "player-1", is_own_goal: 0 },
    ]);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona ordem de chegada às separações existentes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-arrival-order-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE team_separations (id TEXT PRIMARY KEY)").run();
    await bindings.DB.prepare("INSERT INTO team_separations (id) VALUES ('match-1')").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0009_separation_arrival_order.sql", import.meta.url), "utf8"));
    await bindings.DB.prepare("UPDATE team_separations SET arrival_order=? WHERE id='match-1'").bind(JSON.stringify(["p2", "p1"])).run();
    const row = await bindings.DB.prepare("SELECT arrival_order FROM team_separations WHERE id='match-1'").first();
    assert.deepEqual(JSON.parse(row.arrival_order), ["p2", "p1"]);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona rascunho de súmula às separações existentes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-match-draft-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE team_separations (id TEXT PRIMARY KEY)").run();
    await bindings.DB.prepare("INSERT INTO team_separations (id) VALUES ('match-1')").run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0010_match_contribution_draft.sql", import.meta.url), "utf8"));
    const draft={contributions:[{team:"BLUE",scorerPlayerId:"p1",assistPlayerId:null,ownGoal:false}]};
    await bindings.DB.prepare("UPDATE team_separations SET match_draft=? WHERE id='match-1'").bind(JSON.stringify(draft)).run();
    const row = await bindings.DB.prepare("SELECT match_draft FROM team_separations WHERE id='match-1'").first();
    assert.deepEqual(JSON.parse(row.match_draft),draft);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("adaptador de uploads persiste bytes e metadados", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-selfhost-upload-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    await bindings.UPLOADS.put("players/test.png", bytes, { httpMetadata: { contentType: "image/png" } });
    const object = await bindings.UPLOADS.get("players/test.png");
    assert.deepEqual([...object.body], [...bytes]);
    assert.equal(object.httpMetadata.contentType, "image/png");
    assert.deepEqual([...await readFile(join(directory, "uploads", "players", "test.png"))], [...bytes]);
    assert.throws(() => bindings.UPLOADS.objectPath("players/../../escape.png"), /inválida/);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("cadastro de administrador usa exatamente as oito colunas do schema", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-selfhost-admin-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare(`CREATE TABLE administrators (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, active INTEGER NOT NULL, must_change_password INTEGER NOT NULL, last_login_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
    const now = new Date().toISOString();
    await bindings.DB.prepare(insertAdministratorSql).bind("one", "admin@example.com", "hash", 1, 0, null, now, now).run();
    const row = await bindings.DB.prepare(`SELECT email,active FROM administrators WHERE id=?`).bind("one").first();
    assert.equal(row.email, "admin@example.com");
    assert.equal(row.active, 1);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona marcação e preserva proporcionalmente os pesos existentes", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-marking-weight-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE system_configuration (id INTEGER PRIMARY KEY, speed_weight REAL NOT NULL, skill_weight REAL NOT NULL)").run();
    await bindings.DB.prepare("INSERT INTO system_configuration VALUES (1, 0.7, 0.3)").run();
    const migration = await readFile(new URL("../drizzle/0002_add_marking_weight.sql", import.meta.url), "utf8");
    await bindings.DB.exec(migration);
    const row = await bindings.DB.prepare("SELECT speed_weight, skill_weight, marking_weight FROM system_configuration WHERE id=1").first();
    assert.ok(Math.abs(row.speed_weight - .56) < 1e-9);
    assert.ok(Math.abs(row.skill_weight - .24) < 1e-9);
    assert.equal(row.marking_weight, .2);
    assert.ok(Math.abs(row.speed_weight + row.skill_weight + row.marking_weight - 1) < 1e-9);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração do Modo Carreira adiciona momentum e configura os padrões", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-career-mode-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE players (id TEXT PRIMARY KEY)").run();
    await bindings.DB.prepare("INSERT INTO players (id) VALUES ('one')").run();
    const migration = await readFile(new URL("../drizzle/0003_career_mode.sql", import.meta.url), "utf8");
    await bindings.DB.exec(migration);
    const player = await bindings.DB.prepare("SELECT momentum FROM players WHERE id='one'").first();
    const config = await bindings.DB.prepare("SELECT * FROM career_configuration WHERE id=1").first();
    assert.equal(player.momentum, 0);
    assert.equal(config.enabled, 1);
    assert.equal(config.winner_bonus, .1);
    assert.equal(config.loser_penalty, -.1);
    assert.equal(config.motm_first, .3);
    assert.equal(config.dotm_first, -.3);
    assert.equal(config.voting_days, 5);
    await bindings.DB.prepare("INSERT INTO career_votes VALUES (?,?,?,?,?,?,?,?,?,?)").bind("v1","m1","one","a","b","c","d","e","f",new Date().toISOString()).run();
    await assert.rejects(()=>bindings.DB.prepare("INSERT INTO career_votes VALUES (?,?,?,?,?,?,?,?,?,?)").bind("v2","m1","one","a","b","c","d","e","f",new Date().toISOString()).run(),/UNIQUE/);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona multiplicador de momentum preservando o efeito atual", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-momentum-multiplier-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE career_configuration (id INTEGER PRIMARY KEY)").run();
    await bindings.DB.prepare("INSERT INTO career_configuration (id) VALUES (1)").run();
    const migration = await readFile(new URL("../drizzle/0004_momentum_multiplier.sql", import.meta.url), "utf8");
    await bindings.DB.exec(migration);
    const config = await bindings.DB.prepare("SELECT momentum_multiplier FROM career_configuration WHERE id=1").first();
    assert.equal(config.momentum_multiplier, 1);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração adiciona atributos de goleiro preservando as notas anteriores", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-goalkeeper-attributes-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.prepare("CREATE TABLE players (id TEXT PRIMARY KEY, type TEXT NOT NULL, primary_position TEXT NOT NULL, speed REAL NOT NULL, marking REAL NOT NULL)").run();
    await bindings.DB.prepare("INSERT INTO players VALUES ('g1','goalkeeper','Goleiro',4.2,3.7)").run();
    await bindings.DB.prepare("INSERT INTO players VALUES ('p1','monthly','Defesa',4.8,4.4)").run();
    const migration = await readFile(new URL("../drizzle/0005_goalkeeper_attributes.sql", import.meta.url), "utf8");
    await bindings.DB.exec(migration);
    const goalkeeper = await bindings.DB.prepare("SELECT goalkeeper_positioning,goal_exit FROM players WHERE id='g1'").first();
    const linePlayer = await bindings.DB.prepare("SELECT goalkeeper_positioning,goal_exit FROM players WHERE id='p1'").first();
    assert.deepEqual({...goalkeeper}, { goalkeeper_positioning: 4.2, goal_exit: 3.7 });
    assert.deepEqual({...linePlayer}, { goalkeeper_positioning: 3, goal_exit: 3 });
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("migração de contas garante um único login para cada jogador", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-member-accounts-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    const migration = await readFile(new URL("../drizzle/0006_member_accounts.sql", import.meta.url), "utf8");
    await bindings.DB.exec(migration);
    const now = new Date().toISOString();
    await bindings.DB.prepare(`INSERT INTO member_accounts (id,email,password_hash,player_id,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)`).bind("one", "one@example.com", "hash", "player-one", now, now).run();
    await assert.rejects(() => bindings.DB.prepare(`INSERT INTO member_accounts (id,email,password_hash,player_id,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)`).bind("two", "two@example.com", "hash", "player-one", now, now).run(), /UNIQUE/);
    await bindings.DB.prepare(`UPDATE member_accounts SET player_id=NULL WHERE id='one'`).run();
    await bindings.DB.prepare(`INSERT INTO member_accounts (id,email,password_hash,player_id,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)`).bind("two", "two@example.com", "hash", "player-one", now, now).run();
    const account = await bindings.DB.prepare(`SELECT email FROM member_accounts WHERE player_id='player-one'`).first();
    assert.equal(account.email, "two@example.com");
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});

test("vínculo compartilhado impede que administrador e usuário escolham o mesmo jogador", async () => {
  const directory = await mkdtemp(join(tmpdir(), "pelada-shared-player-link-"));
  const bindings = await createSelfhostBindings(directory);
  try {
    await bindings.DB.exec(await readFile(new URL("../drizzle/0006_member_accounts.sql", import.meta.url), "utf8"));
    const now = new Date().toISOString();
    await bindings.DB.prepare(`INSERT INTO member_accounts (id,email,password_hash,player_id,active,created_at,updated_at) VALUES (?,?,?,?,1,?,?)`).bind("member-one", "member@example.com", "hash", "player-one", now, now).run();
    await bindings.DB.exec(await readFile(new URL("../drizzle/0007_shared_player_account_links.sql", import.meta.url), "utf8"));
    const migrated = await bindings.DB.prepare(`SELECT account_type,account_id FROM player_account_links WHERE player_id='player-one'`).first();
    const legacy = await bindings.DB.prepare(`SELECT player_id FROM member_accounts WHERE id='member-one'`).first();
    assert.deepEqual({ ...migrated }, { account_type: "member", account_id: "member-one" });
    assert.equal(legacy.player_id, null);
    await assert.rejects(() => bindings.DB.prepare(`INSERT INTO player_account_links VALUES (?,?,?,?)`).bind("player-one", "administrator", "admin-one", now).run(), /UNIQUE/);
    await bindings.DB.prepare(`DELETE FROM player_account_links WHERE account_id='member-one'`).run();
    await bindings.DB.prepare(`INSERT INTO player_account_links VALUES (?,?,?,?)`).bind("player-one", "administrator", "admin-one", now).run();
    const administratorLink = await bindings.DB.prepare(`SELECT account_type FROM player_account_links WHERE account_id='admin-one'`).first();
    assert.equal(administratorLink.account_type, "administrator");
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});
