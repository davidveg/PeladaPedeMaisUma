# Landing page — Pelada Pede Mais Uma

Landing page comercial estática, isolada da aplicação principal e servida por Nginx sem privilégios.

## Subir com Docker Compose

Execute a partir da raiz do repositório:

```powershell
docker compose -f landing-page/docker-compose.yml up -d --build
```

A página ficará disponível em `http://IP_DO_SERVIDOR:8088`. Para trocar a porta, copie `.env.example` para `.env` dentro desta pasta e altere `HOST_PORT`.

## OpenMediaVault 7 — plugin Compose

O projeto pode ser construído e administrado diretamente pela interface do plugin **Compose** do OMV 7. Como o plugin armazena o arquivo Compose separadamente dos arquivos da aplicação, o contexto de build deve apontar para o caminho absoluto do repositório no servidor.

### 1. Copiar o projeto para o OMV

Crie ou reutilize uma pasta compartilhada em **Storage → Shared Folders**, preferencialmente em um disco de dados, como `appdata`. Copie o repositório inteiro por SMB, SFTP ou Git, preservando esta estrutura:

```text
/srv/dev-disk-by-uuid-SEU-DISCO/appdata/PeladaPedeMaisUma/
├── public/
└── landing-page/
    ├── assets/
    ├── Dockerfile
    ├── docker-compose.yml
    ├── nginx.conf
    ├── index.html
    ├── styles.css
    └── script.js
```

Não copie apenas `landing-page/`: o `Dockerfile` também utiliza imagens de `public/`. O caminho correto do compartilhamento pode ser consultado em **Storage → Shared Folders**, no campo **Absolute path**.

### 2. Criar a entrada no Compose

Abra **Services → Compose → Files**, clique no botão **+** e preencha:

- **Name:** `pelada-pede-mais-uma-landing`
- **Description:** `Landing page comercial do Pelada Pede Mais Uma`

No campo **File**, use:

```yaml
name: ${COMPOSE_PROJECT_NAME:-pelada-pede-mais-uma-landing}

services:
  landing:
    image: ${LANDING_IMAGE:-pelada-pede-mais-uma-landing:latest}
    container_name: ${CONTAINER_NAME:-pelada-pede-mais-uma-landing}

    build:
      context: "${LANDING_SOURCE_PATH}"
      dockerfile: landing-page/Dockerfile

    ports:
      - "${HOST_PORT:-8088}:8080"

    restart: unless-stopped
    init: true
    read_only: true

    security_opt:
      - no-new-privileges:true

    cap_drop:
      - ALL

    tmpfs:
      - /tmp:size=16m,mode=1777
      - /var/cache/nginx:size=16m,mode=0755

    healthcheck:
      test:
        - CMD-SHELL
        - wget -q -O - http://127.0.0.1:8080/healthz | grep -q '^ok$'
      interval: 30s
      timeout: 5s
      start_period: 10s
      retries: 3

    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"

    labels:
      logging: promtail
      logging_jobname: ${LOGGING_JOB_NAME:-pelada-pede-mais-uma-landing}
```

### 3. Configurar o Environment

No campo ou aba **Environment** da mesma entrada, informe:

```dotenv
COMPOSE_PROJECT_NAME=pelada-pede-mais-uma-landing
CONTAINER_NAME=pelada-pede-mais-uma-landing
LANDING_IMAGE=pelada-pede-mais-uma-landing:latest
HOST_PORT=8088
LOGGING_JOB_NAME=pelada-pede-mais-uma-landing
LANDING_SOURCE_PATH=/srv/dev-disk-by-uuid-SEU-DISCO/appdata/PeladaPedeMaisUma
```

Substitua `LANDING_SOURCE_PATH` pelo caminho absoluto real exibido pelo OMV e não use aspas nesse campo. Se a porta `8088` já estiver ocupada, altere `HOST_PORT`, por exemplo, para `8090`.

### 4. Construir e iniciar

Depois de salvar:

1. Selecione `pelada-pede-mais-uma-landing` na lista.
2. Execute **Check** para validar o arquivo.
3. Execute **Build** ou **Pull and Build**.
4. Quando o build terminar, execute **Up**.

Com o status **Up**, abra `http://IP_DO_OMV:8088`. Se outra porta foi definida em `HOST_PORT`, use-a no endereço.

### Solução de problemas

- `failed to read dockerfile`: confira o valor de `LANDING_SOURCE_PATH` e se o repositório foi copiado por inteiro.
- Erro ao copiar um caminho de `public/`: a pasta `public/` está ausente ou não está ao lado de `landing-page/`.
- `port is already allocated`: escolha outra porta em `HOST_PORT`, salve e execute **Up** novamente.
- Conteúdo antigo depois de atualizar os arquivos: execute **Build** e **Up** novamente; se necessário, execute **Down** antes de **Up**.

O container é compatível com arquiteturas `amd64` e `arm64`, roda com filesystem somente leitura, sem capabilities Linux e com `no-new-privileges`.

## Capturas do produto

A seção **Telas reais** usa as imagens em `landing-page/assets/`. Elas são incorporadas à imagem Docker durante o build; para atualizá-las, substitua os arquivos mantendo os mesmos nomes e reconstrua o container.

## Contato

O CTA comercial usa um link `mailto:` para `peladapedemaisuma@gmail.com`; nenhum formulário, servidor de e-mail ou credencial é necessário.
