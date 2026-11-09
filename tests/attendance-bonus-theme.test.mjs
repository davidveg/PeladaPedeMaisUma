import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const styles=await readFile(new URL("../app/attendance-bonus.css",import.meta.url),"utf8");

test("bônus de presença acompanha as paletas configuráveis nos modos claro e escuro",()=>{
  assert.match(styles,/--management-surface/);
  assert.match(styles,/--management-text/);
  assert.match(styles,/--management-muted/);
  assert.match(styles,/--management-line/);
  assert.match(styles,/--management-button/);
  assert.match(styles,/--control-surface/);
  assert.match(styles,/--control-text/);
  assert.match(styles,/--control-line/);
  assert.match(styles,/color-mix/);
  assert.doesNotMatch(styles,/background:\s*#(?:fff|f7f9f7|eef8f2)/i);
});
