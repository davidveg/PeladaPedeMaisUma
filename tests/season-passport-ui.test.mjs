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

test("carimbos distinguem vitória, derrota, empate e ausência no site e no aplicativo", async () => {
  const [site, css, darkTheme, mobilePalette, mobilePreview, mobilePassport] = await Promise.all([
    readFile(new URL("../app/conta/passaporte/SeasonPassportApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/passport-style.ts", import.meta.url), "utf8"),
    readFile(new URL("../mobile/app/(app)/card.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/app/(app)/passport.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.passport-stamp\.win\{--passport-result:#1f7a4c/);
  assert.match(css, /\.passport-stamp\.loss\{--passport-result:#b64036/);
  assert.match(css, /\.passport-stamp\.draw\{--passport-result:#5f6d66/);
  assert.match(css, /\.passport-stamp-detail\.result-win\{--passport-result:#1f7a4c/);
  assert.match(site, /passport-result-name/);
  assert.match(site, /passport-team-name/);
  assert.match(css, /\.passport-team-name\.blue\{--passport-team:var\(--blue\)/);
  assert.match(css, /\.passport-team-name\.yellow\{--passport-team:var\(--yellow\)/);
  assert.match(darkTheme, /--passport-result: #69d99a/);
  assert.match(darkTheme, /--passport-result: #ff8b80/);
  assert.match(darkTheme, /\.passport-stamp\.team-blue[\s\S]*border-top-color: var\(--blue\)/);
  assert.match(darkTheme, /\.passport-stamp\.team-yellow[\s\S]*border-top-color: var\(--yellow\)/);
  assert.match(mobilePalette, /WIN:[\s\S]*textColor: "#176A40"/);
  assert.match(mobilePalette, /LOSS:[\s\S]*textColor: "#A83229"/);
  assert.match(mobilePalette, /DRAW:[\s\S]*textColor: "#52615A"/);
  assert.match(mobilePassport, /config\.teamBlueColor/);
  assert.match(mobilePassport, /contrastTextColor\(teamColor\)/);
  assert.match(mobilePreview, /passportResultPalette\[stamp\.result\]/);
  assert.match(mobilePassport, /passportResultPalette\[stamp\.result\]/);
});
