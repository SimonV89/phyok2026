#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"
GROUP="${1:-all}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all}"
  exit 1
fi

require_env_file
run_compose_group_up "${GROUP}"

echo "Deployment started for group '${GROUP}'."
echo "Services: $(services_csv_for_message "${GROUP}")"
echo "Health check: ${ROOT_DIR}/deploy/scripts/healthcheck.sh ${GROUP}"
echo "Logs: ${ROOT_DIR}/deploy/scripts/logs.sh ${GROUP}"
