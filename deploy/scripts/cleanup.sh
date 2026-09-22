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

services=()
while IFS= read -r service; do
  [[ -n "${service}" ]] && services+=("${service}")
done < <(group_services "${GROUP}")
if [[ ${#services[@]} -gt 0 ]]; then
  cd "${ROOT_DIR}/deploy/compose"
  docker compose --env-file "${ENV_FILE}" -f "${COMPOSE_FILE}" rm -fsv "${services[@]}" || true
fi

docker image prune -f
docker volume prune -f
docker builder prune -f

echo "Cleanup finished for group '${GROUP}'."
