import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, seasons] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../lib/career-season.ts"),
]);
const { db, ensureDb } = database;

test("zera somente os saldos de momentum quando a temporada vence", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-career-season-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings(bindings);
  try {
    await ensureDb();
    const player = await db().prepare(`SELECT id FROM players LIMIT 1`).first();
    assert.ok(player?.id);
    await db().prepare(`UPDATE players SET momentum=.7,result_momentum=.3,voting_momentum=.4 WHERE id=?`).bind(player.id).run();
    await db().prepare(`UPDATE career_configuration SET season_duration_months=6,season_started_at='2025-07-01T03:00:00.000Z',next_season_reset_at='2026-01-01T03:00:00.000Z',season_number=1 WHERE id=1`).run();

    assert.equal(await seasons.ensureCareerSeasonCurrent(new Date("2026-08-03T12:00:00.000Z")), true);
    const updatedPlayer = await db().prepare(`SELECT momentum,result_momentum,voting_momentum FROM players WHERE id=?`).bind(player.id).first();
    assert.deepEqual({ ...updatedPlayer }, { momentum: 0, result_momentum: 0, voting_momentum: 0 });
    const config = await db().prepare(`SELECT season_started_at,next_season_reset_at,season_number FROM career_configuration WHERE id=1`).first();
    assert.deepEqual({ ...config }, { season_started_at: "2026-01-01T03:00:00.000Z", next_season_reset_at: "2027-01-01T03:00:00.000Z", season_number: 2 });
    assert.equal(await seasons.ensureCareerSeasonCurrent(new Date("2026-08-03T12:00:00.000Z")), false);
    assert.equal(Number(await db().prepare(`SELECT COUNT(*) total FROM audit_logs WHERE action='CAREER_SEASON_RESET'`).first("total")), 1);
  } finally {
    bindings.DB.close();
    await rm(directory, { recursive: true, force: true });
  }
});
