import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("tooltips derivam contraste automaticamente da superfície configurada", async () => {
  const [branding, theme] = await Promise.all([
    readFile(new URL("../app/InstanceBranding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(branding, /--control-contrast.*contrastTextColor\(config\.controlSurfaceColor\)/);
  assert.match(theme, /\.help-tip\.help-tip > \[role="tooltip"\],[\s\S]*\.advanced-info\.advanced-info > \[role="tooltip"\] \{[\s\S]*background:\s*var\(--control-surface[\s\S]*color:\s*var\(--control-contrast/);
  assert.match(theme, /\.help-tip\.help-tip > \[role="tooltip"\]::before \{[\s\S]*background:\s*var\(--control-surface/);
  assert.match(theme, /\.career-switch\.career-switch::before \{[\s\S]*color:\s*var\(--control-contrast/);
});
