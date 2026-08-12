import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, database, adminMatches, separationDrafts, matches, notifications, separationProposal] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/admin/matches/route.ts"),
  import("../app/api/admin/separation-drafts/route.ts"),
  import("../app/api/matches/route.ts"),
  import("../app/api/notifications/route.ts"),
  import("../app/api/mobile/separations/proposal/route.ts"),
]);
const { db, ensureDb, hashOpaqueToken, hashPassword } = database;

test("presença é compartilhada entre site e mobile, limita remarcações e gera separação", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-scheduled-matches-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), adminId = "match-admin", memberId = "match-member", playerId = "match-player";
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(adminId, "match-admin@example.com", await hashPassword("match-admin-password"), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("match-admin-session", adminId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind(memberId, "match-member@example.com", await hashPassword("match-member-password"), 1, now, now).run();
    await db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("match-member-session", memberId, "2099-01-01T00:00:00.000Z", now).run();
    const mobileAccess = "match-mobile-access-token";
    await db().prepare(`INSERT INTO mobile_sessions (id,account_type,account_id,access_token_hash,refresh_token_hash,access_expires_at,refresh_expires_at,created_at) VALUES (?,?,?,?,?,?,?,?)`)
      .bind("match-mobile-session", "member", memberId, await hashOpaqueToken(mobileAccess), await hashOpaqueToken("match-mobile-refresh"), "2099-01-01T00:00:00.000Z", "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(playerId, "Jogador Compartilhado", "Jogador Compartilhado", "Compartilhado", "[]", "monthly", "Defesa", 4, 4, 4, 1, now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`)
      .bind(playerId, "member", memberId, now).run();

    const creation = await adminMatches.POST(jsonRequest("https://pelada.example/api/admin/matches", {
      title: "Pelada de domingo", matchAt: "2099-07-27T12:00:00.000Z",
      confirmationDeadline: "2099-07-27T11:00:00.000Z", maxChanges: 2, location: "Batista",
    }, "ppm_session=match-admin-session"));
    assert.equal(creation.status, 201);
    const matchId = (await creation.json()).id;
    const initialList = await matches.GET(new Request("https://pelada.example/api/matches", { headers: { cookie: "ppm_member_session=match-member-session" } }));
    const initialMatch = (await initialList.json()).matches.find(item => item.id === matchId);
    assert.equal(typeof initialMatch.shareMessage, "string");
    assert.match(initialMatch.shareMessage, /PELADA DE DOMINGO/);
    assert.match(initialMatch.shareMessage, new RegExp(`https://pelada\\.example/partidas\\?match=${matchId}`));
    assert.doesNotMatch(initialMatch.shareMessage, /undefined/);

    assert.equal((await matches.PUT(jsonRequest("https://pelada.example/api/matches", { matchId, status: "PRESENT" }, "ppm_member_session=match-member-session"))).status, 200);
    assert.equal((await matches.PUT(bearerRequest("https://pelada.example/api/matches", { matchId, status: "ABSENT" }, mobileAccess))).status, 200);
    assert.equal((await matches.PUT(jsonRequest("https://pelada.example/api/matches", { matchId, status: "PRESENT" }, "ppm_member_session=match-member-session"))).status, 200);
    const blocked = await matches.PUT(bearerRequest("https://pelada.example/api/matches", { matchId, status: "ABSENT" }, mobileAccess));
    assert.equal(blocked.status, 409);
    assert.match((await blocked.json()).error, /limite de 2 remarcações/i);

    const answer = await db().prepare(`SELECT status,change_count FROM match_attendance WHERE match_id=? AND player_id=?`).bind(matchId, playerId).first();
    assert.deepEqual({ ...answer }, { status: "PRESENT", change_count: 2 });
    const memberNotices = await notifications.GET(new Request("https://pelada.example/api/notifications", { headers: { cookie: "ppm_member_session=match-member-session" } }));
    const noticePayload = await memberNotices.json();
    assert.ok(noticePayload.unread >= 4);
    assert.ok(noticePayload.notifications.some(item => item.type === "MATCH_CREATED"));
    assert.ok(noticePayload.notifications.some(item => item.type === "ATTENDANCE_CHANGED"));

    const players = (await db().prepare(`SELECT id FROM players WHERE active=1 AND deleted_at IS NULL AND id<>? LIMIT 3`).bind(playerId).all()).results;
    for (const player of players) {
      const response = await adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", { action: "attendance", matchId, playerId: player.id, status: "PRESENT" }, "ppm_session=match-admin-session", "PATCH"));
      assert.equal(response.status, 200);
    }
    const firstProposalResponse = await separationProposal.POST(jsonRequest(
      "https://pelada.example/api/mobile/separations/proposal",
      { matchId, nonce: 0 },
      "ppm_session=match-admin-session",
    ));
    assert.equal(firstProposalResponse.status, 200);
    const firstProposal = await firstProposalResponse.json();
    assert.equal(firstProposal.players.length, 4);
    assert.equal(firstProposal.result.proposal, 1);

    await db().prepare(`UPDATE instance_configuration SET separation_drafts_enabled=1 WHERE id=1`).run();
    const draftSaved = await separationDrafts.PUT(jsonRequest("https://pelada.example/api/admin/separation-drafts", {
      matchId, result: firstProposal.result, manuallyAdjusted: false,
    }, "ppm_session=match-admin-session", "PUT"));
    assert.equal(draftSaved.status, 200);
    assert.equal((await draftSaved.json()).draft.stale, false);
    const draftLoaded = await separationProposal.POST(jsonRequest(
      "https://pelada.example/api/mobile/separations/proposal",
      { matchId, loadDraft: true },
      "ppm_session=match-admin-session",
    ));
    assert.equal(draftLoaded.status, 200);
    assert.equal((await draftLoaded.json()).draft.exists, true);

    const extra = await db().prepare(`SELECT id FROM players WHERE active=1 AND deleted_at IS NULL AND id NOT IN (SELECT player_id FROM match_attendance WHERE match_id=?) LIMIT 1`).bind(matchId).first();
    assert.ok(extra?.id);
    assert.equal((await adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", { action: "attendance", matchId, playerId: extra.id, status: "PRESENT" }, "ppm_session=match-admin-session", "PATCH"))).status, 200);
    const staleDraft = await separationProposal.POST(jsonRequest(
      "https://pelada.example/api/mobile/separations/proposal",
      { matchId, loadDraft: true },
      "ppm_session=match-admin-session",
    ));
    assert.equal(staleDraft.status, 200);
    assert.equal((await staleDraft.json()).draft.stale, true);

    const regeneratedResponse = await separationProposal.POST(jsonRequest(
      "https://pelada.example/api/mobile/separations/proposal",
      { matchId, nonce: 1 },
      "ppm_session=match-admin-session",
    ));
    assert.equal(regeneratedResponse.status, 200);
    const regenerated = await regeneratedResponse.json();
    assert.equal(regenerated.result.proposal, 2);

    const incomplete = { ...regenerated.result, blue: regenerated.result.blue.slice(1) };
    const rejected = await adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", {
      action: "close", matchId, result: incomplete, manuallyAdjusted: true,
    }, "ppm_session=match-admin-session", "PATCH"));
    assert.equal(rejected.status, 409);
    assert.equal((await db().prepare(`SELECT status FROM scheduled_matches WHERE id=?`).bind(matchId).first()).status, "OPEN");

    const adjusted = structuredClone(regenerated.result);
    [adjusted.blue[0], adjusted.yellow[0]] = [adjusted.yellow[0], adjusted.blue[0]];
    const closed = await adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", {
      action: "close", matchId, result: adjusted, manuallyAdjusted: true,
    }, "ppm_session=match-admin-session", "PATCH"));
    assert.equal(closed.status, 200);
    const closedPayload = await closed.json();
    assert.ok(closedPayload.separationId);
    const stored = await db().prepare(`SELECT status,separation_id FROM scheduled_matches WHERE id=?`).bind(matchId).first();
    assert.deepEqual({ ...stored }, { status: "CLOSED", separation_id: closedPayload.separationId });
    const savedSeparation = await db().prepare(`SELECT id,snapshot,manually_adjusted FROM team_separations WHERE id=?`).bind(closedPayload.separationId).first();
    assert.ok(savedSeparation);
    assert.equal(JSON.parse(savedSeparation.snapshot).proposal, 2);
    assert.equal(savedSeparation.manually_adjusted, 1);
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM match_separation_drafts WHERE match_id=?`).bind(matchId).first().then(row => Number(row.total)), 0);
    const closedNotices = await notifications.GET(new Request("https://pelada.example/api/notifications", { headers: { cookie: "ppm_member_session=match-member-session" } }));
    assert.ok((await closedNotices.json()).notifications.some(item => item.type === "MATCH_CLOSED"));
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("lista de espera mantém convidado fora dos presentes até a aprovação administrativa", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-guest-preconfirmation-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), adminId = "waiting-admin", memberId = "waiting-member", guestId = "waiting-guest", matchId = "waiting-match";
    await db().prepare(`INSERT INTO administrators (id,email,password_hash,active,must_change_password,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`)
      .bind(adminId, "waiting-admin@example.com", await hashPassword("waiting-admin-password"), 1, 0, now, now).run();
    await db().prepare(`INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("waiting-admin-session", adminId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind(memberId, "waiting-member@example.com", await hashPassword("waiting-member-password"), 1, now, now).run();
    await db().prepare(`INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)`)
      .bind("waiting-member-session", memberId, "2099-01-01T00:00:00.000Z", now).run();
    await db().prepare(`INSERT INTO players (id,full_name,display_name,nickname,aliases,type,primary_position,speed,skill,marking,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind(guestId, "Convidado Espera", "Convidado Espera", "Espera", "[]", "guest", "Ataque", 3, 3, 3, 1, now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`)
      .bind(guestId, "member", memberId, now).run();
    await db().prepare(`UPDATE instance_configuration SET guest_preconfirmation_enabled=1,guest_confirmation_threshold=2 WHERE id=1`).run();
    await db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,location,max_changes,status,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,'OPEN',?,?,?)`)
      .bind(matchId, "Pelada com espera", "2099-08-17T12:00:00.000Z", "2099-08-17T11:00:00.000Z", "Batista", 2, adminId, now, now).run();
    const monthly = await db().prepare(`SELECT id FROM players WHERE type<>'guest' AND active=1 AND deleted_at IS NULL LIMIT 1`).first();
    assert.equal((await adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", { action: "attendance", matchId, playerId: monthly.id, status: "PRESENT" }, "ppm_session=waiting-admin-session", "PATCH"))).status, 200);

    const direct = await matches.PUT(jsonRequest("https://pelada.example/api/matches", { matchId, status: "PRESENT" }, "ppm_member_session=waiting-member-session", "PUT"));
    assert.equal(direct.status, 403);
    assert.match((await direct.json()).error, /administrador/i);

    const waiting = await adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", {
      action: "guest-preconfirmation", matchId, playerId: guestId, guestAction: "ADD",
    }, "ppm_session=waiting-admin-session", "PATCH"));
    assert.equal(waiting.status, 200);
    const waitingList = await matches.GET(new Request("https://pelada.example/api/matches", { headers: { cookie: "ppm_member_session=waiting-member-session" } }));
    const waitingMatch = (await waitingList.json()).matches.find(item => item.id === matchId);
    assert.equal(waitingMatch.counts.present, 1);
    assert.equal(waitingMatch.counts.preconfirmed, 1);
    assert.equal(waitingMatch.viewer.preconfirmed, true);
    assert.equal(waitingMatch.viewer.canConfirmPresence, false);
    assert.match(waitingMatch.shareMessage, /Convidados:\n1 - Convidado Espera: /);
    assert.doesNotMatch(waitingMatch.shareMessage, /Convidado Espera: ✅/);

    const approved = await adminMatches.PATCH(jsonRequest("https://pelada.example/api/admin/matches", {
      action: "attendance", matchId, playerId: guestId, status: "PRESENT",
    }, "ppm_session=waiting-admin-session", "PATCH"));
    assert.equal(approved.status, 200);
    const finalList = await matches.GET(new Request("https://pelada.example/api/matches", { headers: { cookie: "ppm_member_session=waiting-member-session" } }));
    const finalMatch = (await finalList.json()).matches.find(item => item.id === matchId);
    assert.equal(finalMatch.counts.present, 2);
    assert.equal(finalMatch.counts.preconfirmed, 0);
    assert.equal(finalMatch.viewer.status, "PRESENT");
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(url, body, cookie = "", method = "POST") {
  return new Request(url, { method, headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) }, body: JSON.stringify(body) });
}
function bearerRequest(url, body, token) {
  return new Request(url, { method: "PUT", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify(body) });
}
