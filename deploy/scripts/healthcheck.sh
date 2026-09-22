#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"
GROUP="${1:-all}"
BASE_URL="${2:-http://127.0.0.1}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all} [base-url]"
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  # shellcheck disable=SC1090
  source "${ENV_FILE}"
fi

NODE2_PORT="${NODE2_PORT:-3002}"
CHAT_WEB_PORT="${CHAT_WEB_PORT:-3001}"

check_node_group() {
  echo "Checking ${BASE_URL}:${NODE2_PORT}/health"
  curl --fail --silent "${BASE_URL}:${NODE2_PORT}/health" >/dev/null
}

check_web_group() {
  echo "Checking ${BASE_URL}:${CHAT_WEB_PORT}"
  curl --fail --silent "${BASE_URL}:${CHAT_WEB_PORT}" >/dev/null
}

check_java_group() {
  local ports=(18081 18082 18083 18084 18085 18086 18087 18088 18089)
  local port
  for port in "${ports[@]}"; do
    echo "Checking ${BASE_URL}:${port}/internal/health"
    curl --fail --silent "${BASE_URL}:${port}/internal/health" >/dev/null
  done
}

case "${GROUP}" in
  web)
    check_web_group
    ;;
  cms)
    echo "Group 'cms' currently has no deployable services configured."
    ;;
  node)
    check_node_group
    ;;
  java)
    check_java_group
    ;;
  all)
    check_web_group
    check_node_group
    check_java_group
    ;;
esac

echo "Health check passed for group '${GROUP}'."
