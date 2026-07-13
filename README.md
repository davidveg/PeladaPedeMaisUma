# Pelada Pede Mais Uma

Aplicação web responsiva para importar confirmações do WhatsApp, identificar jogadores e criar dois times equilibrados — Time Azul e Time Amarelo. A aplicação inclui área pública, histórico persistente e painel administrativo.

## Recursos implementados

- Parser de listas do WhatsApp: reconhece ✅, ❌, campos vazios, caracteres invisíveis, data, título, ausentes e duplicidades.
- Correspondência por nome de exibição, nome completo, apelido e aliases; sugestões ambíguas nunca são vinculadas automaticamente.
- Cadastro reutilizável de mensalistas, convidados e goleiros, com notas decimais de 1 a 5.
- Algoritmo heurístico que testa milhares de combinações e prioriza quantidade, posições, velocidade, habilidade, marcação, médias e proteção do quartil superior no caso ímpar.
- Propostas temporárias, nova proposta, ajuste manual, métricas, confirmação e snapshots históricos imutáveis.
- Compartilhamento pelo clipboard em formato simples ou com pontuações.
- Banco D1 e R2 no ambiente Cloudflare; SQLite e filesystem na edição self-hosted em Node.
- Painel administrativo com jogadores, administradores, configurações e exclusão lógica.
- Primeiro administrador `admin` / `admin`, com troca obrigatória por e-mail válido e senha de 8+ caracteres.
- Senhas com PBKDF2-SHA-256, salt aleatório e 210 mil iterações; sessão em cookie HTTP-only/SameSite.
- Auditoria de operações administrativas.

## Execução local

Requer Node.js 22.13 ou superior.

```bash
npm ci
npm run dev
```

Abra a URL local mostrada no terminal. No primeiro acesso administrativo use `admin` / `admin`; a aplicação exigirá a troca imediata.

Para validar:

```bash
npm test
npm run build
```

## Banco de dados e migrações

O schema declarativo está em `db/schema.ts`; a migração inicial está em `drizzle/0000_initial.sql`. Em desenvolvimento, as tabelas também são inicializadas de forma idempotente na primeira requisição. Para gerar uma nova migração após alterar o schema:

```bash
npm run db:generate
```

O uso de consultas preparadas protege contra injeção SQL. Separações salvam um snapshot JSON completo, portanto alterações futuras no cadastro não mudam partidas antigas. Exclusões de jogadores e separações são lógicas.

### Backup

No ambiente hospedado, exporte o banco D1 com as ferramentas de backup/exportação da plataforma antes de mudanças estruturais. Na edição self-hosted, pare o container e copie todo o conteúdo de `/data`: o banco fica em `/data/pelada.sqlite` e as fotos em `/data/uploads`. Copiar o diretório com o serviço parado também preserva corretamente os arquivos auxiliares WAL do SQLite.

### Evolução para PostgreSQL

As entidades e o acesso estão isolados em `db/` e `lib/database.ts`. Para migrar: crie o schema PostgreSQL equivalente, exporte jogadores/configurações/admins/separações, converta inteiros booleanos, importe snapshots sem transformá-los, troque o driver Drizzle e execute testes de contagem e integridade. IDs UUID em texto e datas ISO evitam acoplamento ao SQLite.

## SMTP e recuperação de senha

No OMV, a recuperação envia um link de uso único para o e-mail do administrador. O token é armazenado somente como hash, expira em 30 minutos, invalida todas as sessões após a troca e limita novas solicitações a uma por minuto e cinco por hora por conta.

Para enviar pela conta `peladapedemaisuma@gmail.com`:

1. Ative a verificação em duas etapas na conta Google.
2. Gere uma [senha de app do Google](https://support.google.com/mail/answer/185833?hl=pt-BR) com um nome como `Pelada OMV`.
3. No arquivo de ambiente da pilha do OMV, configure apenas o segredo e a URL pública real:

```dotenv
APP_BASE_URL=https://pelada.seudominio.com
SMTP_PASSWORD=senha-de-app-de-16-caracteres
```

O `docker-compose.omv.yml` já define `smtp.gmail.com`, porta `465`, TLS, usuário e remetente. Não use a senha normal da conta Google e nunca versione a senha de app. Caso a senha principal da conta seja alterada, o Google revoga as senhas de app e será necessário gerar outra.

## Logs operacionais

A aplicação escreve eventos em JSON, uma linha por evento, diretamente em stdout/stderr. Os campos principais são `timestamp`, `level`, `service`, `event`, `requestId`, `method`, `path`, `status` e `durationMs`; exceções incluem nome, mensagem e stack. E-mails, senhas, tokens, cookies, corpos e query strings não são registrados.

No OMV, `LOG_LEVEL` aceita `debug`, `info`, `warn` ou `error` e usa `info` por padrão. O Compose mantém cinco arquivos de log de até 10 MB cada e adiciona labels para descoberta por Promtail ou Grafana Alloy. Com os logs enviados ao Loki, uma consulta LogQL inicial é:

```logql
{container="pelada-pede-mais-uma"} | json
```

Para mostrar apenas falhas:

```logql
{container="pelada-pede-mais-uma"} | json | level="error"
```

O nome exato do label `container` depende das regras configuradas no coletor. O endpoint `/api/health` informa a situação do banco e se o SMTP está configurado, mas a ausência de SMTP não torna o serviço indisponível.

## API

As rotas retornam JSON:

- `GET/POST/PUT/DELETE /api/players` — jogadores (escritas exigem administrador).
- `GET/POST/DELETE /api/separations` — histórico e confirmação.
- `GET/PUT /api/config` — critérios de equilíbrio.
- `GET/POST/PUT/DELETE /api/auth` — sessão, login, primeiro acesso e logout.
- `POST/PUT /api/password-reset` — solicitação e conclusão da redefinição de senha.
- `GET/POST/PUT /api/administrators` — administração de contas.
- `GET/POST /api/upload` — leitura e envio validado de fotos ao R2.

Exemplo de criação de jogador:

```json
{
  "fullName": "João da Silva",
  "displayName": "João",
  "nickname": "Joca",
  "aliases": ["João S."],
  "type": "guest",
  "primaryPosition": "Meio-campo",
  "speed": 3.5,
  "skill": 4.25,
  "active": true
}
```

## Algoritmo

A nota individual é `velocidade × pesoVelocidade + habilidade × pesoHabilidade + marcação × pesoMarcação`. Os padrões são 48%, 32% e 20%, preservando a proporção anterior entre velocidade e habilidade ao incluir marcação. Os três pesos podem ser ajustados na área administrativa e sempre somam 100%. Cada tentativa monta times com tamanhos alternados, trata goleiros separadamente e calcula custo com penalidade máxima para quantidade, muito alta para posições e ponderada pelos três atributos. A melhor combinação é escolhida; aleatoriedade controlada produz propostas alternativas sem aceitar uma degradação grande. Em total ímpar, o excedente é escolhido entre jogadores fora do grupo superior protegido (25% por padrão).

## Segurança e produção

Use HTTPS, mantenha cookies `Secure` no ambiente de produção, aplique rate limiting no gateway às rotas `/api/auth` e de recuperação, configure política de acesso administrativo, monitore auditoria e faça rotação de segredos. Fotos aceitam somente JPEG, PNG e WebP até 5 MB e recebem nomes aleatórios. A aplicação não retorna hashes nem tokens em APIs.

## Contêineres

O projeto mantém somente três arquivos Compose, um para cada cenário suportado:

| Arquivo | Uso | Runtime e persistência |
| --- | --- | --- |
| `docker-compose.yml` | Execução padrão em PC/servidor compatível | Wrangler/workerd com D1 e R2 locais |
| `docker-compose.dev.yml` | Desenvolvimento com recarga automática | Vinext, código montado e volumes de desenvolvimento |
| `docker-compose.omv.yml` | Raspberry Pi ARM64 com OMV 7 | Node 22, SQLite e fotos no filesystem |

### Execução padrão

```bash
cp .env.docker.example .env
docker compose up -d --build
docker compose logs -f app
```

Acesse `http://localhost:3000`. O Compose padrão usa `Dockerfile.multiarch` e requer um kernel compatível com workerd. O binário ARM64 oficial exige `crc32` e espaço virtual de 48 bits; no Raspberry/OMV com espaço virtual de 39 bits, use exclusivamente o Compose do OMV.

Para encerrar sem apagar os dados:

```bash
docker compose down
```

Use `docker compose down -v` somente quando quiser apagar definitivamente o volume persistente.

### Desenvolvimento com recarga automática

```bash
docker compose -f docker-compose.dev.yml up --build
```

O código-fonte é montado no container, enquanto dependências e estado local ficam em volumes nomeados.

### Raspberry Pi ARM64 com OMV 7

No terminal do Raspberry Pi, confirme primeiro que o OMV está executando em 64 bits:

```bash
uname -m
```

O resultado deve ser `aarch64` ou `arm64`. `armv7l` indica um sistema de 32 bits e não é compatível com o runtime; nesse caso é necessário instalar uma versão ARM64 do Raspberry Pi OS/OMV.

Use `Dockerfile.selfhost.omv` e o modelo completo `docker-compose.omv.yml`. A execução usa somente Node, portanto funciona também no kernel Raspberry com espaço virtual de 39 bits.

O sandbox padrão do BuildKit desse OMV encerra o npm com `SIGSYS` durante o build. Antes do primeiro build, crie uma única vez o builder dedicado abaixo como `root`:

```bash
docker buildx create \
  --name pelada-arm64 \
  --driver docker-container \
  --platform linux/arm64 \
  --buildkitd-flags '--allow-insecure-entitlement security.insecure' \
  --use \
  --bootstrap
docker buildx use --global pelada-arm64
docker buildx inspect pelada-arm64 --bootstrap
```

Na saída, `Flags` deve conter `--allow-insecure-entitlement security.insecure`. Essa autorização vale para o builder. No runtime, o modelo do OMV mantém o usuário `1000:100`, remove todas as capabilities e ativa `no-new-privileges`; ele também usa `seccomp:unconfined` porque o perfil seccomp desse Docker/OMV encerra o Node no Raspberry com `SIGSYS` (código 159), antes da emissão de logs.

Antes de subir o serviço, crie o diretório persistente usando o caminho real do compartilhamento `DockerData` configurado no OMV:

```bash
mkdir -p /srv/dev-disk-by-uuid-SEU_UUID/DockerData/pelada-pede-mais-uma
chown -R 1000:100 /srv/dev-disk-by-uuid-SEU_UUID/DockerData/pelada-pede-mais-uma
chmod 750 /srv/dev-disk-by-uuid-SEU_UUID/DockerData/pelada-pede-mais-uma
```

No plugin Compose, mantenha o arquivo da pilha um nível acima do checkout:

```text
pelada-pede-mais-uma/
├── docker-compose.yml       # conteúdo de docker-compose.omv.yml
└── source/                  # checkout do repositório
    ├── Dockerfile.selfhost.omv
    └── ...
```

No OMV, execute **Check**, **Build** e **Up**, nessa ordem. Não use **Pull**: a imagem `pelada-pede-mais-uma:selfhost-arm64` é construída localmente e não existe em um registry. Acesse `http://IP_DO_RASPBERRY:3000`. Na inicialização, os logs JSON devem mostrar os eventos `application_starting` e `database_ready`.

O primeiro login administrativo continua sendo `admin` / `admin`, com troca obrigatória no primeiro acesso. Para backup, pare o serviço e copie a pasta `pelada-pede-mais-uma` dentro de `DockerData`. Para restaurar, devolva a pasta ao mesmo caminho, confirme o proprietário `1000:100` e inicie o serviço.
