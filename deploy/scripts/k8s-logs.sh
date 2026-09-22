#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"
GROUP="${1:-all}"
WORKLOAD="${2:-}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all} [deployment-name]"
  exit 1
fi

if [[ -n "${WORKLOAD}" ]]; then
  kubectl logs -n phyok deployment/"${WORKLOAD}" -f --tail=200
  exit 0
fi

workloads=()
while IFS= read -r workload; do
  [[ -n "${workload}" ]] && workloads+=("${workload}")
done < <(group_k8s_workloads "${GROUP}")
if [[ ${#workloads[@]} -eq 0 ]]; then
  echo "Group '${GROUP}' currently has no k8s workloads configured."
  exit 0
fi

for workload in "${workloads[@]}"; do
  echo "===== ${workload} ====="
  kubectl logs -n phyok deployment/"${workload}" --tail=50 || true
done
