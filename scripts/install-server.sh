#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_ROOT="/opt/pkpkdupr"

ROOT_DIR="${SOURCE_REPO_ROOT}"
ENV_FILE="${DEPLOY_ROOT}/.env"
DOMAIN_DEFAULT="pkpkdupr.duckdns.org"
WEB_PUBLIC_PORT_DEFAULT="443"
ADMIN_STACK_PORT_DEFAULT="3333"
GHCR_NAMESPACE_DEFAULT="neizzz"
IMAGE_TAG_DEFAULT="latest"
SWAG_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/default.conf.template"
SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/default.conf"
COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.build.yml)

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "❌ '$1' 명령이 필요합니다." >&2
    exit 1
  fi
}

random_hex() {
  if command -v openssl >/dev/null 2>&1; then
    openssl rand -hex 32
    return
  fi

  od -An -N32 -tx1 /dev/urandom | tr -d ' \n'
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

wait_for_file() {
  local path="$1"
  local attempts="${2:-60}"

  for _ in $(seq 1 "${attempts}"); do
    if [[ -f "${path}" ]]; then
      return 0
    fi
    sleep 2
  done

  echo "❌ 필요한 파일이 생성되지 않았습니다: ${path}" >&2
  exit 1
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

docker compose version >/dev/null

echo "ℹ️ 소스 repo 루트: ${SOURCE_REPO_ROOT}"
echo "ℹ️ 배포 루트: ${DEPLOY_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
cd "${SOURCE_REPO_ROOT}"

if [[ ! -f "${ENV_FILE}" ]]; then
  umask 077
  JWT_SECRET_VALUE="$(random_hex)"
  USER_ID="$(id -u)"
  GROUP_ID="$(id -g)"

  cat > "${ENV_FILE}" <<EOF
DOMAIN=${DOMAIN_DEFAULT}
WEB_PUBLIC_PORT=${WEB_PUBLIC_PORT_DEFAULT}
ADMIN_STACK_PORT=${ADMIN_STACK_PORT_DEFAULT}
DUCKDNSTOKEN=replace-with-your-duckdns-token
GHCR_NAMESPACE=${GHCR_NAMESPACE_DEFAULT}
IMAGE_TAG=${IMAGE_TAG_DEFAULT}
JWT_SECRET=${JWT_SECRET_VALUE}
VITE_API_BASE_URL=https://${DOMAIN_DEFAULT}:${ADMIN_STACK_PORT_DEFAULT}
API_ADMIN_USERNAME=admin
API_ADMIN_PASSWORD=admin123qwe
GF_SECURITY_ADMIN_USER=admin
GF_SECURITY_ADMIN_PASSWORD=admin123qwe
GF_SERVER_ROOT_URL=https://${DOMAIN_DEFAULT}:${ADMIN_STACK_PORT_DEFAULT}/grafana/
GF_SERVER_SERVE_FROM_SUB_PATH=true
UID=${USER_ID}
GID=${GROUP_ID}
EOF

  echo "✅ .env 파일을 생성했습니다: ${ENV_FILE}"
  echo "   - DOMAIN=${DOMAIN_DEFAULT}"
  echo "   - WEB_PUBLIC_PORT=${WEB_PUBLIC_PORT_DEFAULT}"
  echo "   - ADMIN_STACK_PORT=${ADMIN_STACK_PORT_DEFAULT}"
  echo "   - VITE_API_BASE_URL=https://${DOMAIN_DEFAULT}:${ADMIN_STACK_PORT_DEFAULT}"
  echo "   - API_ADMIN_USERNAME=admin"
  echo "   - API_ADMIN_PASSWORD=admin123qwe"
  echo "   - GF_SECURITY_ADMIN_USER=admin"
  echo "   - GF_SECURITY_ADMIN_PASSWORD=admin123qwe"
else
  echo "ℹ️ 기존 .env 파일을 사용합니다: ${ENV_FILE}"
fi

DUCKDNS_TOKEN_VALUE="$(read_env_value DUCKDNSTOKEN)"
if [[ -z "${DUCKDNS_TOKEN_VALUE}" || "${DUCKDNS_TOKEN_VALUE}" == "replace-with-your-duckdns-token" ]]; then
  echo "❌ DUCKDNSTOKEN 값을 .env에 설정해야 DuckDNS DNS 검증으로 인증서를 발급할 수 있습니다." >&2
  echo "   예: DUCKDNSTOKEN=your-real-duckdns-token" >&2
  exit 1
fi

DOMAIN_VALUE="$(read_env_value DOMAIN)"
DOMAIN_VALUE="${DOMAIN_VALUE:-${DOMAIN_DEFAULT}}"
WEB_PUBLIC_PORT_VALUE="$(read_env_value WEB_PUBLIC_PORT)"
WEB_PUBLIC_PORT_VALUE="${WEB_PUBLIC_PORT_VALUE:-${WEB_PUBLIC_PORT_DEFAULT}}"
ADMIN_STACK_PORT_VALUE="$(read_env_value ADMIN_STACK_PORT)"
ADMIN_STACK_PORT_VALUE="${ADMIN_STACK_PORT_VALUE:-${ADMIN_STACK_PORT_DEFAULT}}"

mkdir -p \
  "${DEPLOY_ROOT}/data/db" \
  "${DEPLOY_ROOT}/data/uploads/avatars" \
  "${DEPLOY_ROOT}/data/certs"

sync_duckdns_credentials "${DUCKDNS_TOKEN_VALUE}"

echo "🚀 SWAG 초기화 중..."
docker compose --env-file "${ENV_FILE}" "${COMPOSE_FILES[@]}" up -d proxy

wait_for_file "${DEPLOY_ROOT}/data/certs/nginx/proxy.conf"

mkdir -p "$(dirname "${SWAG_TARGET}")"
sed "s/__DOMAIN__/${DOMAIN_VALUE}/g" "${SWAG_TEMPLATE}" > "${SWAG_TARGET}"
echo "✅ SWAG site config 동기화 완료: ${SWAG_TARGET}"

echo "🚀 전체 서비스 배포 중..."
docker compose --env-file "${ENV_FILE}" "${COMPOSE_FILES[@]}" up -d --build
docker compose --env-file "${ENV_FILE}" "${COMPOSE_FILES[@]}" restart proxy

echo "📦 현재 컨테이너 상태"
docker compose --env-file "${ENV_FILE}" "${COMPOSE_FILES[@]}" ps

echo "🪵 최근 로그"
docker compose --env-file "${ENV_FILE}" "${COMPOSE_FILES[@]}" logs --tail=40 proxy web admin-web api db-server grafana prometheus db-exporter || true

WEB_BASE_URL="https://${DOMAIN_VALUE}"
ADMIN_STACK_BASE_URL="https://${DOMAIN_VALUE}:${ADMIN_STACK_PORT_VALUE}"
echo "🔎 HTTPS 응답 확인 중..."
wait_for_url "${WEB_BASE_URL}/"
wait_for_url "${ADMIN_STACK_BASE_URL}/api/health"
wait_for_url "${ADMIN_STACK_BASE_URL}/api/ping"
wait_for_url "${ADMIN_STACK_BASE_URL}/admin/"
wait_for_url "${ADMIN_STACK_BASE_URL}/grafana/"

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

echo "🎉 서버 배포가 완료되었습니다: web=${WEB_BASE_URL}, admin-stack=${ADMIN_STACK_BASE_URL}"
