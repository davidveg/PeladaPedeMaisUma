import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { registerHooks } from "node:module";
import { createSelfhostBindings } from "../server/selfhost-runtime.mjs";

registerHooks({ resolve(specifier, context, nextResolve) { try { return nextResolve(specifier, context); } catch (error) { if (specifier.startsWith(".") && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context); throw error; } } });

const [{ setRuntimeBindings }, { db, ensureDb, hashPassword }, mobileAuth, upload, memberProfile] = await Promise.all([
  import("../lib/runtime-bindings.ts"),
  import("../lib/database.ts"),
  import("../app/api/mobile/auth/route.ts"),
  import("../app/api/upload/route.ts"),
  import("../app/api/member-profile/route.ts"),
]);

test("jogador autenticado no mobile envia e associa sua foto", async () => {
  const directory = await mkdtemp(join(tmpdir(), "ppm-mobile-photo-"));
  const bindings = await createSelfhostBindings(directory);
  setRuntimeBindings({ ...bindings, APP_BASE_URL: "https://pelada.example" });

  try {
    await ensureDb();
    const now = new Date().toISOString();
    const password = "senha-segura-123";
    const playerId = "player-mobile-photo";
    const memberId = "member-mobile-photo";
    await db().prepare(`INSERT INTO players (id,full_name,display_name,type,primary_position,speed,skill,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)`).bind(playerId, "Jogador da Foto", "Jogador", "monthly", "Defesa", 4, 4, now, now).run();
    await db().prepare(`INSERT INTO member_accounts (id,email,password_hash,active,created_at,updated_at) VALUES (?,?,?,?,?,?)`).bind(memberId, "foto-mobile@example.com", await hashPassword(password), 1, now, now).run();
    await db().prepare(`INSERT INTO player_account_links (player_id,account_type,account_id,created_at) VALUES (?,?,?,?)`).bind(playerId, "member", memberId, now).run();

    const login = await mobileAuth.POST(jsonRequest("https://pelada.example/api/mobile/auth", "POST", { email: "foto-mobile@example.com", password, deviceName: "Teste de foto" }));
    assert.equal(login.status, 201);
    const session = await login.json();
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00]);
    const uploaded = await upload.POST(new Request("https://pelada.example/api/upload", {
      method: "POST",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "image/jpeg" },
      body: jpeg,
    }));
    assert.equal(uploaded.status, 200);
    const { url } = await uploaded.json();
    assert.match(url, /^\/api\/upload\?key=players%2F.+\.jpg$/);
    const firstKey = new URL(`https://pelada.example${url}`).searchParams.get("key");
    assert.deepEqual(
      { ...(await db().prepare(`SELECT owner_account_type,owner_account_id,status,size_bytes FROM upload_objects WHERE object_key=?`).bind(firstKey).first()) },
      { owner_account_type: "member", owner_account_id: memberId, status: "pending", size_bytes: jpeg.byteLength },
    );

    const updated = await memberProfile.PUT(new Request("https://pelada.example/api/member-profile", {
      method: "PUT",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ fullName: "Jogador da Foto", nickname: "", primaryPosition: "Defesa", notes: "", photoUrl: url }),
    }));
    assert.equal(updated.status, 200);
    assert.equal(await db().prepare(`SELECT status FROM upload_objects WHERE object_key=?`).bind(firstKey).first("status"), "attached");

    const profile = await memberProfile.GET(authorized("https://pelada.example/api/member-profile", session.accessToken));
    assert.equal(profile.status, 200);
    assert.equal((await profile.json()).player.photoUrl, url);

    const image = await upload.GET(new Request(`https://pelada.example${url}`));
    assert.equal(image.status, 200);
    assert.equal(image.headers.get("content-type"), "image/jpeg");
    assert.deepEqual([...new Uint8Array(await image.arrayBuffer())], [...jpeg]);

    const replacement = await upload.POST(uploadRequest(session.accessToken, jpeg));
    const replacementUrl = (await replacement.json()).url;
    const replaced = await memberProfile.PUT(new Request("https://pelada.example/api/member-profile", {
      method: "PUT",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "application/json" },
      body: JSON.stringify({ fullName: "Jogador da Foto", nickname: "", primaryPosition: "Defesa", notes: "", photoUrl: replacementUrl }),
    }));
    assert.equal(replaced.status, 200);
    assert.equal((await upload.GET(new Request(`https://pelada.example${url}`))).status, 404, "a foto substituída deve sair do storage");
    assert.equal(await db().prepare(`SELECT status FROM upload_objects WHERE object_key=?`).bind(firstKey).first("status"), "deleted");

    let pulls = 0;
    const oversized = new ReadableStream({
      pull(controller) {
        pulls += 1;
        if (pulls === 1) controller.enqueue(new Uint8Array(4_000_000));
        else if (pulls === 2) controller.enqueue(new Uint8Array(1_000_001));
        else controller.enqueue(new Uint8Array(1_000_000));
      },
    });
    const rejected = await upload.POST(new Request("https://pelada.example/api/upload", {
      method: "POST",
      headers: { authorization: `Bearer ${session.accessToken}`, "content-type": "image/jpeg" },
      body: oversized,
      duplex: "half",
    }));
    assert.equal(rejected.status, 413);
    assert.ok(pulls <= 3, "a leitura deve ser cancelada assim que o limite for excedido");

    for (let pending = 0; pending < 5; pending += 1) assert.equal((await upload.POST(uploadRequest(session.accessToken, jpeg))).status, 200);
    const quota = await upload.POST(uploadRequest(session.accessToken, jpeg));
    assert.equal(quota.status, 429);
    assert.equal(quota.headers.get("retry-after"), "3600");
    assert.equal(await db().prepare(`SELECT COUNT(*) total FROM upload_objects WHERE owner_account_id=? AND status='pending'`).bind(memberId).first("total"), 5);
    const orphanKey = await db().prepare(`SELECT object_key FROM upload_objects WHERE owner_account_id=? AND status='pending' LIMIT 1`).bind(memberId).first("object_key");
    await db().prepare(`UPDATE upload_objects SET updated_at='2000-01-01T00:00:00.000Z' WHERE owner_account_id=? AND status='pending'`).bind(memberId).run();
    assert.equal((await upload.POST(uploadRequest(session.accessToken, jpeg))).status, 200, "a coleta deve liberar a quota de pendências expiradas");
    assert.equal((await upload.GET(new Request(`https://pelada.example${uploadUrl(orphanKey)}`))).status, 404);
    assert.equal(await db().prepare(`SELECT status FROM upload_objects WHERE object_key=?`).bind(orphanKey).first("status"), "deleted");
  } finally {
    bindings.DB.close();
    setRuntimeBindings(undefined);
    await rm(directory, { recursive: true, force: true });
  }
});

function jsonRequest(url, method, body) { return new Request(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) }); }
function authorized(url, token) { return new Request(url, { headers: { authorization: `Bearer ${token}` } }); }
function uploadRequest(token, body) { return new Request("https://pelada.example/api/upload", { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "image/jpeg" }, body }); }
function uploadUrl(key) { return `/api/upload?key=${encodeURIComponent(key)}`; }
