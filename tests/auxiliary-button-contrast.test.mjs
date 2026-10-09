import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const theme = await readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8");
const globals = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

test("secondary buttons use their configured color and automatic contrast across the site", () => {
  assert.match(theme, /\.ghost \{[\s\S]*background:\s*var\(--secondary-button[\s\S]*color:\s*var\(--secondary-button-contrast/);
  assert.match(theme, /\.ghost:hover:not\(:disabled\),[\s\S]*\.ghost:focus-visible \{[\s\S]*var\(--secondary-button/);
  assert.match(theme, /\.admin-shell \.primary \{[\s\S]*var\(--management-button/);
  assert.match(theme, /\.app-shell \.result-actions \.ghost \{[\s\S]*var\(--control-surface/);
});

test("non-action auxiliary controls keep the contrast of their own surface", () => {
  assert.match(theme, /\.finance-page \.finance-tabs button\.active \{[\s\S]*color:\s*var\(--control-contrast/);
  assert.match(theme, /\.member-page :is\(\.match-hub-pagination, \.notification-pagination\) \.ghost,[\s\S]*color:\s*var\(--control-contrast/);
  assert.match(theme, /\.modal-back button\.close,[\s\S]*color:\s*var\(--control-contrast/);
  assert.match(globals, /\.player-table \.player-tr\.th \.sort-header\{[^}]*color:var\(--control-contrast/);
});
