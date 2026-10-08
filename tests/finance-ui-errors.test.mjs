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

test("formulários financeiros usam as superfícies configuráveis da identidade", async () => {
  const theme = await readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8");

  assert.match(theme, /\.finance-page \.finance-dialog,[\s\S]*form\.finance-card \{[\s\S]*var\(--management-surface/);
  assert.match(theme, /\.finance-page \.finance-dialog \.eyebrow,[\s\S]*var\(--management-button/);
  assert.match(theme, /\.finance-page \.finance-dialog \.editor-actions \{[\s\S]*var\(--management-line/);
  assert.match(theme, /\.finance-page \.finance-dialog \.ghost \{[\s\S]*var\(--control-surface/);
  assert.match(theme, /\.finance-page :is\([\s\S]*\.finance-dialog input,[\s\S]*var\(--control-surface/);
});

test("cabeçalho financeiro permanece no fluxo da página durante a navegação", async () => {
  const theme = await readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8");
  const header = theme.match(/\.finance-page \.finance-head \{([^}]+)\}/)?.[1] || "";
  const title = theme.match(/\.finance-page \.finance-head h1 \{([^}]+)\}/)?.[1] || "";

  assert.match(header, /position:\s*static/);
  assert.match(header, /top:\s*auto/);
  assert.match(header, /z-index:\s*auto/);
  assert.match(header, /height:\s*auto/);
  assert.match(header, /backdrop-filter:\s*none/);
  assert.match(title, /font:\s*700[^;]*Georgia, serif/);
  assert.match(title, /2\.875rem/);
});

test("goleiros são opcionais por competência na geração de mensalidades", async () => {
  const source = await readFile(new URL("../app/financeiro/FinanceApp.tsx", import.meta.url), "utf8");

  assert.match(source, /useState\(false\)/);
  assert.match(source, /Incluir goleiros nesta competência/);
  assert.match(source, /includeGoalkeepers, goalkeepersOnly: competenceGenerated/);
  assert.match(source, /Goleiro · isento por padrão/);
});

test("mensalidades priorizam cobranças em abas responsivas", async () => {
  const source = await readFile(new URL("../app/financeiro/FinanceApp.tsx", import.meta.url), "utf8");
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  const theme = await readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8");

  assert.match(source, /type MonthlyTab = "charges" \| "settings"/);
  assert.match(source, /useState<MonthlyTab>\("charges"\)/);
  assert.match(source, /aria-label="Áreas das mensalidades"/);
  assert.match(source, /id="finance-monthly-charges-tab"/);
  assert.match(source, /id="finance-monthly-settings-tab"/);
  assert.match(source, /section=\{monthlyTab\} setSection=\{setMonthlyTab\}/);
  assert.match(source, /setSection\("charges"\);[\s\S]*requestAnimationFrame/);
  assert.match(source, /ref=\{chargesPanel\} tabIndex=\{-1\}/);
  assert.match(styles, /\.finance-monthly-tabs\{[^}]*grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(styles, /@media\(max-width:560px\)\{\.finance-monthly-tabs\{width:100%\}/);
  assert.match(theme, /\.finance-page \.finance-monthly-tabs button\.active \{/);
});
