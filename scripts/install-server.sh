#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
DEPLOY_ROOT="${PKPKDUPR_DEPLOY_PATH:-/opt/pkpkdupr}"
ENV_DIR="${DEPLOY_ROOT}/env"
SHARED_ENV_FILE="${ENV_DIR}/shared.env"
PRIMARY_ENV_FILE="${ENV_DIR}/pkpkdupr.env"
PKELO_ENV_FILE="${ENV_DIR}/pkelo.env"
NOTICE_ENV_FILE="${ENV_DIR}/pkelo-notice.env"
NOTICE_ENV_EXAMPLE="${SOURCE_REPO_ROOT}/env/pkelo-notice.env.example"
SWAG_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/default.conf.template"
SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/default.conf"
PKELO_APP_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-app.conf.template"
PKELO_NOTICE_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-notice.conf.template"
PKELO_MODE_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-mode.conf"
PKELO_SSL_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-ssl.conf.template"
PKELO_SSL_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-ssl.conf"
PKELO_CERT_ROOT="${DEPLOY_ROOT}/data/pkelo-certs"
NOTICE_STATE_FILE="${DEPLOY_ROOT}/data/pkelo-notice/state.env"
NOTICE_DATA_PATH="${DEPLOY_ROOT}/data/pkelo-notice"

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ '$1' 명령이 필요합니다." >&2
    exit 1
  }
}

require_file() {
  local path="$1"
  [[ -f "${path}" ]] || {
    echo "❌ 필요한 파일이 없습니다: ${path}" >&2
    exit 1
  }
}

read_env_value() {
  local env_file="$1"
  local key="$2"
  awk -F= -v target="${key}" '$1 == target { print substr($0, index($0, "=") + 1) }' "${env_file}" | tail -n 1
}

require_env_value() {
  local env_file="$1"
  local key="$2"
  local value="$3"
  case "${value}" in
    ""|replace-with-*)
      echo "❌ ${env_file}의 ${key} 값을 설정해야 합니다." >&2
      exit 1
      ;;
  esac
}

wait_for_file() {
  local path="$1"
  local attempts="${2:-60}"

  for _ in $(seq 1 "${attempts}"); do
    [[ -f "${path}" ]] && return 0
    sleep 2
  done

  echo "❌ 필요한 파일이 생성되지 않았습니다: ${path}" >&2
  exit 1
}

compose_proxy() {
  # 기존 단일 Compose 배포의 proxy 컨테이너 소유 프로젝트명을 유지해 무중단 전환 시 이름 충돌을 막습니다.
  docker compose --project-name pkpkdupr \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PRIMARY_ENV_FILE}" \
    -f docker-compose.proxy.yml "$@"
}

compose_certificate() {
  docker compose --project-name pkelo-certificate \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PKELO_ENV_FILE}" \
    -f docker-compose.pkelo-certificate.yml "$@"
}

compose_primary() {
  docker compose --project-name pkpkdupr \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PRIMARY_ENV_FILE}" \
    -f docker-compose.yml -f docker-compose.pkpkdupr-gateway.yml -f docker-compose.build.yml "$@"
}

compose_pkelo() {
  docker compose --project-name pkelo \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PKELO_ENV_FILE}" \
    -f docker-compose.pkelo.yml -f docker-compose.pkelo-gateway.yml -f docker-compose.pkelo.build.yml "$@"
}

compose_notice() {
  PKELO_NOTICE_DATA_PATH="${NOTICE_DATA_PATH}" docker compose --project-name pkelo-notice \
    --env-file "${SHARED_ENV_FILE}" --env-file "${NOTICE_ENV_FILE}" \
    -f docker-compose.pkelo-notice.yml -f docker-compose.pkelo-notice.build.yml "$@"
}

sync_duckdns_credentials() {
  local token="$1"
  local credentials_file="${DEPLOY_ROOT}/data/certs/dns-conf/duckdns.ini"
  mkdir -p "$(dirname "${credentials_file}")"
  umask 077
  printf 'dns_duckdns_token=%s\n' "${token}" > "${credentials_file}"
  chmod 600 "${credentials_file}"
}

sync_pkelo_cloudflare_credentials() {
  local token="$1"
  local credentials_file="${PKELO_CERT_ROOT}/dns-conf/cloudflare.ini"
  mkdir -p "$(dirname "${credentials_file}")"
  umask 077
  printf 'dns_cloudflare_api_token=%s\n' "${token}" > "${credentials_file}"
  chmod 600 "${credentials_file}"
}

render_template() {
  local template="$1" target="$2" temp_file
  mkdir -p "$(dirname "${target}")"
  temp_file="$(mktemp "$(dirname "${target}")/.$(basename "${target}").XXXXXX")"
  sed \
    -e "s/__DOMAIN__/${PRIMARY_DOMAIN}/g" \
    -e "s/__PKELO_DOMAIN__/${PKELO_DOMAIN}/g" \
    "${template}" > "${temp_file}"
  chmod 644 "${temp_file}"
  mv -f "${temp_file}" "${target}"
}

sync_proxy_site_configs() {
  local pkelo_template="${PKELO_APP_TEMPLATE}"
  if is_notice_enabled; then
    pkelo_template="${PKELO_NOTICE_TEMPLATE}"
  fi
  render_template "${SWAG_TEMPLATE}" "${SWAG_TARGET}"
  render_template "${pkelo_template}" "${PKELO_MODE_TARGET}"
  render_template "${PKELO_SSL_TEMPLATE}" "${PKELO_SSL_TARGET}"
}

is_notice_enabled() {
  [[ -f "${NOTICE_STATE_FILE}" ]] && [[ "$(read_env_value "${NOTICE_STATE_FILE}" PKELO_NOTICE_ENABLED)" == "true" ]]
}

ensure_notice_env() {
  if [[ -f "${NOTICE_ENV_FILE}" ]]; then
    return
  fi
  require_file "${NOTICE_ENV_EXAMPLE}"
  umask 077
  cp "${NOTICE_ENV_EXAMPLE}" "${NOTICE_ENV_FILE}"
  chmod 600 "${NOTICE_ENV_FILE}"
  echo "ℹ️ 기본 PKELO 안내 설정을 생성했습니다: ${NOTICE_ENV_FILE}"
}

resolve_environment() {
  require_file "${SHARED_ENV_FILE}"
  require_file "${PRIMARY_ENV_FILE}"
  require_file "${PKELO_ENV_FILE}"
  require_file "${SWAG_TEMPLATE}"
  require_file "${PKELO_APP_TEMPLATE}"
  require_file "${PKELO_NOTICE_TEMPLATE}"
  require_file "${PKELO_SSL_TEMPLATE}"

  PRIMARY_DOMAIN="$(read_env_value "${PRIMARY_ENV_FILE}" DOMAIN)"
  PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-pkpkdupr.duckdns.org}"
  PKELO_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" DOMAIN)"
  PKELO_DOMAIN="${PKELO_DOMAIN:-pkelo.app}"
  ADMIN_STACK_PORT="$(read_env_value "${SHARED_ENV_FILE}" ADMIN_STACK_PORT)"
  ADMIN_STACK_PORT="${ADMIN_STACK_PORT:-3333}"
  PRIMARY_DUCKDNS_TOKEN="$(read_env_value "${PRIMARY_ENV_FILE}" DUCKDNSTOKEN)"
  PKELO_CLOUDFLARE_TOKEN="$(read_env_value "${PKELO_ENV_FILE}" CLOUDFLARE_DNS_API_TOKEN)"
  PRIMARY_JWT_SECRET="$(read_env_value "${PRIMARY_ENV_FILE}" JWT_SECRET)"
  PKELO_JWT_SECRET="$(read_env_value "${PKELO_ENV_FILE}" JWT_SECRET)"
  PRIMARY_USER_AUTH_PROVIDER="$(read_env_value "${PRIMARY_ENV_FILE}" USER_AUTH_PROVIDER)"
  PKELO_USER_AUTH_PROVIDER="$(read_env_value "${PKELO_ENV_FILE}" USER_AUTH_PROVIDER)"
  PRIMARY_USER_AUTH_PROVIDER="${PRIMARY_USER_AUTH_PROVIDER:-password}"
  PKELO_USER_AUTH_PROVIDER="${PKELO_USER_AUTH_PROVIDER:-kakao}"

  require_env_value "${PRIMARY_ENV_FILE}" DUCKDNSTOKEN "${PRIMARY_DUCKDNS_TOKEN}"
  require_env_value "${PKELO_ENV_FILE}" CLOUDFLARE_DNS_API_TOKEN "${PKELO_CLOUDFLARE_TOKEN}"
  require_env_value "${PRIMARY_ENV_FILE}" JWT_SECRET "${PRIMARY_JWT_SECRET}"
  require_env_value "${PKELO_ENV_FILE}" JWT_SECRET "${PKELO_JWT_SECRET}"

  local env_file key
  for env_file in "${PRIMARY_ENV_FILE}" "${PKELO_ENV_FILE}"; do
    for key in API_ADMIN_PASSWORD MYSQL_PASSWORD MYSQL_ROOT_PASSWORD MYSQL_VIEWER_PASSWORD; do
      require_env_value "${env_file}" "${key}" "$(read_env_value "${env_file}" "${key}")"
    done
  done

  if [[ "${PRIMARY_JWT_SECRET}" == "${PKELO_JWT_SECRET}" ]]; then
    echo "❌ 두 앱의 JWT_SECRET은 서로 달라야 합니다." >&2
    exit 1
  fi

  if [[ "${PRIMARY_USER_AUTH_PROVIDER}" != "password" ]]; then
    echo "❌ ${PRIMARY_ENV_FILE}의 USER_AUTH_PROVIDER는 password여야 합니다." >&2
    exit 1
  fi
  if [[ "${PKELO_USER_AUTH_PROVIDER}" != "kakao" ]]; then
    echo "❌ ${PKELO_ENV_FILE}의 USER_AUTH_PROVIDER는 운영에서 kakao여야 합니다." >&2
    exit 1
  fi
  local key
  for key in KAKAO_REST_API_KEY KAKAO_CLIENT_SECRET KAKAO_REDIRECT_URI KAKAO_WEB_ORIGIN; do
    require_env_value "${PKELO_ENV_FILE}" "${key}" "$(read_env_value "${PKELO_ENV_FILE}" "${key}")"
  done
}

set_build_version() {
  if [[ -n "${VITE_APP_VERSION:-}" ]]; then
    return
  fi

  VITE_APP_VERSION="$(git -C "${SOURCE_REPO_ROOT}" describe --tags --abbrev=0 2>/dev/null || true)"
  if [[ -z "${VITE_APP_VERSION}" ]]; then
    VITE_APP_VERSION="0.0.0+$(git -C "${SOURCE_REPO_ROOT}" rev-parse --short=8 HEAD 2>/dev/null || echo unknown)"
  fi
  export VITE_APP_VERSION
}

assert_services_running() {
  local compose_function="$1"
  shift
  local service
  for service in "$@"; do
    if ! "$compose_function" ps --status running --services | awk -v expected="${service}" '$0 == expected { found = 1 } END { exit !found }'; then
      echo "❌ ${service} 컨테이너가 running 상태가 아닙니다." >&2
      "$compose_function" ps "${service}" >&2 || true
      exit 1
    fi
  done
}

assert_all_services_running() {
  assert_services_running compose_primary web admin-web api mysql db-server adminer
  if is_notice_enabled; then
    assert_services_running compose_notice pkelo-notice-web
  else
    assert_services_running compose_pkelo pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
  fi
}

require_command docker
require_command sed
docker compose version >/dev/null

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
resolve_environment
ensure_notice_env

mkdir -p \
  "${DEPLOY_ROOT}/data/uploads/avatars" \
  "${DEPLOY_ROOT}/data/uploads/pkelo/avatars" \
  "${DEPLOY_ROOT}/data/certs" \
  "${PKELO_CERT_ROOT}"
sync_duckdns_credentials "${PRIMARY_DUCKDNS_TOKEN}"
sync_pkelo_cloudflare_credentials "${PKELO_CLOUDFLARE_TOKEN}"

echo "🚀 공용 SWAG와 pkelo.app 인증서 초기화 중..."
compose_proxy up -d
compose_certificate up -d
wait_for_file "${DEPLOY_ROOT}/data/certs/nginx/proxy.conf"
wait_for_file "${PKELO_CERT_ROOT}/etc/letsencrypt/live/${PKELO_DOMAIN}/fullchain.pem"
sync_proxy_site_configs
compose_proxy exec -T proxy nginx -t
compose_proxy exec -T proxy nginx -s reload

set_build_version
echo "🚀 기존 앱 스택 배포 중..."
compose_primary up -d --build
if is_notice_enabled; then
  echo "🚀 PKELO 안내 web을 유지·갱신 중..."
  compose_notice up -d --build
else
  echo "🚀 pkelo.app 스택 배포 중..."
  compose_pkelo up -d --build
fi
compose_proxy exec -T proxy nginx -t
compose_proxy exec -T proxy nginx -s reload

assert_all_services_running
echo "🎉 설치 완료: pkpkdupr=https://${PRIMARY_DOMAIN}, pkelo=https://${PKELO_DOMAIN} (컨테이너 기동 상태 확인 완료)"
