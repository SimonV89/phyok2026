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

cd "${ROOT_DIR}"
"${SCRIPT_DIR}/k8s-apply-env.sh"

case "${GROUP}" in
  web)
    kubectl apply -f deploy/k8s/base/apps/web-services.yaml
    kubectl apply -f deploy/k8s/base/ingress/platform-ingress.yaml
    ;;
  cms)
    echo "Group '${GROUP}' currently has no k8s manifests configured."
    ;;
  node)
    kubectl apply -f deploy/k8s/base/apps/node-services.yaml
    kubectl apply -f deploy/k8s/base/ingress/platform-ingress.yaml
    ;;
  java)
    kubectl apply -f deploy/k8s/base/postgres/postgres.yaml
    kubectl apply -f deploy/k8s/base/redis/redis.yaml
    kubectl apply -f deploy/k8s/base/kafka/kafka.yaml
    kubectl apply -f deploy/k8s/base/qdrant/qdrant.yaml
    kubectl apply -f deploy/k8s/base/apps/java-services.yaml
    kubectl apply -f deploy/k8s/base/apps/java-autoscaling.yaml
    kubectl apply -f deploy/k8s/base/apps/java-pdb.yaml
    kubectl apply -f deploy/k8s/base/ingress/platform-ingress.yaml
    ;;
  all)
    kubectl apply -f deploy/k8s/base/postgres/postgres.yaml
    kubectl apply -f deploy/k8s/base/redis/redis.yaml
    kubectl apply -f deploy/k8s/base/kafka/kafka.yaml
    kubectl apply -f deploy/k8s/base/qdrant/qdrant.yaml
    kubectl apply -f deploy/k8s/base/apps/web-services.yaml
    kubectl apply -f deploy/k8s/base/apps/node-services.yaml
    kubectl apply -f deploy/k8s/base/apps/java-services.yaml
    kubectl apply -f deploy/k8s/base/apps/java-autoscaling.yaml
    kubectl apply -f deploy/k8s/base/apps/java-pdb.yaml
    kubectl apply -f deploy/k8s/base/ingress/platform-ingress.yaml
    ;;
esac

echo "k8s apply finished for group '${GROUP}'."
