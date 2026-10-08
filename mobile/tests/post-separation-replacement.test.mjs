import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { replacementPlayerOptions } from "../src/post-separation-replacement.ts";

test("monta opções de substituição mantendo os times e excluindo a escalação dos candidatos", () => {
  const blue = player("blue", "Beto"), yellow = player("yellow", "Yuri"), available = player("available", "André");
  const options = replacementPlayerOptions({ lineup: { blue: [blue], yellow: [yellow] } }, [yellow, available, blue], "Roxo", "Verde");
  assert.deepEqual(options.outgoing.map(option => option.label), ["Time Roxo · Beto · Ataque", "Time Verde · Yuri · Ataque"]);
  assert.deepEqual(options.incoming.map(option => option.value), ["available"]);
});

test("tela mobile oferece a troca somente ao administrador quando a API autoriza", async () => {
  const source = await readFile(new URL("../src/match-attendance.tsx", import.meta.url), "utf8");
  assert.match(source, /account\?\.role === "admin" && item\.canReplaceAfterTeams/);
  assert.match(source, /Substituição de última hora/);
  assert.match(source, /action: "replace-player"/);
  assert.match(source, /Confirmar substituição\?/);
  assert.match(source, /queryKey: \["separations"\]/);
});

function player(id, displayName) {
  return { id, displayName, type: "monthly", primaryPosition: "Ataque" };
}
