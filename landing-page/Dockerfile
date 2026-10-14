FROM nginxinc/nginx-unprivileged:1.29-alpine

COPY --chown=101:101 landing-page/nginx.conf /etc/nginx/conf.d/default.conf
COPY --chown=101:101 landing-page/index.html landing-page/styles.css landing-page/script.js /usr/share/nginx/html/
COPY --chown=101:101 public/branding/pelada-pede-mais-uma-logo-v1.png /usr/share/nginx/html/assets/logo.png
COPY --chown=101:101 public/og.png /usr/share/nginx/html/assets/og.png
COPY --chown=101:101 public/favicon.png /usr/share/nginx/html/assets/favicon.png
COPY --chown=101:101 landing-page/assets/ /usr/share/nginx/html/assets/

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:8080/healthz | grep -q '^ok$' || exit 1
