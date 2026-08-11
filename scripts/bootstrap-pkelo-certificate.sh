#!/usr/bin/env bash

set -euo pipefail

DEPLOY_ROOT="${PKPKDUPR_DEPLOY_PATH:-/opt/pkpkdupr}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
SOURCE_REPO_ROOT="$(cd -- "${SCRIPT_DIR}/.." && pwd)"
ENV_DIR="${DEPLOY_ROOT}/env"
SHARED_ENV_FILE="${ENV_DIR}/shared.env"
PKELO_ENV_FILE="${ENV_DIR}/pkelo.env"
PKELO_CERT_ROOT="${DEPLOY_ROOT}/data/pkelo-certs"
CLOUDFLARE_CREDENTIALS_FILE="${PKELO_CERT_ROOT}/dns-conf/cloudflare.ini"
CERTIFICATE_FILE="${PKELO_CERT_ROOT}/etc/letsencrypt/live"
WAIT_SECONDS="${PKELO_CERT_WAIT_SECONDS:-120}"

usage() {
  cat <<'USAGE'
usage: bash scripts/bootstrap-pkelo-certificate.sh

pkelo.env의 CLOUDFLARE_DNS_API_TOKEN으로 Cloudflare DNS-01 credential을 생성하고,
pkelo.app 및 admin.pkelo.app 인증서 컨테이너를 기동한 뒤 인증서 발급을 기다립니다.

환경 변수:
  PKPKDUPR_DEPLOY_PATH       배포 루트 (기본: /opt/pkpkdupr)
  PKELO_CERT_WAIT_SECONDS    인증서 대기 시간 초 (기본: 120)
USAGE
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

require_env_value() {
  local key="$1" value="$2"
  case "${value}" in
    ""|replace-with-*)
      echo "❌ ${PKELO_ENV_FILE}의 ${key} 값을 설정해야 합니다." >&2
      exit 1
      ;;
  esac
}

compose_certificate() {
  docker compose --project-name pkelo-certificate \
    --env-file "${SHARED_ENV_FILE}" --env-file "${PKELO_ENV_FILE}" \
    -f docker-compose.pkelo-certificate.yml "$@"
}

write_cloudflare_credentials() {
  mkdir -p "$(dirname "${CLOUDFLARE_CREDENTIALS_FILE}")"

  local temporary_file
  temporary_file="$(mktemp "$(dirname "${CLOUDFLARE_CREDENTIALS_FILE}")/.cloudflare.ini.XXXXXX")"
  umask 077
  printf 'dns_cloudflare_api_token=%s\n' "${PKELO_CLOUDFLARE_TOKEN}" > "${temporary_file}"
  chmod 600 "${temporary_file}"
  mv -f "${temporary_file}" "${CLOUDFLARE_CREDENTIALS_FILE}"
}

wait_for_certificate() {
  local certificate_file="${CERTIFICATE_FILE}/${PKELO_DOMAIN}/fullchain.pem"
  local elapsed=0

  while (( elapsed < WAIT_SECONDS )); do
    if [[ -f "${certificate_file}" ]]; then
      echo "✅ PKELO 인증서를 확인했습니다: ${certificate_file}"
      return
    fi
    sleep 2
    ((elapsed += 2))
  done

  echo "❌ PKELO 인증서 발급 시간이 초과되었습니다: ${certificate_file}" >&2
  docker logs --tail 80 pkelo-certificate >&2 || true
  exit 1
}

verify_certificate_hosts() {
  local certificate_file="${CERTIFICATE_FILE}/${PKELO_DOMAIN}/fullchain.pem"
  local host
  for host in "${PKELO_DOMAIN}" "${PKELO_ADMIN_DOMAIN}"; do
    openssl x509 -in "${certificate_file}" -noout -checkhost "${host}" >/dev/null || {
      echo "❌ PKELO 인증서에 ${host}가 포함되어 있지 않습니다. Cloudflare DNS-01 인증서를 다시 발급하세요." >&2
      exit 1
    }
  done

  echo "✅ PKELO 인증서에 ${PKELO_DOMAIN}, ${PKELO_ADMIN_DOMAIN} 호스트가 포함되어 있습니다."
}

case "${1:-}" in
  "" ) ;;
  -h|--help)
    usage
    exit 0
    ;;
  *)
    usage >&2
    exit 1
    ;;
esac

require_command awk
require_command docker
require_command mktemp
require_command openssl
docker compose version >/dev/null

if ! [[ "${WAIT_SECONDS}" =~ ^[1-9][0-9]*$ ]]; then
  echo "❌ PKELO_CERT_WAIT_SECONDS는 양의 정수여야 합니다." >&2
  exit 1
fi

cd "${SOURCE_REPO_ROOT}"
export PKPKDUPR_DEPLOY_PATH="${DEPLOY_ROOT}"
require_file "${SHARED_ENV_FILE}"
require_file "${PKELO_ENV_FILE}"

PKELO_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" DOMAIN)"
PKELO_DOMAIN="${PKELO_DOMAIN:-pkelo.app}"
PKELO_ADMIN_DOMAIN="$(read_env_value "${PKELO_ENV_FILE}" ADMIN_DOMAIN)"
PKELO_CLOUDFLARE_TOKEN="$(read_env_value "${PKELO_ENV_FILE}" CLOUDFLARE_DNS_API_TOKEN)"
require_env_value "CLOUDFLARE_DNS_API_TOKEN" "${PKELO_CLOUDFLARE_TOKEN}"
require_env_value "ADMIN_DOMAIN" "${PKELO_ADMIN_DOMAIN}"

write_cloudflare_credentials
compose_certificate up -d
wait_for_certificate
verify_certificate_hosts
