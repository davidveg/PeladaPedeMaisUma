import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });
const [{ setRuntimeBindings }, { db, ensureDb }, hub, badges, separations, mobileSeparations, matches, adminMatches, { matchHubHref }] = await Promise.all([
  import("../lib/runtime-bindings.ts"), import("../lib/database.ts"), import("../app/api/match-hub/route.ts"),
  import("../app/api/match-hub/badges/route.ts"), import("../app/api/separations/route.ts"),
  import("../app/api/mobile/separations/route.ts"), import("../app/api/matches/route.ts"),
  import("../app/api/admin/matches/route.ts"), import("../lib/match-hub.ts"),
]);

test("hub unifica histórico e agenda sem alterar dados, vínculos ou permissões", async t => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-match-hub-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });
  try {
    await ensureDb();
    const now = new Date().toISOString(), future = new Date(Date.now() + 86400000).toISOString();
    const admin = await db().prepare("SELECT id FROM administrators LIMIT 1").first();
    const player = await db().prepare("SELECT id FROM players LIMIT 1").first();
    await db().prepare("INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)").bind("hub-admin", admin.id, future, now).run();
    await db().prepare("INSERT INTO member_accounts (id,email,password_hash,active,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind("hub-member", "hub@example.com", "hash", 1, "member", now, now).run();
    await db().prepare("INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)").bind("hub-member-session", "hub-member", future, now).run();
    await db().prepare("INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)").bind(player.id, "member", "hub-member", now).run();
    const snapshot = JSON.stringify({ blue: [{ id: player.id, displayName: "Teste", primaryPosition: "Defesa", speed: 3, skill: 3, marking: 3 }], yellow: [{ id: "other", displayName: "Outro", primaryPosition: "Ataque", speed: 3, skill: 3, marking: 3 }] });
    const addSeparation = (id, deleted = false, date = "2026-07-12") => db().prepare(`INSERT INTO team_separations (id,match_title,match_date,snapshot,confirmed_at,created_at,updated_at,deleted_at,original_text,balance_score,balance_classification) VALUES (?,?,?,?,?,?,?,?,'',0,'Equilíbrio aceitável')`).bind(id, id, date, snapshot, now, now, now, deleted ? now : null).run();
    const addMatch = (id, status, separationId = null) => db().prepare(`INSERT INTO scheduled_matches (id,title,match_at,confirmation_deadline,max_changes,status,created_by_administrator_id,separation_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)`).bind(id, id, future, future, 2, status, admin.id, separationId, now, now).run();
    await addSeparation("linked"); await addSeparation("legacy", false, null); await addSeparation("deleted", true);
    await addMatch("open", "OPEN"); await addMatch("generated", "CLOSED", "linked");
    await addMatch("cancelled", "CANCELLED"); await addMatch("closed", "CLOSED");
    await addMatch("deleted-separation", "CLOSED", "deleted");
    await db().prepare(`INSERT INTO match_separation_drafts (id,match_id,snapshot,present_player_ids,proposal_number,manually_adjusted,created_by_administrator_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind("private-draft", "open", snapshot, "[]", 1, 0, admin.id, now, now).run();
    const request = (path, cookie = "") => new Request(`https://pelada.example${path}`, { headers: cookie ? { cookie } : {} });
    const member = "ppm_member_session=hub-member-session", adminCookie = "ppm_session=hub-admin";
    const get = async (query = "", cookie = member) => {
      const response = await hub.GET(request(`/api/match-hub${query}`, cookie));
      assert.equal(response.status, 200); assert.match(response.headers.get("cache-control"), /no-store/);
      return response.json();
    };
    await t.test("uma única entrada por partida; canceladas e fechadas sem times ocultas por padrão", async () => {
      const result = await get();
      assert.deepEqual(result.items.map(item => item.id).sort(), ["match:generated", "match:open", "separation:legacy"]);
      assert.equal(result.items.filter(item => item.separationId === "linked").length, 1);
      assert.equal(result.items[0].matchId, "open");
      assert.equal(result.items.find(item => item.separationId === "legacy").date, null);
      assert.equal(result.items.find(item => item.separationId === "legacy").present, null);
      assert.deepEqual(result.viewer, { authenticated: true, permissions: [] });
      for (const item of result.items) for (const key of ["snapshot", "attendance", "separationDraft", "draft", "originalText", "players", "weather", "weatherSnapshot", "weather_snapshot"]) assert.equal(key in item, false, key);
    });
    await t.test("previsão compacta aparece na lista e no detalhe sem atualizar o histórico nem consultar provedores", async () => {
      const saved = JSON.stringify({ status: "AVAILABLE", description: "Chuva", icon: "🌧️", temperatureMin: 20.3, temperatureMax: 20.4, windSpeed: 15.1, fetchedAt: "2020-01-01T00:00:00Z", requestedAddress: "Endereço privado", latitude: 10 });
      await db().prepare("UPDATE scheduled_matches SET weather_snapshot=?,weather_updated_at=? WHERE id='generated'").bind(saved, "2020-01-01T00:00:00Z").run();
      const originalFetch = globalThis.fetch;
      let requests = 0;
      globalThis.fetch = async () => { requests++; throw new Error("A listagem não deve consultar previsão externa"); };
      try {
        const list = await get();
        const expected = { description: "Chuva", icon: "🌧️", temperatureMin: 20.3, temperatureMax: 20.4, windSpeed: 15.1, usedDefaultLocation: false };
        assert.deepEqual(list.items.find(item => item.matchId === "generated").weatherSummary, expected);
        assert.equal(list.items.find(item => item.matchId === "open").weatherSummary, null);
        assert.equal(list.items.find(item => item.separationId === "legacy").weatherSummary, null);
        assert.deepEqual((await get("?separation=linked")).items[0].weatherSummary, expected);
        assert.equal(JSON.stringify(list).includes("Endereço privado"), false);
        assert.equal(JSON.stringify(list).includes("weatherSnapshot"), false);
        const stored = await db().prepare("SELECT weather_snapshot,weather_updated_at FROM scheduled_matches WHERE id='generated'").first();
        assert.equal(stored.weather_snapshot, saved);
        assert.equal(stored.weather_updated_at, "2020-01-01T00:00:00Z");
        assert.equal(requests, 0);
        for (const invalid of ["{", JSON.stringify({ status: "UNAVAILABLE", message: "Erro do provedor" })]) {
          await db().prepare("UPDATE scheduled_matches SET weather_snapshot=? WHERE id='generated'").bind(invalid).run();
          assert.equal((await get("?match=generated")).items[0].weatherSummary, null);
        }
      } finally {
        globalThis.fetch = originalFetch;
        await db().prepare("UPDATE scheduled_matches SET weather_snapshot=?,weather_updated_at=? WHERE id='generated'").bind(saved, "2020-01-01T00:00:00Z").run();
      }
    });
    await t.test("consultas anônimas não expõem agenda, separações nem rascunhos", async () => {
      for (const query of ["", "?match=open", "?match=generated", "?separation=legacy", "?filter=history", "?filter=cancelled", "?match=inexistente"]) {
        const response = await hub.GET(request(`/api/match-hub${query}`));
        assert.equal(response.status, 401);
        assert.match(response.headers.get("cache-control"), /private, no-store/);
        assert.match(response.headers.get("vary"), /Cookie, Authorization/);
        assert.deepEqual(Object.keys(await response.json()), ["error"]);
      }
      for (const path of ["/api/separations", "/api/separations?id=legacy", "/api/separations?id=inexistente"]) {
        const response = await separations.GET(request(path));
        assert.equal(response.status, 401);
        assert.deepEqual(Object.keys(await response.json()), ["error"]);
      }
      assert.equal((await matches.GET(request("/api/matches?id=open"))).status, 401);
      assert.equal((await adminMatches.GET(request("/api/admin/matches?id=open", member))).status, 403);
      assert.deepEqual((await get("", adminCookie)).viewer.permissions, ["*"]);
    });
    await t.test("filtros explícitos e seleção por identificador preservam registros antigos", async () => {
      assert.deepEqual((await get("?filter=cancelled")).items.map(item => item.matchId), ["cancelled"]);
      assert.deepEqual((await get("?filter=open")).items.map(item => item.matchId), ["open"]);
      assert.equal((await get("?filter=history")).items.length, 4);
      assert.deepEqual((await get("?filter=finished")).items, []);
      assert.equal((await get("?match=cancelled")).items[0].status, "CANCELLED");
      assert.equal((await get("?separation=linked")).items[0].matchId, "generated");
      assert.deepEqual((await get("?separation=deleted")).items, []);
      assert.equal(matchHubHref({ matchId: "generated", separationId: "linked" }, "voting"), "/partidas?match=generated&tab=voting");
      assert.equal(matchHubHref({ matchId: null, separationId: "legacy" }), "/partidas?separation=legacy");
    });
    await t.test("resultado confirmado e contadores compactos respeitam elegibilidade", async () => {
      await db().prepare(`INSERT INTO career_matches (id,separation_id,blue_score,yellow_score,winner_team,voting_token,status,closes_at,created_by_administrator_id,config_snapshot,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).bind("career", "linked", 3, 1, "BLUE", "voting-token", "OPEN", future, admin.id, "{}", now, now).run();
      const result = await get("?filter=finished");
      assert.equal(result.items[0].blueScore, 3); assert.equal(result.items[0].status, "FINISHED");
      assert.equal(result.items[0].votingStatus, "OPEN");
      const badge = await (await badges.GET(request("/api/match-hub/badges", member))).json();
      assert.deepEqual(badge, { attendance: 1, votes: 1, nextVoteSeparationId: "linked" });
      assert.equal((await badges.GET(request("/api/match-hub/badges"))).status, 401);
      await db().prepare(`INSERT INTO match_attendance (id,match_id,player_id,status,change_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?)`).bind("answer", "open", player.id, "ABSENT", 0, now, now).run();
      await db().prepare("UPDATE career_matches SET status='CLOSED' WHERE id='career'").run();
      const completed = await (await badges.GET(request("/api/match-hub/badges", member))).json();
      assert.equal(completed.attendance, 0); assert.equal(completed.votes, 0);
    });
    await t.test("todos os perfis consultam por cookie e bearer, sem ganhar permissão de edição", async () => {
      const { createMobileSession } = await import("../lib/mobile-auth.ts");
      const vote = await import("../app/api/career/vote/route.ts");
      await db().prepare("INSERT INTO member_accounts (id,email,password_hash,active,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)").bind("hub-moderator", "moderator@example.com", "hash", 1, "moderator", now, now).run();
      await db().prepare("INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)").bind("hub-mod-session", "hub-moderator", future, now).run();
      const readers = [
        [hub.GET, "/api/match-hub?separation=linked"],
        [separations.GET, "/api/separations?id=linked"],
        [mobileSeparations.GET, "/api/mobile/separations?id=linked"],
        [vote.GET, "/api/career/vote?token=voting-token"],
        [matches.GET, "/api/matches?id=generated"],
      ];
      const identities = [
        { id: admin.id, accountType: "administrator", cookie: adminCookie },
        { id: "hub-member", accountType: "member", cookie: member },
        { id: "hub-moderator", accountType: "member", cookie: "ppm_member_session=hub-mod-session" },
      ];
      for (const identity of identities) {
        const session = await createMobileSession(identity);
        for (const headers of [{ cookie: identity.cookie }, { authorization: `Bearer ${session.accessToken}` }]) {
          for (const [read, path] of readers) {
            const response = await read(new Request(`https://pelada.example${path}`, { headers }));
            assert.equal(response.status, 200, `${identity.id} ${path}`);
            assert.match(response.headers.get("cache-control"), /no-store/);
          }
        }
      }
      assert.deepEqual((await get("", "ppm_member_session=hub-mod-session")).viewer.permissions, []);
      for (const cookie of [member, "ppm_member_session=hub-mod-session"]) {
        const denied = await separations.PATCH(new Request("https://pelada.example/api/separations", { method: "PATCH", headers: { cookie, "content-type": "application/json" }, body: JSON.stringify({ id: "linked", action: "teams" }) }));
        assert.equal(denied.status, 401);
      }
      const modVote = await (await vote.GET(request("/api/career/vote?token=voting-token", "ppm_member_session=hub-mod-session"))).json();
      assert.equal(modVote.viewer.authenticated, true);
      assert.equal(modVote.viewer.hasPlayerAssociation, false);
      assert.equal(modVote.viewer.canVote, false);
    });

    await t.test("sessões inválidas, expiradas e contas desativadas não expõem dados", async () => {
      const vote = await import("../app/api/career/vote/route.ts");
      const expired = new Date(Date.now() - 60000).toISOString();
      await db().prepare("INSERT INTO member_sessions (id,member_account_id,expires_at,created_at) VALUES (?,?,?,?)").bind("hub-expired", "hub-member", expired, now).run();
      await db().prepare("INSERT INTO sessions (id,administrator_id,expires_at,created_at) VALUES (?,?,?,?)").bind("hub-expired-admin", admin.id, expired, now).run();
      const readers = [[hub.GET, "/api/match-hub"], [separations.GET, "/api/separations?id=linked"], [mobileSeparations.GET, "/api/mobile/separations?id=linked"], [vote.GET, "/api/career/vote?token=voting-token"], [badges.GET, "/api/match-hub/badges"]];
      for (const headers of [{}, { cookie: "ppm_member_session=invalid; ppm_session=invalid" }, { cookie: "ppm_member_session=hub-expired; ppm_session=hub-expired-admin" }, { authorization: "Bearer invalid" }, { "x-user-role": "admin" }]) {
        for (const [read, path] of readers) {
          const response = await read(new Request(`https://pelada.example${path}`, { headers }));
          assert.equal(response.status, 401, path);
          assert.deepEqual(Object.keys(await response.json()), ["error"]);
        }
      }
      await db().prepare("UPDATE member_accounts SET active=0 WHERE id='hub-moderator'").run();
      for (const [read, path] of readers) {
        const response = await read(request(path, "ppm_member_session=hub-mod-session"));
        assert.equal(response.status, 401);
      }
      await db().prepare("UPDATE member_accounts SET active=1 WHERE id='hub-moderator'").run();
    });

    await t.test("estatísticas públicas mantêm agregados sem vazar detalhes de partidas", async () => {
      const general = await import("../app/api/public-statistics/route.ts");
      const advanced = await import("../app/api/public-statistics/advanced/route.ts");
      const path = `/api/public-statistics?from=2026-07-01&to=2026-07-31&playerA=${player.id}&playerB=other`;
      const publicData = await (await general.GET(request(path))).json();
      const privateData = await (await general.GET(request(path, member))).json();
      assert.deepEqual(publicData.coverage, privateData.coverage);
      assert.deepEqual(publicData.leaderboard, privateData.leaderboard);
      assert.equal(publicData.versus.totalMatches, 1);
      assert.equal(publicData.versus.matchDetailsRestricted, true);
      assert.deepEqual(publicData.versus.matches, []);
      assert.equal(privateData.versus.matches[0].separationId, "linked");
      const advancedPath = "/api/public-statistics/advanced?from=2026-07-01&to=2026-07-31";
      const publicAdvanced = await (await advanced.GET(request(advancedPath))).json();
      const privateAdvanced = await (await advanced.GET(request(advancedPath, member))).json();
      assert.deepEqual(publicAdvanced.players, privateAdvanced.players);
      assert.equal(publicAdvanced.records.matchDetailsRestricted, true);
      for (const field of ["mostGoals", "mostAssists", "biggestBlowout", "highestScoring"]) assert.equal(publicAdvanced.records[field], null);
      assert.equal(privateAdvanced.records.biggestBlowout.separationId, "linked");
      assert.equal(JSON.stringify(publicAdvanced).includes('"separationId"'), false);
      assert.equal(JSON.stringify(publicAdvanced).includes('"votes"'), false);
      assert.equal(JSON.stringify(publicData).includes('"blueIds"'), false);
    });

    await t.test("detalhes de presenças carregam apenas a partida solicitada", async () => {
      const response = await matches.GET(request("/api/matches?id=generated", member));
      assert.deepEqual((await response.json()).matches.map(item => item.id), ["generated"]);
      const managed = await adminMatches.GET(request("/api/admin/matches?id=closed", adminCookie));
      assert.deepEqual((await managed.json()).matches.map(item => item.id), ["closed"]);
    });
    await t.test("consulta leve mantém configurações dos cards sem carregar cadastro de jogadores", async () => {
      const publicPlayers = await import("../app/api/public-players/route.ts");
      const payload = await (await publicPlayers.GET(request("/api/public-players?configOnly=1"))).json();
      assert.deepEqual(payload.players, []);
      assert.equal(typeof payload.config.cardTiersEnabled, "boolean");
      assert.equal(typeof payload.config.showContributions, "boolean");
      const careerAdmin = await import("../app/api/career/admin/route.ts");
      assert.equal((await careerAdmin.GET(request("/api/career/admin?configOnly=1", member))).status, 401);
      const config = await (await careerAdmin.GET(request("/api/career/admin?configOnly=1", adminCookie))).json();
      assert.ok(config.config); assert.equal("matches" in config, false);
    });
    await t.test("paginação completa e links diretos ultrapassam o limite legado de 50", async () => {
      await db().prepare("UPDATE team_separations SET confirmed_at='2020-01-01T00:00:00Z' WHERE id='legacy'").run();
      for (let index = 0; index < 55; index++) await addSeparation(`history-${String(index).padStart(2, "0")}`);
      const seen = new Set();
      for (let page = 1; page <= 10; page++) {
        const result = await get(`?page=${page}`);
        assert.ok(result.items.length <= 12);
        for (const item of result.items) { assert.equal(seen.has(item.id), false); seen.add(item.id); }
        if (!result.hasMore) break;
      }
      assert.equal(seen.size, 58); assert.ok(seen.has("separation:legacy"));
      const oldList = await (await separations.GET(request("/api/separations", member))).json();
      assert.equal(oldList.separations.length, 50);
      assert.equal(oldList.separations.some(item => item.id === "legacy"), false);
      const direct = await (await separations.GET(request("/api/separations?id=legacy", member))).json();
      assert.deepEqual(direct.separations.map(item => item.id), ["legacy"]);
      const mobile = await (await mobileSeparations.GET(request("/api/mobile/separations?id=legacy", member))).json();
      assert.deepEqual(mobile.separations.map(item => item.id), ["legacy"]);
      assert.equal((await get("?page=-2")).page, 1);
      assert.deepEqual((await get("?separation=' OR 1=1 --")).items, []);
    });
  } finally {
    bindings.DB.close(); setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

test("site e app compartilham filtros; rotas antigas chegam às mesmas abas", async () => {
  const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");
  assert.equal((await read("lib/match-hub.ts")).trim(), (await read("mobile/src/match-hub.ts")).trim());
  const web = await read("app/partidas/MatchHubApp.tsx"), mobile = await read("mobile/src/match-hub-detail.tsx");
  for (const label of ["Presenças", "Times", "Súmula e resultado", "Votação"]) { assert.ok(web.includes(label)); assert.ok(mobile.includes(label)); }
  assert.match(await read("app/separacoes-salvas/page.tsx"), /<MatchHubApp\/>/);
  assert.match(await read("app/HomeApp.tsx"), /params\.get\("matchId"\)/);
  assert.match(await read("mobile/app/(app)/separations/[id].tsx"), /separationId=\{id\}/);
  assert.match(await read("mobile/app/(app)/matches/[id].tsx"), /matchId=\{id\}/);
  assert.doesNotMatch(await read("mobile/app/(app)/_layout.tsx"), /api\/mobile\/separations|api\/admin\/matches/);
  assert.match(await read("mobile/src/query-provider.tsx"), /"match-hub"/);
  const football = await read("app/FootballApp.tsx");
  assert.match(football, /section === "result"[^\n]+RoundRecapCard[^\n]+CareerMatchCard/, "a aba Súmula e resultado deve exibir o jornal antes da súmula");
  assert.match(web, /accessRequired \? <SignIn returnTo=\{returnTo\}/);
  assert.match(web, /<a className="primary" href=\{accountSignInHref\(returnTo\)\}>Entrar na minha conta<\/a>/);
  const globalCss = await read("app/globals.css");
  assert.match(globalCss, /\.member-access-card>a\.primary\{color:#fff\}/);
  assert.ok(globalCss.indexOf(".member-access-card>a.primary") > globalCss.indexOf(".member-access-card>a{"));
  assert.doesNotMatch(web, /continuam acessíveis sem login|Você está consultando os times publicados/);
  assert.match(await read("app/votacao/VotingApp.tsx"), /if \(accessRequired\) return <Container/);
  assert.match(web, /ppm:match-access-required/);
});
