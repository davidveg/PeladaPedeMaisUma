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
