import assert from "node:assert/strict";
import test from "node:test";
import { validateMatchContributions } from "../lib/match-contributions.ts";

const base = {
  blueScore: 2,
  yellowScore: 1,
  blueIds: ["azul-1", "azul-2"],
  yellowIds: ["amarelo-1", "amarelo-2"],
};

test("aceita gols com ou sem assistência quando correspondem ao placar", () => {
  const result = validateMatchContributions({ ...base, contributions: [
    { team: "BLUE", scorerPlayerId: "azul-1", assistPlayerId: "azul-2" },
    { team: "BLUE", scorerPlayerId: "azul-2" },
    { team: "YELLOW", scorerPlayerId: "amarelo-1", assistPlayerId: "amarelo-2" },
  ] });
  assert.equal(result.error, null);
  assert.equal(result.contributions.length, 3);
});

test("exige um registro de gol para cada gol do placar", () => {
  const result = validateMatchContributions({ ...base, contributions: [
    { team: "BLUE", scorerPlayerId: "azul-1" },
  ] });
  assert.match(result.error, /placar/i);
});

test("impede assistência de outra equipe e autoassistência", () => {
  const otherTeam = validateMatchContributions({ ...base, contributions: [
    { team: "BLUE", scorerPlayerId: "azul-1", assistPlayerId: "amarelo-1" },
    { team: "BLUE", scorerPlayerId: "azul-2" },
    { team: "YELLOW", scorerPlayerId: "amarelo-1" },
  ] });
  assert.match(otherTeam.error, /mesmo time/i);

  const selfAssist = validateMatchContributions({ ...base, contributions: [
    { team: "BLUE", scorerPlayerId: "azul-1", assistPlayerId: "azul-1" },
    { team: "BLUE", scorerPlayerId: "azul-2" },
    { team: "YELLOW", scorerPlayerId: "amarelo-1" },
  ] });
  assert.match(selfAssist.error, /si mesmo/i);
});

test("aceita gol contra para o placar sem assistência", () => {
  const result = validateMatchContributions({ ...base, contributions: [
    { team: "BLUE", scorerPlayerId: "amarelo-1", ownGoal: true },
    { team: "BLUE", scorerPlayerId: "azul-2" },
    { team: "YELLOW", scorerPlayerId: "amarelo-2" },
  ] });
  assert.equal(result.error, null);
  assert.equal(result.contributions[0].ownGoal, true);

  const withAssist = validateMatchContributions({ ...base, contributions: [
    { team: "BLUE", scorerPlayerId: "amarelo-1", assistPlayerId: "azul-1", ownGoal: true },
    { team: "BLUE", scorerPlayerId: "azul-2" },
    { team: "YELLOW", scorerPlayerId: "amarelo-2" },
  ] });
  assert.match(withAssist.error, /não pode possuir assistência/i);
});
