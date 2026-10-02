import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const [admin, styles] = await Promise.all([
  readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
  readFile(new URL("../app/globals.css", import.meta.url), "utf8"),
]);

test("votações do Modo Carreira são paginadas em grupos de dez", () => {
  assert.match(admin, /pageSize=10/);
  assert.match(admin, /matches\.slice\(start,end\)/);
  assert.match(admin, /Paginação das votações/);
  assert.match(admin, /Página \{page\} de \{totalPages\}/);
  assert.match(styles, /\.career-pagination/);
});

test("registros de votos mantêm rankings e reconhecimentos em grupos alinhados", () => {
  assert.match(admin, /function CareerVoteRow/);
  assert.match(admin, /className="career-vote-ranking"/);
  assert.match(admin, /className="career-vote-recognitions"/);
  assert.match(admin, /\['Parceiro',vote\.partner\?\.name\],\['Fair Play',vote\.fairPlay\?\.name\],\['Defesa',vote\.defense\?\.name\]/);
  assert.match(styles, /\.career-vote-row\{grid-template-columns:minmax\(125px,\.65fr\)[^}]*minmax\(175px,\.9fr\)[^}]*minmax\(88px,auto\)/);
  assert.match(styles, /@media\(max-width:760px\)\{\.career-vote-row\{grid-template-columns:1fr\}/);
});
