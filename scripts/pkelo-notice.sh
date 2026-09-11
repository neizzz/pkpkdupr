#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="${PKPKDUPR_DEPLOY_PATH:-/opt/pkpkdupr}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_DIR="${DEPLOY_ROOT}/env"
SHARED_ENV_FILE="${ENV_DIR}/shared.env"
PKELO_ENV_FILE="${ENV_DIR}/pkelo.env"
NOTICE_ENV_FILE="${ENV_DIR}/pkelo-notice.env"
NOTICE_ENV_EXAMPLE="${SOURCE_REPO_ROOT}/env/pkelo-notice.env.example"
NOTICE_DATA_PATH="${DEPLOY_ROOT}/data/pkelo-notice"
NOTICE_PUBLIC_DIR="${NOTICE_DATA_PATH}/public"
NOTICE_JSON_FILE="${NOTICE_PUBLIC_DIR}/notice.json"
NOTICE_STATE_FILE="${NOTICE_DATA_PATH}/state.env"
PKPKDUPR_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkpkdupr.conf"
PKELO_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkelo.conf"
LEGACY_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/default.conf"
LEGACY_PKELO_MODE_TARGET="${DEPLOY_ROOT}/data/certs/nginx/pkelo-mode.conf"
PKELO_APP_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-app.conf.template"
PKELO_NOTICE_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-notice.conf.template"
PKELO_ADMIN_APP_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-admin.conf.template"
PKELO_ADMIN_NOTICE_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-admin-notice.conf.template"
PKELO_LEGACY_PORT_DENY_TEMPLATE="${SOURCE_REPO_ROOT}/infra/swag/site-confs/pkelo-legacy-port-deny.conf.template"
PKELO_ADMIN_SWAG_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkelo-admin.conf"
PKELO_LEGACY_PORT_DENY_TARGET="${DEPLOY_ROOT}/data/certs/nginx/site-confs/pkelo-legacy-port-deny.conf"
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

PKELO의 외부 트래픽을 임시 안내 페이지로 전환하거나 복구합니다. 안내 중에도 runtime-notice용 API·DB·MySQL은 유지합니다.
안내 문구 기본값은 /opt/pkpkdupr/env/pkelo-notice.env에서 읽습니다.

명령:
  enable                  안내 페이지를 활성화하고 web·admin web·Adminer만 중지합니다.
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

require_env_value() {
  local key="$1" value="$2"
  case "${value}" in
    ""|replace-with-*)
      echo "❌ ${PKELO_ENV_FILE}의 ${key} 값을 설정해야 합니다." >&2
      exit 1
      ;;
  esac
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
  require_file "${PKELO_ENV_FILE}"
  require_file "${PKELO_APP_TEMPLATE}"
  require_file "${PKELO_NOTICE_TEMPLATE}"
  require_file "${PKELO_ADMIN_APP_TEMPLATE}"
  require_file "${PKELO_ADMIN_NOTICE_TEMPLATE}"
  require_file "${PKELO_LEGACY_PORT_DENY_TEMPLATE}"
  require_file "${PKELO_SSL_TEMPLATE}"

  ensure_notice_env
  local settings_file="${NOTICE_ENV_FILE}"
  if [[ ! -f "${settings_file}" ]]; then
    settings_file="${NOTICE_ENV_EXAMPLE}"
  fi

  PKELO_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" DOMAIN)"
  PKELO_DOMAIN="${PKELO_DOMAIN:-pkelo.app}"
  PKELO_ADMIN_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" ADMIN_DOMAIN)"
  require_env_value "ADMIN_DOMAIN" "${PKELO_ADMIN_DOMAIN}"
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

}

compose_pkelo() {
  PKELO_NOTICE_DATA_PATH="${NOTICE_DATA_PATH}" docker compose --project-name pkelo \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PKELO_ENV_FILE}" \
    -f docker-compose.pkelo.yml -f docker-compose.pkelo-gateway.yml "$@"
}

compose_notice() {
  local notice_image
  notice_image="$(docker inspect --format '{{.Config.Image}}' pkelo-notice-web-app 2>/dev/null || true)"
  if [[ -z "${notice_image}" ]]; then
    notice_image="$(docker inspect --format '{{.Config.Image}}' pkelo-web-app 2>/dev/null || true)"
  fi

  PKELO_NOTICE_IMAGE="${notice_image}" docker compose --project-name pkelo-notice \
    --env-file "${SHARED_ENV_FILE}" --env-file "${NOTICE_ENV_FILE}" \
    -f docker-compose.pkelo-notice.yml "$@"
}

is_notice_enabled() {
  [[ -f "${NOTICE_STATE_FILE}" ]] && [[ "$(read_env_value "${NOTICE_STATE_FILE}" PKELO_NOTICE_ENABLED)" == "true" ]]
}

# Bash builtins only: the deployment host does not need Node, Python or jq.
json_escape() {
  local LC_ALL=C
  local value="$1" character code i
  # Work bytewise to preserve UTF-8, escaping all JSON control bytes.
  # NUL cannot occur in Bash arguments or environment variables.
  for ((i = 0; i < ${#value}; i++)); do
    character="${value:i:1}"
    case "${character}" in
      '"') printf '\\"' ;;
      '\') printf '\\\\' ;;
      *)
        printf -v code '%d' "'${character}"
        if ((code > 0 && code < 32)); then
          printf '\\u%04x' "${code}"
        else
          printf '%s' "${character}"
        fi
        ;;
    esac
  done
}

write_notice_json() {
  if [[ "${DRY_RUN}" == true ]]; then
    echo "[dry-run] ${NOTICE_JSON_FILE}에 활성 안내 JSON을 원자적으로 생성합니다."
    return
  fi

  mkdir -p "${NOTICE_PUBLIC_DIR}"
  local temp_file
  temp_file="$(mktemp "${NOTICE_PUBLIC_DIR}/notice.json.XXXXXX")"
  printf '{"enabled":true,"title":"%s","message":"%s"}\n' \
    "$(json_escape "${NOTICE_TITLE}")" \
    "$(json_escape "${NOTICE_MESSAGE}")" > "${temp_file}"
  chmod 644 "${temp_file}"
  mv -f "${temp_file}" "${NOTICE_JSON_FILE}"
}

write_disabled_notice_json() {
  if [[ "${DRY_RUN}" == true ]]; then
    echo "[dry-run] ${NOTICE_JSON_FILE}에 비활성 안내 JSON을 원자적으로 생성합니다."
    return
  fi

  mkdir -p "${NOTICE_PUBLIC_DIR}"
  local temp_file
  temp_file="$(mktemp "${NOTICE_PUBLIC_DIR}/notice.json.XXXXXX")"
  printf '{"enabled":false}\n' > "${temp_file}"
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

backup_notice_files() {
  local backup_dir="$1" path name
  for path in "${NOTICE_JSON_FILE}" "${NOTICE_STATE_FILE}"; do
    name="$(basename "${path}")"
    if [[ -f "${path}" ]]; then
      cp -p "${path}" "${backup_dir}/${name}"
    else
      : > "${backup_dir}/${name}.absent"
    fi
  done
}

restore_notice_files() {
  local backup_dir="$1" path name
  for path in "${NOTICE_JSON_FILE}" "${NOTICE_STATE_FILE}"; do
    name="$(basename "${path}")"
    if [[ -f "${backup_dir}/${name}" ]]; then
      mkdir -p "$(dirname "${path}")"
      cp -p "${backup_dir}/${name}" "${path}"
    else
      rm -f "${path}"
    fi
  done
}

render_template() {
  local template="$1" target="$2"
  local temp_file
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
}

retire_legacy_proxy_site_configs() {
  if [[ -f "${PKPKDUPR_SWAG_TARGET}" && -f "${PKELO_SWAG_TARGET}" ]]; then
    rm -f "${LEGACY_SWAG_TARGET}" "${LEGACY_PKELO_MODE_TARGET}"
  fi
}

sync_proxy_site_configs() {
  local pkelo_template="${PKELO_APP_TEMPLATE}"
  local pkelo_admin_template="${PKELO_ADMIN_APP_TEMPLATE}"
  if is_notice_enabled; then
    pkelo_template="${PKELO_NOTICE_TEMPLATE}"
    pkelo_admin_template="${PKELO_ADMIN_NOTICE_TEMPLATE}"
  fi

  migrate_legacy_proxy_site_configs
  render_template "${pkelo_template}" "${PKELO_SWAG_TARGET}"
  render_template "${pkelo_admin_template}" "${PKELO_ADMIN_SWAG_TARGET}"
  render_template "${PKELO_LEGACY_PORT_DENY_TEMPLATE}" "${PKELO_LEGACY_PORT_DENY_TARGET}"
  render_template "${PKELO_SSL_TEMPLATE}" "${PKELO_SSL_TARGET}"
  retire_legacy_proxy_site_configs
}

backup_proxy_configs() {
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

restore_proxy_configs() {
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

require_running_proxy() {
  if [[ "$(docker inspect -f '{{.State.Running}}' pkpkdupr-proxy 2>/dev/null || true)" != "true" ]]; then
    echo "❌ 공용 SWAG proxy가 실행 중이지 않습니다." >&2
    return 1
  fi
}

sync_and_reload_proxy() {
  local backup_dir
  backup_dir="$(mktemp -d)"
  backup_proxy_configs "${backup_dir}"

  if ! sync_proxy_site_configs || ! require_running_proxy || ! docker exec pkpkdupr-proxy nginx -t; then
    echo "❌ 새 SWAG 설정 검증에 실패했습니다. 기존 설정으로 되돌립니다." >&2
    restore_proxy_configs "${backup_dir}"
    docker exec pkpkdupr-proxy nginx -t >/dev/null 2>&1 && docker exec pkpkdupr-proxy nginx -s reload || true
    rm -rf "${backup_dir}"
    return 1
  fi

  if ! docker exec pkpkdupr-proxy nginx -s reload; then
    echo "❌ SWAG graceful reload에 실패했습니다. 기존 설정으로 되돌립니다." >&2
    restore_proxy_configs "${backup_dir}"
    docker exec pkpkdupr-proxy nginx -t >/dev/null 2>&1 && docker exec pkpkdupr-proxy nginx -s reload || true
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

ensure_notice_api_stack_running() {
  compose_pkelo up -d pkelo-mysql pkelo-db-server pkelo-api
  assert_services_running compose_pkelo pkelo-mysql pkelo-db-server pkelo-api
}

enable_notice() {
  if [[ "${DRY_RUN}" == true ]]; then
    cat <<'EOF'
[dry-run] 1. 활성 안내 JSON을 생성하고 pkelo-notice-web을 기동합니다.
[dry-run] 2. pkelo-api·db-server·MySQL을 유지하거나 기동해 runtime-notice를 제공합니다.
[dry-run] 3. 안내 SWAG 설정을 생성·nginx -t·graceful reload 합니다.
[dry-run] 4. 성공 후 PKELO web/admin web/Adminer만 중지합니다.
EOF
    return
  fi

  local backup_dir was_notice_enabled=false
  backup_dir="$(mktemp -d)"
  backup_notice_files "${backup_dir}"
  if is_notice_enabled; then
    was_notice_enabled=true
  fi

  write_notice_json
  if ! compose_notice up -d pkelo-notice-web || ! ensure_notice_api_stack_running; then
    restore_notice_files "${backup_dir}"
    if [[ "${was_notice_enabled}" == false ]]; then
      compose_notice stop pkelo-notice-web || true
    fi
    rm -rf "${backup_dir}"
    exit 1
  fi

  if [[ "${was_notice_enabled}" == true ]]; then
    if ! sync_and_reload_proxy; then
      restore_notice_files "${backup_dir}"
      rm -rf "${backup_dir}"
      exit 1
    fi
    rm -rf "${backup_dir}"
    echo "✅ PKELO 안내 문구를 갱신했습니다."
    return
  fi

  write_notice_state
  if ! sync_and_reload_proxy; then
    restore_notice_files "${backup_dir}"
    compose_notice stop pkelo-notice-web || true
    rm -rf "${backup_dir}"
    exit 1
  fi

  compose_pkelo stop pkelo-web pkelo-admin-web pkelo-adminer
  assert_services_running compose_notice pkelo-notice-web
  assert_services_running compose_pkelo pkelo-api pkelo-db-server pkelo-mysql
  rm -rf "${backup_dir}"
  echo "✅ PKELO 안내 모드를 활성화했습니다: ${NOTICE_MESSAGE}"
}

disable_notice() {
  if ! is_notice_enabled; then
    echo "ℹ️ PKELO 안내 모드가 활성화되어 있지 않습니다."
    return
  fi

  if [[ "${DRY_RUN}" == true ]]; then
    cat <<'EOF'
[dry-run] 1. 일반 PKELO web/admin web/Adminer를 기동하고 API·DB·MySQL을 확인합니다.
[dry-run] 2. 비활성 안내 JSON을 생성한 뒤 일반 SWAG 설정을 생성·nginx -t·graceful reload 합니다.
[dry-run] 3. 성공 후 pkelo-notice-web을 중지합니다.
EOF
    return
  fi

  compose_pkelo up -d \
    pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
  assert_services_running compose_pkelo pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer

  local backup_dir
  backup_dir="$(mktemp -d)"
  backup_notice_files "${backup_dir}"
  write_disabled_notice_json
  clear_notice_state

  if ! sync_and_reload_proxy; then
    restore_notice_files "${backup_dir}"
    rm -rf "${backup_dir}"
    exit 1
  fi

  compose_notice stop pkelo-notice-web || true
  assert_services_running compose_pkelo pkelo-web pkelo-admin-web pkelo-api pkelo-mysql pkelo-db-server pkelo-adminer
  rm -rf "${backup_dir}"
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
