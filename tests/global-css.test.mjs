import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("a folha global preserva os tokens e o layout estrutural do site", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(css, /:root\{[^}]*--cream:#f5f7f3[^}]*--green:#174d3b/);
  assert.match(css, /header\{height:76px;[^}]*display:flex;[^}]*position:sticky/);
  assert.match(css, /\.content\{max-width:1140px;/);
  assert.match(css, /\.history-list article\{[^}]*border-radius:14px;/);
});
