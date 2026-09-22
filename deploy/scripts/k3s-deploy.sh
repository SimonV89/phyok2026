#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "${SCRIPT_DIR}/common.sh"

GROUP="${1:-all}"
PUBLIC_HOST="${PUBLIC_HOST:-api.phyok.local}"

if ! group_exists "${GROUP}"; then
  echo "Usage: $0 {web|cms|node|java|all}"
  exit 1
fi

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required."
  exit 1
fi

"${SCRIPT_DIR}/k8s-apply-env.sh"

case "${GROUP}" in
  web)
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/apps/web-services.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/ingress/platform-ingress.yaml"
    ;;
  cms)
    echo "Group '${GROUP}' currently has no k3s manifests configured."
    exit 0
    ;;
  node)
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/apps/node-services.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/ingress/platform-ingress.yaml"
    ;;
  java)
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/postgres/postgres.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/redis/redis.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/kafka/kafka.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/qdrant/qdrant.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/apps/java-services.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/ingress/platform-ingress.yaml"
    ;;
  all)
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/postgres/postgres.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/redis/redis.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/kafka/kafka.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/qdrant/qdrant.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/apps/web-services.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/apps/node-services.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/apps/java-services.yaml"
    kubectl apply -n phyok -f "${ROOT_DIR}/deploy/k8s/base/ingress/platform-ingress.yaml"
    ;;
esac

kubectl patch ingress phyok-platform-ingress -n phyok --type json -p "[{\"op\":\"replace\",\"path\":\"/spec/rules/0/host\",\"value\":\"${PUBLIC_HOST}\"}]" || true

workloads=()
while IFS= read -r workload; do
  [[ -n "${workload}" ]] && workloads+=("${workload}")
done < <(group_k8s_workloads "${GROUP}")
for workload in "${workloads[@]}"; do
  kubectl scale deployment/"${workload}" -n phyok --replicas=1 || true
  kubectl rollout status deployment/"${workload}" -n phyok --timeout=180s || true
done

echo "k3s deploy finished for group '${GROUP}' with host '${PUBLIC_HOST}'."
