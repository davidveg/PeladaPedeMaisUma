from __future__ import annotations

from collections import Counter
from datetime import date
from html import escape
from pathlib import Path
from textwrap import TextWrapper

from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.charts.piecharts import Pie
from reportlab.graphics.shapes import Drawing, Rect, String
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    XPreformatted,
)


ROOT = Path(__file__).resolve().parents[2]
OUTPUT = Path(__file__).with_name("relatorio-auditoria-seguranca.pdf")
PROJECT = "Pelada Pede Mais Uma"
REPORT_TITLE = f"Relatório de Auditoria de Segurança — {PROJECT}"
AUDIT_DATE = date(2026, 9, 7)

CRITICAL = colors.HexColor("#B91C1C")
HIGH = colors.HexColor("#EA580C")
MEDIUM = colors.HexColor("#D97706")
LOW = colors.HexColor("#2563EB")
STRONG = colors.HexColor("#059669")
INK = colors.HexColor("#15241F")
MUTED = colors.HexColor("#5E6B65")
PALE = colors.HexColor("#F4F7F5")
LINE = colors.HexColor("#DCE5E0")
NAVY = colors.HexColor("#173B4D")

SEVERITY_COLORS = {
    "Crítica": CRITICAL,
    "Alta": HIGH,
    "Média": MEDIUM,
    "Baixa": LOW,
    "Informativa": colors.HexColor("#64748B"),
}


def register_fonts() -> tuple[str, str, str]:
    candidates = [
        ("AuditSans", "C:/Windows/Fonts/arial.ttf", "C:/Windows/Fonts/arialbd.ttf", "C:/Windows/Fonts/consola.ttf"),
        ("AuditSans", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"),
    ]
    for name, regular, bold, mono in candidates:
        if Path(regular).exists() and Path(bold).exists() and Path(mono).exists():
            pdfmetrics.registerFont(TTFont(name, regular))
            pdfmetrics.registerFont(TTFont(f"{name}-Bold", bold))
            pdfmetrics.registerFont(TTFont(f"{name}-Mono", mono))
            return name, f"{name}-Bold", f"{name}-Mono"
    return "Helvetica", "Helvetica-Bold", "Courier"


FONT, FONT_BOLD, FONT_MONO = register_fonts()


FINDINGS = [
    {
        "id": "SEC-01",
        "severity": "Crítica",
        "category": "Chaves expostas",
        "title": "Credencial administrativa universal é criada e publicada no produto",
        "locations": [
            "lib/database.ts:251-253",
            "app/admin/AdminApp.tsx:47-51",
            "README.md:210",
        ],
        "evidence": [
            'if(!admin){ const hash=await hashPassword("admin"); ... .bind(crypto.randomUUID(),"admin",hash,1,1,now,now).run(); }',
            "const [mode,...,[email,setEmail]=useState('admin'),[password,setPassword]=useState('admin'),...",
            "No primeiro acesso self-hosted, use `admin` / `admin`.",
        ],
        "description": "Toda base vazia recebe automaticamente a mesma conta administrativa e a mesma senha. A interface preenche a credencial e a documentação a divulga. Não existe segredo por instância nem validação de startup que recuse a configuração conhecida.",
        "exploit": "Um atacante que alcance uma instalação recém-criada pode autenticar-se como administrador sem adivinhação. O impacto é controle total de contas, jogadores, finanças, partidas, configurações e uploads.",
        "conditions": "Explorável enquanto a instância ainda conserva a credencial inicial; o risco é especialmente alto nas portas HTTP publicadas pelos Compose. Depois da troca, este achado isolado deixa de ser explorável, mas os achados SEC-02 e SEC-03 ampliam a janela.",
        "recommendation": "Gerar bootstrap aleatório por instância, exibi-lo uma única vez por canal local/console, exigir configuração explícita segura e bloquear o servidor se a credencial conhecida existir em ambiente não local.",
    },
    {
        "id": "SEC-02",
        "severity": "Alta",
        "category": "Permissão no navegador",
        "title": "Troca obrigatória de senha é apenas um gate de frontend",
        "locations": [
            "app/admin/AdminApp.tsx:20-22",
            "lib/database.ts:263-271",
            "app/api/administrators/route.ts:3-5",
        ],
        "evidence": [
            "if(admin.mustChangePassword)return <FirstAccess ... />;",
            "currentAdmin(...) seleciona must_change_password, mas não exige must_change_password=0; adminRequired apenas retorna currentAdmin.",
            "GET/POST/PUT de administradores confiam somente em adminRequired(request).",
        ],
        "description": "A UI impede a navegação normal quando `mustChangePassword` é verdadeiro, porém o servidor continua tratando a sessão como administrador completo. A regra de negócio existe no navegador e não é repetida nos endpoints.",
        "exploit": "Após entrar com `admin/admin`, basta chamar as APIs diretamente para cadastrar outro administrador, alterar configurações, gerir contas ou operar o financeiro sem trocar a senha inicial.",
        "conditions": "Requer uma sessão administrativa com `must_change_password=1`, obtida normalmente no primeiro acesso ou de uma base restaurada nesse estado.",
        "recommendation": "Fazer `adminRequired` recusar contas com troca pendente em todas as rotas, liberando somente `/api/auth` PUT, logout e recuperação; adicionar testes negativos para cada família privilegiada.",
    },
    {
        "id": "SEC-03",
        "severity": "Alta",
        "category": "Sessão/autenticação",
        "title": "Troca inicial de senha não revoga sessões concorrentes",
        "locations": [
            "app/admin/AdminApp.tsx:59",
            "app/api/auth/route.ts:37-40",
            "app/api/profile/password/route.ts:25-28",
        ],
        "evidence": [
            "FirstAccess envia PUT /api/auth.",
            "UPDATE administrators SET email=?,password_hash=?,must_change_password=0,... WHERE id=?",
            "O fluxo posterior de perfil, em contraste, executa DELETE FROM sessions WHERE administrator_id=? AND id<>?.",
        ],
        "description": "O endpoint de primeiro acesso substitui a senha, mas não invalida as demais sessões web que foram abertas com a credencial padrão. O próprio fluxo de troca posterior demonstra o comportamento esperado ao revogar outras sessões.",
        "exploit": "Um atacante pode entrar com a senha padrão antes do responsável. Mesmo após a troca legítima, a sessão do atacante continua válida por até oito horas e mantém poderes administrativos.",
        "conditions": "Requer login concorrente durante a janela de bootstrap e uma sessão ainda não expirada.",
        "recommendation": "Executar a troca em transação e apagar todas as sessões web e mobile da conta, opcionalmente mantendo apenas uma nova sessão rotacionada criada após a alteração.",
    },
    {
        "id": "SEC-04",
        "severity": "Alta",
        "category": "Isolamento/IDOR",
        "title": "Cadastro público pode reivindicar qualquer jogador ainda não associado",
        "locations": [
            "app/api/member-auth/route.ts:40-59",
            "app/api/member-players/route.ts:3-7",
            "app/api/member-players/route.ts:10-25",
            "app/api/member-profile/route.ts:27-42",
        ],
        "evidence": [
            "PUT /api/member-auth cria conta ativa e sessão sem verificação de e-mail ou convite.",
            "GET /api/member-players lista jogadores ativos sem vínculo.",
            "POST /api/member-players insere o vínculo usando o playerId enviado pelo chamador.",
            "PUT /api/member-profile passa a editar o jogador derivado desse vínculo.",
        ],
        "description": "O isolamento por dono é implementado por `player_account_links`, mas a etapa que cria o vínculo aceita qualquer `playerId` livre. Não há prova de posse, convite, código de ativação ou aprovação administrativa.",
        "exploit": "Qualquer pessoa pode criar uma conta com um e-mail arbitrário, enumerar os jogadores sem conta e assumir um deles. A partir daí recebe identidade esportiva, pode votar como o jogador, ver cobranças pessoais e editar nome, posição, observações e foto desse perfil.",
        "conditions": "Explorável para jogadores ainda não associados. As restrições UNIQUE evitam dupla associação depois da primeira reivindicação, mas não autenticam quem fez a primeira.",
        "recommendation": "Trocar a escolha aberta por convite de uso único emitido por administrador ou por fluxo de solicitação/aprovação; verificar e-mail; impedir listagem pública de candidatos e auditar a aprovação.",
    },
    {
        "id": "SEC-05",
        "severity": "Média",
        "category": "Sessão/autenticação",
        "title": "Endpoints de login não possuem limitação de tentativas",
        "locations": [
            "app/api/auth/route.ts:14-19",
            "app/api/member-auth/route.ts:17-25",
            "app/api/mobile/auth/route.ts:13-23",
            "docker-compose.yml:27-28",
        ],
        "evidence": [
            "Os três handlers consultam a conta e chamam verifyPassword sem contador, atraso, lockout, 429 ou Retry-After.",
            'ports: - "${HOST_PORT:-3000}:${PORT:-3000}"',
        ],
        "description": "Login administrativo, portal do jogador e login móvel aceitam tentativas ilimitadas. A documentação transfere rate limiting ao proxy, mas o Compose padrão publica diretamente a aplicação e não configura esse proxy.",
        "exploit": "Um atacante remoto pode testar senhas indefinidamente e distribuir tentativas por contas/IPs. O PBKDF2 aumenta o custo, mas não limita a taxa nem protege contra password spraying.",
        "conditions": "Explorável quando não há proxy/WAF externo com limitação efetiva; é a configuração entregue pelos Compose do repositório.",
        "recommendation": "Implementar limites por IP e por conta, backoff progressivo, resposta 429 com Retry-After e telemetria; manter uma segunda camada no proxy.",
    },
    {
        "id": "SEC-06",
        "severity": "Média",
        "category": "Sessão/autenticação",
        "title": "Cookies de sessão não usam o atributo Secure",
        "locations": [
            "app/api/auth/route.ts:5",
            "app/api/member-auth/route.ts:4",
            "docker-compose.yml:27-28",
            "docker-compose.omv.yml:40-41",
        ],
        "evidence": [
            "`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`",
            "Os Compose expõem a porta HTTP da aplicação; não há HSTS configurado no código.",
        ],
        "description": "Os cookies têm HttpOnly e SameSite=Strict, mas não `Secure`. Portanto, o navegador pode enviá-los em HTTP quando a origem estiver acessível dessa forma.",
        "exploit": "Em rede hostil, downgrade, acesso direto à porta publicada ou proxy TLS mal configurado, o token de sessão pode atravessar a rede sem criptografia e ser reutilizado.",
        "conditions": "Requer que o usuário acesse a origem por HTTP ou que exista rota HTTP até a aplicação. Um proxy que force HTTPS reduz a exposição, mas o cookie continua sem defesa própria.",
        "recommendation": "Adicionar `Secure` em produção, redirecionar HTTP para HTTPS, habilitar HSTS no ponto de entrada e falhar startup quando a URL pública de produção não for HTTPS.",
    },
    {
        "id": "SEC-07",
        "severity": "Média",
        "category": "Sessão/autenticação",
        "title": "Tokens de sessão web são persistidos em texto claro",
        "locations": [
            "app/api/auth/route.ts:20-29",
            "app/api/member-auth/route.ts:27-34",
            "lib/database.ts:263-265",
            "lib/mobile-auth.ts:65-69",
        ],
        "evidence": [
            "INSERT INTO sessions/member_sessions grava diretamente o UUID entregue no cookie.",
            "currentAdmin/currentMember comparam `s.id=?` com o valor bruto do cookie.",
            "O fluxo móvel, em contraste, persiste `hashOpaqueToken(accessToken)` e `hashOpaqueToken(refreshToken)`.",
        ],
        "description": "Sessões web são bearer tokens reutilizáveis e ficam em claro no SQLite/D1, embora tokens móveis e de recuperação sejam armazenados somente como hash.",
        "exploit": "Leitura indevida do banco, snapshot, backup ou console permite replay imediato das sessões: até oito horas para administrador e até trinta dias para membro.",
        "conditions": "Depende de exposição de leitura da base ou de backup. Não exige quebra do hash de senha.",
        "recommendation": "Persistir apenas SHA-256/HMAC do token aleatório, comparar o hash recebido, rotacionar sessões existentes e reduzir/revisar TTLs conforme o risco.",
    },
    {
        "id": "SEC-08",
        "severity": "Média",
        "category": "Upload/DoS",
        "title": "Limite de upload é aplicado somente depois de carregar o corpo inteiro",
        "locations": [
            "app/api/upload/route.ts:13-20",
        ],
        "evidence": [
            "const declaredSize = Number(request.headers.get(\"content-length\") || 0);",
            "const buffer = await request.arrayBuffer();",
            "if (!buffer.byteLength || buffer.byteLength > MAX_FILE_SIZE) ...",
        ],
        "description": "Quando `Content-Length` é omitido ou usa transferência em chunks, o pré-check recebe zero e o handler materializa todo o corpo em memória antes de descobrir que excede 5 MB.",
        "exploit": "Um membro autenticado pode enviar corpos muito grandes ou várias requisições paralelas para pressionar memória e CPU do processo self-hosted, causando indisponibilidade antes da resposta 413.",
        "conditions": "Requer conta autenticada; SEC-04 torna a criação dessa conta pública. Limites impostos externamente por Cloudflare/proxy reduzem a exposição, mas o servidor Node local não contém limite de streaming próprio.",
        "recommendation": "Impor limite no servidor/proxy antes do handler e ler o stream incrementalmente, abortando assim que superar 5 MB; limitar concorrência e testar requisição chunked sem Content-Length.",
    },
    {
        "id": "SEC-09",
        "severity": "Média",
        "category": "Upload/DoS",
        "title": "Uploads ilimitados geram objetos órfãos sem quota ou limpeza",
        "locations": [
            "app/api/upload/route.ts:7-24",
            "server/selfhost-runtime.mjs:119-134",
        ],
        "evidence": [
            "Cada POST autorizado cria `players/${crypto.randomUUID()}` e chama UPLOADS.put.",
            "A busca por `UPLOADS.delete` no código de produção não encontrou chamadas; não há vínculo transacional com o perfil nem quota por conta.",
        ],
        "description": "Cada envio cria um objeto permanente antes de o URL ser associado a qualquer jogador. Envios abandonados, substituições de foto e abuso deliberado não são removidos nem contabilizados por usuário.",
        "exploit": "Uma conta pode repetir uploads válidos de até 5 MB até esgotar o volume local ou elevar custos no R2, afetando disponibilidade e operação.",
        "conditions": "Requer conta autenticada; não há limite de frequência, volume acumulado ou quantidade. A capacidade física do storage é o único freio observado.",
        "recommendation": "Aplicar quota e rate limit por conta, registrar dono/estado temporário, confirmar associação em prazo curto e executar coleta de órfãos; remover o objeto anterior quando uma foto for substituída.",
    },
    {
        "id": "SEC-10",
        "severity": "Média",
        "category": "Deploy/hardening",
        "title": "Build e runtime OMV desabilitam barreiras do sandbox de contêiner",
        "locations": [
            "docker-compose.omv.yml:10-15",
            "docker-compose.omv.yml:45-50",
            "Dockerfile.selfhost.omv:7-17",
            "Dockerfile.multiarch:9-21",
        ],
        "evidence": [
            "build: ... privileged: true",
            "security_opt: - seccomp:unconfined",
            "RUN --security=insecure ... npm ci / npm run build",
        ],
        "description": "As receitas de produção concedem modo inseguro/privilegiado ao build e removem o filtro seccomp no runtime OMV. `cap_drop: ALL`, usuário não-root e `no-new-privileges` ajudam, mas não restauram essas duas fronteiras.",
        "exploit": "Código malicioso introduzido no repositório ou cadeia de dependências durante o build recebe uma superfície maior contra o host; no runtime OMV, uma exploração do Node/app dispõe de mais syscalls para pós-exploração.",
        "conditions": "Aplica-se aos builds que habilitam entitlement `security.insecure` e ao Compose OMV. O runtime do Compose padrão não declara `seccomp:unconfined`.",
        "recommendation": "Eliminar `privileged` e `--security=insecure`; se a limitação do kernel OMV impedir isso, isolar o builder, documentar a exceção, fixar e verificar artefatos, usar SBOM/assinatura e criar um perfil seccomp mínimo compatível para runtime.",
    },
]


STRENGTHS = [
    ("Autorização sensível no servidor", "Rotas de jogadores, partidas, financeiro, moderadores, configurações, auditoria e releases aplicam `adminRequired` ou `staffRequired` com permissão específica; evidências: app/api/players/route.ts:30-47, app/api/admin/matches/route.ts:14-23 e 48-53, app/api/finance/route.ts:12-26, app/api/moderators/route.ts:8-10 e 30-32."),
    ("Posse aplicada em operações pessoais", "Notificações filtram e atualizam por `account_type` + `account_id` (app/api/notifications/route.ts:19-31 e 49-61); perfil e ausência derivam `playerId` da sessão (app/api/member-profile/route.ts:10-24 e 27-42; app/api/player-absence/route.ts:6-37); presença ignora playerId do corpo (app/api/matches/route.ts:18-28)."),
    ("Financeiro pessoal isolado", "Quando o chamador não possui `FINANCE_MANAGE`, `loadFinance` desvia para `loadPlayerFinance`, que exige `viewer.playerId` e filtra `c.player_id=?` (lib/finance-service.ts:121-125 e 173-182)."),
    ("Voto vinculado à identidade autenticada", "O voto usa `account.playerId`, valida participação e possui unicidade por jogador/conta (app/api/career/vote/route.ts:99-139; lib/database.ts:55 e 217)."),
    ("Tokens sensíveis modernos", "Refresh/access tokens móveis e tokens de redefinição são aleatórios, persistidos como hash, têm expiração/uso único e revogação por reutilização (lib/mobile-auth.ts:20-42 e 64-69; app/api/password-reset/route.ts:63-82; app/api/member-password-reset/route.ts:62-80)."),
    ("Redução de SQL injection", "As entradas de usuário são passadas por `.bind(...)`; identificadores SQL dinâmicos observados derivam de constantes ou enumerações fechadas, não de texto livre. O adaptador usa prepared statements (server/selfhost-runtime.mjs:11-28)."),
    ("Superfície XSS bem contida", "Não foram encontrados `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, renderizadores Markdown/HTML ou biblioteca de sanitização necessária. React faz escape de texto; URLs de release exigem HTTPS (lib/mobile-release.ts:70-75 e 144-145), branding restringe uploads/HTTPS (lib/instance-config.ts:192-199) e uploads validam assinatura/tipo (app/api/upload/route.ts:19-23)."),
    ("Segredos operacionais fora do contexto Docker", "`.env` é ignorado no Git e no Docker (linhas 33-36 de .gitignore; linhas 14-16 de .dockerignore). Em 137 commits, o scan por formatos fortes encontrou apenas chaves cliente do Firebase/Google Services esperadas no app móvel; não encontrou chave privada, token backend ou segredo SMTP real. Os bundles `dist/client` e `mobile/dist` não contêm formatos fortes de segredo."),
    ("Testes existentes sólidos", "A suíte executada diretamente com Node passou 240/240 testes, incluindo expiração de sessão, autorização de moderador, isolamento financeiro, voto autenticado, reset com revogação e travessia de diretório em upload."),
]


WEAKNESSES = [
    "O bootstrap conhecido `admin/admin` combina-se com autorização server-side permissiva durante `must_change_password` e com sessões concorrentes não revogadas.",
    "A identidade de jogador é reivindicada por escolha do primeiro usuário, sem convite, verificação de e-mail ou aprovação.",
    "Controles de borda (HTTPS/limite de login/limite de corpo/quota) são presumidos, mas não fazem parte dos deploys padrão.",
    "Sessões web e recipes de contêiner ficam abaixo do nível de proteção já usado em outros componentes do próprio projeto.",
]


ISSUES = [
    {
        "number": 1,
        "severity": "Crítica",
        "title": "[Segurança] Eliminar credencial admin universal e bloquear APIs até concluir o bootstrap",
        "body": """Labels sugeridas: security, severidade:crítica

## Descrição

Instalações vazias criam automaticamente `admin/admin`, a interface preenche essa credencial e a documentação a publica. Depois do login, `must_change_password` é respeitado apenas pela UI: `adminRequired` aceita a sessão em todas as APIs. Além disso, a troca inicial não revoga sessões abertas em paralelo.

## Por que é explorável

Quem alcançar uma instância nova pode autenticar-se sem adivinhação, chamar diretamente endpoints administrativos e manter uma sessão por até oito horas mesmo que o responsável troque a senha logo depois.

## Evidência

- `lib/database.ts:251-253`

```ts
if(!admin){ const hash=await hashPassword("admin");
  ...bind(crypto.randomUUID(),"admin",hash,1,1,now,now).run(); }
```

- `app/admin/AdminApp.tsx:22,49,59`

```tsx
if(admin.mustChangePassword)return <FirstAccess ... />;
const [email,setEmail]=useState('admin'),[password,setPassword]=useState('admin');
// FirstAccess envia PUT /api/auth
```

- `lib/database.ts:263-271` - `adminRequired` não exige `must_change_password=0`.
- `app/api/auth/route.ts:37-40` - a troca inicial atualiza a senha sem apagar sessões.

## Impacto

Tomada completa da instância: contas, perfis, partidas, resultados, finanças, configurações e uploads.

## Sugestão de correção

Gerar segredo inicial aleatório por instância ou fluxo de criação local; recusar startup inseguro em produção; fazer `adminRequired` bloquear contas pendentes em toda rota exceto troca/logout/reset; na conclusão, revogar todas as sessões web/mobile e emitir token novo.

## Critérios de aceite

- [ ] Base vazia não contém senha universal nem valor documentado.
- [ ] Produção falha de forma segura se o bootstrap não estiver configurado.
- [ ] Sessão com `must_change_password=1` recebe 403 em toda API privilegiada.
- [ ] Apenas troca inicial, logout e recuperação permanecem acessíveis nesse estado.
- [ ] Troca inicial revoga todas as sessões concorrentes web e mobile.
- [ ] Teste automatizado prova que a sessão antiga deixa de funcionar.
""",
    },
    {
        "number": 2,
        "severity": "Alta",
        "title": "[Segurança] Exigir convite ou aprovação para associar conta a jogador",
        "body": """Labels sugeridas: security, severidade:alta

## Descrição

O portal permite cadastro público sem verificação de e-mail, lista jogadores ainda sem conta e aceita o `playerId` escolhido pelo usuário. O vínculo passa a ser a fonte de autorização para voto, perfil, ausência e financeiro.

## Por que é explorável

Um atacante cria uma conta com qualquer e-mail, seleciona um jogador livre e assume a identidade antes do titular. O índice UNIQUE protege apenas contra a segunda associação; não autentica a primeira.

## Evidência

- `app/api/member-auth/route.ts:40-59` - cria conta ativa e sessão sem convite/verificação.
- `app/api/member-players/route.ts:3-7`

```ts
SELECT ... FROM players p LEFT JOIN player_account_links l ON l.player_id=p.id
WHERE ... AND l.player_id IS NULL
```

- `app/api/member-players/route.ts:10-25`

```ts
const playerId = String(payload.playerId || "");
INSERT INTO player_account_links (...) .bind(playerId, ..., member.id, ...)
```

- `app/api/member-profile/route.ts:27-42` - o vínculo permite editar o perfil.

## Impacto

Impersonação de jogador, voto indevido, acesso a cobrança pessoal e alteração de dados do perfil.

## Sugestão de correção

Usar convite de uso único emitido por administrador ou solicitação pendente aprovada por administrador; verificar e-mail; não expor a lista completa de candidatos a contas não aprovadas.

## Critérios de aceite

- [ ] Cadastro novo não cria vínculo ativo por escolha unilateral.
- [ ] Convite/solicitação está vinculado a jogador e expira.
- [ ] Administrador aprova e a ação fica auditada.
- [ ] E-mail da conta é verificado antes de ativar o vínculo.
- [ ] Tentativa com `playerId` arbitrário recebe 403.
- [ ] Testes cobrem corrida de dois solicitantes para o mesmo jogador.
""",
    },
    {
        "number": 3,
        "severity": "Média",
        "title": "[Segurança] Aplicar rate limiting aos três fluxos de login",
        "body": """Labels sugeridas: security, severidade:média

## Descrição

Login administrativo, login do jogador e login móvel verificam credenciais sem limite por conta/IP, atraso progressivo, lockout temporário ou resposta 429. O Compose padrão publica a aplicação diretamente.

## Por que é explorável

Permite brute force e password spraying contínuos. O PBKDF2 eleva o custo por tentativa, mas não controla volume distribuído.

## Evidência

- `app/api/auth/route.ts:14-19`
- `app/api/member-auth/route.ts:17-25`
- `app/api/mobile/auth/route.ts:13-23`
- `docker-compose.yml:27-28`

```yaml
ports:
  - "${HOST_PORT:-3000}:${PORT:-3000}"
```

## Impacto

Comprometimento de contas com senhas fracas/reutilizadas e consumo de CPU por PBKDF2.

## Sugestão de correção

Limitar por IP e identificador normalizado, usar backoff progressivo e janela deslizante, responder 429/Retry-After e alertar sobre spraying. Manter limite adicional no proxy.

## Critérios de aceite

- [ ] Todos os três endpoints compartilham política de limite.
- [ ] Excesso recebe 429 com Retry-After.
- [ ] Resposta não revela se a conta existe.
- [ ] Há limite por conta e por origem.
- [ ] Testes cobrem janela, desbloqueio e IPs distribuídos.
""",
    },
    {
        "number": 4,
        "severity": "Média",
        "title": "[Segurança] Marcar cookies de sessão como Secure e forçar HTTPS",
        "body": """Labels sugeridas: security, severidade:média

## Descrição

Cookies web usam HttpOnly e SameSite=Strict, mas não `Secure`. Os Compose publicam uma porta HTTP e o código não aplica HSTS.

## Por que é explorável

Se o usuário acessar HTTP, a sessão pode ser transmitida sem criptografia e reutilizada por quem observa a rede.

## Evidência

- `app/api/auth/route.ts:5`
- `app/api/member-auth/route.ts:4`

```ts
`${name}=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}`
```

- `docker-compose.yml:27-28`; `docker-compose.omv.yml:40-41`.

## Impacto

Sequestro de sessão administrativa ou de jogador em implantação HTTP/downgrade.

## Sugestão de correção

Adicionar `Secure` em produção, forçar HTTPS/HSTS no proxy e rejeitar configuração pública não HTTPS.

## Critérios de aceite

- [ ] Set-Cookie contém Secure em produção.
- [ ] HTTP redireciona para HTTPS antes de autenticação.
- [ ] HSTS está presente na origem pública.
- [ ] Startup de produção recusa APP_BASE_URL HTTP.
- [ ] Testes verificam os atributos em login e logout.
""",
    },
    {
        "number": 5,
        "severity": "Média",
        "title": "[Segurança] Persistir somente hash dos tokens de sessão web",
        "body": """Labels sugeridas: security, severidade:média

## Descrição

Os UUIDs entregues nos cookies são gravados em claro em `sessions` e `member_sessions`. Tokens móveis e de reset já usam hash, mostrando uma implementação segura disponível.

## Por que é explorável

Quem obtiver leitura do banco ou backup pode copiar o valor e usá-lo como bearer token sem conhecer a senha.

## Evidência

- `app/api/auth/route.ts:20-29`; `app/api/member-auth/route.ts:27-34`

```ts
INSERT INTO sessions ... .bind(token, account.id, ...)
INSERT INTO member_sessions ... .bind(id, account.id, ...)
```

- `lib/database.ts:263-265` compara o cookie diretamente a `s.id`.
- `lib/mobile-auth.ts:65-69` usa `hashOpaqueToken` nos tokens móveis.

## Impacto

Replay de sessão por até 8 horas (admin) ou 30 dias (membro) após vazamento de banco/backup.

## Sugestão de correção

Emitir token aleatório de alta entropia, persistir SHA-256/HMAC, comparar apenas o hash e migrar/revogar sessões legadas.

## Critérios de aceite

- [ ] Banco não contém o bearer token entregue ao cliente.
- [ ] Lookup autentica pelo hash.
- [ ] Sessões antigas são revogadas/migradas.
- [ ] Logs e auditoria nunca registram o token.
- [ ] Teste comprova que o valor armazenado não autentica diretamente.
""",
    },
    {
        "number": 6,
        "severity": "Média",
        "title": "[Segurança] Tornar uploads limitados por streaming, quota e coleta de órfãos",
        "body": """Labels sugeridas: security, severidade:média

## Descrição

O endpoint confia no Content-Length para o pré-check e, quando ele falta, usa `request.arrayBuffer()` antes de validar 5 MB. Cada upload cria ainda um objeto permanente sem quota, rate limit, dono persistido ou limpeza.

## Por que é explorável

Uma conta pode enviar corpo chunked grande para consumir memória e repetir imagens válidas para esgotar storage/custos. SEC-04 facilita obter essa conta.

## Evidência

- `app/api/upload/route.ts:13-23`

```ts
const declaredSize = Number(request.headers.get("content-length") || 0);
const buffer = await request.arrayBuffer();
if (buffer.byteLength > MAX_FILE_SIZE) return ... 413;
await UPLOADS.put(`${purpose}/${crypto.randomUUID()}.${extension}`, buffer, ...);
```

- `server/selfhost-runtime.mjs:119-134` persiste o objeto.
- Não há chamada de produção a `UPLOADS.delete`.

## Impacto

Indisponibilidade por memória/concorrência e esgotamento do volume/R2 por objetos órfãos.

## Sugestão de correção

Limitar corpo no proxy e por leitura incremental, abortar acima de 5 MB, aplicar rate/quota por conta, registrar dono/estado temporário e coletar objetos não associados.

## Critérios de aceite

- [ ] Upload chunked acima de 5 MB é abortado sem buffer integral.
- [ ] Há limite de concorrência e taxa por conta/IP.
- [ ] Quota cumulativa impede esgotamento do storage.
- [ ] Objeto temporário expira se não for associado.
- [ ] Troca/remoção de foto coleta o objeto antigo quando seguro.
- [ ] Métricas alertam sobre volume e rejeições.
""",
    },
    {
        "number": 7,
        "severity": "Média",
        "title": "[Segurança] Remover build privilegiado e seccomp unconfined do deploy OMV",
        "body": """Labels sugeridas: security, severidade:média

## Descrição

O Compose OMV marca o build como privilegiado, os Dockerfiles executam etapas com `--security=insecure` e o runtime OMV desabilita seccomp.

## Por que é explorável

Código malicioso no repositório/dependências durante build ganha uma fronteira mais fraca contra o host; uma exploração do runtime dispõe de mais syscalls para pós-exploração.

## Evidência

- `docker-compose.omv.yml:10-15`

```yaml
build:
  privileged: true
```

- `docker-compose.omv.yml:45-50`: `seccomp:unconfined`.
- `Dockerfile.selfhost.omv:7-17` e `Dockerfile.multiarch:9-21`: `RUN --security=insecure`.

## Impacto

Aumento do impacto de comprometimento de supply chain/build e de exploração do processo em produção OMV.

## Sugestão de correção

Remover entitlements inseguros; separar builder; usar artefatos assinados/SBOM; criar perfil seccomp mínimo compatível e preservar usuário não-root, cap_drop e no-new-privileges.

## Critérios de aceite

- [ ] Build padrão funciona sem privileged e security.insecure.
- [ ] Runtime não usa seccomp:unconfined.
- [ ] Perfil seccomp mínimo é versionado e testado no OMV alvo.
- [ ] Imagens são fixadas por digest/assinadas e acompanhadas de SBOM.
- [ ] Pipeline valida que exceções inseguras não retornaram.
""",
    },
]


def styles():
    sample = getSampleStyleSheet()
    return {
        "title": ParagraphStyle("Title", parent=sample["Title"], fontName=FONT_BOLD, fontSize=25, leading=30, textColor=colors.white, alignment=TA_LEFT, spaceAfter=14),
        "cover_sub": ParagraphStyle("CoverSub", fontName=FONT, fontSize=11, leading=17, textColor=colors.HexColor("#D8E7E0")),
        "h1": ParagraphStyle("H1", fontName=FONT_BOLD, fontSize=18, leading=22, textColor=NAVY, spaceBefore=8, spaceAfter=10),
        "h2": ParagraphStyle("H2", fontName=FONT_BOLD, fontSize=13, leading=17, textColor=INK, spaceBefore=9, spaceAfter=6),
        "h3": ParagraphStyle("H3", fontName=FONT_BOLD, fontSize=10.5, leading=14, textColor=INK, spaceBefore=7, spaceAfter=4),
        "body": ParagraphStyle("Body", fontName=FONT, fontSize=9.2, leading=13.2, textColor=INK, spaceAfter=6),
        "small": ParagraphStyle("Small", fontName=FONT, fontSize=7.7, leading=10.5, textColor=MUTED, spaceAfter=4),
        "table": ParagraphStyle("Table", fontName=FONT, fontSize=7.4, leading=9.5, textColor=INK),
        "table_head": ParagraphStyle("TableHead", fontName=FONT_BOLD, fontSize=7.5, leading=9, textColor=colors.white, alignment=TA_LEFT),
        "chip": ParagraphStyle("Chip", fontName=FONT_BOLD, fontSize=7.2, leading=9, textColor=colors.white, alignment=TA_CENTER),
        "code": ParagraphStyle("Code", fontName=FONT_MONO, fontSize=7.2, leading=9.4, textColor=colors.HexColor("#24332C"), leftIndent=4, rightIndent=4, spaceAfter=5),
        "issue": ParagraphStyle(
            "Issue", fontName=FONT_MONO, fontSize=7.1, leading=9.4, textColor=INK,
            splitLongWords=True, backColor=colors.HexColor("#F8FAF9"),
            borderColor=LINE, borderWidth=0.6, borderPadding=9,
        ),
        "footer": ParagraphStyle("Footer", fontName=FONT, fontSize=7, textColor=MUTED),
        "center": ParagraphStyle("Center", fontName=FONT, fontSize=9, leading=13, textColor=INK, alignment=TA_CENTER),
    }


S = styles()


class AuditDocTemplate(BaseDocTemplate):
    def __init__(self, filename: str):
        super().__init__(
            filename,
            pagesize=A4,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2.2 * cm,
            bottomMargin=1.8 * cm,
            title=REPORT_TITLE,
            author="Auditoria automatizada assistida por Codex",
            subject="Auditoria de segurança de código",
        )
        frame = Frame(self.leftMargin, self.bottomMargin, self.width, self.height, id="normal")
        self.addPageTemplates(PageTemplate(id="audit", frames=[frame], onPage=self.draw_header_footer))

    def draw_header_footer(self, canvas, doc):
        canvas.saveState()
        if doc.page > 1:
            canvas.setStrokeColor(LINE)
            canvas.setLineWidth(0.5)
            canvas.line(doc.leftMargin, A4[1] - 1.45 * cm, A4[0] - doc.rightMargin, A4[1] - 1.45 * cm)
            canvas.setFont(FONT, 7.2)
            canvas.setFillColor(MUTED)
            canvas.drawString(doc.leftMargin, A4[1] - 1.16 * cm, "RELATÓRIO DE AUDITORIA DE SEGURANÇA")
            canvas.drawRightString(A4[0] - doc.rightMargin, A4[1] - 1.16 * cm, PROJECT)
        canvas.setStrokeColor(LINE)
        canvas.line(doc.leftMargin, 1.2 * cm, A4[0] - doc.rightMargin, 1.2 * cm)
        canvas.setFont(FONT, 7.2)
        canvas.setFillColor(MUTED)
        canvas.drawString(doc.leftMargin, 0.82 * cm, "Uso interno - revisão estática e testes locais")
        canvas.drawRightString(A4[0] - doc.rightMargin, 0.82 * cm, f"Página {doc.page}")
        canvas.restoreState()


def p(text: str, style: str = "body") -> Paragraph:
    return Paragraph(text, S[style])


def bullet(text: str, color=INK) -> Table:
    dot = Paragraph("●", ParagraphStyle("dot", fontName=FONT, fontSize=7, textColor=color, leading=12))
    return Table([[dot, p(text)]], colWidths=[0.32 * cm, 15.9 * cm], style=TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 2),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 2),
    ]))


def severity_chip(severity: str) -> Table:
    return Table([[Paragraph(severity.upper(), S["chip"])]], colWidths=[1.7 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SEVERITY_COLORS[severity]),
        ("BOX", (0, 0), (-1, -1), 0, SEVERITY_COLORS[severity]),
        ("LEFTPADDING", (0, 0), (-1, -1), 4),
        ("RIGHTPADDING", (0, 0), (-1, -1), 4),
        ("TOPPADDING", (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ]))


def charts() -> tuple[Drawing, Drawing]:
    severity_counts = Counter(item["severity"] for item in FINDINGS)
    labels = [label for label in ["Crítica", "Alta", "Média", "Baixa"] if severity_counts[label]]
    values = [severity_counts[label] for label in labels]
    donut = Drawing(204, 162)
    pie = Pie()
    pie.x = 21
    pie.y = 34
    pie.width = 104
    pie.height = 104
    pie.data = values
    pie.startAngle = 90
    pie.direction = "clockwise"
    pie.innerRadiusFraction = 0.59
    pie.slices.strokeColor = colors.white
    pie.slices.strokeWidth = 1.5
    for idx, label in enumerate(labels):
        pie.slices[idx].fillColor = SEVERITY_COLORS[label]
    donut.add(pie)
    donut.add(String(73, 91, str(sum(values)), fontName=FONT_BOLD, fontSize=18, fillColor=NAVY, textAnchor="middle"))
    donut.add(String(73, 77, "achados", fontName=FONT, fontSize=7, fillColor=MUTED, textAnchor="middle"))
    for idx, label in enumerate(labels):
        y = 121 - idx * 24
        donut.add(Rect(141, y - 7, 9, 9, fillColor=SEVERITY_COLORS[label], strokeColor=None, rx=2, ry=2))
        donut.add(String(156, y - 5, f"{label}: {severity_counts[label]}", fontName=FONT, fontSize=7.5, fillColor=INK))

    category_counts = Counter(item["category"] for item in FINDINGS)
    ordered = [
        "Chaves expostas",
        "Permissão no navegador",
        "Isolamento/IDOR",
        "Sessão/autenticação",
        "Upload/DoS",
        "Deploy/hardening",
        "Inputs/XSS",
    ]
    category_counts["Inputs/XSS"] = 0
    short = ["Chaves", "Permissão UI", "Isolamento/IDOR", "Sessão/auth", "Upload/DoS", "Deploy", "Inputs/XSS"]
    vals = [category_counts[name] for name in ordered]
    bars_drawing = Drawing(448, 198)
    bar = HorizontalBarChart()
    bar.x = 104
    bar.y = 24
    bar.width = 290
    bar.height = 154
    bar.data = [[float(value) for value in vals[::-1]]]
    bar.categoryAxis.categoryNames = short[::-1]
    bar.categoryAxis.labels.fontName = FONT
    bar.categoryAxis.labels.fontSize = 7.5
    bar.categoryAxis.labels.fillColor = INK
    bar.categoryAxis.labels.boxAnchor = "e"
    bar.valueAxis.valueMin = 0
    bar.valueAxis.valueMax = max(vals) + 1
    bar.valueAxis.valueStep = 1
    bar.valueAxis.labels.fontName = FONT
    bar.valueAxis.labels.fontSize = 7
    bar.valueAxis.labels.fillColor = MUTED
    bar.valueAxis.gridStrokeColor = LINE
    bar.valueAxis.gridStrokeWidth = 0.5
    bar.bars[0].fillColor = NAVY
    bar.bars[0].strokeColor = None
    bar.barWidth = 12
    bar.barSpacing = 4
    bars_drawing.add(bar)
    for idx, value in enumerate(vals[::-1]):
        # Value labels are deliberately drawn outside the bars for readability.
        y = 36 + idx * 22
        x = 108 + (value / (max(vals) + 1)) * 290
        bars_drawing.add(String(x + 4, y, str(value), fontName=FONT_BOLD, fontSize=7.5, fillColor=INK))
    bars_drawing.add(String(249, 6, "Quantidade de achados", fontName=FONT, fontSize=7, fillColor=MUTED, textAnchor="middle"))
    return donut, bars_drawing


def cover(story: list):
    block = Table([
        [Paragraph("AUDITORIA DE SEGURANÇA", ParagraphStyle("eyebrow", fontName=FONT_BOLD, fontSize=9, tracking=1.4, textColor=colors.HexColor("#D9F36B")))],
        [Spacer(1, 0.35 * cm)],
        [Paragraph(REPORT_TITLE, S["title"])],
        [Paragraph("Revisão de código, autorização, isolamento por identidade, segredos, XSS, uploads e deploy.", S["cover_sub"])],
    ], colWidths=[16.2 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#0B3D2E")),
        ("LEFTPADDING", (0, 0), (-1, -1), 24),
        ("RIGHTPADDING", (0, 0), (-1, -1), 24),
        ("TOPPADDING", (0, 0), (-1, -1), 15),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 15),
    ]))
    story.extend([Spacer(1, 2.4 * cm), block, Spacer(1, 1.0 * cm)])
    meta = [
        [p("DATA", "small"), p("07 de setembro de 2026")],
        [p("ESCOPO", "small"), p("Aplicação web, API, app móvel, persistência, migrações, servidor self-hosted, Worker, arquivos Docker/Compose/Wrangler, histórico Git e bundles gerados.")],
        [p("COBERTURA", "small"), p("47 arquivos de rota; 98 handlers exportados (incluindo wrappers móveis); 137 commits verificados; 240 testes executados.")],
        [p("RESULTADO", "small"), p("10 achados verificados: 1 crítico, 3 altos e 6 médios. Nenhum achado XSS confirmado.")],
    ]
    story.append(Table(meta, colWidths=[2.5 * cm, 13.7 * cm], style=TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), PALE),
        ("BOX", (0, 0), (-1, -1), 0.7, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 8),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ])))
    story.extend([Spacer(1, 0.8 * cm), p("Nota metodológica", "h2")])
    story.append(p("A stack foi detectada antes da busca por falhas. Como o projeto não usa Supabase/RLS nem tabelas multi-tenant, a categoria \"banco sem tranca\" foi mapeada para o vínculo entre conta e jogador (`player_account_links`) e para filtros derivados da sessão. Gates do React/Expo foram cruzados com os handlers Next.js; todos os handlers foram percorridos. Segredos foram procurados no código atual, deploy, documentação, 137 commits e bundles. XSS foi mapeado para sinks React/React Native, URLs renderizadas, templates de e-mail e renderização de HTML/Markdown."))
    story.append(PageBreak())


def stack_section(story: list):
    story.append(p("1. Stack e modelo de segurança detectados", "h1"))
    rows = [
        ["Camada", "Tecnologia detectada", "Mapeamento de auditoria"],
        ["Linguagem/runtime", "TypeScript/JavaScript; Node.js >=22", "Handlers, bibliotecas, Worker e servidor self-hosted"],
        ["Framework web", "Next.js 16 via vinext + React 19", "App Router em app/api/**/route.ts e gates no React"],
        ["Persistência", "SQLite local / Cloudflare D1; schema Drizzle 0.45", "Runtime usa prepared statements D1/SQLite; Drizzle concentra schema/migrações"],
        ["Autenticação", "Cookies opacos web; bearer access/refresh no móvel", "Sessões admin/membro, PBKDF2, permissões de moderador e vínculo com jogador"],
        ["Frontend", "React web e Expo/React Native", "Gates por accountType/permissions; sinks HTML, URLs, Linking.openURL"],
        ["Isolamento", "Uma pelada por instância; sem tenant_id/RLS", "Dados globais da instância; dados pessoais isolados por account_id/playerId"],
        ["Deploy", "Dockerfiles, Docker Compose, Wrangler; sem CI/Helm/Terraform", "Segredos/defaults, portas, privilégios de build e sandbox de runtime"],
    ]
    table = Table([[p(str(cell), "table_head") for cell in rows[0]]] + [[p(str(cell), "table") for cell in row] for row in rows[1:]], colWidths=[3.0 * cm, 5.1 * cm, 8.1 * cm], repeatRows=1)
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), NAVY),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
        ("GRID", (0, 0), (-1, -1), 0.4, LINE),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 6),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
    ]))
    story.append(table)
    story.extend([Spacer(1, 0.35 * cm), p("Arquivos de CI, Helm e Terraform não existem no repositório; a análise não forçou equivalentes. O arquivo `.openai/hosting.json` não está presente. O modelo é single-tenant por implantação, com `scope_id='instance:1'` no financeiro; portanto, ausência de `tenant_id` nas tabelas globais não foi tratada como falha por si só.", "small")])


def executive_summary(story: list):
    story.append(PageBreak())
    story.append(p("2. Resumo executivo", "h1"))
    story.append(p("O risco dominante está no bootstrap administrativo. A credencial conhecida é criada automaticamente, a troca obrigatória é apenas visual e sessões concorrentes sobrevivem à troca. Em paralelo, o primeiro usuário de uma conta comum pode reivindicar um jogador livre sem prova de identidade. Os demais achados concentram-se em controles de borda e contenção: rate limiting, transporte de cookies, hashing de sessões web, uploads e sandbox de contêiner."))
    sev_chart, cat_chart = charts()
    dashboard = Table([
        [sev_chart, Table([
            [p("10", "h1"), p("achados verificados", "small")],
            [severity_chip("Crítica"), p("1 - tomada inicial da instância", "small")],
            [severity_chip("Alta"), p("3 - autorização, sessão e identidade", "small")],
            [severity_chip("Média"), p("6 - proteção de borda e contenção", "small")],
        ], colWidths=[2.1 * cm, 5.3 * cm], style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("LEFTPADDING", (0, 0), (-1, -1), 4),
            ("RIGHTPADDING", (0, 0), (-1, -1), 4),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))],
        [cat_chart, ""],
    ], colWidths=[8.0 * cm, 8.2 * cm], style=TableStyle([
        ("SPAN", (0, 1), (1, 1)),
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("BOX", (0, 0), (-1, -1), 0.6, LINE),
        ("INNERGRID", (0, 0), (-1, -1), 0.35, LINE),
        ("LEFTPADDING", (0, 0), (-1, -1), 7),
        ("RIGHTPADDING", (0, 0), (-1, -1), 7),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(dashboard)
    story.extend([Spacer(1, 0.35 * cm), p("A barra Inputs/XSS em zero é resultado de cobertura, não ausência de análise: foram pesquisados sinks HTML/JavaScript, Markdown/HTML, URLs controladas e templates de e-mail. Não há biblioteca de sanitização instalada, mas também não foi localizado ponto que renderize HTML não confiável.", "small")])


def strengths_weaknesses(story: list):
    story.append(PageBreak())
    story.append(p("3. Pontos fortes e pontos fracos", "h1"))
    story.append(p("Pontos fortes", "h2"))
    for index, (title, text) in enumerate(STRENGTHS):
        if index == len(STRENGTHS) - 1:
            story.append(PageBreak())
        story.append(KeepTogether([p(title, "h3"), bullet(text, STRONG), Spacer(1, 0.1 * cm)]))
    weak_block = [p("Pontos fracos centrais", "h2")]
    weak_block.extend(bullet(text, HIGH) for text in WEAKNESSES)
    story.append(KeepTogether(weak_block))


def findings_table(story: list):
    story.append(PageBreak())
    story.append(p("4. Achados por categoria", "h1"))
    categories = [
        "Chaves expostas", "Permissão no navegador", "Isolamento/IDOR", "Sessão/autenticação", "Upload/DoS", "Deploy/hardening", "Inputs/XSS"
    ]
    for category in categories:
        story.append(p(category, "h2"))
        items = [item for item in FINDINGS if item["category"] == category]
        if not items:
            story.append(Table([[p("SEM ACHADOS", "chip"), p("Nenhuma falha verificável nesta categoria. Veja os pontos fortes e a metodologia de cobertura.", "table")]], colWidths=[2.4 * cm, 13.8 * cm], style=TableStyle([
                ("BACKGROUND", (0, 0), (0, 0), STRONG),
                ("BACKGROUND", (1, 0), (1, 0), PALE),
                ("BOX", (0, 0), (-1, -1), 0.5, LINE),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("LEFTPADDING", (0, 0), (-1, -1), 6),
                ("RIGHTPADDING", (0, 0), (-1, -1), 6),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ])))
            continue
        rows = [[p("Severidade", "table_head"), p("Arquivo:linha", "table_head"), p("Descrição", "table_head")]]
        for item in items:
            rows.append([
                severity_chip(item["severity"]),
                p("<br/>".join(escape(location) for location in item["locations"]), "table"),
                p(f"<b>{item['id']} - {escape(item['title'])}</b><br/>{escape(item['description'])}", "table"),
            ])
        table = Table(rows, colWidths=[2.1 * cm, 5.0 * cm, 9.1 * cm], repeatRows=1)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), NAVY),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, PALE]),
            ("GRID", (0, 0), (-1, -1), 0.4, LINE),
            ("VALIGN", (0, 0), (-1, -1), "TOP"),
            ("LEFTPADDING", (0, 0), (-1, -1), 6),
            ("RIGHTPADDING", (0, 0), (-1, -1), 6),
            ("TOPPADDING", (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
        ]))
        story.append(table)


def finding_details(story: list):
    story.append(PageBreak())
    story.append(p("5. Achados detalhados", "h1"))
    for index, item in enumerate(FINDINGS):
        if index:
            story.append(PageBreak())
        header = Table([[severity_chip(item["severity"]), p(item["category"], "small"), p(item["id"], "small")]], colWidths=[2.0 * cm, 11.5 * cm, 2.7 * cm], style=TableStyle([
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN", (2, 0), (2, 0), "RIGHT"),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 3),
        ]))
        story.extend([header, p(item["title"], "h1")])
        story.append(p("Descrição", "h2")); story.append(p(item["description"]))
        story.append(p("Evidência - arquivo por arquivo, linha por linha", "h2"))
        for location, evidence in zip(item["locations"], item["evidence"]):
            story.append(p(f"<b>{escape(location)}</b>", "small"))
            story.append(Table([[XPreformatted(escape(evidence), S["code"])]] , colWidths=[16.2 * cm], style=TableStyle([
                ("BACKGROUND", (0, 0), (-1, -1), PALE),
                ("BOX", (0, 0), (-1, -1), 0.45, LINE),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ])))
        story.append(p("Por que é explorável", "h2")); story.append(p(item["exploit"]))
        story.append(p("Condições de explorabilidade", "h2")); story.append(p(item["conditions"]))
        story.append(p("Correção recomendada", "h2")); story.append(p(item["recommendation"]))


def recommendations(story: list):
    story.append(PageBreak())
    story.append(p("6. Recomendações priorizadas", "h1"))
    priorities = [
        ("P1 - Bootstrap seguro e autorização de primeiro acesso", "Resolver SEC-01, SEC-02 e SEC-03 em conjunto antes de publicar nova instância: remover `admin/admin`, bloquear APIs durante troca pendente e revogar sessões concorrentes."),
        ("P2 - Prova de identidade para vínculo com jogador", "Substituir a associação aberta por convite/aprovação com verificação de e-mail (SEC-04). Revisar jogadores atualmente vinculados em instâncias existentes."),
        ("P3 - Controles de autenticação e transporte", "Aplicar rate limiting nos três logins e `Secure` + HTTPS/HSTS (SEC-05 e SEC-06). Tratar proxy como defesa adicional, não requisito invisível."),
        ("P4 - Redução do impacto de vazamento de banco", "Migrar sessões web para token hash e revogar registros legados (SEC-07)."),
        ("P5 - Proteção de upload", "Limitar streaming, concorrência, taxa e quota; introduzir ownership/estado temporário e garbage collection (SEC-08 e SEC-09)."),
        ("P6 - Hardening de build e OMV", "Retirar entitlements inseguros e criar perfil seccomp mínimo; reforçar supply chain com digest, assinatura e SBOM (SEC-10)."),
        ("P7 - Testes de regressão", "Adicionar testes específicos para os dez achados. Preservar os 240 testes atuais, que validam várias proteções já existentes."),
    ]
    for title, body in priorities:
        card = Table([[p(title, "h2")], [p(body)]], colWidths=[16.2 * cm], style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), PALE),
            ("LINEBEFORE", (0, 0), (0, -1), 4, STRONG if title.startswith(("P4", "P5", "P6", "P7")) else HIGH),
            ("BOX", (0, 0), (-1, -1), 0.45, LINE),
            ("LEFTPADDING", (0, 0), (-1, -1), 10),
            ("RIGHTPADDING", (0, 0), (-1, -1), 10),
            ("TOPPADDING", (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ]))
        story.extend([card, Spacer(1, 0.22 * cm)])


def methodology(story: list):
    story.append(PageBreak())
    story.append(p("7. Cobertura e limitações", "h1"))
    items = [
        "Revisão estática de todos os 47 `route.ts` em `app/api`, totalizando 98 exports de método HTTP quando wrappers móveis são contados.",
        "Cruzamento de gates `accountType`, `role`, `permissions`, `isAdmin` e `can*` do React/Expo com os endpoints chamados.",
        "Revisão dos helpers de autenticação, sessão, finanças, partidas, notificações, uploads, URLs públicas, e-mail e adapters D1/SQLite.",
        "Busca por sinks XSS/execução (`dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, Markdown/HTML) e por URLs em href/src/Linking.openURL.",
        "Busca de segredos em fonte, exemplos, Compose/Docker, Wrangler, documentação, 137 commits e bundles. Chaves `google-services.json` foram classificadas como identificadores cliente esperados; a segurança real delas depende de restrições no console Google, fora do código auditado.",
        "Execução da suíte: 240 testes passaram. `npm test` não iniciou devido a npm global quebrado no host; o comando equivalente `node --test tests/*.test.mjs` foi executado com sucesso.",
        "Sem teste dinâmico contra ambiente publicado, proxy, Cloudflare, conta Google/Firebase, SMTP, registry ou host OMV. Controles externos não versionados não foram presumidos.",
        "Worktree já continha alterações em `mobile/dist`; elas não foram modificadas nem usadas como fonte autoritativa, exceto no scan somente leitura de formatos de segredo.",
    ]
    for item in items:
        story.append(bullet(item, NAVY))


def github_issues(story: list):
    story.append(PageBreak())
    story.append(p("ISSUES PARA O GITHUB", "h1"))
    story.append(p("Os 10 achados foram agrupados em 7 issues para evitar duplicação. Cada bloco abaixo está completo e pronto para copiar e colar em Markdown."))
    for index, issue in enumerate(ISSUES):
        if index:
            story.append(PageBreak())
        story.append(p(f"Issue {issue['number']} de {len(ISSUES)}", "h2"))
        story.append(p(issue["title"], "h1"))
        text = f"--- ISSUE {issue['number']} ---\nTítulo: {issue['title']}\n\n{issue['body'].strip()}\n--- FIM ISSUE {issue['number']} ---"
        wrapper = TextWrapper(width=90, break_long_words=True, break_on_hyphens=False,
                              replace_whitespace=False, drop_whitespace=True)
        text = "\n".join(
            line if len(line) <= 90 else "\n".join(wrapper.wrap(line))
            for line in text.splitlines()
        )
        story.append(XPreformatted(escape(text), S["issue"]))


def build():
    story: list = []
    cover(story)
    stack_section(story)
    executive_summary(story)
    strengths_weaknesses(story)
    findings_table(story)
    finding_details(story)
    recommendations(story)
    methodology(story)
    github_issues(story)
    doc = AuditDocTemplate(str(OUTPUT))
    doc.build(story)
    print(OUTPUT)


if __name__ == "__main__":
    build()
