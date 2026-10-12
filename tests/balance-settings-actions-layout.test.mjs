import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("ações das configurações de equilíbrio mantêm espaço entre os botões", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(styles, /\.expanded-weights \.settings-actions\{[^}]*gap:14px/);
  assert.match(styles, /@media\(max-width:600px\)\{\.expanded-weights \.settings-actions\{[^}]*flex-direction:column/);
});
