/* Saved snapshots remain schema-flexible for historical compatibility. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { defaultConfig, recalculateTeamBalance, type Config, type Player } from "./football.ts";

export function rebuildEditedSeparation(snapshot: any, blueInput: unknown, yellowInput: unknown) {
  const currentBlue = Array.isArray(snapshot?.blue) ? snapshot.blue as Player[] : [];
  const currentYellow = Array.isArray(snapshot?.yellow) ? snapshot.yellow as Player[] : [];
  const players = [...currentBlue, ...currentYellow];
  const blueIds = stringIds(blueInput), yellowIds = stringIds(yellowInput);
  const submitted = [...blueIds, ...yellowIds], expected = new Set(players.map(player => String(player.id)));
  if (!blueIds.length || !yellowIds.length) throw new Error("Os dois times precisam ter pelo menos um jogador.");
  if (submitted.length !== expected.size || new Set(submitted).size !== submitted.length || submitted.some(id => !expected.has(id))) {
    throw new Error("A edição deve manter exatamente os jogadores da escalação, sem duplicações.");
  }
  const byId = new Map(players.map(player => [String(player.id), player]));
  const blue = blueIds.map(id => byId.get(id)!), yellow = yellowIds.map(id => byId.get(id)!);
  const config: Config = { ...defaultConfig, ...snapshot };
  const preserved = { ...snapshot };
  return { ...preserved, blue, yellow, ...recalculateTeamBalance(blue,yellow,config) };
}

function stringIds(value: unknown) {
  return Array.isArray(value) ? value.map(item => String(item || "")).filter(Boolean) : [];
}
