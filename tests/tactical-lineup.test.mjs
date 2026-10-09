import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { buildTacticalLineup } from "../lib/tactical-lineup.ts";
import { buildTacticalLineup as buildMobileTacticalLineup } from "../mobile/src/tactical-lineup.ts";

const player = (id, primaryPosition, rating, secondaryPosition = null, type = "monthly") => ({ id, displayName: id, primaryPosition, secondaryPosition, type, rating });
const ratingOf = value => value.rating;
const base = [player("gk", "Goleiro", 4, null, "goalkeeper"), player("d1", "Defesa", 4), player("d2", "Defesa", 3.9)];

test("escolhe 2-3-1 quando o terceiro meia supera o segundo atacante", () => {
  const lineup = buildTacticalLineup([...base, player("m1", "Meio-campo", 5), player("m2", "Meio-campo", 4.8), player("m3", "Meio-campo", 4.6), player("a1", "Ataque", 3), player("a2", "Ataque", 2)], ratingOf);
  assert.equal(lineup.formation, "2-3-1");
  assert.deepEqual(lineup.midfielders.map(entry => entry.player.id), ["m1", "m2", "m3"]);
  assert.deepEqual(lineup.reserves.map(entry => entry.id), ["a2"]);
});

test("escolhe 2-2-2 quando o segundo atacante supera o terceiro meia", () => {
  const lineup = buildTacticalLineup([...base, player("m1", "Meio-campo", 4.5), player("m2", "Meio-campo", 4.4), player("m3", "Meio-campo", 2), player("a1", "Ataque", 5), player("a2", "Ataque", 4.9)], ratingOf);
  assert.equal(lineup.formation, "2-2-2");
  assert.deepEqual(lineup.attackers.map(entry => entry.player.id), ["a1", "a2"]);
});

test("usa posição secundária para completar a melhor escalação sem duplicar jogadores", () => {
  const lineup = buildTacticalLineup([...base, player("flex", "Meio-campo", 5, "Ataque"), player("m2", "Meio-campo", 4), player("m3", "Meio-campo", 3.8), player("m4", "Meio-campo", 3.7)], ratingOf);
  assert.equal(lineup.filledSlots, 7);
  assert.equal(lineup.attackers[0].player.id, "flex");
  assert.equal(lineup.attackers[0].usedSecondaryPosition, true);
  assert.equal(new Set([lineup.goalkeeper, ...lineup.defenders, ...lineup.midfielders, ...lineup.attackers].filter(Boolean).map(entry => entry.player.id)).size, 7);
});

test("mantém o goleiro de maior nota como titular", () => {
  const lineup = buildTacticalLineup([...base, player("gk-top", "Goleiro", 4.8, null, "goalkeeper")], ratingOf);
  assert.equal(lineup.goalkeeper?.player.id, "gk-top");
  assert.ok(lineup.reserves.some(entry => entry.id === "gk"));
});

test("usa formações configuráveis e infere o tamanho do time pelas posições", () => {
  const options = [
    { defenders: 2, midfielders: 3, attackers: 1 },
    { defenders: 3, midfielders: 3, attackers: 2 },
  ];
  const players = [...base,
    player("d3", "Defesa", 4.1), player("m1", "Meio-campo", 4.8), player("m2", "Meio-campo", 4.7),
    player("m3", "Meio-campo", 4.6), player("a1", "Ataque", 4.5), player("a2", "Ataque", 4.4),
  ];
  const lineup = buildTacticalLineup(players, ratingOf, options);
  assert.equal(lineup.formation, "3-3-2");
  assert.equal(lineup.totalSlots, 9);
  assert.deepEqual(lineup.slots, { defenders: 3, midfielders: 3, attackers: 2, goalkeepers: 1 });
});

test("prioriza a formação configurada mais próxima da quantidade atual", () => {
  const players = [...base, player("m1", "Meio-campo", 5), player("m2", "Meio-campo", 4.8), player("m3", "Meio-campo", 4.6), player("a1", "Ataque", 4.4)];
  const lineup = buildTacticalLineup(players, ratingOf, [{ defenders: 2, midfielders: 3, attackers: 1 }, { defenders: 4, midfielders: 4, attackers: 2 }]);
  assert.equal(lineup.formation, "2-3-1");
  assert.equal(lineup.totalSlots, 7);
});

test("site e aplicativo calculam a mesma formação", () => {
  const players = [...base, player("m1", "Meio-campo", 4.7), player("m2", "Meio-campo", 4.5), player("flex", "Meio-campo", 4.2, "Ataque"), player("a1", "Ataque", 4.6), player("a2", "Ataque", 3.8)];
  const summarize = lineup => ({ formation: lineup.formation, defenders: lineup.defenders.map(entry => entry.player.id), midfielders: lineup.midfielders.map(entry => entry.player.id), attackers: lineup.attackers.map(entry => entry.player.id), goalkeeper: lineup.goalkeeper?.player.id, reserves: lineup.reserves.map(entry => entry.id) });
  assert.deepEqual(summarize(buildMobileTacticalLineup(players, ratingOf)), summarize(buildTacticalLineup(players, ratingOf)));
});

test("site e aplicativo respeitam as mesmas opções personalizadas", () => {
  const players = [...base, player("d3", "Defesa", 4.6), player("m1", "Meio-campo", 4.7), player("m2", "Meio-campo", 4.5), player("m3", "Meio-campo", 4.2), player("a1", "Ataque", 4.6), player("a2", "Ataque", 3.8)];
  const options = [{ defenders: 3, midfielders: 3, attackers: 2 }];
  const summarize = lineup => ({ formation: lineup.formation, totalSlots: lineup.totalSlots, slots: lineup.slots, reserves: lineup.reserves.map(entry => entry.id) });
  assert.deepEqual(summarize(buildMobileTacticalLineup(players, ratingOf, options)), summarize(buildTacticalLineup(players, ratingOf, options)));
});

test("gramados usam faixas horizontais e containers ligados às cores da identidade", async () => {
  const [css, mobile] = await Promise.all([
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/separation-detail.tsx", import.meta.url), "utf8"),
  ]);
  assert.match(css, /\.tactical-field\{background:linear-gradient\(180deg/);
  assert.match(css, /\.tactical-team\{[^}]*var\(--control-surface/);
  assert.match(css, /\.tactical-team>header>b\{[^}]*var\(--team-contrast/);
  assert.match(mobile, /tacticalStripes:\{[^}]*flexDirection:"column"/);
  assert.match(mobile, /backgroundColor:palette\.cream/);
  assert.match(mobile, /contrastTextColor\(color\)/);
});

test("opções exibem posição principal e secundária no site e no aplicativo", async () => {
  const [site, mobile, css] = await Promise.all([
    readFile(new URL("../app/FootballApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../mobile/src/separation-detail.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
  ]);
  assert.match(site, /Principal: \$\{player\.primaryPosition/);
  assert.match(site, /Secundária: \$\{player\.secondaryPosition/);
  assert.match(site, /tactical-reserve-details/);
  assert.match(mobile, /Principal: \{player\.primaryPosition/);
  assert.match(mobile, /Secundária: \$\{player\.secondaryPosition/);
  assert.match(mobile, /tacticalReservePosition/);
  assert.match(css, /\.tactical-reserve-details>small/);
});
