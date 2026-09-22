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

cd "${ROOT_DIR}"
if git rev-parse --show-toplevel >/dev/null 2>&1; then
  git pull --ff-only
else
  echo "Skip git pull: ${ROOT_DIR} is not a git repository."
fi

run_compose_group_up "${GROUP}"

echo "Update finished for group '${GROUP}'."
echo "Services: $(services_csv_for_message "${GROUP}")"
