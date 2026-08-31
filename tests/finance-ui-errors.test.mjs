import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("valores dos cartões financeiros ficam em uma linha com fonte relativa ao cartão", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const card = styles.match(/\.finance-metric\{([^}]+)\}/)?.[1] || "";
  const amount = styles.match(/\.finance-metric strong\{([^}]+)\}/)?.[1] || "";

  assert.match(card, /container-type:inline-size/);
  assert.match(card, /gap:14px/);
  assert.match(amount, /font-size:clamp\(1rem,12cqi,1\.75rem\)/);
  assert.match(amount, /white-space:nowrap/);
  assert.match(amount, /font-variant-numeric:tabular-nums/);
  assert.match(amount, /overflow-wrap:normal/);
  assert.doesNotMatch(amount, /overflow-wrap:anywhere|word-break:break-all|vw/);
});

test("erros financeiros esperados ficam na página sem rejeição não tratada", async () => {
  const source = await readFile(new URL("../app/financeiro/FinanceApp.tsx", import.meta.url), "utf8");

  assert.match(source, /catch \(cause: any\) \{ setError\([^}]+\); return null; \} finally/);
  assert.doesNotMatch(source, /catch \(cause: any\)[^}]*throw cause/);
});

test("diálogos financeiros só fecham depois de uma operação bem-sucedida", async () => {
  const source = await readFile(new URL("../app/financeiro/FinanceApp.tsx", import.meta.url), "utf8");

  assert.match(source, /if\(await action\(\{ action: "register-payment"[^\n]+setPayment\(null\)/);
  assert.match(source, /if\(await action\(\{ action: "pay-expense"[^\n]+setPaying\(null\)/);
});

test("goleiros são opcionais por competência na geração de mensalidades", async () => {
  const source = await readFile(new URL("../app/financeiro/FinanceApp.tsx", import.meta.url), "utf8");

  assert.match(source, /useState\(false\)/);
  assert.match(source, /Incluir goleiros nesta competência/);
  assert.match(source, /includeGoalkeepers, goalkeepersOnly: competenceGenerated/);
  assert.match(source, /Goleiro · isento por padrão/);
});
