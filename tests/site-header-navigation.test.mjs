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
  assert.doesNotMatch(source, /link\("separations"/);
  assert.match(source, /link\("matches", "\/partidas", "Partidas"\)/);
  assert.match(source, /link\("admin", "\/admin", "Painel Administrativo"\)/);
  assert.match(source, /href="\/partidas" className="brand"/);
  assert.doesNotMatch(source, /scrollIntoView/);
  assert.match(source, /menu\.scrollLeft = Math\.max\(0,/);
  assert.match(worker, /text\/html/);
  assert.match(worker, /text\/x-component/);
  assert.match(worker, /no-cache, must-revalidate/);
});

test("o login retorna ao menu protegido solicitado depois de renovar a sessão", async () => {
  const [account, gate, layout] = await Promise.all([
    readFile(new URL("../app/conta/MemberApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SiteAccessGate.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(account, /Sua sessão expirou\. Entre novamente para continuar\./);
  assert.match(account, /window\.location\.assign\(returnTo\)/);
  assert.match(account, /safeSiteReturnTo/);
  assert.match(gate, /fetch\("\/api\/member-auth"/);
  assert.match(gate, /window\.location\.replace\(accountSignInHref\(returnTo,/);
  assert.match(gate, /window\.setInterval\(validate, 60_000\)/);
  assert.match(gate, /visibilitychange/);
  assert.match(layout, /<SiteAccessGate>\{children\}<SiteFooter\/><\/SiteAccessGate>/);
  assert.doesNotMatch(account, /área pública/);
});

test("a saída da sessão fica dentro de Minha conta e não no menu superior", async () => {
  const [header, account] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/conta/MemberApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(header, /onLogout|>Sair</);
  assert.match(account, /className="ghost member-logout"[^>]*onClick=\{logout\}>Sair da conta</);
});

test("notificações ficam no sino superior e não se repetem no menu lateral ou em Partidas", async () => {
  const [header, matches] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/partidas/MatchesApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(header, /link\("notifications", "\/notificacoes", "Notificações"\)/);
  assert.match(header, /<NotificationBell unread=\{unreadNotifications\}/);
  assert.doesNotMatch(matches, /href="\/notificacoes"/);
});

test("site e painel administrativo exibem sino com contador apenas para notificações não lidas", async () => {
  const [admin, header, bell, theme] = await Promise.all([
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/NotificationBell.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(admin, /fetch\('\/api\/notifications\?pageSize=10'/);
  assert.match(admin, /payload\.unread/);
  assert.match(header, /fetch\("\/api\/notifications\?pageSize=10"/);
  assert.match(header, /<NotificationBell unread=\{unreadNotifications\}/);
  assert.match(bell, /count > 99 \? "99\+"/);
  assert.match(bell, /className="notification-bell-icon"/);
  assert.match(bell, /data-unread=\{label\}/);
  assert.match(theme, /a\[href="\/notificacoes"\]::before/);
  assert.match(theme, /notification-bell-link\[data-unread\]:not\(\[data-unread="0"\]\)::after/);
  assert.match(theme, /background:\s*#dc352f/);
});

test("menu lateral evita overflow no desktop e centraliza o item somente no mobile", async () => {
  const [header, theme] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);

  assert.match(header, /window\.innerWidth > 900/);
  assert.match(theme, /\.site-sidebar nav \{[\s\S]*?overflow-x:\s*hidden/);
  assert.match(theme, /\.site-sidebar nav a:hover \{[\s\S]*?transform:\s*none/);
  assert.match(theme, /@media \(max-width: 900px\)[\s\S]*?\.site-sidebar nav \{[\s\S]*?overflow-x:\s*auto/);
});

test("menu lateral mostra o mês atual calculado e o andamento da temporada", async () => {
  const [header, branding, publicConfig, theme] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/InstanceBranding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public-config/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(header, /AMBIENTE DE VALIDAÇÃO|Layout experimental/);
  assert.match(header, /careerSeasonProgress\(season\)/);
  assert.match(header, /new Date\(season\.startedAt\)\.getUTCFullYear\(\)/);
  assert.match(header, /date\.setUTCMonth\(date\.getUTCMonth\(\) \+ seasonProgress\.currentMonth - 1\)/);
  assert.match(header, /Intl\.DateTimeFormat\("pt-BR", \{ month: "long", timeZone: "UTC" \}\)/);
  assert.match(header, /<strong>\{seasonMonth\}<\/strong>/);
  assert.match(header, /role="progressbar"/);
  assert.match(header, /aria-valuemax=\{seasonProgress\?\.totalMonths\}/);
  assert.match(header, /aria-valuenow=\{seasonProgress\?\.currentMonth\}/);
  assert.match(header, /width: `\$\{seasonProgress\?\.percentage \?\? 0\}%`/);
  assert.match(theme, /\.site-season-progress \{[\s\S]*height:\s*5px/);
  assert.match(theme, /\.site-season-progress > span \{[\s\S]*var\(--admin-sidebar-active/);
  assert.match(branding, /season: PublicCareerSeason \| null/);
  assert.match(publicConfig, /season_duration_months/);
  assert.match(publicConfig, /instance, season/);
});

test("acesso do jogador usa a mesma superfície escura do layout atual", async () => {
  const theme = await readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8");

  assert.match(theme, /\.member-access \{[\s\S]*?#0f1612/);
  assert.match(theme, /\.member-access-card \{[\s\S]*?background:\s*#18211d/);
  assert.match(theme, /\.member-access-tabs button\.on \{[\s\S]*?color:\s*#d3eb7a/);
});

test("a apresentação das estatísticas avançadas não herda o cabeçalho fixo global", async () => {
  const advanced = await readFile(new URL("../app/estatisticas/avancadas/AdvancedStatisticsApp.tsx", import.meta.url), "utf8");

  assert.match(advanced, /<section className="advanced-hero" aria-labelledby="advanced-statistics-title">/);
  assert.doesNotMatch(advanced, /<header className="advanced-hero"/);
});
