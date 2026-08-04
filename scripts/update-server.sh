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
IMAGE_TAG_INPUT="${1:-${IMAGE_TAG:-latest}}"
TARGET_STACK="${2:-all}"
SWAG_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/default.conf.template"
SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/default.conf"
PKELO_APP_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-app.conf.template"
PKELO_NOTICE_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-notice.conf.template"
PKELO_MODE_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-mode.conf"
PKELO_SSL_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-ssl.conf.template"
PKELO_SSL_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-ssl.conf"
PKELO_CERT_ROOT="${DEPLOY_ROOT}/data/pkelo-certs"
NOTICE_DATA_PATH="${DEPLOY_ROOT}/data/pkelo-notice"
NOTICE_STATE_FILE="${NOTICE_DATA_PATH}/state.env"

require_command() {
  command -v "$1" >/dev/null 2>&1 || { echo "❌ '$1' 명령이 필요합니다." >&2; exit 1; }
}

require_file() {
  [[ -f "$1" ]] || { echo "❌ 필요한 파일이 없습니다: $1" >&2; exit 1; }
}

read_env_value() {
  local env_file="$1" key="$2"
  awk -F= -v target="${key}" '$1 == target { print substr($0, index($0, "=") + 1) }' "${env_file}" | tail -n 1
}

require_env_value() {
  case "$3" in
    ""|replace-with-*) echo "❌ $1의 $2 값을 설정해야 합니다." >&2; exit 1 ;;
  esac
}

sync_credentials() {
  mkdir -p "${DEPLOY_ROOT}/data/certs/dns-conf" "${PKELO_CERT_ROOT}/dns-conf"
  umask 077
  printf 'dns_duckdns_token=%s\n' "${PRIMARY_DUCKDNS_TOKEN}" > "${DEPLOY_ROOT}/data/certs/dns-conf/duckdns.ini"
  printf 'dns_cloudflare_api_token=%s\n' "${PKELO_CLOUDFLARE_TOKEN}" > "${PKELO_CERT_ROOT}/dns-conf/cloudflare.ini"
  chmod 600 "${DEPLOY_ROOT}/data/certs/dns-conf/duckdns.ini" "${PKELO_CERT_ROOT}/dns-conf/cloudflare.ini"
}

render_template() {
  local template="$1" target="$2" temp_file
  mkdir -p "$(dirname "${target}")"
  temp_file="$(mktemp "$(dirname "${target}")/.$(basename "${target}").XXXXXX")"
  sed -e "s/__DOMAIN__/${PRIMARY_DOMAIN}/g" -e "s/__PKELO_DOMAIN__/${PKELO_DOMAIN}/g" "${template}" > "${temp_file}"
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

wait_for_file() {
  for _ in $(seq 1 "${2:-60}"); do
    [[ -f "$1" ]] && return 0
    sleep 2
  done
  echo "❌ 필요한 파일이 생성되지 않았습니다: $1" >&2
  exit 1
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

resolve_environment() {
  require_file "${SHARED_ENV_FILE}"
  require_file "${PRIMARY_ENV_FILE}"
  require_file "${PKELO_ENV_FILE}"
  require_file "${SWAG_TEMPLATE}"
  require_file "${PKELO_APP_TEMPLATE}"
  require_file "${PKELO_NOTICE_TEMPLATE}"
  require_file "${PKELO_SSL_TEMPLATE}"
  PRIMARY_DOMAIN="$(read_env_value "${PRIMARY_ENV_FILE}" DOMAIN)"; PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-pkpkdupr.duckdns.org}"
  PKELO_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" DOMAIN)"; PKELO_DOMAIN="${PKELO_DOMAIN:-pkelo.app}"
  ADMIN_STACK_PORT="$(read_env_value "${SHARED_ENV_FILE}" ADMIN_STACK_PORT)"; ADMIN_STACK_PORT="${ADMIN_STACK_PORT:-3333}"
  PRIMARY_DUCKDNS_TOKEN="$(read_env_value "${PRIMARY_ENV_FILE}" DUCKDNSTOKEN)"
  PKELO_CLOUDFLARE_TOKEN="$(read_env_value "${PKELO_ENV_FILE}" CLOUDFLARE_DNS_API_TOKEN)"
  PRIMARY_JWT_SECRET="$(read_env_value "${PRIMARY_ENV_FILE}" JWT_SECRET)"
  PKELO_JWT_SECRET="$(read_env_value "${PKELO_ENV_FILE}" JWT_SECRET)"
  PRIMARY_USER_AUTH_PROVIDER="$(read_env_value "${PRIMARY_ENV_FILE}" USER_AUTH_PROVIDER)"; PRIMARY_USER_AUTH_PROVIDER="${PRIMARY_USER_AUTH_PROVIDER:-password}"
  PKELO_USER_AUTH_PROVIDER="$(read_env_value "${PKELO_ENV_FILE}" USER_AUTH_PROVIDER)"; PKELO_USER_AUTH_PROVIDER="${PKELO_USER_AUTH_PROVIDER:-kakao}"
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
  [[ "${PRIMARY_JWT_SECRET}" != "${PKELO_JWT_SECRET}" ]] || { echo "❌ 두 앱의 JWT_SECRET은 서로 달라야 합니다." >&2; exit 1; }
  [[ "${PRIMARY_USER_AUTH_PROVIDER}" == "password" ]] || { echo "❌ ${PRIMARY_ENV_FILE}의 USER_AUTH_PROVIDER는 password여야 합니다." >&2; exit 1; }
  [[ "${PKELO_USER_AUTH_PROVIDER}" == "kakao" ]] || { echo "❌ ${PKELO_ENV_FILE}의 USER_AUTH_PROVIDER는 운영에서 kakao여야 합니다." >&2; exit 1; }
  local key
  for key in KAKAO_REST_API_KEY KAKAO_CLIENT_SECRET KAKAO_REDIRECT_URI KAKAO_WEB_ORIGIN; do
    require_env_value "${PKELO_ENV_FILE}" "${key}" "$(read_env_value "${PKELO_ENV_FILE}" "${key}")"
  done
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

assert_target_services_running() {
  local target="$1"
  case "${target}" in
    pkpkdupr)
      assert_services_running compose_primary web admin-web api mysql db-server adminer
      ;;
    pkelo)
      if is_notice_enabled; then
        assert_services_running compose_notice pkelo-notice-web
      else
        assert_services_running compose_pkelo pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
      fi
      ;;
    all)
      assert_services_running compose_primary web admin-web api mysql db-server adminer
      if is_notice_enabled; then
        assert_services_running compose_notice pkelo-notice-web
      else
        assert_services_running compose_pkelo pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
      fi
      ;;
  esac
}

case "${TARGET_STACK}" in
  pkpkdupr|pkelo|all) ;;
  *) echo "❌ 배포 대상은 pkpkdupr, pkelo, all 중 하나여야 합니다." >&2; exit 1 ;;
esac

require_command docker
require_command sed
docker compose version >/dev/null
cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
export IMAGE_TAG="${IMAGE_TAG_INPUT}"
resolve_environment

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
fi

mkdir -p "${DEPLOY_ROOT}/data/uploads/avatars" "${DEPLOY_ROOT}/data/uploads/pkelo/avatars" "${PKELO_CERT_ROOT}"
sync_credentials
compose_proxy up -d
compose_certificate up -d
wait_for_file "${DEPLOY_ROOT}/data/certs/nginx/proxy.conf"
wait_for_file "${PKELO_CERT_ROOT}/etc/letsencrypt/live/${PKELO_DOMAIN}/fullchain.pem"
sync_proxy_site_configs

case "${TARGET_STACK}" in
  pkpkdupr)
    compose_primary pull web admin-web api mysql db-server adminer
    compose_primary up -d web admin-web api mysql db-server adminer
    ;;
  pkelo)
    if is_notice_enabled; then
      compose_notice pull pkelo-notice-web
      compose_notice up -d pkelo-notice-web
    else
      compose_pkelo pull pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
      compose_pkelo up -d pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
    fi
    ;;
  all)
    compose_primary pull web admin-web api mysql db-server adminer
    compose_primary up -d web admin-web api mysql db-server adminer
    if is_notice_enabled; then
      compose_notice pull pkelo-notice-web
      compose_notice up -d pkelo-notice-web
    else
      compose_pkelo pull pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
      compose_pkelo up -d pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
    fi
    ;;
esac

compose_proxy exec -T proxy nginx -t
compose_proxy exec -T proxy nginx -s reload
assert_target_services_running "${TARGET_STACK}"
echo "🎉 ${TARGET_STACK} 업데이트 완료 (tag=${IMAGE_TAG}, 컨테이너 기동 상태 확인 완료)"
