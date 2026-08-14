import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("o menu usa navegação de documento compatível com o vinext", async () => {
  const [source, worker] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../worker/index.ts", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(source, /next\/link/);
  assert.match(source, /window\.location\.assign\(href\)/);
  assert.match(source, /event\.ctrlKey/);
  assert.match(source, /fetch\("\/api\/member-auth"/);
  assert.match(source, /accountSignInHref\(href, true\)/);
  assert.doesNotMatch(source, />Início<|"Início"/);
  assert.doesNotMatch(source, /Entrar como administrador|Últimas separações/);
  assert.match(source, /link\("separations", "\/separacoes-salvas", "Separações salvas"\)/);
  assert.match(source, /link\("admin", "\/admin", "Painel Administrativo"\)/);
  assert.match(source, /href="\/separacoes-salvas" className="brand"/);
  assert.match(worker, /text\/html/);
  assert.match(worker, /text\/x-component/);
  assert.match(worker, /no-cache, must-revalidate/);
});

test("o login retorna ao menu protegido solicitado depois de renovar a sessão", async () => {
  const account = await readFile(new URL("../app/conta/MemberApp.tsx", import.meta.url), "utf8");

  assert.match(account, /Sua sessão expirou\. Entre novamente para continuar\./);
  assert.match(account, /window\.location\.assign\(returnTo\)/);
  assert.match(account, /safeSiteReturnTo/);
});

test("a saída da sessão fica dentro de Minha conta e não no menu superior", async () => {
  const [header, account] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/conta/MemberApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(header, /onLogout|>Sair</);
  assert.match(account, /className="ghost member-logout"[^>]*onClick=\{logout\}>Sair da conta</);
});

test("notificações ficam somente no menu compartilhado e não se repetem no cabeçalho de Partidas", async () => {
  const [header, matches] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/partidas/MatchesApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(header, /link\("notifications", "\/notificacoes", "Notificações"\)/);
  assert.doesNotMatch(matches, /href="\/notificacoes"/);
});
