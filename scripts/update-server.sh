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
PKPKDUPR_SWAG_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkpkdupr.conf.template"
PKPKDUPR_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkpkdupr.conf"
PKELO_APP_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-app.conf.template"
PKELO_NOTICE_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-notice.conf.template"
PKELO_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkelo.conf"
PKELO_ADMIN_APP_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-admin.conf.template"
PKELO_ADMIN_NOTICE_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-admin-notice.conf.template"
PKELO_ADMIN_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkelo-admin.conf"
PKELO_LEGACY_PORT_DENY_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-legacy-port-deny.conf.template"
PKELO_LEGACY_PORT_DENY_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkelo-legacy-port-deny.conf"
PKELO_SSL_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-ssl.conf.template"
PKELO_SSL_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-ssl.conf"
LEGACY_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/default.conf"
LEGACY_PKELO_MODE_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-mode.conf"
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
  sed \
    -e "s/__DOMAIN__/${PRIMARY_DOMAIN:-}/g" \
    -e "s/__PKELO_DOMAIN__/${PKELO_DOMAIN:-}/g" \
    -e "s/__PKELO_ADMIN_DOMAIN__/${PKELO_ADMIN_DOMAIN:-}/g" \
    "${template}" > "${temp_file}"
  chmod 644 "${temp_file}"
  mv -f "${temp_file}" "${target}"
}

copy_file_atomically() {
  local source="$1" target="$2" temp_file
  mkdir -p "$(dirname "${target}")"
  temp_file="$(mktemp "$(dirname "${target}")/.$(basename "${target}").XXXXXX")"
  cat "${source}" > "${temp_file}"
  chmod 644 "${temp_file}"
  mv -f "${temp_file}" "${target}"
}

migrate_legacy_proxy_site_configs() {
  if [[ ! -f "${PKPKDUPR_SWAG_TARGET}" && -f "${LEGACY_SWAG_TARGET}" ]]; then
    local temp_file
    mkdir -p "$(dirname "${PKPKDUPR_SWAG_TARGET}")"
    temp_file="$(mktemp "$(dirname "${PKPKDUPR_SWAG_TARGET}")/.$(basename "${PKPKDUPR_SWAG_TARGET}").XXXXXX")"
    sed \
      -e '/^# pkelo\.app은 일반 서비스와 임시 안내 모드 중 하나를 /d' \
      -e '/^# 원자적으로 생성해 include합니다\. 이 파일은 site-confs 밖에 두어 SWAG glob에 중복되지 않습니다\.$/d' \
      -e '/^[[:space:]]*include[[:space:]]*\/config\/nginx\/pkelo-mode\.conf;[[:space:]]*$/d' \
      "${LEGACY_SWAG_TARGET}" > "${temp_file}"
    chmod 644 "${temp_file}"
    mv -f "${temp_file}" "${PKPKDUPR_SWAG_TARGET}"
  fi

  if [[ ! -f "${PKELO_SWAG_TARGET}" && -f "${LEGACY_PKELO_MODE_TARGET}" ]]; then
    copy_file_atomically "${LEGACY_PKELO_MODE_TARGET}" "${PKELO_SWAG_TARGET}"
  fi
}

retire_legacy_proxy_site_configs() {
  if [[ -f "${PKPKDUPR_SWAG_TARGET}" && -f "${PKELO_SWAG_TARGET}" ]]; then
    rm -f "${LEGACY_SWAG_TARGET}" "${LEGACY_PKELO_MODE_TARGET}"
  fi
}

sync_pkpkdupr_proxy_site_config() {
  render_template "${PKPKDUPR_SWAG_TEMPLATE}" "${PKPKDUPR_SWAG_TARGET}"
}

sync_pkelo_proxy_site_config() {
  local pkelo_template="${PKELO_APP_TEMPLATE}"
  local pkelo_admin_template="${PKELO_ADMIN_APP_TEMPLATE}"
  if is_notice_enabled; then
    pkelo_template="${PKELO_NOTICE_TEMPLATE}"
    pkelo_admin_template="${PKELO_ADMIN_NOTICE_TEMPLATE}"
  fi
  render_template "${pkelo_template}" "${PKELO_SWAG_TARGET}"
  render_template "${pkelo_admin_template}" "${PKELO_ADMIN_SWAG_TARGET}"
  render_template "${PKELO_LEGACY_PORT_DENY_TEMPLATE}" "${PKELO_LEGACY_PORT_DENY_TARGET}"
  render_template "${PKELO_SSL_TEMPLATE}" "${PKELO_SSL_TARGET}"
}

sync_proxy_site_configs() {
  sync_pkpkdupr_proxy_site_config
  sync_pkelo_proxy_site_config
}

require_running_proxy() {
  if [[ "$(docker inspect -f '{{.State.Running}}' pkpkdupr-proxy 2>/dev/null || true)" != "true" ]]; then
    echo "❌ 공용 SWAG proxy가 실행 중이지 않습니다. 최초 설치는 --stack all 또는 install-server.sh를 사용하세요." >&2
    exit 1
  fi
}

backup_proxy_site_configs() {
  local backup_dir="$1"
  local path
  for path in \
    "${PKPKDUPR_SWAG_TARGET}" "${PKELO_SWAG_TARGET}" "${PKELO_ADMIN_SWAG_TARGET}" \
    "${PKELO_LEGACY_PORT_DENY_TARGET}" "${PKELO_SSL_TARGET}" \
    "${LEGACY_SWAG_TARGET}" "${LEGACY_PKELO_MODE_TARGET}"; do
    local name
    name="$(basename "${path}")"
    if [[ -f "${path}" ]]; then
      cp -p "${path}" "${backup_dir}/${name}"
    else
      : > "${backup_dir}/${name}.absent"
    fi
  done
}

restore_proxy_site_configs() {
  local backup_dir="$1"
  local path
  for path in \
    "${PKPKDUPR_SWAG_TARGET}" "${PKELO_SWAG_TARGET}" "${PKELO_ADMIN_SWAG_TARGET}" \
    "${PKELO_LEGACY_PORT_DENY_TARGET}" "${PKELO_SSL_TARGET}" \
    "${LEGACY_SWAG_TARGET}" "${LEGACY_PKELO_MODE_TARGET}"; do
    local name
    name="$(basename "${path}")"
    if [[ -f "${backup_dir}/${name}" ]]; then
      mkdir -p "$(dirname "${path}")"
      cp -p "${backup_dir}/${name}" "${path}"
    else
      rm -f "${path}"
    fi
  done
}

apply_proxy_site_configs() {
  local target="$1" backup_dir
  backup_dir="$(mktemp -d)"
  backup_proxy_site_configs "${backup_dir}"

  rollback_proxy_site_configs() {
    echo "❌ 새 SWAG 설정 적용에 실패했습니다. 기존 설정으로 되돌립니다." >&2
    restore_proxy_site_configs "${backup_dir}"
    docker exec pkpkdupr-proxy nginx -t >/dev/null 2>&1 && docker exec pkpkdupr-proxy nginx -s reload || true
    rm -rf "${backup_dir}"
  }

  if ! migrate_legacy_proxy_site_configs; then
    rollback_proxy_site_configs
    return 1
  fi

  case "${target}" in
    pkpkdupr)
      if ! sync_pkpkdupr_proxy_site_config; then
        rollback_proxy_site_configs
        return 1
      fi
      ;;
    pkelo)
      if ! sync_pkelo_proxy_site_config; then
        rollback_proxy_site_configs
        return 1
      fi
      ;;
    all)
      if ! sync_proxy_site_configs; then
        rollback_proxy_site_configs
        return 1
      fi
      ;;
  esac

  if ! retire_legacy_proxy_site_configs || ! docker exec pkpkdupr-proxy nginx -t || ! docker exec pkpkdupr-proxy nginx -s reload; then
    rollback_proxy_site_configs
    return 1
  fi

  rm -rf "${backup_dir}"
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

verify_pkelo_certificate_hosts() {
  local certificate_file="${PKELO_CERT_ROOT}/etc/letsencrypt/live/${PKELO_DOMAIN}/fullchain.pem"
  local host
  for host in "${PKELO_DOMAIN}" "${PKELO_ADMIN_DOMAIN}"; do
    openssl x509 -in "${certificate_file}" -noout -checkhost "${host}" >/dev/null || {
      echo "❌ PKELO 인증서에 ${host}가 포함되어 있지 않습니다. bootstrap-pkelo-certificate.sh를 다시 실행하세요." >&2
      exit 1
    }
  done
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

resolve_shared_environment() {
  require_file "${SHARED_ENV_FILE}"
  ADMIN_STACK_PORT="$(read_env_value "${SHARED_ENV_FILE}" ADMIN_STACK_PORT)"
  ADMIN_STACK_PORT="${ADMIN_STACK_PORT:-3333}"
  GATEWAY_NETWORK="$(read_env_value "${SHARED_ENV_FILE}" GATEWAY_NETWORK)"
  GATEWAY_NETWORK="${GATEWAY_NETWORK:-pkpkdupr-gateway}"
}

resolve_primary_environment() {
  require_file "${PRIMARY_ENV_FILE}"
  PRIMARY_DOMAIN="$(read_env_value "${PRIMARY_ENV_FILE}" DOMAIN)"
  PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-pkpkdupr.duckdns.org}"
  PRIMARY_DUCKDNS_TOKEN="$(read_env_value "${PRIMARY_ENV_FILE}" DUCKDNSTOKEN)"
  PRIMARY_JWT_SECRET="$(read_env_value "${PRIMARY_ENV_FILE}" JWT_SECRET)"
  PRIMARY_USER_AUTH_PROVIDER="$(read_env_value "${PRIMARY_ENV_FILE}" USER_AUTH_PROVIDER)"
  PRIMARY_USER_AUTH_PROVIDER="${PRIMARY_USER_AUTH_PROVIDER:-password}"
  require_env_value "${PRIMARY_ENV_FILE}" DUCKDNSTOKEN "${PRIMARY_DUCKDNS_TOKEN}"
  require_env_value "${PRIMARY_ENV_FILE}" JWT_SECRET "${PRIMARY_JWT_SECRET}"
  local key
  for key in API_ADMIN_PASSWORD MYSQL_PASSWORD MYSQL_ROOT_PASSWORD MYSQL_VIEWER_PASSWORD; do
    require_env_value "${PRIMARY_ENV_FILE}" "${key}" "$(read_env_value "${PRIMARY_ENV_FILE}" "${key}")"
  done
  [[ "${PRIMARY_USER_AUTH_PROVIDER}" == "password" ]] || { echo "❌ ${PRIMARY_ENV_FILE}의 USER_AUTH_PROVIDER는 password여야 합니다." >&2; exit 1; }
}

resolve_pkelo_environment() {
  require_file "${PKELO_ENV_FILE}"
  PKELO_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" DOMAIN)"
  PKELO_DOMAIN="${PKELO_DOMAIN:-pkelo.app}"
  PKELO_ADMIN_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" ADMIN_DOMAIN)"
  PKELO_CLOUDFLARE_TOKEN="$(read_env_value "${PKELO_ENV_FILE}" CLOUDFLARE_DNS_API_TOKEN)"
  PKELO_JWT_SECRET="$(read_env_value "${PKELO_ENV_FILE}" JWT_SECRET)"
  PKELO_USER_AUTH_PROVIDER="$(read_env_value "${PKELO_ENV_FILE}" USER_AUTH_PROVIDER)"
  PKELO_USER_AUTH_PROVIDER="${PKELO_USER_AUTH_PROVIDER:-kakao}"
  require_env_value "${PKELO_ENV_FILE}" CLOUDFLARE_DNS_API_TOKEN "${PKELO_CLOUDFLARE_TOKEN}"
  require_env_value "${PKELO_ENV_FILE}" JWT_SECRET "${PKELO_JWT_SECRET}"
  require_env_value "${PKELO_ENV_FILE}" ADMIN_DOMAIN "${PKELO_ADMIN_DOMAIN}"
  local key
  for key in API_ADMIN_PASSWORD MYSQL_PASSWORD MYSQL_ROOT_PASSWORD MYSQL_VIEWER_PASSWORD; do
    require_env_value "${PKELO_ENV_FILE}" "${key}" "$(read_env_value "${PKELO_ENV_FILE}" "${key}")"
  done
  [[ "${PKELO_USER_AUTH_PROVIDER}" == "kakao" ]] || { echo "❌ ${PKELO_ENV_FILE}의 USER_AUTH_PROVIDER는 운영에서 kakao여야 합니다." >&2; exit 1; }
  local key
  for key in KAKAO_REST_API_KEY KAKAO_CLIENT_SECRET KAKAO_REDIRECT_URI KAKAO_WEB_ORIGIN; do
    require_env_value "${PKELO_ENV_FILE}" "${key}" "$(read_env_value "${PKELO_ENV_FILE}" "${key}")"
  done
}

require_pkpkdupr_proxy_template() {
  require_file "${PKPKDUPR_SWAG_TEMPLATE}"
}

require_pkelo_proxy_templates() {
  require_file "${PKELO_APP_TEMPLATE}"
  require_file "${PKELO_NOTICE_TEMPLATE}"
  require_file "${PKELO_ADMIN_APP_TEMPLATE}"
  require_file "${PKELO_ADMIN_NOTICE_TEMPLATE}"
  require_file "${PKELO_LEGACY_PORT_DENY_TEMPLATE}"
  require_file "${PKELO_SSL_TEMPLATE}"
}

resolve_environment() {
  resolve_shared_environment
  case "${TARGET_STACK}" in
    pkpkdupr)
      resolve_primary_environment
      require_pkpkdupr_proxy_template
      ;;
    pkelo)
      resolve_pkelo_environment
      require_pkelo_proxy_templates
      ;;
    all)
      resolve_primary_environment
      resolve_pkelo_environment
      [[ "${PRIMARY_JWT_SECRET}" != "${PKELO_JWT_SECRET}" ]] || { echo "❌ 두 앱의 JWT_SECRET은 서로 달라야 합니다." >&2; exit 1; }
      require_pkpkdupr_proxy_template
      require_pkelo_proxy_templates
      ;;
  esac
}

ensure_gateway_network() {
  if docker network inspect "${GATEWAY_NETWORK}" >/dev/null 2>&1; then
    return
  fi

  if docker network create \
    --driver bridge \
    --label com.docker.compose.project=pkpkdupr \
    --label com.docker.compose.network=pkpkdupr-gateway \
    "${GATEWAY_NETWORK}" >/dev/null; then
    echo "ℹ️ 공용 gateway network를 생성했습니다: ${GATEWAY_NETWORK}"
    return
  fi

  docker network inspect "${GATEWAY_NETWORK}" >/dev/null 2>&1 || {
    echo "❌ 공용 gateway network를 생성할 수 없습니다: ${GATEWAY_NETWORK}" >&2
    exit 1
  }
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
if [[ "${TARGET_STACK}" != "pkpkdupr" ]]; then
  require_command openssl
fi
docker compose version >/dev/null
cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
export IMAGE_TAG="${IMAGE_TAG_INPUT}"
resolve_environment

if [[ "${TARGET_STACK}" != "all" ]]; then
  ensure_gateway_network
  require_running_proxy
  if [[ "${TARGET_STACK}" == "pkelo" ]]; then
    verify_pkelo_certificate_hosts
  fi
fi

if [[ -n "${GHCR_USERNAME:-}" && -n "${GHCR_TOKEN:-}" ]]; then
  printf '%s' "${GHCR_TOKEN}" | docker login ghcr.io -u "${GHCR_USERNAME}" --password-stdin
fi

if [[ "${TARGET_STACK}" == "all" ]]; then
  mkdir -p \
    "${DEPLOY_ROOT}/data/uploads/avatars" \
    "${DEPLOY_ROOT}/data/uploads/pkelo/avatars" \
    "${PKELO_CERT_ROOT}"
  sync_credentials
  compose_proxy up -d
  compose_certificate up -d
  wait_for_file "${DEPLOY_ROOT}/data/certs/nginx/proxy.conf"
  wait_for_file "${PKELO_CERT_ROOT}/etc/letsencrypt/live/${PKELO_DOMAIN}/fullchain.pem"
  verify_pkelo_certificate_hosts
fi

case "${TARGET_STACK}" in
  pkpkdupr)
    mkdir -p "${DEPLOY_ROOT}/data/uploads/avatars"
    compose_primary pull web admin-web api mysql db-server adminer
    compose_primary up -d web admin-web api mysql db-server adminer
    ;;
  pkelo)
    mkdir -p "${DEPLOY_ROOT}/data/uploads/pkelo/avatars"
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

apply_proxy_site_configs "${TARGET_STACK}"
assert_target_services_running "${TARGET_STACK}"
echo "🎉 ${TARGET_STACK} 업데이트 완료 (tag=${IMAGE_TAG}, 컨테이너 기동 상태 확인 완료)"
