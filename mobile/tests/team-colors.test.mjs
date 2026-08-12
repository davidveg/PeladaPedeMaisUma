import assert from "node:assert/strict";
import test from "node:test";
import { contrastTextColor, teamColorMarker } from "../src/team-colors.ts";

test("aproxima as cores configuradas aos marcadores usados no compartilhamento", () => {
  assert.equal(teamColorMarker("#D62828"), "🔴");
  assert.equal(teamColorMarker("#1768E5"), "🔵");
  assert.equal(teamColorMarker("#F4BF20"), "🟡");
});

test("mantém contraste legível sobre cores claras e escuras", () => {
  assert.equal(contrastTextColor("#F4BF20"), "#17221D");
  assert.equal(contrastTextColor("#A80000"), "#FFFFFF");
});
