import assert from "node:assert/strict";
import test from "node:test";
import { colorWithOpacity, contrastTextColor, readableTeamColor, teamColorMarker } from "../lib/team-colors.ts";

test("gera tons auxiliares a partir da cor configurada da equipe", () => {
  assert.equal(colorWithOpacity("#FF2020", 0.1), "rgba(255,32,32,0.1)");
  assert.equal(readableTeamColor("#FF2020"), "#9e1414");
});

test("escolhe contraste legível para botões com a cor da equipe", () => {
  assert.equal(contrastTextColor("#FF2020"), "#FFFFFF");
  assert.equal(contrastTextColor("#F4BF20"), "#17221D");
});

test("usa no texto compartilhado o marcador mais próximo da cor configurada", () => {
  assert.equal(teamColorMarker("#FF2020"), "🔴");
  assert.equal(teamColorMarker("#1768E5"), "🔵");
});
