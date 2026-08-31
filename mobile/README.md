# Pelada Pede Mais Uma — aplicativo mobile

Aplicativo Expo/React Native com uma única base TypeScript para iOS e Android. O backend web continua sendo a fonte oficial: o app não possui banco próprio nem uma cópia do algoritmo de equilíbrio.

## Arquitetura e decisões

- Expo SDK 56 + Expo Router, seguindo o template estável oficial disponível durante a implementação.
- TanStack Query para cache, invalidação e persistência offline de separações, partidas, notificações, perfil e configuração pública.
- Tokens somente no SecureStore. Senhas existem apenas durante o envio do login.
- Uma resposta `401` provoca uma única tentativa compartilhada de refresh; falha remove a sessão local e volta ao login.
- Mutações usam `networkMode: online`, não são enfileiradas, e confirmações críticas usam `Idempotency-Key`.
- O servidor interpreta a lista e chama o algoritmo oficial. O cliente apenas apresenta a proposta e permite trocas manuais.
- A criação avulsa e a aba **Nova** foram removidas. O construtor só pode ser aberto a partir de uma Partida, com `matchId` e permissão para montar times. Links antigos sem partida orientam a acessar Partidas.
- Datas são apresentadas em `America/Sao_Paulo`; os contratos continuam usando ISO 8601.
- O compartilhamento tenta WhatsApp e cai no compartilhamento nativo. Links são rejeitados se não forem HTTPS públicos.
- Partidas e presenças usam a mesma API do site; mudar a resposta em qualquer cliente consome a mesma contagem de remarcações.
- Push é opcional e nunca bloqueia o aplicativo. No Expo Go o módulo nativo fica desativado automaticamente, enquanto a central interna de notificações continua funcionando.
- A aba **Financeiro** acompanha a chave da instância: jogadores consultam somente o próprio histórico; administradores e moderadores autorizados veem o resumo mensal e compartilham a parcial pelo WhatsApp. Cadastros, estornos e configurações financeiras completas permanecem no site.

## Estatísticas no aplicativo

- Entrada **Estatísticas da pelada** em **Partidas** e **Conta**, disponível para qualquer conta autenticada, mesmo sem jogador associado. A barra inferior mantém suas opções atuais.
- Gerais: filtros por mês, ano, intervalo e mês encerrado; sequências de vitórias/invencibilidade; rankings de gols, assistências, participações e assiduidade; confrontos com links para as partidas.
- Destaques: jogador do mês, seleção com campo e fotos, histórico mensal e pódio anual. Fechamentos antecipados, elegibilidade e a formação de cada mês vêm dos snapshots do servidor; o app não recalcula nem antecipa prêmios por conta própria.
- Avançadas: visão geral, análise de qualquer jogador, ranking IPI por função, forma recente (5/10/20 jogos), impacto, consistência, duplas, rede de entrosamento em lista, recordes e qualidade do balanceamento. Filtros de temporada, posição e amostra mínima usam os mesmos endpoints do site.
- O atalho do **Meu card** continua abrindo a análise do jogador vinculado. As consultas são autenticadas, atualizam ao voltar à tela e permitem puxar para atualizar. Não alteram notas, resultados, histórico ou o algoritmo.
- Fotos circulares com fallback; campo ajustável a diferentes formações; listas com “Ver mais”; seletores pesquisáveis e explicações em alertas nativos. Falta de cobertura aparece como “Sem dados”, não como zero.
- Validação: `npm run typecheck`, `npm test` (inclui contratos com o motor do servidor e interações JSX), `npx expo export --platform android`. Os testes de componentes não substituem a conferência visual em Android/iOS.

## Execução local

Pré-requisitos: Node compatível com o SDK, Android Studio para Android e macOS/Xcode para simulador iOS. Um iPhone físico também pode usar o development build.

```bash
cd mobile
cp .env.example .env
npm install
npx expo start
```

Defina `EXPO_PUBLIC_API_BASE_URL` com um endereço alcançável pelo aparelho. `localhost` no telefone aponta para o próprio telefone; use o IP da máquina na rede durante o desenvolvimento. Para produção, use obrigatoriamente HTTPS.

Comandos úteis:

```bash
npm run android
npm run ios
npm run typecheck
npm test
```

Os fluxos declarativos em `e2e/` usam [Maestro](https://maestro.mobile.dev/). Com um development build aberto, forneça as variáveis indicadas em cada YAML e execute `maestro test e2e`. Eles cobrem login, separações, ordem de chegada, rascunho, confirmação de resultado e pesos. O cenário `admin-create-separation.yaml` exige uma partida aberta com pelo menos quatro presentes e o título informado em `MATCH_TITLE`. Ele testa o fluxo iniciado pelas presenças, sem importação de texto.

## Builds

Os perfis em `eas.json` são:

- `development`: development client interno;
- `preview`: homologação distribuída internamente;
- `production`: binário de loja com versão incrementada.
- `agriao-preview`: APK interno da Pelada do Agrião, ligado exclusivamente ao backend e ao projeto EAS do Agrião;
- `agriao-production`: binário de loja/TestFlight da Pelada do Agrião.

Cadastre `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_WEB_BASE_URL` e `EXPO_PUBLIC_APP_ENV` nos ambientes EAS correspondentes e execute:

```bash
eas build --profile development --platform all
eas build --profile preview --platform all
eas build --profile production --platform all
```

### Pelada do Agrião

Os perfis do Agrião usam o package/bundle `br.com.peladadoagriao.app`, o projeto EAS `5c7cc851-84df-4e97-8405-35091dc56fa0`, o Firebase de `google-services-agriao.json` e a API `https://peladadoagriao.vegaalameda.com`. Eles não substituem nem recebem atualizações do aplicativo Pelada Pede Mais Uma.

```bash
eas build --profile agriao-preview --platform android
eas build --profile agriao-production --platform android
eas build --profile agriao-production --platform ios
```

O EAS Update não recebe um perfil de build. Antes de publicar uma atualização OTA do Agrião no PowerShell, defina explicitamente a identidade do projeto para impedir que o update seja enviado ao aplicativo anterior:

```powershell
$env:EXPO_APP_VARIANT="agriao"
$env:EXPO_APP_NAME="Pelada do Agrião"
$env:EXPO_APP_SLUG="pelada-do-agriao"
$env:EXPO_APP_SCHEME="peladadoagriao"
$env:EXPO_ANDROID_PACKAGE="br.com.peladadoagriao.app"
$env:EXPO_IOS_BUNDLE_IDENTIFIER="br.com.peladadoagriao.app"
$env:EXPO_EAS_PROJECT_ID="5c7cc851-84df-4e97-8405-35091dc56fa0"
$env:EXPO_UPDATES_URL="https://u.expo.dev/5c7cc851-84df-4e97-8405-35091dc56fa0"
$env:EXPO_PUBLIC_API_BASE_URL="https://peladadoagriao.vegaalameda.com"
$env:EXPO_PUBLIC_WEB_BASE_URL="https://peladadoagriao.vegaalameda.com"
$env:EXPO_PUBLIC_APP_ENV="preview"
$env:EXPO_APP_ICON="./assets/icon-agriao.png"
$env:EXPO_ADAPTIVE_ICON="./assets/icon-agriao.png"
$env:EXPO_NOTIFICATION_ICON="./assets/icon-agriao.png"
$env:EXPO_GOOGLE_SERVICES_FILE="./google-services-agriao.json"
$env:EXPO_PRIMARY_COLOR="#0B3D2E"

npx eas-cli@latest update `
  --channel preview `
  --environment preview `
  --platform android `
  --message "Atualização Pelada do Agrião"
```

Troque os identificadores `br.com.peladapedemaisuma.app` antes da primeira publicação caso esse domínio não pertença ao projeto.

## Contratos e segurança

A especificação está em `../docs/mobile-openapi.yaml`. Os endpoints web existentes continuam aceitando cookies; os validadores protegidos agora também aceitam o Bearer emitido por `/api/mobile/auth`.

Exemplos mínimos:

```bash
# login
curl -X POST "$API/api/mobile/auth" -H "content-type: application/json" \
  -d '{"email":"jogador@example.com","password":"senha","deviceName":"Android"}'

# refresh rotativo
curl -X PUT "$API/api/mobile/auth" -H "content-type: application/json" \
  -d '{"refreshToken":"REFRESH_TOKEN"}'

# proposta calculada exclusivamente no servidor
curl -X POST "$API/api/mobile/separations/proposal" \
  -H "authorization: Bearer ACCESS_TOKEN" -H "content-type: application/json" \
  -d '{"matchId":"MATCH_ID","nonce":0}'

# fechar a lista e publicar os times retornados pela proposta (snapshot completo)
# proposal-result.json deve conter {"action":"close","matchId":"MATCH_ID","result":<result da proposta>,"manuallyAdjusted":false}
curl -X PATCH "$API/api/admin/matches" \
  -H "authorization: Bearer ACCESS_TOKEN" -H "content-type: application/json" \
  --data-binary @proposal-result.json
```

Os antigos POSTs de criação avulsa (`/api/separations` e `/api/mobile/separations`) retornam `410`. Propostas sem `matchId` também retornam `410`. O histórico continua acessível e editável conforme as permissões. Publique primeiro o servidor: ele retorna `manualSeparationEnabled: false` para versões antigas do aplicativo, preservando o fluxo por Partidas. Depois distribua a atualização mobile.

Access tokens duram 15 minutos. Refresh tokens duram 30 dias, são armazenados somente como SHA-256 no servidor, rotacionados a cada uso e revogáveis. A reutilização de um refresh já rotacionado revoga todas as sessões mobile da conta. Login, refresh, logout, alterações de pesos, ordens, resultados e separações administrativas entram na auditoria.

## Testes de fluxo recomendados antes de cada release

1. Jogador: login, partidas, confirmação e remarcação de presença, notificações, separações, card associado e mensagem de conta sem associação.
2. Autorização: chamar proposta, config, ordem, súmula e resultado com token de jogador e confirmar `401`.
3. Administrador: abrir partida, revisar presentes, gerar novamente, trocar jogadores, salvar/reabrir rascunho e fechar a lista para publicar e notificar.
4. Ordem: arrastar em cada time, usar setas acessíveis, salvar, alterar e salvar novamente.
5. Súmula: gol com/sem assistência; GC com adversário e sem assistência; salvar e reabrir rascunho.
6. Resultado: confirmar explicitamente, validar placar, corrigir e conferir auditoria/estatísticas.
7. Compartilhamento: WhatsApp instalado e ausente; acentos, emojis, quebras e URL HTTPS.
8. Rede: cache em modo avião, mutações bloqueadas, refresh expirado e servidor em `503`.

## Checklist App Store e Google Play

- configurar ícones, splash e capturas finais (os assets comerciais não estão no repositório);
- confirmar nome, bundle ID/package, categorias e classificação etária;
- publicar política de privacidade e URL de suporte;
- preencher declarações de coleta/segurança de dados e justificar autenticação;
- conferir exclusão de conta via fluxo web e instruções ao revisor;
- testar em telefone pequeno, tablet, VoiceOver e TalkBack;
- validar HTTPS, ambiente de produção e ausência de credenciais/logs sensíveis;
- executar `npm test`, `npm run typecheck`, teste interno e homologação;
- incrementar versão, gerar builds assinados e testar os artefatos das lojas;
- fornecer conta de demonstração ao revisor, quando solicitado.

## Limitações objetivas da versão 1.0

- cadastro, associação, conclusão da redefinição de senha recebida por e-mail, votação e administração completa continuam no site responsivo;
- cache offline é somente leitura e expira após sete dias;
- notificações push exigem um development/preview/production build; no Expo Go apenas a central interna é usada;
- ícones/splash comerciais e credenciais de assinatura das lojas devem ser fornecidos antes da publicação.
