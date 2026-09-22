#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PUBLIC_HOST="${PUBLIC_HOST:-www.phyok.com}"

if ! command -v kubectl >/dev/null 2>&1; then
  echo "kubectl is required."
  exit 1
fi

if ! command -v k3s >/dev/null 2>&1; then
  echo "k3s is required. Run ${SCRIPT_DIR}/k3s-install-host-nginx.sh first."
  exit 1
fi

bash "${SCRIPT_DIR}/k3s-load-images.sh" web
bash "${SCRIPT_DIR}/k3s-load-images.sh" node
bash "${SCRIPT_DIR}/k3s-load-images.sh" java
PUBLIC_HOST="${PUBLIC_HOST}" bash "${SCRIPT_DIR}/k3s-deploy.sh" all

cat <<EOF

Project deployed to k3s.
- host: ${PUBLIC_HOST}
- ingress upstream for host nginx: http://127.0.0.1:${K3S_INGRESS_HTTP_NODEPORT:-30080}

Useful commands:
- kubectl get pods -n phyok
- ${SCRIPT_DIR}/k8s-logs.sh all
- ${SCRIPT_DIR}/k3s-healthcheck.sh all
EOF
