import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { DEFAULT_INSTANCE_CONFIGURATION } from "../lib/instance-config.ts";
import { COLOR_SCHEME_STORAGE_KEY, contrastRatio, mixHexColors, siteAppearance } from "../lib/color-scheme.ts";

test("modo escuro preserva exatamente a identidade configurada", () => {
  const appearance = siteAppearance(DEFAULT_INSTANCE_CONFIGURATION, "dark");
  assert.equal(appearance.background, DEFAULT_INSTANCE_CONFIGURATION.managementBackgroundColor);
  assert.equal(appearance.surface, DEFAULT_INSTANCE_CONFIGURATION.managementSurfaceColor);
  assert.equal(appearance.publicSidebar, DEFAULT_INSTANCE_CONFIGURATION.publicSidebarColor);
});

test("modo claro usa a paleta clássica e deriva os elementos sem versão clara", () => {
  const original = structuredClone(DEFAULT_INSTANCE_CONFIGURATION);
  const appearance = siteAppearance(original, "light");
  assert.equal(appearance.background, original.backgroundColor);
  assert.equal(appearance.surface, original.surfaceColor);
  assert.equal(appearance.text, original.textColor);
  assert.equal(appearance.muted, original.mutedColor);
  assert.equal(appearance.controlSurface, mixHexColors(original.controlSurfaceColor, original.surfaceColor, .92));
  assert.equal(appearance.adminSidebar, mixHexColors(original.adminSidebarColor, original.backgroundColor, .87));
  assert.match(appearance.background, /^#[0-9A-F]{6}$/);
  assert.notEqual(appearance.background, original.managementBackgroundColor);
  assert.ok(contrastRatio(appearance.accentText, appearance.surface) >= 4.5);
  assert.ok(contrastRatio(appearance.managementAccentText, appearance.surface) >= 4.5);
  assert.notEqual(appearance.managementAccentText, original.managementButtonColor);
  assert.deepEqual(original, DEFAULT_INSTANCE_CONFIGURATION);
});

test("seletor fica no cabeçalho, no painel de identidade e persiste antes da pintura", async () => {
  const [toggle, header, admin, layout] = await Promise.all([
    readFile(new URL("../app/components/ColorSchemeToggle.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(toggle, /Usar tema claro/);
  assert.match(toggle, /Usar tema escuro/);
  assert.match(toggle, /localStorage\.setItem\(COLOR_SCHEME_STORAGE_KEY/);
  assert.match(header, /<ColorSchemeToggle\/>/);
  assert.match(admin, /ThemePresentationPanel/);
  assert.match(admin, /O escuro continua como padrão/);
  assert.match(layout, new RegExp(COLOR_SCHEME_STORAGE_KEY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(layout, /data-color-scheme="dark"/);
});

test("componentes funcionais consomem a aparência efetiva do tema ativo", async () => {
  const [selector, loading, gate, theme] = await Promise.all([
    readFile(new URL("../app/components/PlayerPhotoSelect.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/BrandedLoading.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SiteAccessGate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);
  assert.doesNotMatch(selector, /controlSurfaceColor|style=\{theme\}/);
  assert.doesNotMatch(loading, /managementBackgroundColor|style=\{style\}/);
  assert.doesNotMatch(gate, /accessScreenStyle/);
  assert.match(theme, /public-player-tr:not\(\.tier-row\):hover[\s\S]*var\(--management-surface/);
  assert.match(theme, /player-tr:not\(\.tier-row\):hover[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.section-head h2,[\s\S]*\.member-account-head h1,[\s\S]*\.match-hub-heading h1,[\s\S]*color: var\(--management-text/);
  assert.match(theme, /\.overview-feature-copy > small,[\s\S]*color: var\(--accent-text/);
  assert.match(theme, /\.admin-shell :is\(\.stat b,[\s\S]*color: var\(--management-accent-text/);
});
