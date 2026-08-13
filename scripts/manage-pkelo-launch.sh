#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="${PKPKDUPR_DEPLOY_PATH:-/opt/pkpkdupr}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_DIR="${DEPLOY_ROOT}/env"
SHARED_ENV_FILE="${ENV_DIR}/shared.env"
PKELO_ENV_FILE="${ENV_DIR}/pkelo.env"
NOTICE_ENV_FILE="${ENV_DIR}/pkelo-notice.env"
NOTICE_DATA_PATH="${DEPLOY_ROOT}/data/pkelo-notice"
NOTICE_PUBLIC_DIR="${NOTICE_DATA_PATH}/public"
NOTICE_JSON_FILE="${NOTICE_PUBLIC_DIR}/notice.json"
NOTICE_STATE_FILE="${NOTICE_DATA_PATH}/state.env"
PKELO_CERT_ROOT="${DEPLOY_ROOT}/data/pkelo-certs"
MANUAL_DEPLOY_SCRIPT="${SOURCE_REPO_ROOT}/scripts/manual-deploy.sh"
PKELO_NOTICE_SCRIPT="${SOURCE_REPO_ROOT}/scripts/pkelo-notice.sh"

ACTION=""
IMAGE_TAG=""
GHCR_USERNAME_ARG=""
GHCR_TOKEN_ARG=""

usage() {
  cat <<'USAGE'
usage: bash scripts/manage-pkelo-launch.sh <notice|open> --image-tag <tag> [options]

PKELO 첫 공개를 안내 페이지로 전환하거나, 안내를 해제해 실제 앱을 엽니다.
이미지 태그는 반드시 PKELO 소스 ref에서 만든 태그를 사용합니다.

명령:
  notice                  notice JSON·상태를 생성하고 PKELO notice web·API를 배포
  open                    같은 PKELO 태그로 notice를 해제하고 앱 스택 기동

옵션:
  --image-tag <tag>       PKELO 배포 이미지 태그 (필수)
  --ghcr-username <name>  notice 배포 시 GHCR 로그인에 사용할 사용자명
  --ghcr-token <token>    notice 배포 시 GHCR 로그인에 사용할 read:packages 토큰
  -h, --help              도움말 출력

사전 조건:
  - bash scripts/bootstrap-pkelo-certificate.sh 실행 완료
  - /opt/pkpkdupr/env/pkelo.env 및 pkelo-notice.env 설정 완료
  - 기존 pkpkdupr-proxy가 실행 중
USAGE
}

require_file() {
  [[ -f "$1" ]] || {
    echo "❌ 필요한 파일이 없습니다: $1" >&2
    exit 1
  }
}

require_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "❌ '$1' 명령이 필요합니다." >&2
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

json_escape() {
  local value="$1"
  value="${value//\\/\\\\}"
  value="${value//\"/\\\"}"
  value="${value//$'\n'/\\n}"
  value="${value//$'\r'/\\r}"
  value="${value//$'\t'/\\t}"
  printf '%s' "${value}"
}

write_notice_json() {
  mkdir -p "${NOTICE_PUBLIC_DIR}"

  local temporary_file
  temporary_file="$(mktemp "${NOTICE_PUBLIC_DIR}/notice.json.XXXXXX")"
  printf '{"enabled":true,"title":"%s","message":"%s"}\n' \
    "$(json_escape "${NOTICE_TITLE}")" \
    "$(json_escape "${NOTICE_MESSAGE}")" > "${temporary_file}"
  chmod 644 "${temporary_file}"
  mv -f "${temporary_file}" "${NOTICE_JSON_FILE}"
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

write_notice_state() {
  mkdir -p "${NOTICE_DATA_PATH}"

  local temporary_file
  temporary_file="$(mktemp "${NOTICE_DATA_PATH}/state.env.XXXXXX")"
  printf 'PKELO_NOTICE_ENABLED=true\n' > "${temporary_file}"
  chmod 600 "${temporary_file}"
  mv -f "${temporary_file}" "${NOTICE_STATE_FILE}"
}

require_certificate() {
  local domain admin_domain host
  domain="$(read_env_value "${PKELO_ENV_FILE}" DOMAIN)"
  domain="${domain:-pkelo.app}"
  admin_domain="$(read_env_value "${PKELO_ENV_FILE}" ADMIN_DOMAIN)"
  [[ -n "${admin_domain}" && "${admin_domain}" != replace-with-* ]] || {
    echo "❌ ${PKELO_ENV_FILE}의 ADMIN_DOMAIN 값을 설정해야 합니다." >&2
    exit 1
  }
  local certificate_file="${PKELO_CERT_ROOT}/etc/letsencrypt/live/${domain}/fullchain.pem"

  [[ -f "${certificate_file}" ]] || {
    echo "❌ PKELO 인증서가 없습니다. 먼저 bash scripts/bootstrap-pkelo-certificate.sh를 실행하세요." >&2
    exit 1
  }

  for host in "${domain}" "${admin_domain}"; do
    openssl x509 -in "${certificate_file}" -noout -checkhost "${host}" >/dev/null || {
      echo "❌ PKELO 인증서에 ${host}가 포함되어 있지 않습니다. bootstrap-pkelo-certificate.sh를 다시 실행하세요." >&2
      exit 1
    }
  done
}

run_notice_deploy() {
  local -a command=(
    bash "${MANUAL_DEPLOY_SCRIPT}"
    --image-tag "${IMAGE_TAG}"
    --stack pkelo
  )

  if [[ -n "${GHCR_USERNAME_ARG}" ]]; then
    command+=(--ghcr-username "${GHCR_USERNAME_ARG}")
  fi
  if [[ -n "${GHCR_TOKEN_ARG}" ]]; then
    command+=(--ghcr-token "${GHCR_TOKEN_ARG}")
  fi

  "${command[@]}"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    notice|open)
      [[ -z "${ACTION}" ]] || { echo "❌ 명령은 하나만 지정하세요." >&2; exit 1; }
      ACTION="$1"
      shift
      ;;
    --image-tag)
      IMAGE_TAG="${2:-}"
      shift 2
      ;;
    --ghcr-username)
      GHCR_USERNAME_ARG="${2:-}"
      shift 2
      ;;
    --ghcr-token)
      GHCR_TOKEN_ARG="${2:-}"
      shift 2
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
[[ -n "${IMAGE_TAG}" ]] || { echo "❌ --image-tag 값이 필요합니다." >&2; exit 1; }
if [[ "${ACTION}" == "open" && ( -n "${GHCR_USERNAME_ARG}" || -n "${GHCR_TOKEN_ARG}" ) ]]; then
  echo "❌ --ghcr-username 및 --ghcr-token은 notice에서만 사용할 수 있습니다." >&2
  exit 1
fi
if [[ ( -n "${GHCR_USERNAME_ARG}" && -z "${GHCR_TOKEN_ARG}" ) || ( -z "${GHCR_USERNAME_ARG}" && -n "${GHCR_TOKEN_ARG}" ) ]]; then
  echo "❌ GHCR 사용자명과 토큰은 함께 지정하세요." >&2
  exit 1
fi

require_file "${SHARED_ENV_FILE}"
require_file "${PKELO_ENV_FILE}"
require_file "${NOTICE_ENV_FILE}"
require_file "${MANUAL_DEPLOY_SCRIPT}"
require_file "${PKELO_NOTICE_SCRIPT}"
require_command openssl

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
require_certificate

case "${ACTION}" in
  notice)
    NOTICE_TITLE="$(read_env_value "${NOTICE_ENV_FILE}" PKELO_NOTICE_TITLE)"
    NOTICE_MESSAGE="$(read_env_value "${NOTICE_ENV_FILE}" PKELO_NOTICE_MESSAGE)"
    if is_blank "${NOTICE_TITLE}" || is_blank "${NOTICE_MESSAGE}"; then
      echo "❌ ${NOTICE_ENV_FILE}의 PKELO_NOTICE_TITLE과 PKELO_NOTICE_MESSAGE를 설정해야 합니다." >&2
      exit 1
    fi

    notice_backup_dir="$(mktemp -d)"
    backup_notice_files "${notice_backup_dir}"
    write_notice_json
    write_notice_state
    if ! run_notice_deploy; then
      restore_notice_files "${notice_backup_dir}"
      rm -rf "${notice_backup_dir}"
      exit 1
    fi
    rm -rf "${notice_backup_dir}"
    echo "✅ PKELO 안내 모드를 배포했습니다: ${NOTICE_MESSAGE}"
    ;;
  open)
    IMAGE_TAG="${IMAGE_TAG}" bash "${PKELO_NOTICE_SCRIPT}" disable
    echo "✅ PKELO 안내 모드를 해제했습니다. API health와 Kakao 로그인을 확인하세요."
    ;;
esac
