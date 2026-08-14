# Pelada Pede Mais Uma

Aplicação web responsiva e aplicativo Expo/React Native para organizar peladas, confirmar presenças, montar times equilibrados, registrar resultados e acompanhar a evolução dos jogadores.

O mesmo código pode atender vários grupos em implantações independentes. Cada instância mantém identidade visual, agenda, banco de dados, uploads e configurações próprias.

Documentação complementar:

- [Aplicativo mobile](mobile/README.md)
- [API mobile em OpenAPI](docs/mobile-openapi.yaml)
- [Operação de múltiplas peladas](docs/MULTI_INSTANCE.md)
- [Notas da versão 1.0](RELEASE_NOTES_1.0.0.md)

## Visão geral

### Área pública

- Lista pública de jogadores separada entre jogadores de linha e goleiros.
- Ordenação crescente e decrescente por nome, tipo, posição, atributos, momentum, histórico e overall.
- Cards completos com foto, atributos, overall com uma casa decimal, jogos, vitórias, derrotas, gols e assistências.
- Cards opcionais por nível — Bronze, Prata, Ouro e Lendário — com limites configuráveis.
- Separações salvas com link público permanente, times, regras utilizadas, ordem de chegada, placar, súmula e resultado da votação.
- Página pública de estatísticas com período mensal, anual ou personalizado:
  - ranking de gols, assistências e participações;
  - ranking de assiduidade;
  - comparação direta entre dois jogadores;
  - opção de incluir ou ocultar convidados.
- Página oficial para download das versões Android e iOS publicadas pelos administradores.

### Jogadores e contas

- Cadastro de mensalistas, convidados e goleiros.
- Correspondência por nome de exibição, nome completo, apelido e aliases.
- Foto individual com avatar padrão quando não houver imagem.
- Notas decimais entre 1 e 5:
  - jogadores de linha: Velocidade, Habilidade e Marcação;
  - goleiros: Habilidade, Posicionamento e Saída de Gol;
  - todos os jogadores: Momentum.
- Contas comuns e administrativas podem ser associadas a um jogador.
- Cada conta aceita um único jogador e cada jogador aceita um único login, independentemente do tipo da conta.
- A área **Minha conta** permite visualizar o card e atualizar foto, nome completo, apelido, posição e observações.
- Recuperação de senha por e-mail para administradores e contas de jogadores.
- Administradores podem redefinir uma senha temporária de conta de jogador e revogar todas as sessões anteriores.
- Perfil intermediário de **moderador**, promovido a partir de uma conta de jogador e sempre reversível pelo administrador.
- Permissões granulares de moderador para jogadores e notas, partidas, presenças, cancelamentos, separações, súmula/resultados, votos do Modo Carreira e pesos do algoritmo.
- Moderadores mantêm a associação com seu jogador e nunca podem promover, reverter ou alterar permissões de outras contas.

### Agenda, presenças e notificações

- Criação administrativa de partidas com título, data, horário, local e prazo de confirmação.
- Confirmação de presença ou ausência pelo jogador associado.
- Limite configurável de alterações da resposta.
- Respostas compartilhadas entre site e aplicativo.
- Administradores podem responder por jogadores sem conta vinculada.
- Lista de espera opcional para convidados, desativada por padrão e configurável em **Identidade e agenda**.
- Quando ativada, somente administradores colocam convidados na lista de espera e aprovam sua presença após presentes + espera atingirem o limite configurado (16 por padrão).
- Convidados na espera aparecem na parcial do WhatsApp sem `✅`, não contam como presentes ou pendentes e não entram na geração dos times até a aprovação final.
- Fechamento antecipado da lista e geração automática de uma separação equilibrada.
- Cancelamento e edição de partidas com auditoria.
- Central de notificações por conta, com paginação e marcação de itens lidos.
- Preferências individuais para:
  - partidas e alterações;
  - confirmações de presença;
  - separações geradas;
  - atualizações do aplicativo;
  - lembretes de votação do Modo Carreira.
- Push Android/iOS via Expo quando disponível. A central interna continua funcionando mesmo sem push.

### Importação e separação dos times

- O fluxo principal parte das presenças registradas em **Partidas**: o administrador fecha a lista e gera os times com os jogadores confirmados.
- A importação manual de uma lista copiada do WhatsApp é opcional, vem desativada por padrão e pode ser reativada em **Painel administrativo → Identidade e agenda → Formas de montar times**.
- Ao desativar a importação manual, o site oculta **Montar times** e o aplicativo oculta **Nova**, preservando integralmente a geração iniciada por uma partida e todas as separações já salvas.
- Parser de listas do WhatsApp com suporte a confirmações, ausências, campos vazios, caracteres Unicode invisíveis, datas, títulos e duplicidades.
- Reconhecimento das seções **Goleiros**, **Mensalistas** e **Convidados**.
- Jogadores desconhecidos ou ambíguos nunca são vinculados automaticamente.
- Propostas calculadas pelo algoritmo oficial do servidor.
- Rascunhos de Separação opcionais, desativados por padrão e configuráveis em **Painel administrativo → Separações**.
- Quando ativados, a partida mantém o caminho direto **Fechar lista e gerar times** e ganha o caminho adicional **Criar/Editar rascunho de separação**. Site e aplicativo compartilham o mesmo rascunho.
- Dentro do rascunho, o administrador pode apenas salvá-lo — mantendo a lista aberta e sem notificações — ou usar **Fechar lista e publicar**, que cria a separação oficial e notifica os jogadores.
- A configuração dos rascunhos é independente do Modo Carreira e não altera o estado das demais funcionalidades.
- Se a lista de presentes mudar, o rascunho é marcado como desatualizado e uma nova proposta precisa ser validada antes da publicação oficial.
- Nova proposta, troca manual entre equipes, métricas e indicador de equilíbrio.
- Nomes e cores das duas equipes configuráveis por instância; os padrões são Time Azul e Time Amarelo.
- Criação e confirmação de separações exclusivas para administradores.
- Snapshot histórico das equipes e das regras utilizadas, preservando a partida mesmo após alterações futuras nos cadastros.
- Ordem de chegada independente para cada equipe, editável e confirmável novamente.
- Compartilhamento dos times e do link público pelo WhatsApp.

### Modo Carreira

- Confirmação administrativa do placar.
- Bônus de momentum para a equipe vencedora e ônus para a perdedora.
- Empates não alteram o momentum das equipes.
- Rascunho de súmula otimizado para celular e tablet.
- Registro opcional de gols, assistências e gols contra.
- Correção administrativa posterior de placar e súmula sem duplicar momentum.
- Estatísticas acumuladas de jogos, vitórias, derrotas, gols e assistências.
- Votação dos três melhores e três piores jogadores da partida.
- Seletores de votação com foto atual, nome e avatar padrão para facilitar a identificação dos participantes no site e no aplicativo.
- Link compartilhável e QR Code para a votação.
- Encerramento automático pelo prazo ou antecipado pelo administrador.
- Revisão e remoção administrativa de votos somente enquanto a votação estiver aberta.
- Compartilhamento do resultado final da votação pelo WhatsApp.
- Momentum separado por origem: resultados de partidas e votações.
- Multiplicadores independentes e configuráveis para o Momentum de resultados e o Momentum das votações.
- Temporadas automáticas com duração configurável entre 1 e 120 meses; a primeira virada é agendada por padrão para o fim do ano corrente.
- Na virada da temporada, os dois saldos de Momentum são zerados sem apagar jogos, vitórias, derrotas, gols, assistências ou o histórico das partidas.
- Partidas e votações de temporadas anteriores permanecem consultáveis, mas não reaplicam Momentum na temporada atual.

#### Regras da votação

A votação exige autenticação. O servidor usa exclusivamente o jogador associado à sessão web ou ao token do aplicativo; a identidade não é escolhida pelo navegador.

Para votar, a conta deve:

1. estar autenticada;
2. possuir um jogador associado;
3. ter participado da separação;
4. ainda não ter votado;
5. estar dentro do prazo configurado.

O jogador não pode votar em si mesmo, não pode repetir candidatos entre os seis lugares e não pode votar duas vezes usando site e aplicativo. Cada voto fica associado ao jogador e à conta autenticada.

O 1º lugar recebe 3 pontos, o 2º recebe 2 e o 3º recebe 1. Empates são resolvidos por quantidade de votos em 1º, depois em 2º e em 3º. Após o encerramento, novos votos e remoções são bloqueados e o momentum é aplicado uma única vez.

### Painel administrativo

O painel possui:

- visão geral com jogadores, convidados, separações, administradores, contas, pesos do algoritmo e estados do Modo Carreira;
- jogadores e goleiros em tabelas separadas e ordenáveis;
- partidas e presenças;
- versões do aplicativo Android/iOS;
- separações salvas;
- administradores;
- contas de jogadores e associações;
- moderadores e suas permissões;
- identidade, agenda, nomes e cores das equipes;
- ativação e limite da lista de espera administrativa de convidados;
- ativação opcional da importação manual por lista do WhatsApp, compartilhada entre site e aplicativo;
- configurações de equilíbrio;
- configurações, votos e encerramento do Modo Carreira;
- auditoria pesquisável, filtrável e paginada.

A auditoria carrega 10 eventos por página por padrão e permite 10, 25, 50 ou 100 eventos.

### Aplicativo mobile

O diretório [`mobile/`](mobile/) contém um aplicativo Expo/React Native para iOS e Android. O backend web continua sendo a fonte oficial dos dados e das regras.

O aplicativo oferece:

- login de jogador ou administrador;
- tokens nativos com refresh rotativo;
- partidas, confirmações de presença e notificações;
- lista de espera e aprovação administrativa de convidados quando a funcionalidade estiver habilitada;
- separações salvas e card do jogador;
- criação de separações para administradores a partir das presenças de uma partida;
- importação manual por lista do WhatsApp quando habilitada na configuração da instância;
- ordem de chegada por equipe;
- rascunho e confirmação de resultado;
- compartilhamento pelo WhatsApp;
- ajuste administrativo dos pesos de Velocidade, Habilidade e Marcação;
- cache offline somente para leitura;
- push notifications em development builds e builds distribuídos;
- verificação da versão instalada e orientação para atualização.

Administradores publicam versão, build mínimo, links Android/iOS e notas da versão pelo painel. A publicação atualiza a página `/baixar-app` e notifica os usuários. O rodapé do site também aponta para essa página.

## Tecnologias

### Aplicação web e API

- Node.js 22
- React 19
- Next.js/Vinext
- TypeScript
- Cloudflare D1 e R2 no ambiente hospedado
- SQLite e filesystem no ambiente self-hosted
- Drizzle ORM/Kit para definição e evolução do schema
- Nodemailer para SMTP
- QRCode para links de votação

### Aplicativo

- Expo SDK 56 e React Native
- Expo Router
- TanStack Query
- React Hook Form e Zod
- SecureStore
- Expo Notifications e Expo Updates
- EAS Build

## Execução local da aplicação web

Requer Node.js `22.13` ou superior.

```bash
npm ci
npm run dev
```

Abra a URL exibida no terminal. No primeiro acesso self-hosted, use `admin` / `admin`; o sistema exige imediatamente um e-mail válido e uma senha de pelo menos 8 caracteres.

Validação:

```bash
npm test
npm run build
```

## Execução local do aplicativo

```bash
cd mobile
cp .env.example .env
npm ci
npm start
```

Configure `EXPO_PUBLIC_API_BASE_URL` e `EXPO_PUBLIC_WEB_BASE_URL` com um endereço que o aparelho consiga alcançar. Em um telefone físico, `localhost` aponta para o próprio telefone; durante o desenvolvimento, use o IP da máquina na rede local.

Comandos úteis:

```bash
npm run android
npm run ios
npm run typecheck
npm test
```

Consulte [mobile/README.md](mobile/README.md) para builds EAS, testes Maestro, segurança dos tokens e publicação nas lojas.

## Configuração de ambiente

Copie `.env.example` ou `.env.docker.example` conforme o ambiente. Nunca versione segredos.

| Variável | Finalidade |
| --- | --- |
| `APP_BASE_URL` | URL HTTPS canônica usada em links públicos, votação, redefinição de senha e notificações |
| `WEATHER_GEOCODING_URL` | Endpoint Nominatim usado para resolver o endereço da partida; pode apontar para uma instância própria |
| `WEATHER_FORECAST_URL` | Endpoint Locationforecast 2.0 do MET Norway ou proxy compatível |
| `WEATHER_FALLBACK_FORECAST_URL` | Endpoint secundário Open-Meteo usado automaticamente quando o provedor principal não responde |
| `WEATHER_CONTACT_EMAIL` | Contato enviado aos provedores no `User-Agent`; recomendado para identificar corretamente a instância |
| `SMTP_HOST` | Servidor SMTP |
| `SMTP_PORT` | Porta SMTP |
| `SMTP_SECURE` | Ativa TLS direto, normalmente `true` na porta 465 |
| `SMTP_USER` | Usuário SMTP |
| `SMTP_PASSWORD` | Senha de aplicativo ou segredo SMTP |
| `SMTP_FROM` | Nome e endereço do remetente |
| `LOG_LEVEL` | `debug`, `info`, `warn` ou `error` |
| `HOST_PORT` | Porta publicada pelo Compose |
| `INSTANCE_DATA_PATH` | Diretório persistente exclusivo da instância no OMV |
| `LOGGING_JOB_NAME` | Identificador usado por Promtail/Grafana Alloy |

### Gmail

Para enviar com uma conta Google:

1. ative a verificação em duas etapas;
2. gere uma [senha de app do Google](https://support.google.com/mail/answer/185833?hl=pt-BR);
3. configure a senha de app em `SMTP_PASSWORD`;
4. não use a senha normal da conta e não versione o segredo.

Exemplo:

```dotenv
APP_BASE_URL=https://pelada.seudominio.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=peladapedemaisuma@gmail.com
SMTP_PASSWORD=senha-de-app
SMTP_FROM="Pelada Pede Mais Uma <peladapedemaisuma@gmail.com>"
LOG_LEVEL=info
```

Os links de redefinição são de uso único, armazenados somente como hash e expiram em 30 minutos. Uma redefinição concluída revoga as sessões anteriores.

### Previsão do tempo

A previsão usa o endereço completo da partida e, quando ele não é localizado, o endereço padrão salvo em **Partidas** no painel administrativo. O servidor persiste coordenadas e previsão no banco da própria instância e renova o resultado no máximo uma vez por hora. Partidas com mais de nove dias exibem uma mensagem até entrarem na janela do provedor.

O padrão usa Nominatim/OpenStreetMap para geocodificação e MET Norway Locationforecast 2.0 para clima. Se o geocodificador estiver temporariamente inacessível, a localização padrão do Rio de Janeiro ainda possui coordenadas de contingência; se o MET Norway falhar, o servidor tenta automaticamente o Open-Meteo. O Nominatim público limita o uso a uma requisição por segundo e exige cache e identificação; o serviço implementa essas proteções. Para uma operação com volume maior, configure `WEATHER_GEOCODING_URL` para uma instância própria ou outro endpoint compatível.

## Banco de dados e migrações

O schema declarativo está em [`db/schema.ts`](db/schema.ts) e as migrações incrementais em [`drizzle/`](drizzle/).

```bash
npm run db:generate
```

Em desenvolvimento e no runtime self-hosted, a inicialização também verifica e cria estruturas ausentes de forma idempotente.

Características de persistência:

- consultas preparadas;
- UUIDs em texto;
- datas em ISO 8601;
- snapshots JSON das separações;
- exclusão lógica de jogadores e separações;
- associação exclusiva entre conta e jogador;
- idempotência nas mutações administrativas do aplicativo;
- armazenamento apenas de hashes dos tokens de recuperação e refresh.

### Backup self-hosted

Pare o container e copie todo o diretório montado em `/data`:

- banco: `/data/pelada.sqlite`;
- fotos: `/data/uploads`;
- arquivos auxiliares SQLite/WAL no mesmo diretório.

Copiar a pasta com o serviço parado garante um backup consistente. Para restaurar, devolva a pasta, confirme o proprietário usado pelo container e inicie o serviço.

## Algoritmo de equilíbrio

Para jogadores de linha, o overall base usa:

```text
Velocidade × pesoVelocidade
+ Habilidade × pesoHabilidade
+ Marcação × pesoMarcação
+ Momentum de vitórias e derrotas
+ Momentum das votações × multiplicadorMomentum
```

Goleiros usam Habilidade, Posicionamento e Saída de Gol na mesma escala. O resultado final é limitado entre 1 e 5 e arredondado para uma casa decimal.

Pesos padrão:

- Velocidade: 48%;
- Habilidade: 32%;
- Marcação: 20%;
- Peso do Momentum de vitórias e derrotas: 1,0 (fixo);
- Multiplicador do Momentum das votações: 1,0.

O algoritmo testa milhares de combinações, prioriza a diferença de quantidade, penaliza desequilíbrio de posições e compara atributos e médias. Quando há dois ou mais convidados, também distribui esse grupo com a menor diferença possível entre as equipes (por exemplo, dois convidados ficam em uma divisão 1 × 1 e cinco convidados em 3 × 2). Em listas ímpares, protege por padrão o quartil superior contra a equipe excedente. Administradores podem gerar novas propostas e fazer ajustes manuais antes de confirmar.

## Gols, assistências e histórico

Quando a funcionalidade estiver ativa, cada gol do placar exige um evento correspondente:

- gol normal pode ter assistência opcional do mesmo time;
- o autor não pode assistir o próprio gol;
- gol contra é marcado como **GC**;
- GC entra no placar, não aceita assistência e não entra no histórico de gols do jogador.

Somente a confirmação oficial do resultado atualiza estatísticas e momentum. O rascunho da súmula não produz efeitos definitivos.

## Páginas principais

| Página | Finalidade |
| --- | --- |
| `/` | Organização e criação de times para administradores |
| `/admin` | Painel completo para administradores e painel limitado às permissões concedidas para moderadores |
| `/jogadores` | Lista pública e cards |
| `/separacoes-salvas` | Histórico público das separações |
| `/estatisticas` | Rankings e confrontos |
| `/partidas` | Agenda e confirmação de presença |
| `/notificacoes` | Central da conta autenticada |
| `/conta` | Login, associação e perfil |
| `/votacao?token=...` | Votação autenticada do Modo Carreira |
| `/sumula?separationId=...` | Rascunho administrativo |
| `/baixar-app` | Versões oficiais Android/iOS |
| `/admin` | Painel administrativo |

## API

As rotas retornam JSON. Cookies HTTP-only são usados no site; o aplicativo usa Bearer tokens opacos emitidos por `/api/mobile/auth`.

### Públicas

- `GET /api/public-config` — URL canônica, identidade, agenda, nomes e cores das equipes.
- `GET /api/public-players` — jogadores e estatísticas esportivas públicas.
- `GET /api/public-statistics` — rankings, assiduidade e confrontos por período.
- `GET /api/separations` — separações confirmadas.
- `GET /api/mobile/version` — versão e link oficial por plataforma.
- `GET /api/health` — saúde da aplicação e banco.

### Contas

- `GET/POST/PUT/DELETE /api/member-auth` — sessão, login, cadastro e logout.
- `POST/PUT /api/member-password-reset` — recuperação de senha de jogador.
- `GET/POST /api/member-players` — jogadores disponíveis e associação.
- `GET/PUT /api/member-profile` — card e perfil associado.
- `GET/PUT /api/notification-preferences` — preferências da conta.
- `GET/PATCH /api/notifications` — central interna.

### Partidas e separações

- `GET/PUT /api/matches` — agenda e confirmação do jogador.
- `GET/POST/PATCH /api/admin/matches` — gestão administrativa das partidas, presenças e lista de espera de convidados.
- `GET/PUT /api/admin/separation-drafts` — consulta e gravação privada dos rascunhos de separação.
- `GET/POST/PATCH/DELETE /api/separations` — histórico, criação, chegada e exclusão lógica.
- `GET/PUT /api/career/draft` — rascunho de súmula.
- `POST/PUT /api/career/match` — confirmação e correção de resultado.
- `GET/POST /api/career/vote` — consulta da votação e voto autenticado.
- `GET/PUT/POST/DELETE /api/career/admin` — configuração, acompanhamento e encerramento.

### Administração

- `GET/POST/PUT/DELETE /api/players` — jogadores.
- `GET/POST/PUT /api/administrators` — administradores.
- `GET/POST/PUT/DELETE /api/moderators` — promoção, permissões e reversão de moderadores (somente administradores).
- `GET/DELETE /api/member-associations` — associações.
- `PUT /api/member-associations/password` — senha temporária de jogador.
- `GET/PUT /api/config` — equilíbrio.
- `GET/PUT /api/instance-config` — identidade, agenda e equipes.
- `GET/PUT/POST /api/admin/mobile-release` — versões Android/iOS.
- `GET /api/audit` — auditoria paginada.
- `GET/POST /api/upload` — fotos validadas.

### Mobile

- `GET/POST/PUT/DELETE /api/mobile/auth` — login, refresh rotativo e revogação.
- `GET/POST/PATCH /api/mobile/separations` — separações.
- `POST /api/mobile/separations/proposal` — parser e algoritmo oficial.
- `GET/PUT /api/mobile/config` — os três pesos editáveis.
- `POST/PUT /api/mobile/career/match` — resultado idempotente.
- `POST/DELETE /api/mobile/notifications` — registro e desativação de push.

O contrato detalhado está em [docs/mobile-openapi.yaml](docs/mobile-openapi.yaml).

## Segurança

- PBKDF2-SHA-256 com salt aleatório e 210 mil iterações para senhas.
- Cookies HTTP-only/SameSite no site.
- Access tokens mobile de curta duração e refresh tokens rotativos.
- Refresh tokens e tokens de redefinição persistidos somente como hash.
- Reutilização de refresh token revoga as sessões mobile da conta.
- Autorização validada no servidor em todas as ações protegidas.
- A votação deriva o jogador da conta autenticada e ignora identidades enviadas pelo cliente.
- Fotos limitadas a JPEG, PNG e WebP de até 5 MB.
- Logs não incluem senhas, cookies, tokens, corpos ou query strings.
- Auditoria para logins, contas, jogadores, configurações, partidas, votos, placares e operações mobile.

Em produção, use HTTPS, segredos fora do repositório, rate limiting no proxy e backups antes de mudanças estruturais.

## Logs e observabilidade

A aplicação escreve JSON em stdout/stderr, uma linha por evento. Os campos principais incluem:

- `timestamp`;
- `level`;
- `service`;
- `event`;
- `requestId`;
- `method`;
- `path`;
- `status`;
- `durationMs`.

Exemplo de consulta no Loki:

```logql
{container="pelada-pede-mais-uma"} | json
```

Somente erros:

```logql
{container="pelada-pede-mais-uma"} | json | level="error"
```

O Compose do OMV mantém cinco arquivos de log de até 10 MB. O nome real dos labels depende da configuração do Promtail ou Grafana Alloy.

## Containers

| Arquivo | Uso | Runtime |
| --- | --- | --- |
| `docker-compose.yml` | PC ou servidor compatível | Wrangler/workerd |
| `docker-compose.dev.yml` | Desenvolvimento com recarga | Vinext |
| `docker-compose.omv.yml` | Raspberry Pi ARM64 com OMV 7 | Node 22 self-hosted |

### Compose padrão

```bash
cp .env.docker.example .env
docker compose up -d --build
docker compose logs -f app
```

Acesse `http://localhost:3000`.

O runtime workerd ARM64 exige suporte de CPU e espaço virtual compatíveis. Em Raspberry Pi/OMV com espaço virtual de 39 bits, use o Compose self-hosted do OMV.

### Desenvolvimento em container

```bash
docker compose -f docker-compose.dev.yml up --build
```

O código é montado no container e as dependências ficam em volume separado.

### Raspberry Pi ARM64 com OMV 7

Confirme o sistema de 64 bits:

```bash
uname -m
```

O resultado deve ser `aarch64` ou `arm64`.

O plugin Compose deve manter a pilha um nível acima do checkout:

```text
pelada-pede-mais-uma/
├── docker-compose.yml       # conteúdo de docker-compose.omv.yml
└── source/                  # checkout do repositório
    ├── Dockerfile.selfhost.omv
    └── ...
```

Crie o diretório persistente:

```bash
mkdir -p /srv/dev-disk-by-uuid-SEU_UUID/DockerData/pelada-pede-mais-uma
chown -R 1000:100 /srv/dev-disk-by-uuid-SEU_UUID/DockerData/pelada-pede-mais-uma
chmod 750 /srv/dev-disk-by-uuid-SEU_UUID/DockerData/pelada-pede-mais-uma
```

O sandbox BuildKit de algumas instalações OMV encerra o npm com `SIGSYS`. Nesses casos, crie uma vez o builder:

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

No plugin, execute **Check**, **Build** e **Up**. Não use **Pull** para a imagem local `pelada-pede-mais-uma:selfhost-arm64`.

O modelo do OMV:

- usa Node sem workerd;
- executa como usuário `1000:100`;
- remove capabilities;
- ativa `no-new-privileges`;
- usa `seccomp:unconfined` para evitar o `SIGSYS` observado nesse ambiente;
- persiste banco e fotos em `/data`.

Acesse `http://IP_DO_RASPBERRY:3000`. Os logs devem registrar `application_starting` e `database_ready`.

## Múltiplas instâncias

Uma única imagem pode atender vários grupos, desde que cada Compose use valores exclusivos para:

- `COMPOSE_PROJECT_NAME`;
- `CONTAINER_NAME`;
- `HOST_PORT`;
- `INSTANCE_DATA_PATH`;
- `APP_BASE_URL`;
- `LOGGING_JOB_NAME`.

Nunca compartilhe `INSTANCE_DATA_PATH` entre grupos. Consulte [docs/MULTI_INSTANCE.md](docs/MULTI_INSTANCE.md) para configuração da identidade, agenda e builds personalizados do aplicativo.

## Licença e operação

O projeto é privado. Antes de publicar binários ou abrir o serviço na internet, revise política de privacidade, termos de uso, URLs de suporte e requisitos da App Store/Google Play.
