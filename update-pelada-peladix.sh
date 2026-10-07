#!/usr/bin/env bash

set -Eeuo pipefail

if [[ $# -ne 1 || -z "${1//[[:space:]]/}" ]]; then
  printf 'Uso: %s "Mensagem da atualização"\n' "$(basename "$0")" >&2
  exit 64
fi

readonly UPDATE_MESSAGE="$1"
readonly SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
readonly MOBILE_PATH="${SCRIPT_DIR}/mobile"

if [[ ! -f "${MOBILE_PATH}/package.json" ]]; then
  printf 'A pasta mobile não foi encontrada em: %s\n' "$MOBILE_PATH" >&2
  exit 1
fi

if ! command -v npx >/dev/null 2>&1; then
  printf 'O npx não foi encontrado. Instale o Node.js e confirme que ele está disponível no PATH.\n' >&2
  exit 127
fi

if [[ ! -f "${MOBILE_PATH}/node_modules/expo-router/package.json" ]]; then
  printf 'Dependências mobile ausentes; executando npm ci em %s...\n' "$MOBILE_PATH"
  (
    cd -- "$MOBILE_PATH"
    npm ci
  )
fi

export EXPO_APP_VARIANT="peladix"
export EXPO_APP_NAME="Peladix"
export EXPO_APP_SLUG="pelada-peladix"
export EXPO_APP_SCHEME="peladix"
export EXPO_ANDROID_PACKAGE="br.com.peladix.app"
export EXPO_IOS_BUNDLE_IDENTIFIER="br.com.peladix.app"
export EXPO_EAS_PROJECT_ID="4a4cf359-9c40-43b8-93bd-57a2ab53aa43"
export EXPO_UPDATES_URL="https://u.expo.dev/4a4cf359-9c40-43b8-93bd-57a2ab53aa43"
export EXPO_OWNER="davidvegabr"

export EXPO_PUBLIC_API_BASE_URL="https://peladix.vegaalameda.com"
export EXPO_PUBLIC_WEB_BASE_URL="https://peladix.vegaalameda.com"
export EXPO_PUBLIC_APP_ENV="preview"

export EXPO_APP_ICON="./assets/icon-peladix.png"
export EXPO_ADAPTIVE_ICON="./assets/adaptive-icon-peladix.png"
export EXPO_NOTIFICATION_ICON="./assets/notification-icon-peladix.png"
export EXPO_GOOGLE_SERVICES_FILE="./google-services-peladix.json"
export EXPO_PRIMARY_COLOR="#440052"
export EXPO_ADAPTIVE_BACKGROUND_COLOR="#FFFFFF"

cd -- "$MOBILE_PATH"

npx eas-cli@latest update \
  --channel preview \
  --environment preview \
  --platform android \
  --message "$UPDATE_MESSAGE"
