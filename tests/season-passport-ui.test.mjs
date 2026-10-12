import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("site e aplicativo oferecem passaporte completo com navegação mensal", async () => {
  const [site, mobile, profile, route] = await Promise.all([
    readFile(new URL("../app/conta/passaporte/SeasonPassportApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/app/(app)/passport.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/conta/MemberApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/member-profile/passport/route.ts", import.meta.url), "utf8"),
  ]);
  assert.match(site, /\/api\/member-profile\/passport/);
  assert.match(site, /data\.months\.map/);
  assert.match(mobile, /queryKey: \["season-passport", season, month\]/);
  assert.match(mobile, /data\.months\.map/);
  assert.match(profile, /passport\.recentStamps\.map/);
  assert.match(route, /loadPlayerSeasonPassport/);
});

test("prévia limita carimbos e a tela completa recebe somente o mês selecionado", async () => {
  const source = await readFile(new URL("../lib/player-engagement-store.ts", import.meta.url), "utf8");
  const passport = await readFile(new URL("../lib/season-passport.ts", import.meta.url), "utf8");
  assert.match(passport, /stamps\.slice\(-8\)\.reverse\(\)/);
  assert.match(source, /full\.stamps\.filter\(stamp => stamp\.month === selectedMonth\)/);
});
