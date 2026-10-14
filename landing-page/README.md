# Landing page — Pelada Pede Mais Uma

Landing page comercial estática, isolada da aplicação principal e servida por Nginx sem privilégios.

## Subir com Docker Compose

Execute a partir da raiz do repositório:

```powershell
docker compose -f landing-page/docker-compose.yml up -d --build
```

A página ficará disponível em `http://IP_DO_SERVIDOR:8088`. Para trocar a porta, copie `.env.example` para `.env` dentro desta pasta e altere `HOST_PORT`.

## OpenMediaVault

No plugin **Compose** do OpenMediaVault:

1. Mantenha este repositório completo em uma pasta acessível ao Docker.
2. Crie um projeto apontando para `landing-page/docker-compose.yml`.
3. Se o plugin usar uma pasta de projeto própria, preserve a relação entre `landing-page/` e `public/`, pois o build reutiliza o logotipo, favicon e imagem social oficiais.
4. Ajuste `HOST_PORT` caso a porta `8088` já esteja ocupada.
5. Execute **Build** e depois **Up**.

O container é compatível com arquiteturas `amd64` e `arm64`, roda com filesystem somente leitura, sem capabilities Linux e com `no-new-privileges`.

## Capturas do produto

A seção **Telas reais** usa as imagens em `landing-page/assets/`. Elas são incorporadas à imagem Docker durante o build; para atualizá-las, substitua os arquivos mantendo os mesmos nomes e reconstrua o container.

## Contato

O CTA comercial usa um link `mailto:` para `peladapedemaisuma@gmail.com`; nenhum formulário, servidor de e-mail ou credencial é necessário.
