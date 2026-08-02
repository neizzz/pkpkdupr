#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="${PKPKDUPR_DEPLOY_PATH:-/opt/pkpkdupr}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_DIR="${DEPLOY_ROOT}/env"
SHARED_ENV_FILE="${ENV_DIR}/shared.env"
PRIMARY_ENV_FILE="${ENV_DIR}/pkpkdupr.env"
PKELO_ENV_FILE="${ENV_DIR}/pkelo.env"
NOTICE_ENV_FILE="${ENV_DIR}/pkelo-notice.env"
NOTICE_DATA_PATH="${DEPLOY_ROOT}/data/pkelo-notice"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ '$1' 명령이 필요합니다." >&2; exit 1; }
}

require_file() {
  [[ -f "$1" ]] || { echo "❌ 필요한 파일이 없습니다: $1" >&2; exit 1; }
}

compose_proxy() {
  docker compose --project-name pkpkdupr --env-file "${SHARED_ENV_FILE}" --env-file "${PRIMARY_ENV_FILE}" -f docker-compose.proxy.yml "$@"
}

compose_certificate() {
  docker compose --project-name pkelo-certificate --env-file "${SHARED_ENV_FILE}" --env-file "${PKELO_ENV_FILE}" -f docker-compose.pkelo-certificate.yml "$@"
}

compose_primary() {
  docker compose --project-name pkpkdupr --env-file "${SHARED_ENV_FILE}" --env-file "${PRIMARY_ENV_FILE}" -f docker-compose.yml -f docker-compose.pkpkdupr-gateway.yml "$@"
}

compose_pkelo() {
  docker compose --project-name pkelo --env-file "${SHARED_ENV_FILE}" --env-file "${PKELO_ENV_FILE}" -f docker-compose.pkelo.yml -f docker-compose.pkelo-gateway.yml "$@"
}

compose_notice() {
  PKELO_NOTICE_DATA_PATH="${NOTICE_DATA_PATH}" docker compose --project-name pkelo-notice \
    --env-file "${SHARED_ENV_FILE}" --env-file "${NOTICE_ENV_FILE}" \
    -f docker-compose.pkelo-notice.yml "$@"
}

require_command docker
docker compose version >/dev/null
require_file "${SHARED_ENV_FILE}"
require_file "${PRIMARY_ENV_FILE}"
require_file "${PKELO_ENV_FILE}"

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
echo "🧹 앱 컨테이너·orphan만 정리합니다. named volume, data, 이미지는 유지됩니다."

compose_primary down --remove-orphans
compose_pkelo down --remove-orphans
if [[ -f "${NOTICE_ENV_FILE}" ]]; then
  compose_notice down --remove-orphans
fi
compose_certificate down --remove-orphans
compose_proxy down --remove-orphans

echo "📦 현재 컨테이너 상태"
compose_primary ps --all || true
compose_pkelo ps --all || true
if [[ -f "${NOTICE_ENV_FILE}" ]]; then
  compose_notice ps --all || true
fi
compose_proxy ps --all || true
echo "✅ 안전 청소가 완료되었습니다."
