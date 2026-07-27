import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("o menu usa navegação de documento compatível com o vinext", async () => {
  const source = await readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8");

  assert.doesNotMatch(source, /next\/link/);
  assert.match(source, /window\.location\.assign\(href\)/);
  assert.match(source, /event\.ctrlKey/);
});

test("a saída da sessão fica dentro de Minha conta e não no menu superior", async () => {
  const [header, account] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/conta/MemberApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(header, /onLogout|>Sair</);
  assert.match(account, /className="ghost member-logout"[^>]*onClick=\{logout\}>Sair da conta</);
});
