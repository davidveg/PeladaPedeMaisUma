import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
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
