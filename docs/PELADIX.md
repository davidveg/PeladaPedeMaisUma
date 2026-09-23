# Implantação da Peladix

A Peladix deve ser uma instância independente do mesmo codebase. Ela compartilha a imagem da aplicação, mas não compartilha banco SQLite, uploads, container, porta, domínio, projeto EAS ou Firebase com nenhuma outra pelada.

## Valores preparados

| Item | Valor inicial |
| --- | --- |
| Projeto/container Compose | `peladix` |
| Porta no host | `3020` |
| URL pública | `https://peladix.vegaalameda.com` |
| Diretório de dados | `.../containers/peladix` (o UUID do disco deve ser preenchido) |
| Nome do aplicativo | `Peladix` |
| Slug EAS | `pelada-peladix` |
| Scheme | `peladix` |
| Package Android | `br.com.peladix.app` |
| Bundle identifier iOS | `br.com.peladix.app` |
| Projeto EAS | `4a4cf359-9c40-43b8-93bd-57a2ab53aa43` |
| Projeto Firebase | `peladix-361e7` |
| Cor nativa principal | `#440052` |
| Fundo do adaptive icon | `#FFFFFF` |

Se o domínio, a porta ou os identificadores nativos forem diferentes, altere os arquivos de exemplo antes da implantação. O package e o bundle identifier não devem ser trocados depois da publicação nas lojas.

## Site

1. Copiar `examples/peladix.omv.env.example` para o diretório do novo projeto Compose no OMV e renomear a cópia para `.env`.
2. Preencher `INSTANCE_DATA_PATH`, `WEATHER_CONTACT_EMAIL` e as credenciais SMTP. Nunca reutilizar o diretório de dados de outra pelada.
3. Reutilizar a imagem atual e subir `docker-compose.omv.yml` como um projeto Compose separado.
4. Publicar a porta `3020` no proxy reverso com HTTPS para `peladix.vegaalameda.com` e configurar DNS/certificado.
5. Conferir `GET /api/health` e os logs `application_starting` e `database_ready`.
6. Entrar em `/admin` com `admin` / `admin`, trocar imediatamente e-mail e senha e abrir **Identidade e agenda**.
7. Configurar nome `Peladix`, textos, agenda, local, cores, nomes dos times, logotipo, favicon, imagem de compartilhamento e módulos opcionais.
8. Cadastrar os organizadores e jogadores. Se houver dados anteriores, planejar a importação antes de abrir a instância ao grupo.

## Aplicativo

O aplicativo já existe em Expo/React Native e usa a mesma API do site. Não é necessário criar outro projeto de código; falta criar e conectar a identidade nativa da Peladix.

Itens obrigatorios antes do primeiro APK/TestFlight:

- projeto EAS exclusivo da Peladix e seu UUID (configurado);
- aplicativo Android no Firebase com package `br.com.peladix.app` e arquivo `mobile/google-services-peladix.json` (configurado);
- configuração equivalente de push para iOS quando o build iOS for publicado;
- ícone principal quadrado, adaptive icon Android e ícone monocromático de notificação já adicionados em `mobile/assets`;
- definição final da paleta e textos do aplicativo no painel da instância;
- HTTPS e API da Peladix publicados e testados;
- contas Google Play Console e Apple Developer, política de privacidade, URL de suporte, capturas de tela e dados das lojas.

Os perfis `peladix-preview` e `peladix-production` em `mobile/eas.json` estão
associados exclusivamente ao UUID EAS e ao Firebase da Peladix.

## Validação antes da abertura

- Site: login inicial, troca obrigatória de senha, upload de identidade, cadastro de jogador, partida, presença, separação, súmula e resultado.
- Isolamento: confirmar que jogadores, fotos, partidas e configurações das outras peladas não aparecem.
- E-mail: convite/redefinição de senha com links para o domínio da Peladix.
- Mobile: login, cache, presença, notificações, estatísticas, compartilhamento e fluxo administrativo em build interno.
- Release: executar testes web/mobile, typecheck, export Android e teste em aparelho físico antes do build de loja.

## Pendências de decisão

- confirmar domínio e porta propostos;
- informar caminho real do disco no OMV;
- definir e-mail remetente e contato dos provedores de clima;
- confirmar se a paleta roxa, verde-limão e branca extraída do logo será a paleta final do site e do aplicativo;
- gerar o primeiro build para o EAS criar o keystore Android e depois cadastrar a chave privada FCM V1;
- decidir se haverá importação de jogadores/histórico e quais módulos opcionais serão ativados.
