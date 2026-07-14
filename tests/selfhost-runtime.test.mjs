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
