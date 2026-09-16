import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = path => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("site renderiza o jornal em PNG e preserva texto e link no compartilhamento", async () => {
  const [helper, football, pane] = await Promise.all([
    read("app/recap-image-client.ts"),
    read("app/FootballApp.tsx"),
    read("app/partidas/SeparationPane.tsx"),
  ]);
  assert.match(helper, /toBlob\(element/);
  assert.match(helper, /files: \[file\]/);
  assert.match(helper, /downloadRecapPng\(file\)/);
  assert.match(football, /renderRecapPng\(newspaperRef\.current/);
  assert.match(pane, /buildWhatsAppRoundRecapMessage[\s\S]+shareRecapFile/);
});

test("aplicativo captura a área editorial, copia legenda e link e compartilha a imagem", async () => {
  const [mobile, manifest] = await Promise.all([
    read("mobile/src/separation-detail.tsx"),
    read("mobile/package.json"),
  ]);
  assert.match(mobile, /captureRef\(newspaperRef/);
  assert.match(mobile, /Sharing\.isAvailableAsync\(\)/);
  assert.match(mobile, /Clipboard\.setStringAsync\(`\$\{recap\.shareText\}\\n\\n\$\{link\}`\)/);
  assert.match(mobile, /Sharing\.shareAsync\(uri,\{[\s\S]+mimeType:"image\/png"[\s\S]+UTI:"public\.png"/);
  assert.match(mobile, /releaseCapture\(uri\)/);
  assert.match(manifest, /expo-sharing/);
  assert.match(manifest, /expo-clipboard/);
  assert.doesNotMatch(manifest, /react-native-share/);
  assert.match(manifest, /react-native-view-shot/);
});
