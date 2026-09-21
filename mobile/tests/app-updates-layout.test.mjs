import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = await readFile(new URL("../src/app-updates.tsx", import.meta.url), "utf8");

test("modal de atualização mantém as ações visíveis e permite rolar textos extensos", () => {
  assert.match(source, /Pressable, ScrollView, StyleSheet/);
  assert.match(source, /<ScrollView[\s\S]+persistentScrollbar[\s\S]+release\.releaseNotes[\s\S]+<\/ScrollView>/);
  assert.match(source, /<\/ScrollView>\s*<View style=\{styles\.actions\}>[\s\S]+Atualizar agora/);
  assert.match(source, /maxHeight: "92%"/);
  assert.match(source, /actions: \{ flexShrink: 0/);
  assert.match(source, /useSafeAreaInsets\(\)/);
  assert.match(source, /paddingBottom:Math\.max\(16,insets\.bottom\+8\)/);
});
