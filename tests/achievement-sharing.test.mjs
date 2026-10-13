import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("site gera e compartilha um cartão 4:5 para cada conquista", async () => {
  const [card, profile, css] = await Promise.all([
    read("app/components/AchievementShareCard.tsx"),
    read("app/conta/MemberApp.tsx"),
    read("app/globals.css"),
  ]);
  assert.match(profile, /<AchievementShareCard achievement=\{item\} player=\{player\}/);
  assert.match(card, /renderRecapPng\(captureRef\.current/);
  assert.match(card, /shareRecapFile\(image, title, message\)/);
  assert.match(card, /achievement\.matchTitle/);
  assert.match(css, /\.achievement-share-card\{[^}]*width:540px;height:675px/);
});

test("aplicativo mostra a prévia, captura o cartão e copia a legenda", async () => {
  const mobile = await read("mobile/app/(app)/card.tsx");
  assert.match(mobile, /AchievementShareModal/);
  assert.match(mobile, /captureRef\(cardRef/);
  assert.match(mobile, /Clipboard\.setStringAsync\(message\)/);
  assert.match(mobile, /Sharing\.shareAsync\(uri,\{[\s\S]+mimeType:"image\/png"/);
  assert.match(mobile, /releaseCapture\(uri\)/);
});
