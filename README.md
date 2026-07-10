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

## Contêiner

`Dockerfile` e `docker-compose.yml` oferecem uma embalagem de build/execução. Para hospedagem oficial, use as vinculações D1/R2 descritas em `.openai/hosting.json`.
