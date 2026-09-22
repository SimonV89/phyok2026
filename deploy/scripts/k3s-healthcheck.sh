#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

GROUP="${1:-all}"
NAMESPACE="${K8S_NAMESPACE:-phyok}"
DISK_ALERT_THRESHOLD_PERCENT="${DISK_ALERT_THRESHOLD_PERCENT:-85}"
MEM_ALERT_THRESHOLD_PERCENT="${MEM_ALERT_THRESHOLD_PERCENT:-90}"
RESTART_ALERT_THRESHOLD="${RESTART_ALERT_THRESHOLD:-3}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all}"
  exit 1
fi

if [[ -f "${ENV_FILE}" ]]; then
  load_env_file_exports "${ENV_FILE}"
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required."
  exit 1
fi

tmp_report="$(mktemp)"
cleanup() {
  rm -f "${tmp_report}"
}
trap cleanup EXIT

failures=()

append_failure() {
  local message="$1"
  failures+=("${message}")
  printf '%s\n' "${message}" >> "${tmp_report}"
}

workloads=()
while IFS= read -r workload; do
  [[ -n "${workload}" ]] && workloads+=("${workload}")
done < <(group_k8s_workloads "${GROUP}")

if [[ ${#workloads[@]} -eq 0 ]]; then
  echo "Group '${GROUP}' currently has no k3s workloads configured."
  exit 0
fi

for workload in "${workloads[@]}"; do
  desired="$(kubectl get deployment "${workload}" -n "${NAMESPACE}" -o jsonpath='{.spec.replicas}' 2>/dev/null || echo 0)"
  ready="$(kubectl get deployment "${workload}" -n "${NAMESPACE}" -o jsonpath='{.status.readyReplicas}' 2>/dev/null || echo 0)"
  desired="${desired:-0}"
  ready="${ready:-0}"
  if [[ "${ready}" != "${desired}" ]]; then
    append_failure "Deployment ${workload} not ready: ready=${ready}, desired=${desired}"
  fi

  restart_count="$(kubectl get pods -n "${NAMESPACE}" -l "app=${workload}" --no-headers 2>/dev/null | awk '{sum += $4} END {print sum+0}')"
  if [[ "${restart_count:-0}" -ge "${RESTART_ALERT_THRESHOLD}" ]]; then
    append_failure "Deployment ${workload} restart count is high: ${restart_count}"
  fi
done

disk_used_percent="$(df -P "${ROOT_DIR}" | awk 'NR==2 {gsub("%","",$5); print $5}')"
if [[ -n "${disk_used_percent}" && "${disk_used_percent}" -ge "${DISK_ALERT_THRESHOLD_PERCENT}" ]]; then
  append_failure "Disk usage is high: ${disk_used_percent}%"
fi

if command -v free >/dev/null 2>&1; then
  mem_used_percent="$(free | awk '/Mem:/ { if ($2 > 0) printf("%d", ($3 * 100) / $2); }')"
  if [[ -n "${mem_used_percent}" && "${mem_used_percent}" -ge "${MEM_ALERT_THRESHOLD_PERCENT}" ]]; then
    append_failure "Memory usage is high: ${mem_used_percent}%"
  fi
fi

if [[ ${#failures[@]} -gt 0 ]]; then
  "${SCRIPT_DIR}/alert.sh" "${GROUP}" "[phyok][k3s] healthcheck failed" "${tmp_report}" || true
  cat "${tmp_report}"
  exit 1
fi

echo "k3s health check passed for group '${GROUP}'."
