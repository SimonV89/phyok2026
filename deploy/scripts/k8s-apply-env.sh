#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

NAMESPACE="${K8S_NAMESPACE:-phyok}"
CONFIGMAP_NAME="${K8S_PLATFORM_CONFIGMAP_NAME:-phyok-platform-config}"
SECRET_NAME="${K8S_PLATFORM_SECRET_NAME:-phyok-platform-secret}"
CONFIGMAP_FILE="${ROOT_DIR}/deploy/k8s/base/configmap/platform-configmap.yaml"
NAMESPACE_FILE="${ROOT_DIR}/deploy/k8s/base/namespace/namespace.yaml"

require_env_file

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required."
  exit 1
fi

tmp_env_file="$(mktemp)"
cleanup() {
  rm -f "${tmp_env_file}"
}
trap cleanup EXIT

set -a
# shellcheck disable=SC1090
source "${ENV_FILE}"
set +a

key_count=0
while IFS= read -r key; do
  [[ -z "${key}" ]] && continue
  printf '%s=%s\n' "${key}" "${!key-}" >> "${tmp_env_file}"
  key_count=$((key_count + 1))
done < <(
  awk -F= '
    /^[A-Za-z_][A-Za-z0-9_]*=/ { keys[++count] = $1 }
    END {
      for (i = count; i >= 1; i--) {
        if (!seen[keys[i]]++) {
          ordered[++ordered_count] = keys[i]
        }
      }
      for (i = ordered_count; i >= 1; i--) {
        print ordered[i]
      }
    }
  ' "${ENV_FILE}"
)

kubectl apply -f "${NAMESPACE_FILE}"
kubectl apply -n "${NAMESPACE}" -f "${CONFIGMAP_FILE}"
kubectl create secret generic "${SECRET_NAME}" \
  -n "${NAMESPACE}" \
  --from-env-file="${tmp_env_file}" \
  --dry-run=client -o yaml | kubectl apply -f -

echo "Applied ConfigMap '${CONFIGMAP_NAME}' and Secret '${SECRET_NAME}' from ${ENV_FILE} (${key_count} keys)."
