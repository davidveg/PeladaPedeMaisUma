import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("../app/estatisticas/StatisticsApp.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../app/estatisticas/statistics.css", import.meta.url), "utf8");
const globalStyles = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

test("confronto direto reutiliza o seletor de jogadores com foto", () => {
  const playerSelect = source.slice(source.indexOf("function PlayerSelect"), source.indexOf("function PlayerSide"));

  assert.match(source, /import \{ PlayerPhotoSelect \} from "\.\.\/components\/PlayerPhotoSelect"/);
  assert.match(playerSelect, /<PlayerPhotoSelect/);
  assert.match(playerSelect, /photoUrl:player\.photoUrl/);
  assert.match(playerSelect, /player\.id!==blocked/);
  assert.doesNotMatch(playerSelect, /<select/);
});

test("seletor mantém layout próprio no desktop e painel responsivo no celular", () => {
  assert.match(styles, /\.versus-player-select\{[^}]*min-width:0/);
  assert.match(globalStyles, /@media\(max-width:760px\)[\s\S]*?\.vote-player-options\{position:fixed/);
});
