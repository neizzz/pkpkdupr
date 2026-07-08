#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="/opt/pkpkdupr"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"

ROOT_DIR="${SOURCE_REPO_ROOT}"
ENV_FILE="${DEPLOY_ROOT}/.env"
IMAGE_TAG_INPUT="${1:-${IMAGE_TAG:-latest}}"
DOMAIN_DEFAULT="pkpkdupr.duckdns.org"
WEB_PUBLIC_PORT_DEFAULT="443"
ADMIN_STACK_PORT_DEFAULT="3333"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ '$1' 명령이 필요합니다." >&2
    exit 1
  fi
}

read_env_value() {
  local key="$1"
  local value
  value="$(awk -F= -v target="$key" '$1 == target { print substr($0, index($0, "=") + 1) }' "${ENV_FILE}" | tail -n 1)"
  printf '%s' "${value}"
}

sync_duckdns_credentials() {
  local token="$1"
  local credentials_file="${DEPLOY_ROOT}/data/certs/dns-conf/duckdns.ini"

  mkdir -p "$(dirname "${credentials_file}")"
  umask 077
  printf 'dns_duckdns_token=%s\n' "${token}" > "${credentials_file}"
  chmod 600 "${credentials_file}"

  echo "✅ DuckDNS credential 파일 동기화 완료: ${credentials_file}"
}

wait_for_url() {
  local url="$1"
  local attempts="${2:-60}"

  for _ in $(seq 1 "${attempts}"); do
    if curl -fsS "${url}" >/dev/null 2>&1; then
      return 0
    fi
    sleep 5
  done

  echo "❌ URL 응답 대기 실패: ${url}" >&2
  exit 1
}

require_command docker
require_command curl

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "❌ .env 파일이 없습니다. 먼저 scripts/install-server.sh를 실행하세요." >&2
  exit 1
fi

docker compose version >/dev/null

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
echo "ℹ️ 소스 repo 루트: ${SOURCE_REPO_ROOT}"
echo "ℹ️ 배포 루트: ${DEPLOY_ROOT}"

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
else
  echo "ℹ️ GHCR_USERNAME/GHCR_TOKEN이 없어 기존 docker login 상태를 사용합니다."
fi

export IMAGE_TAG="${IMAGE_TAG_INPUT}"
DUCKDNS_TOKEN_VALUE="$(read_env_value DUCKDNSTOKEN)"
if [[ -z "${DUCKDNS_TOKEN_VALUE}" || "${DUCKDNS_TOKEN_VALUE}" == "replace-with-your-duckdns-token" ]]; then
  echo "❌ DUCKDNSTOKEN 값을 ${ENV_FILE}에 설정해야 DuckDNS DNS 검증으로 인증서를 발급/갱신할 수 있습니다." >&2
  echo "   예: DUCKDNSTOKEN=your-real-duckdns-token" >&2
  exit 1
fi

sync_duckdns_credentials "${DUCKDNS_TOKEN_VALUE}"

DOMAIN_VALUE="$(read_env_value DOMAIN)"
DOMAIN_VALUE="${DOMAIN_VALUE:-${DOMAIN_DEFAULT}}"
WEB_PUBLIC_PORT_VALUE="$(read_env_value WEB_PUBLIC_PORT)"
WEB_PUBLIC_PORT_VALUE="${WEB_PUBLIC_PORT_VALUE:-${WEB_PUBLIC_PORT_DEFAULT}}"
ADMIN_STACK_PORT_VALUE="$(read_env_value ADMIN_STACK_PORT)"
ADMIN_STACK_PORT_VALUE="${ADMIN_STACK_PORT_VALUE:-${ADMIN_STACK_PORT_DEFAULT}}"
WEB_BASE_URL="https://${DOMAIN_VALUE}"
ADMIN_STACK_BASE_URL="https://${DOMAIN_VALUE}:${ADMIN_STACK_PORT_VALUE}"

echo "📥 이미지 pull 중 (tag=${IMAGE_TAG})..."
docker compose --env-file "${ENV_FILE}" pull web admin-web api db-server uptime-kuma sqlite-web

echo "🚀 서비스 업데이트 중..."
docker compose --env-file "${ENV_FILE}" up -d proxy web admin-web api db-server uptime-kuma sqlite-web

echo "📦 현재 컨테이너 상태"
docker compose --env-file "${ENV_FILE}" ps

echo "🪵 최근 로그"
docker compose --env-file "${ENV_FILE}" logs --tail=40 proxy web admin-web api db-server uptime-kuma sqlite-web || true

echo "🔎 HTTPS 응답 확인 중..."
wait_for_url "${WEB_BASE_URL}/"
wait_for_url "${ADMIN_STACK_BASE_URL}/api/health"
wait_for_url "${ADMIN_STACK_BASE_URL}/api/ping"
wait_for_url "${ADMIN_STACK_BASE_URL}/admin/"
wait_for_url "${ADMIN_STACK_BASE_URL}/uptime/"
wait_for_url "${ADMIN_STACK_BASE_URL}/db/"

if command -v node >/dev/null 2>&1; then
  echo "🩺 Node healthy check 실행"
  PKPKDUPR_WEB_URL="${WEB_BASE_URL}" \
    PKPKDUPR_ADMIN_STACK_URL="${ADMIN_STACK_BASE_URL}" \
    node scripts/check-healthy.mjs
else
  echo "ℹ️ node가 없어 scripts/check-healthy.mjs는 건너뜁니다."
  echo "   필요 시 node 설치 후 아래 명령을 실행하세요:"
  echo "   PKPKDUPR_WEB_URL=${WEB_BASE_URL} PKPKDUPR_ADMIN_STACK_URL=${ADMIN_STACK_BASE_URL} node scripts/check-healthy.mjs"
fi

echo "🎉 서버 업데이트가 완료되었습니다: web=${WEB_BASE_URL}, admin-stack=${ADMIN_STACK_BASE_URL} (tag=${IMAGE_TAG})"
