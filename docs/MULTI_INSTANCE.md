# Operação de múltiplas peladas

O produto usa um único codebase e uma implantação independente por grupo. Cada instância possui seu próprio diretório de dados, banco SQLite, uploads, porta, URL pública e configuração administrativa.

## O que é configurado no painel

No painel administrativo, abra **Identidade e agenda** para alterar:

- nome completo, nome curto, frase de apoio, rodapé e logotipo;
- paleta do site, cores dos times e paleta do aplicativo;
- título e frase exibidos pelo aplicativo;
- título padrão das partidas, dia da semana, horário, antecedência das confirmações e fuso horário.
- disponibilidade da importação manual de confirmações copiadas do WhatsApp no site e no aplicativo.

Os valores antigos de “Pelada Pede Mais Uma” e domingo às 09:00 são os padrões. A importação manual fica desativada por padrão; a criação de times pelas presenças de **Partidas** continua disponível e o recurso antigo pode ser reativado a qualquer momento.

O site consulta essa configuração no banco da instância. O aplicativo consulta a mesma configuração pública ao iniciar. Se estiver temporariamente sem conexão, ele usa a identidade padrão embarcada até conseguir sincronizar.

## Criar uma instância no OMV

1. Construa ou reutilize a mesma imagem da aplicação.
2. Copie `examples/instance.omv.env.example` para um arquivo `.env` exclusivo do novo grupo.
3. Defina valores exclusivos para:
   - `COMPOSE_PROJECT_NAME`;
   - `CONTAINER_NAME`;
   - `HOST_PORT`;
   - `INSTANCE_DATA_PATH`;
   - `APP_BASE_URL`;
   - `LOGGING_JOB_NAME`.
4. Inicie o projeto usando `docker-compose.omv.yml` e esse arquivo de ambiente.
5. Acesse o painel com o usuário e senha iniciais `admin`, conclua a troca obrigatória e configure **Identidade e agenda**.

Exemplo de portas:

```text
pelada atual       HOST_PORT=3000  INSTANCE_DATA_PATH=.../pelada-pede-mais-uma
novo contrato      HOST_PORT=3010  INSTANCE_DATA_PATH=.../pelada-novo-grupo
outro contrato     HOST_PORT=3020  INSTANCE_DATA_PATH=.../pelada-outro-grupo
```

Nunca reutilize `INSTANCE_DATA_PATH` entre grupos. É esse diretório que contém `pelada.sqlite` e os uploads da instância.

## Gerar um APK ou TestFlight personalizado

O conteúdo e as cores do aplicativo são sincronizados com o painel. Os itens controlados pelo sistema operacional precisam ser definidos na geração do binário:

- nome sob o ícone;
- ícone e adaptive icon;
- package Android;
- bundle identifier iOS;
- scheme;
- projeto EAS e URL de atualizações.

Copie `mobile/.env.example` e configure pelo menos:

```dotenv
EXPO_PUBLIC_API_BASE_URL=https://novo-grupo.seudominio.com
EXPO_PUBLIC_WEB_BASE_URL=https://novo-grupo.seudominio.com
EXPO_APP_NAME="Nome da Nova Pelada"
EXPO_APP_SLUG=nome-da-nova-pelada
EXPO_APP_SCHEME=nomedanovapelada
EXPO_ANDROID_PACKAGE=br.com.suaempresa.nomedanovapelada
EXPO_IOS_BUNDLE_IDENTIFIER=br.com.suaempresa.nomedanovapelada
EXPO_EAS_PROJECT_ID=UUID_DO_PROJETO_EAS
EXPO_UPDATES_URL=https://u.expo.dev/UUID_DO_PROJETO_EAS
EXPO_APP_ICON=./assets/icone-da-nova-pelada.png
EXPO_ADAPTIVE_ICON=./assets/adaptive-icon-da-nova-pelada.png
EXPO_PRIMARY_COLOR="#123456"
```

Cada aplicativo publicado deve ter package, bundle identifier e projeto EAS próprios. Isso evita que atualizações, push notifications ou lojas de um contrato atinjam outro.

## Atualizações do codebase

As configurações comerciais não devem gerar forks de código. Uma nova versão é construída uma vez e implantada em cada Compose. As migrações criam os novos campos automaticamente e preservam a configuração de cada banco.
