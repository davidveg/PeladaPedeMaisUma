import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword }, playersRoute, statisticsRoute, advancedStatisticsRoute] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/players/route.ts"),
  import("../app/api/public-statistics/route.ts"),
  import("../app/api/public-statistics/advanced/route.ts"),
]);

test("exclusão lógica exige jogador inativo e sem conta associada", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-player-delete-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), adminId = "delete-admin", cookie = "ppm_session=delete-admin-session";
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(adminId, "delete-admin@example.com", await hashPassword("senha-admin-123"), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("delete-admin-session", adminId, "2099-01-01T00:00:00.000Z", now).run();

    await insertPlayer("active-player", "Jogador Ativo", 1, now);
    await insertPlayer("linked-player", "Jogador Vinculado", 0, now);
    await insertPlayer("eligible-player", "Jogador Histórico", 0, now);
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind("linked-account", "linked@example.com", await hashPassword("senha-jogador-123"), 1, now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`)
      .bind("linked-player", "member", "linked-account", now).run();
    const historicalStanding = playerId => ({
      player: { id: playerId, displayName: playerId === "linked-player" ? "Jogador Vinculado" : "Jogador Histórico", type: "monthly", primaryPosition: "Defesa" },
      resultMomentum: 0.2, votingMomentum: 0.3, totalMomentum: 0.5, games: 3, wins: 2, draws: 0, losses: 1,
    });
    await db().prepare(`INSERT INTO monthly_career_awards (month,year,snapshot,finalized_at) VALUES (?,?,?,?)`)
      .bind("2099-01", 2099, JSON.stringify({ month: "2099-01", matchCount: 3, formation: { goalkeepers: 0, defenders: 2, midfielders: 0, attackers: 0 }, playerOfMonth: historicalStanding("linked-player"), selection: [{ ...historicalStanding("linked-player"), role: "Defesa" }, { ...historicalStanding("eligible-player"), role: "Defesa" }] }), now).run();
    await db().prepare(`INSERT INTO career_season_awards (season_number,year,started_at,ended_at,snapshot,finalized_by_administrator_id,finalized_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(99, 2099, "2099-01-01", "2099-12-31", JSON.stringify({ annualMvp: [{ player: historicalStanding("linked-player").player }, { player: historicalStanding("eligible-player").player }] }), adminId, now).run();

    const unauthenticated = await playersRoute.DELETE(deleteRequest("eligible-player"));
    assert.equal(unauthenticated.status, 401);

    const active = await playersRoute.DELETE(deleteRequest("active-player", cookie));
    assert.equal(active.status, 409);
    assert.match((await active.json()).error, /Desative o jogador/);

    const linked = await playersRoute.DELETE(deleteRequest("linked-player", cookie));
    assert.equal(linked.status, 409);
    assert.match((await linked.json()).error, /Desassocie a conta/);

    const inactiveStatistics = await statisticsRoute.GET(new Request("https://pelada.example/api/public-statistics?from=2000-01-01&to=2099-12-31", { headers: { cookie } }));
    assert.equal(inactiveStatistics.status, 200);
    const inactiveStatisticsPayload = await inactiveStatistics.json();
    assert.equal(inactiveStatisticsPayload.players.some(player => player.id === "linked-player"), true, "jogador somente inativado deve continuar no histórico");
    assert.equal(inactiveStatisticsPayload.careerHighlights.history[0].playerOfMonth.player.id, "linked-player", "destaque mensal do inativo deve ser preservado");
    assert.equal(inactiveStatisticsPayload.careerHighlights.annualMvp.some(entry => entry.player.id === "linked-player"), true, "premiação de temporada do inativo deve ser preservada");

    const inactiveAdvancedStatistics = await advancedStatisticsRoute.GET(new Request("https://pelada.example/api/public-statistics/advanced?from=2000-01-01&to=2099-12-31", { headers: { cookie } }));
    assert.equal(inactiveAdvancedStatistics.status, 200);
    assert.equal((await inactiveAdvancedStatistics.json()).allPlayers.some(player => player.id === "linked-player"), true, "jogador somente inativado deve continuar nas estatísticas avançadas");

    const deleted = await playersRoute.DELETE(deleteRequest("eligible-player", cookie));
    assert.equal(deleted.status, 200);
    assert.match((await deleted.json()).message, /histórico esportivo foi preservado/);

    const stored = await db().prepare(`SELECT active,deleted_at FROM players WHERE id=?`).bind("eligible-player").first();
    assert.equal(Number(stored.active), 0);
    assert.ok(stored.deleted_at, "o registro deve permanecer marcado com deleted_at");

    const adminList = await playersRoute.GET(new Request("https://pelada.example/api/players", { headers: { cookie } }));
    assert.equal(adminList.status, 200);
    assert.equal((await adminList.json()).players.some(player => player.id === "eligible-player"), false);

    const historicalStatistics = await statisticsRoute.GET(new Request("https://pelada.example/api/public-statistics?from=2000-01-01&to=2099-12-31", { headers: { cookie } }));
    assert.equal(historicalStatistics.status, 200);
    const historicalPayload = await historicalStatistics.json();
    assert.equal(historicalPayload.players.some(player => player.id === "eligible-player"), false);
    assert.equal(historicalPayload.players.some(player => player.id === "linked-player"), true);
    assert.equal(historicalPayload.careerHighlights.history[0].playerOfMonth.player.id, "linked-player");
    assert.equal(historicalPayload.careerHighlights.history[0].selection.some(entry => entry.player.id === "eligible-player"), false, "exclusão deve remover o jogador do destaque mensal exibido");
    assert.equal(historicalPayload.careerHighlights.annualMvp.some(entry => entry.player.id === "eligible-player"), false, "exclusão deve remover o jogador da premiação de temporada exibida");

    const advancedStatistics = await advancedStatisticsRoute.GET(new Request("https://pelada.example/api/public-statistics/advanced?from=2000-01-01&to=2099-12-31", { headers: { cookie } }));
    assert.equal(advancedStatistics.status, 200);
    const advancedPayload = await advancedStatistics.json();
    assert.equal(advancedPayload.allPlayers.some(player => player.id === "eligible-player"), false);
    assert.equal(advancedPayload.allPlayers.some(player => player.id === "linked-player"), true);

    const audit = await db().prepare(`SELECT action,entity_id,new_data FROM audit_logs WHERE action='DELETE' AND entity_id=?`).bind("eligible-player").first();
    assert.equal(audit.action, "DELETE");
    assert.equal(JSON.parse(audit.new_data).deletionType, "logical");
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

async function insertPlayer(id, displayName, active, now) {
  await db().prepare(`INSERT INTO players (id,full_name,display_name,type,primary_position,speed,skill,marking,goalkeeper_positioning,goal_exit,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, displayName, displayName, "monthly", "Defesa", 3, 3, 3, 3, 3, active, now, now).run();
}

function deleteRequest(id, cookie = "") {
  return new Request(`https://pelada.example/api/players?id=${encodeURIComponent(id)}`, { method: "DELETE", headers: cookie ? { cookie } : {} });
}
