import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb, hashPassword }, mobileAuth, memberAuth, careerVote] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/mobile/auth/route.ts"),
  import("../app/api/member-auth/route.ts"),
  import("../app/api/career/vote/route.ts"),
]);

test("voto exige conta autenticada, usa o jogador associado e é único entre site e aplicativo", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-career-vote-auth-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), password = "senha-segura-123", accountId = "member-voter", playerId = "p1";
    const players = Array.from({ length: 7 }, (_, index) => ({ id: `p${index + 1}`, displayName: `Jogador ${index + 1}`, primaryPosition: "Ataque" }));
    await db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,marking,goalkeeper_positioning,goal_exit,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(playerId, "Jogador 1", "Jogador 1", "[]", "monthly", "Ataque", 3, 3, 3, 3, 3, 1, now, now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind(accountId, "voter@example.com", await hashPassword(password), 1, now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`)
      .bind(playerId, "member", accountId, now).run();
    await db().prepare(`INSERT INTO team_separations (id,match_title,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind("s1", "Pelada autenticada", "", JSON.stringify({ blue: players.slice(0, 4), yellow: players.slice(4) }), 0, "Bom equilíbrio", now, now, now).run();
    await db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,created_by_administrator_id,config_snapshot,team_momentum_applied,votes_momentum_applied,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("m1", "s1", 3, 2, "BLUE", "token-vote", "OPEN", "2099-01-01T00:00:00.000Z", "admin", JSON.stringify({}), 1, 0, now, now).run();

    const body = { token: "token-vote", voterPlayerId: "p2", motmThirdId: "p2", motmSecondId: "p3", motmFirstId: "p4", dotmThirdId: "p5", dotmSecondId: "p6", dotmFirstId: "p7" };
    const unauthenticated = await careerVote.POST(jsonRequest("https://pelada.example/api/career/vote", body));
    assert.equal(unauthenticated.status, 401);

    const login = await mobileAuth.POST(jsonRequest("https://pelada.example/api/mobile/auth", { email: "voter@example.com", password }));
    const session = await login.json();
    const created = await careerVote.POST(authorizedJson("https://pelada.example/api/career/vote", session.accessToken, body));
    assert.equal(created.status, 201);
    const stored = await db().prepare(`SELECT voter_player_id,voter_account_type,voter_account_id FROM career_votes WHERE career_match_id='m1'`).first();
    assert.deepEqual({ ...stored }, { voter_player_id: "p1", voter_account_type: "member", voter_account_id: accountId });

    const state = await careerVote.GET(authorized("https://pelada.example/api/career/vote?token=token-vote", session.accessToken));
    const payload = await state.json();
    assert.equal(payload.viewer.player.id, playerId);
    assert.equal(payload.viewer.hasVoted, true);
    assert.equal(payload.viewer.canVote, false);

    const duplicate = await careerVote.POST(authorizedJson("https://pelada.example/api/career/vote", session.accessToken, body));
    assert.equal(duplicate.status, 409);

    const webLogin = await memberAuth.POST(jsonRequest("https://pelada.example/api/member-auth", { email: "voter@example.com", password }));
    assert.equal(webLogin.status, 200);
    const webCookie = webLogin.headers.get("set-cookie").split(";")[0];
    const webDuplicateAfterMobile = await careerVote.POST(cookieJson("https://pelada.example/api/career/vote", webCookie, body));
    assert.equal(webDuplicateAfterMobile.status, 409);
    assert.match((await webDuplicateAfterMobile.json()).error, /site ou aplicativo/);

    await db().prepare(`INSERT INTO team_separations (id,match_title,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind("s2", "Pelada web primeiro", "", JSON.stringify({ blue: players.slice(0, 4), yellow: players.slice(4) }), 0, "Bom equilíbrio", now, now, now).run();
    await db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,created_by_administrator_id,config_snapshot,team_momentum_applied,votes_momentum_applied,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("m2", "s2", 1, 1, "DRAW", "token-web-first", "OPEN", "2099-01-01T00:00:00.000Z", "admin", JSON.stringify({}), 1, 0, now, now).run();
    const secondBody = { ...body, token: "token-web-first" };
    const webCreated = await careerVote.POST(cookieJson("https://pelada.example/api/career/vote", webCookie, secondBody));
    assert.equal(webCreated.status, 201);
    const mobileDuplicateAfterWeb = await careerVote.POST(authorizedJson("https://pelada.example/api/career/vote", session.accessToken, secondBody));
    assert.equal(mobileDuplicateAfterWeb.status, 409);
    assert.equal((await db().prepare(`SELECT COUNT(*) total FROM career_votes WHERE career_match_id='m2'`).first()).total, 1);
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(url, body) {
  return new Request(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
}
function authorized(url, token) {
  return new Request(url, { headers: { authorization: `Bearer ${token}` } });
}
function authorizedJson(url, token, body) {
  return new Request(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
}
function cookieJson(url, cookie, body) {
  return new Request(url, { method: "POST", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify(body) });
}
