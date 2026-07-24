import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, { notifyOpenCareerVote }] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../lib/push-notifications.ts"),
]);

test("push de votação alcança somente participante pendente e não duplica a entrega", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-push-vote-"));
  const bindings = await createSelfhostBindings(directory);
  const originalFetch = globalThis.fetch;
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString();
    const players = Array.from({ length: 7 }, (_, index) => ({ id: `push-p${index + 1}`, displayName: `Jogador ${index + 1}` }));
    await db().prepare(`INSERT INTO players (id,full_name,display_name,aliases,type,primary_position,speed,skill,active,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("push-p1", "Jogador 1", "Jogador 1", "[]", "monthly", "Ataque", 3, 3, 1, now, now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`)
      .bind("push-account", "push@example.com", "hash", 1, now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`)
      .bind("push-p1", "member", "push-account", now).run();
    await db().prepare(`INSERT INTO mobile_push_tokens (id,account_type,account_id,mobile_session_id,expo_push_token,platform,active,created_at,updated_at) VALUES (?,?,?,?,?,?,1,?,?)`)
      .bind("push-token-id", "member", "push-account", "session", "ExpoPushToken[test-token]", "android", now, now).run();
    await db().prepare(`INSERT INTO team_separations (id,match_title,original_text,snapshot,balance_score,balance_classification,confirmed_at,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`)
      .bind("push-separation", "Pelada com votação", "", JSON.stringify({ blue: players.slice(0, 4), yellow: players.slice(4) }), 0, "Bom equilíbrio", now, now, now).run();
    await db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,created_by_administrator_id,config_snapshot,team_momentum_applied,votes_momentum_applied,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .bind("push-match", "push-separation", 2, 1, "BLUE", "push-vote-token", "OPEN", "2099-01-01T00:00:00.000Z", "admin", "{}", 1, 0, now, now).run();

    const requests = [];
    globalThis.fetch = async (_url, options) => {
      requests.push(JSON.parse(options.body));
      return Response.json({ data: [{ status: "ok", id: "expo-ticket" }] });
    };
    const first = await notifyOpenCareerVote("push-match");
    assert.equal(first.sent, 1);
    assert.equal(requests.length, 1);
    assert.deepEqual(requests[0][0].data, {
      type: "career_vote_open",
      separationId: "push-separation",
      careerMatchId: "push-match",
    });
    const delivery = await db().prepare(`SELECT status,ticket_id FROM push_notification_deliveries WHERE career_match_id='push-match'`).first();
    assert.deepEqual({ ...delivery }, { status: "SENT", ticket_id: "expo-ticket" });

    const duplicate = await notifyOpenCareerVote("push-match");
    assert.equal(duplicate.sent, 0);
    assert.equal(requests.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});
