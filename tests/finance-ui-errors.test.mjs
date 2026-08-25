import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

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
