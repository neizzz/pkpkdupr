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
NOTICE_ENV_EXAMPLE="${SOURCE_REPO_ROOT}/env/pkelo-notice.env.example"
NOTICE_DATA_PATH="${DEPLOY_ROOT}/data/pkelo-notice"
NOTICE_PUBLIC_DIR="${NOTICE_DATA_PATH}/public"
NOTICE_JSON_FILE="${NOTICE_PUBLIC_DIR}/notice.json"
NOTICE_STATE_FILE="${NOTICE_DATA_PATH}/state.env"
SWAG_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/default.conf.template"
SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/default.conf"
PKELO_APP_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-app.conf.template"
PKELO_NOTICE_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-notice.conf.template"
PKELO_MODE_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-mode.conf"
PKELO_SSL_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-ssl.conf.template"
PKELO_SSL_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-ssl.conf"

ACTION=""
NOTICE_TITLE_OVERRIDE=""
NOTICE_MESSAGE_OVERRIDE=""
HAS_NOTICE_TITLE_OVERRIDE=false
HAS_NOTICE_MESSAGE_OVERRIDE=false
DRY_RUN=false

usage() {
  cat <<'EOF'
usage: bash scripts/pkelo-notice.sh <enable|disable|status> [options]

PKELO의 외부 트래픽을 임시 안내 페이지로 무중단 전환하거나 복구합니다.
안내 문구 기본값은 /opt/pkpkdupr/env/pkelo-notice.env에서 읽습니다.

명령:
  enable                  안내 페이지를 활성화하고 PKELO 앱 스택만 중지합니다.
  disable                 일반 PKELO 앱 스택과 프록시 라우팅을 복구합니다.
  status                  현재 안내 모드와 설정 문구를 표시합니다.

옵션:
  --title <text>          이번 enable에만 적용할 제목 override
  --message <text>        이번 enable에만 적용할 문구 override
  --dry-run               실제 컨테이너·프록시·파일을 변경하지 않음
  -h, --help              도움말 출력

예시:
  bash scripts/pkelo-notice.sh enable
  bash scripts/pkelo-notice.sh enable --message "점검 중입니다"
  bash scripts/pkelo-notice.sh disable
EOF
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ '$1' 명령이 필요합니다." >&2
    exit 1
  }
}

require_file() {
  [[ -f "$1" ]] || {
    echo "❌ 필요한 파일이 없습니다: $1" >&2
    exit 1
  }
}

read_env_value() {
  local env_file="$1" key="$2"
  awk -F= -v target="${key}" '$1 == target { print substr($0, index($0, "=") + 1) }' "${env_file}" | tail -n 1
}

is_blank() {
  [[ -z "${1//[[:space:]]/}" ]]
}

ensure_notice_env() {
  if [[ -f "${NOTICE_ENV_FILE}" ]]; then
    return
  fi

  require_file "${NOTICE_ENV_EXAMPLE}"
  if [[ "${DRY_RUN}" == true ]]; then
    echo "[dry-run] ${NOTICE_ENV_FILE}에 기본 안내 설정을 생성합니다."
    return
  fi

  mkdir -p "${ENV_DIR}"
  umask 077
  cp "${NOTICE_ENV_EXAMPLE}" "${NOTICE_ENV_FILE}"
  chmod 600 "${NOTICE_ENV_FILE}"
  echo "ℹ️ 기본 PKELO 안내 설정을 생성했습니다: ${NOTICE_ENV_FILE}"
}

load_environment() {
  require_file "${SHARED_ENV_FILE}"
  require_file "${PRIMARY_ENV_FILE}"
  require_file "${PKELO_ENV_FILE}"
  require_file "${SWAG_TEMPLATE}"
  require_file "${PKELO_APP_TEMPLATE}"
  require_file "${PKELO_NOTICE_TEMPLATE}"
  require_file "${PKELO_SSL_TEMPLATE}"

  ensure_notice_env
  local settings_file="${NOTICE_ENV_FILE}"
  if [[ ! -f "${settings_file}" ]]; then
    settings_file="${NOTICE_ENV_EXAMPLE}"
  fi

  PKELO_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" DOMAIN)"
  PKELO_DOMAIN="${PKELO_DOMAIN:-pkelo.app}"
  ADMIN_STACK_PORT="$(read_env_value "${SHARED_ENV_FILE}" ADMIN_STACK_PORT)"
  ADMIN_STACK_PORT="${ADMIN_STACK_PORT:-3333}"
  NOTICE_TITLE="$(read_env_value "${settings_file}" PKELO_NOTICE_TITLE)"
  NOTICE_MESSAGE="$(read_env_value "${settings_file}" PKELO_NOTICE_MESSAGE)"
  if [[ "${HAS_NOTICE_TITLE_OVERRIDE}" == true ]]; then
    NOTICE_TITLE="${NOTICE_TITLE_OVERRIDE}"
  else
    NOTICE_TITLE="${NOTICE_TITLE:-PKELO}"
  fi
  if [[ "${HAS_NOTICE_MESSAGE_OVERRIDE}" == true ]]; then
    NOTICE_MESSAGE="${NOTICE_MESSAGE_OVERRIDE}"
  else
    NOTICE_MESSAGE="${NOTICE_MESSAGE:-8월 오픈 예정}"
  fi

  if [[ "${ACTION}" == "enable" ]] && (is_blank "${NOTICE_TITLE}" || is_blank "${NOTICE_MESSAGE}"); then
    echo "❌ PKELO_NOTICE_TITLE과 PKELO_NOTICE_MESSAGE는 공백만으로 설정할 수 없습니다." >&2
    exit 1
  fi

  PRIMARY_DOMAIN="$(read_env_value "${PRIMARY_ENV_FILE}" DOMAIN)"
  PRIMARY_DOMAIN="${PRIMARY_DOMAIN:-pkpkdupr.duckdns.org}"
}

compose_proxy() {
  docker compose --project-name pkpkdupr \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PRIMARY_ENV_FILE}" \
    -f docker-compose.proxy.yml "$@"
}

compose_pkelo() {
  docker compose --project-name pkelo \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PKELO_ENV_FILE}" \
    -f docker-compose.pkelo.yml -f docker-compose.pkelo-gateway.yml "$@"
}

compose_notice() {
  local notice_image
  notice_image="$(docker inspect --format '{{.Config.Image}}' pkelo-notice-web-app 2>/dev/null || true)"
  if [[ -z "${notice_image}" ]]; then
    notice_image="$(docker inspect --format '{{.Config.Image}}' pkelo-web-app 2>/dev/null || true)"
  fi

  PKELO_NOTICE_DATA_PATH="${NOTICE_DATA_PATH}" PKELO_NOTICE_IMAGE="${notice_image}" docker compose --project-name pkelo-notice \
    --env-file "${SHARED_ENV_FILE}" --env-file "${NOTICE_ENV_FILE}" \
    -f docker-compose.pkelo-notice.yml "$@"
}

is_notice_enabled() {
  [[ -f "${NOTICE_STATE_FILE}" ]] && [[ "$(read_env_value "${NOTICE_STATE_FILE}" PKELO_NOTICE_ENABLED)" == "true" ]]
}

write_notice_json() {
  if [[ "${DRY_RUN}" == true ]]; then
    echo "[dry-run] ${NOTICE_JSON_FILE}에 안내 JSON을 원자적으로 생성합니다."
    return
  fi

  mkdir -p "${NOTICE_PUBLIC_DIR}"
  local temp_file
  temp_file="$(mktemp "${NOTICE_PUBLIC_DIR}/notice.json.XXXXXX")"
  PKELO_NOTICE_TITLE="${NOTICE_TITLE}" PKELO_NOTICE_MESSAGE="${NOTICE_MESSAGE}" \
    node --input-type=module -e '
      const title = process.env.PKELO_NOTICE_TITLE;
      const message = process.env.PKELO_NOTICE_MESSAGE;
      process.stdout.write(`${JSON.stringify({ enabled: true, title, message })}\n`);
    ' > "${temp_file}"
  chmod 644 "${temp_file}"
  mv -f "${temp_file}" "${NOTICE_JSON_FILE}"
}

write_notice_state() {
  if [[ "${DRY_RUN}" == true ]]; then
    echo "[dry-run] PKELO 안내 상태를 활성화합니다."
    return
  fi

  mkdir -p "${NOTICE_DATA_PATH}"
  local temp_file
  temp_file="$(mktemp "${NOTICE_DATA_PATH}/state.env.XXXXXX")"
  printf 'PKELO_NOTICE_ENABLED=true\n' > "${temp_file}"
  chmod 600 "${temp_file}"
  mv -f "${temp_file}" "${NOTICE_STATE_FILE}"
}

clear_notice_state() {
  if [[ "${DRY_RUN}" == true ]]; then
    echo "[dry-run] PKELO 안내 상태를 비활성화합니다."
    return
  fi
  rm -f "${NOTICE_STATE_FILE}"
}

render_template() {
  local template="$1" target="$2"
  local temp_file
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

backup_proxy_configs() {
  local backup_dir="$1"
  local path
  for path in "${SWAG_TARGET}" "${PKELO_MODE_TARGET}" "${PKELO_SSL_TARGET}"; do
    local name
    name="$(basename "${path}")"
    if [[ -f "${path}" ]]; then
      cp -p "${path}" "${backup_dir}/${name}"
    else
      : > "${backup_dir}/${name}.absent"
    fi
  done
}

restore_proxy_configs() {
  local backup_dir="$1"
  local path
  for path in "${SWAG_TARGET}" "${PKELO_MODE_TARGET}" "${PKELO_SSL_TARGET}"; do
    local name
    name="$(basename "${path}")"
    if [[ -f "${backup_dir}/${name}" ]]; then
      cp -p "${backup_dir}/${name}" "${path}"
    else
      rm -f "${path}"
    fi
  done
}

sync_and_reload_proxy() {
  local backup_dir
  backup_dir="$(mktemp -d)"
  backup_proxy_configs "${backup_dir}"

  if ! sync_proxy_site_configs || ! compose_proxy exec -T proxy nginx -t; then
    echo "❌ 새 SWAG 설정 검증에 실패했습니다. 기존 설정을 유지합니다." >&2
    restore_proxy_configs "${backup_dir}"
    rm -rf "${backup_dir}"
    return 1
  fi

  if ! compose_proxy exec -T proxy nginx -s reload; then
    echo "❌ SWAG graceful reload에 실패했습니다. 기존 설정으로 되돌립니다." >&2
    restore_proxy_configs "${backup_dir}"
    compose_proxy exec -T proxy nginx -s reload || true
    rm -rf "${backup_dir}"
    return 1
  fi

  rm -rf "${backup_dir}"
}

assert_services_running() {
  local compose_function="$1"
  shift
  local service
  for service in "$@"; do
    if ! "$compose_function" ps --status running --services | awk -v expected="${service}" '$0 == expected { found = 1 } END { exit !found }'; then
      echo "❌ ${service} 컨테이너가 running 상태가 아닙니다." >&2
      "$compose_function" ps "${service}" >&2 || true
      return 1
    fi
  done
}

enable_notice() {
  write_notice_json

  if is_notice_enabled; then
    if [[ "${DRY_RUN}" == true ]]; then
      echo "[dry-run] 실행 중인 안내 web을 확인하고 JSON만 갱신합니다."
      return
    fi
    compose_notice up -d pkelo-notice-web
    assert_services_running compose_notice pkelo-notice-web
    echo "✅ PKELO 안내 문구를 갱신했습니다."
    return
  fi

  if [[ "${DRY_RUN}" == true ]]; then
    cat <<'EOF'
[dry-run] 1. pkelo-notice-web을 기동하고 컨테이너 상태를 확인합니다.
[dry-run] 2. 안내 SWAG 설정을 생성·nginx -t·graceful reload 합니다.
[dry-run] 3. 성공 후 PKELO web/admin/API/db-server/MySQL/Adminer를 중지합니다.
EOF
    return
  fi

  compose_notice up -d pkelo-notice-web
  assert_services_running compose_notice pkelo-notice-web
  write_notice_state

  if ! sync_and_reload_proxy; then
    clear_notice_state
    compose_notice stop pkelo-notice-web || true
    exit 1
  fi

  compose_pkelo stop \
    pkelo-web pkelo-admin-web pkelo-api pkelo-adminer pkelo-db-server pkelo-mysql
  assert_services_running compose_notice pkelo-notice-web
  echo "✅ PKELO 안내 모드를 활성화했습니다: ${NOTICE_MESSAGE}"
}

disable_notice() {
  if ! is_notice_enabled; then
    echo "ℹ️ PKELO 안내 모드가 활성화되어 있지 않습니다."
    return
  fi

  if [[ "${DRY_RUN}" == true ]]; then
    cat <<'EOF'
[dry-run] 1. 일반 PKELO 앱 스택을 기동하고 API 준비를 확인합니다.
[dry-run] 2. 일반 SWAG 설정을 생성·nginx -t·graceful reload 합니다.
[dry-run] 3. 성공 후 pkelo-notice-web을 중지합니다.
EOF
    return
  fi

  compose_pkelo up -d \
    pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
  assert_services_running compose_pkelo pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
  clear_notice_state

  if ! sync_and_reload_proxy; then
    write_notice_state
    exit 1
  fi

  compose_notice stop pkelo-notice-web || true
  assert_services_running compose_pkelo pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
  echo "✅ PKELO 일반 서비스를 복구했습니다."
}

show_status() {
  if is_notice_enabled; then
    echo "PKELO 안내 모드: 활성"
  else
    echo "PKELO 안내 모드: 비활성"
  fi
  echo "제목: ${NOTICE_TITLE}"
  echo "문구: ${NOTICE_MESSAGE}"
  echo "설정 파일: ${NOTICE_ENV_FILE}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    enable|disable|status)
      [[ -z "${ACTION}" ]] || { echo "❌ 명령은 하나만 지정하세요." >&2; exit 1; }
      ACTION="$1"
      shift
      ;;
    --title)
      NOTICE_TITLE_OVERRIDE="${2:-}"
      HAS_NOTICE_TITLE_OVERRIDE=true
      shift 2
      ;;
    --message)
      NOTICE_MESSAGE_OVERRIDE="${2:-}"
      HAS_NOTICE_MESSAGE_OVERRIDE=true
      shift 2
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "❌ 알 수 없는 옵션: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

[[ -n "${ACTION}" ]] || { usage >&2; exit 1; }
if [[ "${ACTION}" != "enable" && ( "${HAS_NOTICE_TITLE_OVERRIDE}" == true || "${HAS_NOTICE_MESSAGE_OVERRIDE}" == true ) ]]; then
  echo "❌ --title 및 --message는 enable에서만 사용할 수 있습니다." >&2
  exit 1
fi

require_command docker
require_command sed
require_command awk
docker compose version >/dev/null

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
load_environment

case "${ACTION}" in
  enable) enable_notice ;;
  disable) disable_notice ;;
  status) show_status ;;
esac
