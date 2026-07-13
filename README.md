# Pelada Pede Mais Uma

Aplicação web responsiva para importar confirmações do WhatsApp, identificar jogadores e criar dois times equilibrados — Time Azul e Time Amarelo. A aplicação inclui área pública, histórico persistente e painel administrativo.

## Recursos implementados

- Parser de listas do WhatsApp: reconhece ✅, ❌, campos vazios, caracteres invisíveis, data, título, ausentes e duplicidades.
- Correspondência por nome de exibição, nome completo, apelido e aliases; sugestões ambíguas nunca são vinculadas automaticamente.
- Cadastro reutilizável de mensalistas, convidados e goleiros, com notas decimais de 1 a 5.
- Algoritmo heurístico que testa milhares de combinações e prioriza quantidade, posições, velocidade, habilidade, médias e proteção do quartil superior no caso ímpar.
- Propostas temporárias, nova proposta, ajuste manual, métricas, confirmação e snapshots históricos imutáveis.
- Compartilhamento pelo clipboard em formato simples ou com pontuações.
- Banco D1 (SQLite compatível) para dados relacionais e R2 para fotos.
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

No ambiente hospedado, exporte o banco D1 com as ferramentas de backup/exportação da plataforma antes de mudanças estruturais. Em uma instalação SQLite alternativa, pare gravações e copie o arquivo `.sqlite` junto com as imagens; prefira `sqlite3 banco.sqlite ".backup backup.sqlite"` para cópia consistente.

### Evolução para PostgreSQL

As entidades e o acesso estão isolados em `db/` e `lib/database.ts`. Para migrar: crie o schema PostgreSQL equivalente, exporte jogadores/configurações/admins/separações, converta inteiros booleanos, importe snapshots sem transformá-los, troque o driver Drizzle e execute testes de contagem e integridade. IDs UUID em texto e datas ISO evitam acoplamento ao SQLite.

## SMTP e recuperação de senha

Copie `.env.example` para `.env.local` e configure host, porta, usuário, senha e remetente. Segredos devem ser configurados no ambiente de hospedagem e nunca versionados. A estrutura `password_reset_tokens` já prevê hash, expiração e uso único; o provedor SMTP deve ser ligado à rota de recuperação antes de uso em produção.

## API

As rotas retornam JSON:

- `GET/POST/PUT/DELETE /api/players` — jogadores (escritas exigem administrador).
- `GET/POST/DELETE /api/separations` — histórico e confirmação.
- `GET/PUT /api/config` — critérios de equilíbrio.
- `GET/POST/PUT/DELETE /api/auth` — sessão, login, primeiro acesso e logout.
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

A nota individual é `velocidade × pesoVelocidade + habilidade × pesoHabilidade` (60/40 por padrão). Cada tentativa monta times com tamanhos alternados, trata goleiros separadamente e calcula custo com penalidade máxima para quantidade, muito alta para posições e alta para velocidade e pontuação. A melhor combinação é escolhida; aleatoriedade controlada produz propostas alternativas sem aceitar uma degradação grande. Em total ímpar, o excedente é escolhido entre jogadores fora do grupo superior protegido (25% por padrão).

## Segurança e produção

Use HTTPS, mantenha cookies `Secure` no ambiente de produção, aplique rate limiting no gateway às rotas `/api/auth` e de recuperação, configure política de acesso administrativo, monitore auditoria e faça rotação de segredos. Fotos aceitam somente JPEG, PNG e WebP até 5 MB e recebem nomes aleatórios. A aplicação não retorna hashes nem tokens em APIs.

## Contêineres

A imagem de produção executa o Worker com D1 e R2 locais. Banco, sessões e uploads ficam no volume persistente `/data`, portanto sobrevivem à substituição do container.

### Produção com Docker Compose

O Compose principal usa `Dockerfile.multiarch` e seleciona automaticamente uma imagem nativa para `linux/amd64` (PCs e servidores Intel/AMD) ou `linux/arm64` (Raspberry Pi com sistema operacional de 64 bits). O `Dockerfile` original foi mantido como alternativa legada.

```bash
cp .env.docker.example .env
docker compose up -d --build
docker compose ps
```

Acesse `http://localhost:3000`. O primeiro login administrativo continua sendo `admin` / `admin`, com troca obrigatória no primeiro acesso.

Para acompanhar ou encerrar:

```bash
docker compose logs -f app
docker compose down
```

`docker compose down` preserva o volume. Use `docker compose down -v` somente quando quiser apagar definitivamente banco, sessões e uploads.

### Raspberry Pi, ARM64 e OMV 7

No terminal do Raspberry Pi, confirme primeiro que o OMV está executando em 64 bits:

```bash
uname -m
```

O resultado deve ser `aarch64` ou `arm64`. `armv7l` indica um sistema de 32 bits e não é compatível com o runtime; nesse caso é necessário instalar uma versão ARM64 do Raspberry Pi OS/OMV.

No plugin Compose do OMV 7, use `platform: linux/arm64` e `security_opt: [seccomp:unconfined]`. O perfil é necessário em alguns kernels de Raspberry Pi porque o perfil seccomp padrão pode bloquear uma syscall do workerd com código de saída 159. Fora do plugin, o arquivo `docker-compose.arm64.yml` já fornece esse ajuste:

```bash
cp .env.docker.example .env
docker compose -f docker-compose.yml -f docker-compose.arm64.yml build --pull --no-cache app
docker compose -f docker-compose.yml -f docker-compose.arm64.yml up -d
docker compose -f docker-compose.yml -f docker-compose.arm64.yml logs -f app
```

Durante o build, a mensagem `Pacote @cloudflare/workerd-linux-arm64 ... instalado` confirma que o binário correto foi encontrado. Ele não é iniciado durante o build para evitar o bloqueio seccomp dessa etapa. O primeiro build pode demorar alguns minutos no Raspberry Pi. Banco e fotos continuam persistidos no volume configurado.

Para usar explicitamente o Dockerfile antigo em um PC, execute:

```bash
docker build -f Dockerfile -t pelada-pede-mais-uma:legacy .
```

Para publicar uma única tag multi-arquitetura em um registry a partir de uma máquina com Buildx:

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f Dockerfile.multiarch \
  -t SEU_REGISTRY/pelada-pede-mais-uma:latest \
  --push .
```

### Desenvolvimento com recarga automática

```bash
docker compose -f docker-compose.dev.yml up --build
```

O código-fonte é montado no container, enquanto dependências e estado local ficam em volumes nomeados.

### Imagem sem Compose

```bash
docker build -t pelada-pede-mais-uma:latest .
docker volume create pelada-pede-mais-uma-data
docker run -d --name pelada \
  -p 3000:3000 \
  -v pelada-pede-mais-uma-data:/data \
  --restart unless-stopped \
  pelada-pede-mais-uma:latest
```

### Publicação em qualquer plataforma de containers

Faça push da imagem para Docker Hub, GHCR, ECR, GCR ou outro registry e configure na plataforma:

- Porta HTTP: `3000` ou o valor informado em `PORT`.
- Healthcheck: `GET /api/health`.
- Volume persistente montado em `/data`.
- Variáveis SMTP somente quando o envio de e-mails estiver configurado.
- HTTPS no proxy ou balanceador da plataforma.
- Uma única réplica quando usar o armazenamento D1/R2 local do container. Para várias réplicas, use o deploy nativo Cloudflare/Sites ou migre o armazenamento para serviços externos compartilhados.

O processo roda como usuário sem privilégios, possui healthcheck, recebe encerramento gracioso e não requer recursos Cloudflare externos para a execução em container.
