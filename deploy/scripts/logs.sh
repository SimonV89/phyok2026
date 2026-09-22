#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"
GROUP="${1:-all}"
SERVICE_NAME="${2:-}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all} [service-name]"
  exit 1
fi

require_env_file
run_compose_group_logs "${GROUP}" "${SERVICE_NAME}"
