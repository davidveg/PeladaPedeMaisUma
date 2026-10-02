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
  assert.match(source, /link\("overview", "\/visao-geral", "Visão geral"\)/);
  assert.match(source, /link\("matches", "\/partidas", "Partidas"\)/);
  assert.match(source, /matches: "calendar"/);
  assert.match(source, /<NavigationIcon name=\{navigationIcons\[section\]/);
  assert.match(source, /link\("admin", "\/admin", "Painel Administrativo"\)/);
  assert.match(source, /href="\/visao-geral" className="brand"/);
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

test("menu administrativo amplia os ícones móveis sem alargar os itens", async () => {
  const theme = await readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8");
  const mobile = [...theme.matchAll(/@media \(max-width: 600px\) \{([\s\S]*?)\r?\n\}/g)]
    .map(match => match[1])
    .find(block => block.includes(".admin-shell aside > button")) || "";

  assert.match(mobile, /\.admin-shell aside > button \{[\s\S]*?min-width:\s*64px;[\s\S]*?padding:\s*5px 8px/);
  assert.match(mobile, /\.admin-nav-icon \{[\s\S]*?width:\s*24px;[\s\S]*?height:\s*24px;[\s\S]*?font-size:\s*0/);
});

test("menus público e administrativo compartilham o mesmo conjunto vetorial de ícones", async () => {
  const [header, admin, icons, theme] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/admin/AdminApp.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/components/NavigationIcon.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);

  for (const mapping of [/overview: "dashboard"/, /matches: "calendar"/, /players: "players"/]) assert.match(header, mapping);
  for (const mapping of [/overview:'dashboard'/, /matches:'calendar'/, /players:'players'/]) assert.match(admin, mapping);
  assert.match(admin, /<NavigationIcon name=\{navigationIcons\[id\]\}/);
  assert.match(icons, /className="navigation-icon-svg"/);
  assert.match(icons, /stroke="currentColor"/);
  assert.doesNotMatch(header, /📅|♙|▦/);
  assert.doesNotMatch(admin.match(/const navigationIcons:[^\n]+/)?.[0] || "", /[▦♙▤◉◎◌◇≋★≡]/);
  assert.match(theme, /\.site-nav-icon \.navigation-icon-svg,[\s\S]*\.admin-nav-icon \.navigation-icon-svg \{[\s\S]*width:\s*18px;[\s\S]*height:\s*18px;[\s\S]*stroke-width:\s*1\.8/);
});

test("menu lateral mostra o mês atual calculado e o andamento da temporada", async () => {
  const [header, branding, publicConfig, theme] = await Promise.all([
    readFile(new URL("../app/components/SiteHeader.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/InstanceBranding.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/public-config/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
  ]);

  assert.doesNotMatch(header, /AMBIENTE DE VALIDAÇÃO|Layout experimental/);
  assert.match(header, /new Date\(season\.startedAt\)\.getUTCFullYear\(\)/);
  assert.match(header, /timeZone: config\.timezone \|\| "America\/Sao_Paulo"/);
  assert.match(header, /<strong>\{calendarMonth\} de 12 meses<\/strong>/);
  assert.match(header, /role="progressbar"/);
  assert.match(header, /aria-valuemax=\{12\}/);
  assert.match(header, /aria-valuenow=\{calendarMonth\}/);
  assert.match(header, /width: `\$\{calendarMonth \/ 12 \* 100\}%`/);
  assert.match(theme, /\.site-season-progress \{[\s\S]*height:\s*5px/);
  assert.match(theme, /\.site-season-progress > span \{[\s\S]*var\(--public-sidebar-highlight/);
  assert.match(branding, /season: PublicCareerSeason \| null/);
  assert.match(publicConfig, /season_duration_months/);
  assert.match(publicConfig, /instance, season/);
});

test("acesso e cadastro do jogador acompanham a identidade configurável", async () => {
  const [theme, member] = await Promise.all([
    readFile(new URL("../app/experimental-modern-theme.css", import.meta.url), "utf8"),
    readFile(new URL("../app/conta/MemberApp.tsx", import.meta.url), "utf8"),
  ]);

  assert.match(theme, /\.member-access \{[\s\S]*?var\(--management-background/);
  assert.match(theme, /\.member-access-copy \{[\s\S]*?var\(--public-sidebar/);
  assert.match(theme, /\.member-access-card \{[\s\S]*?background:\s*var\(--management-surface/);
  assert.match(theme, /\.member-access-tabs button\.on \{[\s\S]*?var\(--management-button/);
  assert.match(member, /<BrandIdentity compact \/>/);
  assert.match(member, /brand\.logoUrl \? <img src=\{brand\.logoUrl\}/);
});

test("opções do modo carreira ocupam linhas próprias no celular", async () => {
  const styles = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");

  assert.match(styles, /@media\(max-width:760px\)\{\.career-config-head\{[^}]*flex-direction:column/);
  assert.match(styles, /\.career-switches\{[^}]*width:100%/);
  assert.match(styles, /\.career-switches>\.career-switch\{[^}]*grid-template-columns:24px minmax\(0,1fr\) 20px/);
});

test("a apresentação das estatísticas avançadas não herda o cabeçalho fixo global", async () => {
  const advanced = await readFile(new URL("../app/estatisticas/avancadas/AdvancedStatisticsApp.tsx", import.meta.url), "utf8");

  assert.match(advanced, /<section className="advanced-hero" aria-labelledby="advanced-statistics-title">/);
  assert.doesNotMatch(advanced, /<header className="advanced-hero"/);
});
