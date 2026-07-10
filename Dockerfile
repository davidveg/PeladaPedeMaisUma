# syntax=docker/dockerfile:1.7

ARG NODE_VERSION=22.19.0
ARG WRANGLER_VERSION=4.92.0

FROM node:${NODE_VERSION}-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts --no-audit --no-fund

FROM node:${NODE_VERSION}-bookworm-slim AS build
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm test

FROM node:${NODE_VERSION}-bookworm-slim AS runtime
ARG WRANGLER_VERSION
WORKDIR /app
RUN --mount=type=cache,target=/root/.npm \
    npm install --global "wrangler@${WRANGLER_VERSION}" --no-audit --no-fund \
    && mkdir -p /data /home/node/.config /home/node/.wrangler \
    && chown -R node:node /app /data /home/node

ENV NODE_ENV=production \
    PORT=3000 \
    WRANGLER_LOG=error \
    WRANGLER_HOME=/home/node/.wrangler \
    XDG_CONFIG_HOME=/home/node/.config

COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/drizzle ./drizzle
COPY --chown=node:node wrangler.container.jsonc ./wrangler.container.jsonc

USER node
EXPOSE 3000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/api/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["sh", "-c", "wrangler dev --config wrangler.container.jsonc --local --ip 0.0.0.0 --port ${PORT:-3000} --persist-to /data"]
