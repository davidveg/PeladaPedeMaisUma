import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("participação efetiva usa o seletor compartilhado com foto e posição", async () => {
  const [football, styles] = await Promise.all([
    readFile(new URL("../app/FootballApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  const participation = football.slice(football.indexOf("function ParticipationEditor"), football.indexOf("function participationChangeSummary"));

  assert.match(participation, /<PlayerPhotoSelect/);
  assert.match(participation, /players=\{options\}/);
  assert.match(participation, /description:`\$\{player\.primaryPosition/);
  assert.doesNotMatch(participation, /<select/);
  assert.match(styles, /\.participation-team:has\(\.participant-add \.player-photo-select\.open\)/);
});
