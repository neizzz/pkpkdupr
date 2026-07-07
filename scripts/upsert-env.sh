#!/usr/bin/env bash

set -euo pipefail

if [[ $# -ne 3 ]]; then
  echo "usage: $0 <env-file> <key> <value>" >&2
  exit 1
fi

ENV_FILE="$1"
KEY="$2"
VALUE="$3"

if [[ ! -f "${ENV_FILE}" ]]; then
  touch "${ENV_FILE}"
fi

TMP_FILE="$(mktemp)"

awk -v key="${KEY}" -v value="${VALUE}" '
BEGIN { updated = 0 }
$0 ~ ("^" key "=") {
  print key "=" value
  updated = 1
  next
}
{ print }
END {
  if (updated == 0) {
    print key "=" value
  }
}
' "${ENV_FILE}" > "${TMP_FILE}"

mv "${TMP_FILE}" "${ENV_FILE}"
