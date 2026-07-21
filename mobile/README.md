# Pelada Pede Mais Uma — aplicativo mobile

Aplicativo Expo/React Native com uma única base TypeScript para iOS e Android. O backend web continua sendo a fonte oficial: o app não possui banco próprio nem uma cópia do algoritmo de equilíbrio.

## Arquitetura e decisões

- Expo SDK 56 + Expo Router, seguindo o template estável oficial disponível durante a implementação.
- TanStack Query para cache, invalidação e persistência offline apenas de separações, perfil e configuração pública.
- Tokens somente no SecureStore. Senhas existem apenas durante o envio do login.
- Uma resposta `401` provoca uma única tentativa compartilhada de refresh; falha remove a sessão local e volta ao login.
- Mutações usam `networkMode: online`, não são enfileiradas, e confirmações críticas usam `Idempotency-Key`.
- O servidor interpreta a lista e chama o algoritmo oficial. O cliente apenas apresenta a proposta e permite trocas manuais.
- Datas são apresentadas em `America/Sao_Paulo`; os contratos continuam usando ISO 8601.
- O compartilhamento tenta WhatsApp e cai no compartilhamento nativo. Links são rejeitados se não forem HTTPS públicos.

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

Os fluxos declarativos em `e2e/` usam [Maestro](https://maestro.mobile.dev/). Com um development build aberto, forneça as variáveis indicadas em cada YAML e execute `maestro test e2e`. Eles cobrem login, separações, ordem de chegada, rascunho, confirmação de resultado e pesos.

## Builds

Os perfis em `eas.json` são:

- `development`: development client interno;
- `preview`: homologação distribuída internamente;
- `production`: binário de loja com versão incrementada.

Cadastre `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_WEB_BASE_URL` e `EXPO_PUBLIC_APP_ENV` nos ambientes EAS correspondentes e execute:

```bash
eas build --profile development --platform all
eas build --profile preview --platform all
eas build --profile production --platform all
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
  -d '{"playerIds":["id-1","id-2","id-3","id-4"],"nonce":0}'

# confirmação idempotente
curl -X POST "$API/api/mobile/separations" \
  -H "authorization: Bearer ACCESS_TOKEN" -H "content-type: application/json" \
  -H "idempotency-key: 550e8400-e29b-41d4-a716-446655440000" \
  -d '{"title":"Pelada","originalText":"lista original","result":{"blue":[{"id":"id-1"}],"yellow":[{"id":"id-2"}],"cost":20,"rating":"Excelente equilíbrio"}}'
```

Access tokens duram 15 minutos. Refresh tokens duram 30 dias, são armazenados somente como SHA-256 no servidor, rotacionados a cada uso e revogáveis. A reutilização de um refresh já rotacionado revoga todas as sessões mobile da conta. Login, refresh, logout, alterações de pesos, ordens, resultados e separações administrativas entram na auditoria.

## Testes de fluxo recomendados antes de cada release

1. Jogador: login, separações, detalhe somente leitura, card associado e mensagem de conta sem associação.
2. Autorização: chamar proposta, config, ordem, súmula e resultado com token de jogador e confirmar `401`.
3. Administrador: importar lista, tratar nome ambíguo, revisar, gerar novamente, trocar jogadores e salvar.
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

- cadastro, associação, recuperação de senha, votação e administração completa continuam no site responsivo;
- cache offline é somente leitura e expira após sete dias;
- correção manual de jogadores desconhecidos ou ambíguos deve ser feita no site;
- notificações push não fazem parte desta versão;
- ícones/splash comerciais e credenciais de assinatura das lojas devem ser fornecidos antes da publicação.
